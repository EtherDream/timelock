import {
  SIZE,
  NUM,
  DecryptParams,
  EncryptParams,
  EncryptNode,

  readCache,
  writeCache,
  aesEncrypt,
  fillRandomBytes,
  isPositiveInt,
  isUint,
  isPowerOf2,
  indexBuf,
  cloneBuf,
  xorBuf,
} from './util'

import * as encryptCpu from './encrypt-cpu'
import * as encryptWebGl from './encrypt-webgl'
import * as wasm from './wasm'


export type BenchmarkInfo = {
  cpuThread: number
  gpuThread: number
  cpuHashPerSec: number
  gpuHashPerSec: number
}
let benchmarkInfo: BenchmarkInfo | undefined

const BENCHMARK_FILE = '/.timelock/benchmark.json'


async function readInfo() {
  const res = await readCache(BENCHMARK_FILE)
  if (!res) {
    return
  }
  let info: BenchmarkInfo
  try {
    info = await res.json()
  } catch {
    console.warn('invalid benchmark cache')
    return
  }
  if (typeof info === 'object' &&
    isPositiveInt(info.cpuThread) &&
    isPositiveInt(info.cpuHashPerSec) &&
    isUint(info.gpuThread) &&
    isUint(info.gpuHashPerSec)
  ) {
    return info
  }
}

async function saveInfo(info: BenchmarkInfo) {
  const data = JSON.stringify(info)
  await writeCache(BENCHMARK_FILE, data)
}


const enum Status {
  NONE,
  INITING,
  READY,
  BENCHMARKING,
  RUNNING,
  PAUSED,
}
let status: Status = Status.NONE
let gpuAvailable = true


export async function init() {
  if (status !== Status.NONE) {
    return
  }
  status = Status.INITING

  await wasm.init()
  const errMsg = await encryptWebGl.init()
  if (errMsg) {
    console.warn('init webgl error:', errMsg)
    gpuAvailable = false
  }
  benchmarkInfo = await readInfo()

  status = Status.READY
}

export function isGpuAvailable() {
  return gpuAvailable
}

export async function benchmark(
  onProgress: (info: BenchmarkInfo) => void
) {
  if (status !== Status.READY) {
    return
  }
  status = Status.BENCHMARKING

  const info: BenchmarkInfo = {
    cpuThread: 0,
    gpuThread: 0,
    cpuHashPerSec: 0,
    gpuHashPerSec: 0,
  }

  await encryptCpu.benchmark((iterPerMs, thread) => {
    info.cpuHashPerSec = iterPerMs * 1000 * 2
    info.cpuThread = thread
    onProgress(info)
  })

  if (gpuAvailable) {
    await encryptWebGl.benchmark((iterPerMs, thread) => {
      info.gpuHashPerSec = iterPerMs * 1000 * 2
      info.gpuThread = thread
      onProgress(info)
    })
  }

  await saveInfo(info)
  benchmarkInfo = info

  status = Status.READY
}

export function getBenchmarkInfo() {
  return benchmarkInfo
}

export function pause() {
  if (status !== Status.RUNNING) {
    return
  }
  status = Status.PAUSED
  encryptCpu.pause()
  encryptWebGl.pause()
}

export function resume() {
  if (status !== Status.PAUSED) {
    return
  }
  status = Status.RUNNING
  encryptCpu.resume()
  encryptWebGl.resume()
}

export function stop() {
  if (status !== Status.RUNNING) {
    return
  }
  status = Status.READY
  encryptCpu.stop()
  encryptWebGl.stop()
}

