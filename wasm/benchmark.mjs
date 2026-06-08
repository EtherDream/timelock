import fs from 'node:fs'

const file = new URL('../src/assets/mulxor.wasm', import.meta.url)
const wasm = fs.readFileSync(file)

const {instance} = await WebAssembly.instantiate(wasm)
const {mulxor} = instance.exports

// warmup
mulxor(1n, 1e6)

const t0 = performance.now()
const result = mulxor(1234567890n, 1e9)
const t1 = performance.now()

const elapsed = Math.round(t1 - t0)
console.log(`result: ${result} time: ${elapsed} ms`)