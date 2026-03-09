import {SIZE} from './util'
import WASM_B64 from './assets/timelock.wasm'


let wasmObj: {
  memory: WebAssembly.Memory

  get_io_buf: () => number
  get_salt_buf: () => number
  get_start_ctx_buf: () => number
  get_ctx_w_buf: () => number
  get_ctx_r_buf: () => number
  pbkdf2_pre: (thread: number, seed_len: number, seq: number) => void
  pbkdf2_post: (thread: number) => void
}

export async function init() {
  // @ts-ignore
  const bin = Uint8Array.fromBase64(WASM_B64)
  const mod = new WebAssembly.Module(bin)
  const obj = new WebAssembly.Instance(mod, {})
  wasmObj = obj.exports as any
}

export function getSaltBuf() {
  const ptr = wasmObj.get_salt_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, SIZE.SALT)
}

export function getIoBuf(thread: number) {
  const ptr = wasmObj.get_io_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, thread * SIZE.HASH)
}

export function getStartCtxBuf(thread: number) {
  const ptr = wasmObj.get_start_ctx_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, thread * 64)
}

export function getCtxWBuf(thread: number) {
  const ptr = wasmObj.get_ctx_w_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, thread * 32)
}

export function getCtxRBuf(thread: number) {
  const ptr = wasmObj.get_ctx_r_buf()
  return new Uint8Array(wasmObj.memory.buffer, ptr, thread * 32)
}

export function pbkdf2Pre(thread: number, seedLen: number, seq: number) {
  wasmObj.pbkdf2_pre(thread, seedLen, seq)
}

export function pbkdf2Post(thread: number) {
  wasmObj.pbkdf2_post(thread)
}
