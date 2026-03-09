import {
  SIZE,
  MAX_ITER_PER_PBKDF2,
  DecryptParams,
  xorBuf,
  getBlockByIndex,
  aesDecrypt,
} from './util'


export async function start(
  params: DecryptParams,
  onProgress: (percent: number, hashPerSec: number) => void
) {
  const {cost, seedNum, seedLen, seeds, salt} = params

  // 1 cost = 1M Hash = 0.5M iter
  const iterPerSeed = Math.ceil(cost * 1e6 / 2 / seedNum)

  const iterMax = iterPerSeed * seedNum
  let iterCur = 0

  const pbkdf2Times = Math.ceil(iterPerSeed / MAX_ITER_PER_PBKDF2)
  const pbkdf2Iter = Math.ceil(iterPerSeed / pbkdf2Times)

  const saltBin = new Uint8Array(salt.length + 8)
  saltBin.set(salt)

  const saltView = new DataView(saltBin.buffer)

  const pbkdfOpt: Pbkdf2Params = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: saltBin,
    // one more iteration during initialization
    iterations: pbkdf2Iter + 1,
  }

  async function slowHash(seed: BufferSource, p: number) {
    let chain = seed

    // salt = seed_id .. call_id
    saltView.setUint32(salt.length, p)

    for (let i = 0; i < pbkdf2Times; i++) {
      saltView.setUint32(salt.length + 4, i)

      const k = await crypto.subtle.importKey(
        'raw', chain, 'PBKDF2', false, ['deriveBits']
      )
      const t0 = performance.now()
      chain = await crypto.subtle.deriveBits(pbkdfOpt, k, SIZE.HASH * 8)
      const t1 = performance.now()

      const time = Math.max(t1 - t0, 0.01)

      // 1 iter = 2 hash
      const hashPerSec = pbkdf2Iter / time * 1000 * 2

      iterCur += pbkdf2Iter
      onProgress(iterCur / iterMax, hashPerSec)
    }

    return new Uint8Array(chain as ArrayBuffer)
  }

  // The first seed is in plaintext,
  // so XORing it with 0 leaves it unchanged.

  const key = new Uint8Array(SIZE.HASH)

  for (let p = 0; p < seedNum; p++) {
    // seedP ^= key
    const seed = getBlockByIndex(seeds, seedLen, p)
    xorBuf(seed, key, seedLen)

    // key ^= slow_hash(seedP)
    const hash = await slowHash(seed, p)
    xorBuf(key, hash, SIZE.HASH)
  }

  try {
    return await aesDecrypt(params.cipher, key, new Uint8Array(16))
  } catch {
  }
}