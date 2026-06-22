import SHADER from './assets/shader.wgsl'

import {
  DecryptParams,
  EncryptParams,
  aesEncrypt,
  fillRandomBytes,
} from './util'

const WORKGROUP_SIZE = 64
const ILP_FACTOR = 4

const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent)
const MAX_DISPATCH_MS = IS_MOBILE ? 200 : 1000


/** total iterations per second (H/s) */
export let speed = 0
export let percent = 0

export async function start(params: EncryptParams) {
  const plaintext = params.plaintext
  const cost = BigInt(params.cost) * 1000000000n
  if (cost < 1n) {
    throw Error('cost must be >= 1')
  }

  let thread = params.thread
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

  const seeds = new BigUint64Array(thread)
  fillRandomBytes(seeds.buffer)

  // Degenerate seeds (0, 0x80000000_00000000, 0x00000000_80000000, 0x80000000_80000000)
  // have short cycles, but the probability is 4/2^64. A degenerate seed
  // only breaks sequential hardness for its own slow_hash output and does
  // not weaken the chain and the final AES key.

  const gpu = await getGpuDevice()
  if (!gpu) {
    throw Error('WebGPU is not available')
  }
  gpu.addEventListener('uncapturederror', e => {
    console.warn(e.error.message)
  })

  const constants = params.constants
  const code = SHADER
    .replace(/__C(\d+)__/g, (_, i) => constants[+i - 1] + '')
    .replace('__WORKGROUP_SIZE__', WORKGROUP_SIZE + '')

  const module = gpu.createShaderModule({code})
  await module.getCompilationInfo()

  const pipeline = gpu.createComputePipeline({
    layout: 'auto',
    compute: {
      module,
    },
  })

  // input params (aligned to 16 bytes)
  const enum ID {
    ITERATIONS,
  }
  const uniformParams = new Uint32Array(4)

  const uniformParamsBuffer = gpu.createBuffer({
    size: uniformParams.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const seedBuffer = gpu.createBuffer({
    size: seeds.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  })
  const hashReadback = gpu.createBuffer({
    size: seeds.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })

  const gpuThreadCount = thread / ILP_FACTOR

  const countBuffer = gpu.createBuffer({
    size: gpuThreadCount * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  })
  const countReadback = gpu.createBuffer({
    size: gpuThreadCount * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })

  const bindGroup = gpu.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformParamsBuffer } },
      { binding: 1, resource: { buffer: seedBuffer } },
      { binding: 2, resource: { buffer: countBuffer } },
    ],
  })
  gpu.queue.writeBuffer(seedBuffer, 0, seeds)


  const costPerThread = Number(cost / BigInt(thread))
  let remaining = costPerThread
  let iterationsPerBatch = 1e4
  let lastRate = 0
  let dispatchCount = 0

  while (remaining > 0) {
    dispatchCount++
    uniformParams[ID.ITERATIONS] = Math.min(iterationsPerBatch, remaining)
    gpu.queue.writeBuffer(uniformParamsBuffer, 0, uniformParams)

    const cmd = gpu.createCommandEncoder()
    const pass = cmd.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(gpuThreadCount / WORKGROUP_SIZE)
    pass.end()
    gpu.queue.submit([cmd.finish()])

    const t0 = performance.now()
    await gpu.queue.onSubmittedWorkDone()
    const t1 = performance.now()

    const elapsedMs = Math.max(t1 - t0, 0.01)
    const currentRate = elapsedMs / iterationsPerBatch

    // detect GPU timeout: verify all threads completed expected dispatch count
    if (currentRate < lastRate * 0.3) {
      const completed = await readDispatchCounts(gpu, countBuffer, countReadback, gpuThreadCount, dispatchCount)
      if (completed < gpuThreadCount) {
        if (completed >= 0) {
          const failedCount = gpuThreadCount - completed
          console.warn(`GPU timeout: ${failedCount} workgroups incomplete at dispatch ${dispatchCount}`)
        }
        break
      }
    }
    lastRate = currentRate

    remaining -= iterationsPerBatch
    percent = 1 - remaining / costPerThread

    const threadRate = iterationsPerBatch / elapsedMs

    // grow batch size: double, but never exceed the GPU watchdog time limit
    const maxByTime = Math.ceil(threadRate * MAX_DISPATCH_MS)
    const maxByGrowth = iterationsPerBatch * 2

    iterationsPerBatch = Math.min(maxByTime, maxByGrowth, 1e8)

    // update property for UI display
    speed = threadRate * thread * 1000
  }

  // verify all batches completed
  const finalCompleted = await readDispatchCounts(gpu, countBuffer, countReadback, gpuThreadCount, dispatchCount)
  if (finalCompleted < gpuThreadCount) {
    throw Error('GPU computation incomplete. Try reducing thread count.')
  }

  const cmd = gpu.createCommandEncoder()
  cmd.copyBufferToBuffer(seedBuffer, 0, hashReadback, 0, hashReadback.size)
  gpu.queue.submit([cmd.finish()])

  await hashReadback.mapAsync(GPUMapMode.READ)
  const hashes = new BigUint64Array(hashReadback.getMappedRange())

  // encrypt original seeds using hashes
  let key = 0n

  for (let p = 0; p < thread; p++) {
    seeds[p] ^= key
    key ^= hashes[p]
  }

  // Each slow_hash output is 64 bits, insufficient for AES-256's 256-bit key.
  // SHA-256 aggregates all hash outputs into a single 256-bit key, ensuring
  // every hash contributes to the final key material.
  const aesKey = await crypto.subtle.digest('SHA-256', hashes)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await aesEncrypt(plaintext, aesKey, iv)

  percent = 1

  hashReadback.unmap()
  gpu.destroy()

  const output: DecryptParams = {
    cost: params.cost,
    seedNum: thread,
    seedData: new Uint8Array(seeds.buffer),
    ciphertext,
    iv,
    constants: constants.slice(0),
  }
  return output
}

export async function init() {
  const device = await getGpuDevice()
  if (!device) {
    return false
  }
  return true
}

async function getGpuDevice() {
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  })
  if (adapter) {
    const device = await adapter.requestDevice()
    return device
  }
}

/**
 * Read per-thread dispatch counts from GPU and return the number of threads
 * that match the expected count. Returns -1 on I/O failure.
 */
async function readDispatchCounts(
  gpu: GPUDevice,
  countBuffer: GPUBuffer,
  countReadback: GPUBuffer,
  threadCount: number,
  expected: number,
) {
  try {
    const cmd = gpu.createCommandEncoder()
    cmd.copyBufferToBuffer(countBuffer, 0, countReadback, 0, threadCount * 4)
    gpu.queue.submit([cmd.finish()])

    await countReadback.mapAsync(GPUMapMode.READ)
    const counts = new Uint32Array(countReadback.getMappedRange())

    let completed = 0
    for (let i = 0; i < threadCount; i++) {
      if (counts[i] === expected) {
        completed++
      }
    }
    countReadback.unmap()
    return completed
  } catch {
    return -1
  }
}
