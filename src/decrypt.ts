import {
  DecryptParams,
  aesDecrypt,
} from './util'

import WASM_B64 from './assets/mulxor.wasm'
const wasmBytes = Uint8Array.fromBase64(WASM_B64)

type F = (seed: bigint, n: number) => bigint


function fillWasm(constants: Uint32Array) {
  const bin = wasmBytes.slice(0)
  let slot = 0

  for (let i = 0; i < bin.length; i++) {
    if (bin[i] !== 0xFF) {
      continue
    }
    // encode as 5-byte signed LEB128
    let v = constants[slot++] | 0

    for (let k = 0; k < 4; k++) {
      bin[i + k] = (v & 0x7F) | 0x80
      v >>= 7
    }
    bin[i + 4] = v & 0x7F
    i += 4
  }
  return bin
}

const workerEnv = () => {
  let benchmarkSpeed = 1e8

  function compile(wasm: BufferSource) {
    const mod = new WebAssembly.Module(wasm)
    const obj = new WebAssembly.Instance(mod)
    return obj.exports.mulxor as F
  }

  function handleBenchmark(wasm: BufferSource) {
    const N = 1e6
    const fn = compile(wasm)

    // warmup
    fn(1n, N)

    const t0 = performance.now()
    fn(1n, N)
    const t1 = performance.now()

    benchmarkSpeed = Math.ceil(N / (t1 - t0) * 1000)
    postMessage({type: 'benchmark', benchmarkSpeed})
  }

  async function handleStart(
    wasm: BufferSource,
    seeds: BigUint64Array,
    costPerSeed: number
  ) {
    const mulxor = compile(wasm)
    const totalIterations = costPerSeed * seeds.length
    const hashes = new BigUint64Array(seeds.length)

    let iterationsPerBatch = benchmarkSpeed
    let iterationsDone = 0
    let key = 0n

    for (let p = 0; p < seeds.length; p++) {
      const seed = seeds[p] ^ key

      let hash = seed
      let remaining = costPerSeed

      while (remaining > 0) {
        const n = Math.min(remaining, iterationsPerBatch)

        const t0 = performance.now()
        hash = mulxor(hash, n)
        const t1 = performance.now()

        remaining -= n
        iterationsDone += n

        const iterationsPerSec = Math.ceil(n / (t1 - t0) * 1000)
        iterationsPerBatch = Math.min(iterationsPerSec, 1e9)

        postMessage({
          type: 'progress',
          percent: iterationsDone / totalIterations,
          speed: iterationsPerSec,
        })
      }

      hashes[p] = hash
      key ^= hash
    }

    const aesKey = await crypto.subtle.digest('SHA-256', hashes)
    postMessage({type: 'done', aesKey})
  }

  onmessage = (e: MessageEvent) => {
    const $ = e.data
    switch ($.type) {
    case 'benchmark':
      handleBenchmark($.wasm)
      break
    default:
      handleStart($.wasm, $.seeds, $.costPerSeed)
      break
    }
  }
}

let worker: Worker

export let speed = 0
export let percent = 0

export function init() {
  const code = `(${workerEnv})()`
  const blob = new Blob([code])
  const url = URL.createObjectURL(blob)
  worker = new Worker(url)
}

/** must not be called during decryption */
export function benchmark(): Promise<void> {
  worker.postMessage({type: 'benchmark', wasm: wasmBytes})

  return new Promise(resolve => {
    worker.onmessage = (e) => {
      speed = e.data.benchmarkSpeed
      resolve()
    }
  })
}

export function start(params: DecryptParams): Promise<Uint8Array | undefined> {
  const {seedNum} = params
  const cost = BigInt(params.cost) * 1000000000n
  const costPerSeed = Number(cost / BigInt(seedNum))

  const seeds = new BigUint64Array(params.seedData.buffer)

  percent = 0
  const {promise, resolve} = Promise.withResolvers<Uint8Array | undefined>()

  worker.onmessage = async (e) => {
    const $ = e.data
    if ($.type === 'progress') {
      speed = $.speed
      percent = $.percent
      return
    }
    // type == 'done'
    let result: Uint8Array | undefined
    try {
      result = await aesDecrypt(params.ciphertext, $.aesKey, params.iv)
    } catch {}

    resolve(result)
  }
  const wasm = fillWasm(params.constants)
  worker.postMessage({wasm, seeds, costPerSeed})

  return promise
}