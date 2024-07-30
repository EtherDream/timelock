import {SIZE} from './util'
import WASM_URI from './assets/timelock.wasm'


let wasmObj: {
  memory: WebAssembly.Memory

  get_hashes_buf: () => number
  get_salt_buf: () => number
  get_ctx_buf: () => number
  pbkdf2_pre: (gpu_thread: number, elem_len: number) => void
  pbkdf2_post: (gpu_thread: number) => void
}

export async function init() {
  const res = await fetch(WASM_URI)
  const {instance} = await WebAssembly.instantiateStreaming(res)
  wasmObj = instance.exports as any
}

export function getSaltBuf() {
  const ptr = wasmObj.get_salt_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, SIZE.SALT)
}

export function getHashesBuf(thread: number) {
  const ptr = wasmObj.get_hashes_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, thread * SIZE.HASH)
}

export function getCtxBuf(gpuThread: number) {
  const ptr = wasmObj.get_ctx_buf()
  return new Uint32Array(wasmObj.memory.buffer, ptr, gpuThread * SIZE.CTX / 4)
}

export function pbkdf2Pre(gpuThread: number, elemLen: number) {
  wasmObj.pbkdf2_pre(gpuThread, elemLen)
}

export function pbkdf2Post(gpuThread: number) {
  wasmObj.pbkdf2_post(gpuThread)
}
