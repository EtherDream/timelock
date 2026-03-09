import SHADER from './assets/shader.wgsl'
import * as wasm from './wasm'

import {
  SIZE,
  MAX_ITER_PER_PBKDF2,
  DecryptParams,
  EncryptParams,

  aesEncrypt,
  fillRandomBytes,
  getBlockByIndex,
  // cloneBuf,
  xorBuf,
} from './util'


async function getGpuDevice() {
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  })
  if (adapter) {
    const device = await adapter.requestDevice()
    return device
  }
}

export async function init() {
  const device = await getGpuDevice()
  if (!device) {
    return false
  }
  wasm.init()
  return true
}

/** @workgroup_size() in shader.wgsl */
const WORKGROUP_SIZE = 64

export async function start(
  params: EncryptParams,
  onProgress: (percent: number, hashPerSec: number) => void
) {
  const plain = params.plain
  const cost = params.cost
  const seedLen = params.seedLen
  let thread = params.thread

  if (cost < 1) {
    throw Error('cost must be >= 1')
  }
  if (seedLen <= 0 || seedLen > 32) {
    throw Error('seedLen must in [1, 32]')
  }
  if (thread < WORKGROUP_SIZE) {
    thread = WORKGROUP_SIZE
  }
  if (thread > 131072) {
    thread = 131072
  }
  if (thread % WORKGROUP_SIZE) {
    thread = Math.ceil(thread / WORKGROUP_SIZE) * WORKGROUP_SIZE
    console.log('thread rounded up to:', thread)
  }

  const workgroupNum = thread / WORKGROUP_SIZE

  const startCtxBuf = wasm.getStartCtxBuf(thread)
  const ctxWBuf = wasm.getCtxWBuf(thread)
  const ctxRBuf = wasm.getCtxRBuf(thread)
  const ioBuf = wasm.getIoBuf(thread)

  const salt = wasm.getSaltBuf()
  fillRandomBytes(salt)

  const seeds = new Uint8Array(thread * seedLen)
  fillRandomBytes(seeds)

  ioBuf.set(seeds)

  const gpu = await getGpuDevice()
  if (!gpu) {
    return
  }
  gpu.addEventListener('uncapturederror', e => {
    // console.warn(e.error.message)
  })

  const module = gpu.createShaderModule({
    code: SHADER,
  })
  await module.getCompilationInfo()

  const pipeline = gpu.createComputePipeline({
    layout: 'auto',
    compute: {
      module,
    }
  })

  // input params
  // (read-only, aligned to 16 bytes)
  const enum ID {
    STEP,
  }
  const uniformParams = new Uint32Array(4)

  const gpuUniformParams = gpu.createBuffer({
    size: uniformParams.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  // start_ctx.inner.state and start_ctx.outer.state
  // (read-only)
  const gpuStartCtx = gpu.createBuffer({
    size: startCtxBuf.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  // sha256 words
  const gpuCtxW = gpu.createBuffer({
    size: ctxWBuf.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  })

  // result
  const gpuCtxR = gpu.createBuffer({
    size: ctxRBuf.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  })

  const bindGroup = gpu.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: gpuUniformParams } },
      { binding: 1, resource: { buffer: gpuStartCtx } },
      { binding: 2, resource: { buffer: gpuCtxW } },
      { binding: 3, resource: { buffer: gpuCtxR } },
    ],
  })
  const readbackGpuBuf = gpu.createBuffer({
    size: ctxRBuf.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })

  // 1 cost = 1M Hash
  const hashNum = cost * 1e6

  // PBKDF2 performs SHA256 twice in each iteration
  const iterTotal = hashNum / 2

  // number of iterations required per seed
  const iterMax = Math.ceil(iterTotal / thread)

  // number of iterations completed per seed
  let iterCur = 0
 
  // iteration step of each GPU execution
  let step = 500

  const pbkdf2Times = Math.ceil(iterMax / MAX_ITER_PER_PBKDF2)
  const pbkdf2Iter = Math.ceil(iterMax / pbkdf2Times)

  let seq = 0
  wasm.pbkdf2Pre(thread, seedLen, seq)

  for (seq = 1; seq <= pbkdf2Times; seq++) {
    let remainPbkdf2Iter = pbkdf2Iter

    gpu.queue.writeBuffer(gpuStartCtx, 0, startCtxBuf)
    gpu.queue.writeBuffer(gpuCtxW, 0, ctxWBuf)
    gpu.queue.writeBuffer(gpuCtxR, 0, ctxRBuf)

    // Split a single PBKDF2 into multiple calls to
    // prevent a single call from taking too long on the GPU.
    do {
      if (step > remainPbkdf2Iter) {
        step = remainPbkdf2Iter
      }
      // 1x iter => 2x hash
      uniformParams[ID.STEP] = step * 2
      gpu.queue.writeBuffer(gpuUniformParams, 0, uniformParams)

      const cmd = gpu.createCommandEncoder()
      const pass = cmd.beginComputePass()
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.dispatchWorkgroups(workgroupNum)
      pass.end()

      cmd.copyBufferToBuffer(gpuCtxR, 0, readbackGpuBuf, 0, readbackGpuBuf.size)
      gpu.queue.submit([cmd.finish()])

      const t0 = performance.now()
      await gpu.queue.onSubmittedWorkDone()
      const t1 = performance.now()

      remainPbkdf2Iter -= step
      iterCur += step

      // update step to keep each call takes ~1s
      const stepPerMs = step / Math.max(t1 - t0, 0.01)
      step = Math.ceil(stepPerMs * 1000)

      onProgress(iterCur / iterMax, step * thread * 2)
    } while (remainPbkdf2Iter)


    await readbackGpuBuf.mapAsync(GPUMapMode.READ)
    const readbackJsBuf = readbackGpuBuf.getMappedRange()
  
    ctxRBuf.set(new Uint8Array(readbackJsBuf))
    readbackGpuBuf.unmap()

    wasm.pbkdf2Post(thread)

    if (seq < pbkdf2Times) {
      // output as next input
      wasm.pbkdf2Pre(thread, SIZE.HASH, seq)
    }
  }
  gpu.destroy()

  //
  // encrypt seeds and generate key
  //
  const key = new Uint8Array(SIZE.HASH)

  for (let p = 0; p < thread; p++) {
    const seed = getBlockByIndex(seeds, seedLen, p)
    xorBuf(seed, key, seedLen)

    const hash = getBlockByIndex(ioBuf, SIZE.HASH, p)
    xorBuf(key, hash, SIZE.HASH)
  }

  const cipher = await aesEncrypt(plain, key, new Uint8Array(16))
  const output: DecryptParams = {
    cost,
    cipher,
    salt,
    seedNum: thread,
    seedLen,
    seeds,
  }
  return output
}