export async function start(
  params: EncryptParams,
  onProgress: (percent: number) => boolean
) {
  if (status !== Status.READY) {
    throw Error('invalid status')
  }
  if (!benchmarkInfo) {
    await benchmark(() => {})
  }
  status = Status.RUNNING

  const plain = params.plain
  const cost = params.cost
  const seedLen = params.seedLen | 0

  let cpuThread = params.cpuThread | 0
  let gpuThread = params.gpuThread | 0

  if (!gpuAvailable) {
    gpuThread = 0
  }
  if (cpuThread < 0) {
    throw Error('cpuThread must be >= 0')
  }
  if (gpuThread < 0) {
    throw Error('gpuThread must be >= 0')
  }
  if (cpuThread + gpuThread === 0) {
    throw Error('no available thread')
  }
  if (cost < 1) {
    throw Error('cost must be >= 1')
  }
  if (seedLen <= 0 || seedLen > 32) {
    throw Error('seedLen must in [1, 32]')
  }

  if (gpuThread && gpuThread < 32) {
    gpuThread = 32
  }
  if (!isPowerOf2(gpuThread)) {
    gpuThread = 1 << Math.log2(gpuThread)
  }
  if (cpuThread > 512) {
    cpuThread = 512
  }
  if (gpuThread > 65536) {
    gpuThread = 65536
  }
  const totalThread = gpuThread + cpuThread

  // 1 cost = 1 Mhash
  // 1 hash = 0.5 iter
  const iter = Math.round(cost * 1e6 / 2)

  const {cpuHashPerSec, gpuHashPerSec} = benchmarkInfo!
  const cpuSpeedRatio = gpuThread
    ? Math.round(cpuHashPerSec / gpuHashPerSec)
    : 1

  const sliceNum = gpuThread + cpuThread * cpuSpeedRatio
  const iterPerSlice = Math.ceil(iter / sliceNum)

  const seedsBuf = new Uint8Array(totalThread * seedLen)
  fillRandomBytes(seedsBuf)

  const encryptNodes: EncryptNode[] = []
  const hashesBuf = new Uint8Array(totalThread * SIZE.HASH)
  let gpuCrashed = false

  // `iterRounded` is slightly larger than `iter`
  const iterRounded = iterPerSlice * sliceNum
  let iterCompleted = 0

  const onIterAdded = (iterAdded: number) => {
    iterCompleted += iterAdded
    onProgress(iterCompleted / iterRounded)
  }

  const startGpuTask = async () => {
    if (gpuThread === 0) {
      return
    }
    console.time('gpu encryption')

    const gpuSalt = wasm.getSaltBuf()
    fillRandomBytes(gpuSalt)

    const INTERVAL = 25
    const iterPerMs = gpuHashPerSec / 1000 / 2
    const iterPerDraw = iterPerMs * INTERVAL | 0

    encryptWebGl.setIterPerDraw(iterPerDraw)
    encryptWebGl.setThread(gpuThread)

    const pbkdf2Ctx = wasm.getCtxBuf(gpuThread)
    const gpuHashes = wasm.getHashesBuf(gpuThread)
    const gpuSeeds = seedsBuf.subarray(0, seedLen * gpuThread)

    gpuHashes.set(gpuSeeds)
    wasm.pbkdf2Pre(gpuThread, seedLen)

    let iterRemain = iterPerSlice

    do {
      // 1 iter has been performed at pbkdf2Pre
      const gpuIter = Math.min(iterRemain, NUM.ITER_PER_LOOP) - 1
      onIterAdded(gpuThread)

      const ctxOut = await encryptWebGl.start(pbkdf2Ctx, gpuIter, onIterAdded)
      if (!ctxOut) {
        gpuCrashed = true
        gpuAvailable = false
        break
      }
      pbkdf2Ctx.set(ctxOut)
      wasm.pbkdf2Post(gpuThread)

      // next loop
      wasm.pbkdf2Pre(gpuThread, SIZE.HASH)

      iterRemain -= NUM.ITER_PER_LOOP
    } while (iterRemain > 0)

    console.timeEnd('gpu encryption')

    if (gpuCrashed) {
      if (cpuThread) {
        encryptCpu.stop()
      }
      onProgress(-1)
      return
    }
    encryptNodes[0] = {
      name: 'GPU (WebGL)',
      iter: iterPerSlice,
      seedLen: seedLen,
      seedNum: gpuThread,
      seeds: gpuSeeds,
      salt: cloneBuf(gpuSalt),
    }
    hashesBuf.set(gpuHashes)
  }

  const startCpuTask = async () => {
    if (cpuThread === 0) {
      return
    }
    console.time('cpu encryption')

    const seedsBegin = seedLen * gpuThread
    const seedsEnd = seedLen * (gpuThread + cpuThread)
    const cpuSeeds = seedsBuf.subarray(seedsBegin, seedsEnd)

    const cpuSalt = new Uint8Array(SIZE.SALT)
    fillRandomBytes(cpuSalt)

    const cpuIter = iterPerSlice * cpuSpeedRatio
    const cpuHashes = await encryptCpu.start(
      cpuThread,
      cpuSeeds,
      seedLen,
      cpuSalt,
      cpuIter,
      onIterAdded,
    )
    console.timeEnd('cpu encryption')

    // aborted
    if (!cpuHashes) {
      return
    }
    encryptNodes[1] = {
      name: 'CPU (WebCrypto)',
      iter: cpuIter,
      seedNum: cpuThread,
      seedLen: seedLen,
      seeds: cpuSeeds,
      salt: cpuSalt,
    }
    hashesBuf.set(cpuHashes, gpuThread * SIZE.HASH)
  }

  await Promise.all([
    startGpuTask(),
    startCpuTask(),
  ])

  if (gpuCrashed) {
    status = Status.READY
    return
  }

  // encrypt seeds
  const key = new Uint8Array(SIZE.HASH)

  for (let i = 0; i < totalThread; i++) {
    const hash = indexBuf(hashesBuf, SIZE.HASH, i)
    const seed = indexBuf(seedsBuf, seedLen, i)

    xorBuf(seed, key, seedLen)
    xorBuf(key, hash, SIZE.HASH)
  }

  const cipher = await aesEncrypt(plain, key, new Uint8Array(16))
  const output: DecryptParams = {
    cost,
    cipher,
    nodes: encryptNodes.filter(v => v),
  }
  status = Status.READY
  return output
}
