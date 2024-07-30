import {
  SIZE,
  NUM,
  DecryptParams,
  xorBuf,
  indexBuf,
  aesDecrypt,
  isPositiveInt,
} from './util'

let isRunning: boolean
let isStopping: boolean
let pausedSignal: Promise<void> | undefined
let resumeCallback: () => void


export async function start(
  params: DecryptParams,
  onProgress: (percent: number, hashPerSec: number) => void
) {
  if (isRunning) {
    throw Error('invalid status')
  }
  isRunning = true
  isStopping = false

  let completedIter = 0
  let totalIter = 0

  for (const item of params.nodes) {
    const {iter, seedNum, seedLen, seeds} = item

    if (!isPositiveInt(iter)) {
      throw Error('iter must be a positive integer')
    }
    if (!isPositiveInt(seedLen)) {
      throw Error('seedLen must be a positive integer')
    }
    if (!isPositiveInt(seedNum)) {
      throw Error('thread must be a positive integer')
    }
    if (seeds.length !== seedLen * seedNum) {
      throw Error('seeds.length != seedLen * thread')
    }
    totalIter += iter * seedNum
  }

  const pbkdfOpt: Pbkdf2Params = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: undefined!,
    iterations: 0,
  }

  const slowHash = async (seed: Uint8Array, iter: number) => {
    const loop = Math.ceil(iter / NUM.ITER_PER_LOOP)

    let hash = seed
    let iterRemain = iter

    for (let i = 0; i < loop; i++) {
      pbkdfOpt.iterations = Math.min(iterRemain, NUM.ITER_PER_LOOP)
      iterRemain -= NUM.ITER_PER_LOOP

      const k = await crypto.subtle.importKey(
        'raw', hash, 'PBKDF2', false, ['deriveBits']
      )
      const startTime = performance.now()
      const buf = await crypto.subtle.deriveBits(pbkdfOpt, k, SIZE.HASH * 8)
      const endTime = performance.now()

      const time = endTime - startTime
      const iterPerMs = pbkdfOpt.iterations / time
      const hashPerSec = iterPerMs * 1000 * 2

      hash = new Uint8Array(buf)

      if (pausedSignal) {
        await pausedSignal
      }
      if (isStopping) {
        break
      }
      completedIter += pbkdfOpt.iterations
      onProgress(completedIter / totalIter, hashPerSec)
    }
    return hash
  }

  // XOR'd with zero will be itself
  const key = new Uint8Array(SIZE.HASH)

  for (const item of params.nodes) {
    const {iter, seedNum, seedLen, seeds, salt} = item

    const saltIdBuf = new Uint8Array(salt.length + 4)
    const saltIdView = new DataView(saltIdBuf.buffer)

    saltIdBuf.set(salt)
    pbkdfOpt.salt = saltIdBuf

    for (let p = 0; p < seedNum; p++) {
      saltIdView.setUint32(salt.length, p)

      const seed = indexBuf(seeds, seedLen, p)
      xorBuf(seed, key, seedLen)

      const hash = await slowHash(seed, iter)
      xorBuf(key, hash, SIZE.HASH)

      if (isStopping) {
        isRunning = false
        return
      }
    }
  }

  try {
    return await aesDecrypt(params.cipher, key, new Uint8Array(16))
  } catch {
  } finally {
    isRunning = false
  }
}

export function pause() {
  pausedSignal = new Promise(resolve => {
    resumeCallback = resolve
  })
}

export function resume() {
  pausedSignal = undefined
  resumeCallback()
}

export function stop() {
  isStopping = true
}
