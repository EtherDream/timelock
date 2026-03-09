export const enum SIZE {
  HASH = 32,
  SALT = 16,
}

// ~1 second
export const MAX_ITER_PER_PBKDF2 = 2e7


export type EncryptParams = {
  plain: Uint8Array<ArrayBuffer>
  cost: number
  seedLen: number
  thread: number
}

export type DecryptParams = {
  cost: number
  cipher: Uint8Array<ArrayBuffer>
  salt: Uint8Array<ArrayBuffer>
  seedNum: number
  seedLen: number
  seeds: Uint8Array<ArrayBuffer>
}

export async function aesEncrypt(
  plain: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>
) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const buf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, plain)
  return new Uint8Array(buf)
}

export async function aesDecrypt(
  cipher: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>
) {
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

export function getBlockByIndex(buf: Uint8Array<ArrayBuffer>, blockLen: number, index: number) {
  const offset = index * blockLen
  return buf.subarray(offset, offset + blockLen)
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
