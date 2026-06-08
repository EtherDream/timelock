export type EncryptParams = {
  plaintext: Uint8Array<ArrayBuffer>
  cost: number
  thread: number
  constants: Uint32Array
}

export type DecryptParams = {
  cost: number
  ciphertext: Uint8Array<ArrayBuffer>
  seedNum: number
  seedData: Uint8Array<ArrayBuffer>
  constants: Uint32Array
  iv: Uint8Array<ArrayBuffer>
}

export async function aesEncrypt(
  plaintext: BufferSource,
  key: BufferSource,
  iv: BufferSource
) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const buf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, plaintext)
  return new Uint8Array(buf)
}

export async function aesDecrypt(
  ciphertext: BufferSource,
  key: BufferSource,
  iv: BufferSource
) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  const buf = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, k, ciphertext)
  return new Uint8Array(buf)
}

export function fillRandomBytes(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)

  for (let i = 0; i < bytes.length; i += 65536) {
    const slice = bytes.subarray(i, i + 65536)
    crypto.getRandomValues(slice)
  }
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
