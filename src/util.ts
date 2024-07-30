export const enum SIZE {
  HASH = 32,
  SALT = 12,
  SALT_WITH_ID = SALT + 4,
  PIXEL = 16,
  CTX = 128,
}

export const enum NUM {
  ITER_PER_LOOP = 1e7
}

export type EncryptParams = {
  plain: Uint8Array
  cost: number
  seedLen: number
  cpuThread: number
  gpuThread: number
}

export type EncryptNode = {
  name: string
  iter: number
  seedNum: number
  seedLen: number
  seeds: Uint8Array
  salt: Uint8Array
}

export type DecryptParams = {
  cost: number
  cipher: Uint8Array
  nodes: EncryptNode[]
}

export async function aesEncrypt(plain: Uint8Array, key: Uint8Array, iv: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const buf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, plain)
  return new Uint8Array(buf)
}

export async function aesDecrypt(cipher: Uint8Array, key: Uint8Array, iv: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  const buf = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, k, cipher)
  return new Uint8Array(buf)
}

export function fillRandomBytes(buf: Uint8Array) {
  for (let i = 0; i < buf.length; i += 65536) {
    const slice = buf.subarray(i, i + 65536)
    crypto.getRandomValues(slice)
  }
}

export function xorBuf(dst: Uint8Array, src: Uint8Array, len: number) {
  for (let i = 0; i < len; i++) {
    dst[i] ^= src[i]
  }
}

export function indexBuf(buf: Uint8Array, sliceLen: number, index: number) {
  const offset = index * sliceLen
  return buf.subarray(offset, offset + sliceLen)
}

export function cloneBuf(buf: Uint8Array) {
  return buf.slice(0)
}

export function concatBuf(bufs: Uint8Array[], size: number) {
  const ret = new Uint8Array(size)
  let pos = 0
  for (const v of bufs) {
    ret.set(v, pos)
    pos += v.length
  }
  return ret
}

export function sleep(ms: number) {
  return new Promise(fn => {
    setTimeout(fn, ms)
  })
}

export function isUint(value: number) {
  return value === Math.floor(value)
}

export function isPositiveInt(value: number) {
  return value > 0 && isUint(value)
}

export function isPowerOf2(value: number) {
  return (value & (value - 1)) === 0
}

export async function readCache(url: string) {
  const cache = await caches.open('timelock')
  return await cache.match(url)
}

export async function writeCache(url: string, data: BodyInit) {
  const cache = await caches.open('timelock')
  const res = new Response(data)
  await cache.put(url, res)
}
