type EncryptProgress = (
  completedCost: number,
  workerId: number,
  hash: Uint32Array
) => boolean

type DecryptProgress = (
  completedCost: number,
  hash: Uint32Array
) => boolean

type EncryptParams = {
  plain: Uint8Array
  cost: number
  cpuThread: number
}

type DecryptParams = {
  cipher: Uint8Array
  cost: number
  seeds: Uint8Array
  salt: Uint8Array
}

type PageToWorkerMsg = {
  threadId: number
  baseId: number
  seed: number,
  salt: Uint8Array
  costThisThread: number
}

type WorkerToPageMsg = {
  threadId: number
  progress: number
  hash: Uint32Array
}


async function pbkdf2(pwd: BufferSource, opts: Pbkdf2Params) {
  const k = await crypto.subtle.importKey('raw', pwd, 'PBKDF2', false, ['deriveBits'])
  const buf = await crypto.subtle.deriveBits(opts, k, 256)
  return new Uint32Array(buf)
}

async function aesEncrypt(plain: BufferSource, key: BufferSource, iv: BufferSource) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const buf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, plain)
  return new Uint8Array(buf)
}

async function aesDecrypt(cipher: BufferSource, key: BufferSource, iv: BufferSource) {
  const k = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt'])
  const buf = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, k, cipher)
  return new Uint8Array(buf)
}

function xorArr(dst: Uint32Array, src: Uint32Array) {
  for (let i = 0; i < src.length; i++) {
    dst[i] ^= src[i]
  }
}

/**
 * this function will run in the worker
 */
async function workerOnMessage(e: MessageEvent) {
  const {
    threadId, baseId, costThisThread, seed, salt,
  } = e.data as PageToWorkerMsg

  const saltU32 = new Uint32Array(salt.buffer)

  const pbkdf2Params: Pbkdf2Params = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: saltU32,
    iterations: 1e7,
  }
  let hash = Uint32Array.of(seed)

  for (let i = 0; i < costThisThread; i++) {
    const k = await crypto.subtle.importKey('raw', hash, 'PBKDF2', false, ['deriveBits'])
    const pbkdfId = baseId + i

    saltU32[0] ^= pbkdfId
    const buf = await crypto.subtle.deriveBits(pbkdf2Params, k, 256)
    saltU32[0] ^= pbkdfId

    hash = new Uint32Array(buf)
    postMessage({
      threadId,
      progress: i,
      hash,
    } as WorkerToPageMsg)
  }

  postMessage({
    threadId,
    progress: -1,
    hash
  } as WorkerToPageMsg)
}

let workerUrl: string
const workerPool: Worker[] = []

function allocWorker() {
  if (!workerUrl) {
    const code = 'onmessage=' + workerOnMessage
    const blob = new Blob([code])
    workerUrl = URL.createObjectURL(blob)
  }
  return workerPool.pop() || new Worker(workerUrl)
}

function freeWorker(worker: Worker) {
  worker.onmessage = null
  workerPool.push(worker)
}

export function encrypt(params: EncryptParams, onProgress: EncryptProgress) {
  const {plain, cost, cpuThread} = params

  const threadNumAvail = Math.min(cpuThread, cost)
  const costPreThread = Math.ceil(cost / threadNumAvail)
  const threadNum = Math.ceil(cost / costPreThread)
  const costLastThread = costPreThread - (threadNum * costPreThread - cost)

  const seeds = new Uint32Array(threadNum)
  crypto.getRandomValues(seeds)

  const salt = crypto.getRandomValues(new Uint8Array(8))

  const hashes: Uint32Array[] = []
  let completedCost = 0

  const onMsg = async function(this: Worker, e: MessageEvent) {
    const {threadId, progress, hash} = e.data as WorkerToPageMsg

    if (progress !== -1) {
      onProgress(++completedCost, threadId, hash)
      return
    }
    hashes[threadId] = hash
    freeWorker(this)

    if (completedCost !== cost) {
      return
    }
    //
    // all threads completed
    //
    let key = hashes[0]

    for (let i = 1; i < threadNum; i++) {
      seeds[i] ^= key[0]
      xorArr(key, hashes[i])
    }
    const cipher = await aesEncrypt(plain, key, new Uint8Array(16))

    const output: DecryptParams = {
      cipher, cost, salt,
      seeds: new Uint8Array(seeds.buffer),
    }
    onComplete(output)
  }

  for (let i = 0; i < threadNum; i++) {
    const worker = allocWorker()
    worker.onmessage = onMsg
    worker.postMessage({
      threadId: i,
      baseId: costPreThread * i,
      seed: seeds[i],
      salt,
      costThisThread: (i === threadNum - 1) ? costLastThread : costPreThread,
    } as PageToWorkerMsg)
  }

  let onComplete: (result: DecryptParams) => void

  return new Promise<DecryptParams>(resolve => {
    onComplete = resolve
  })
}

export async function decrypt(params: DecryptParams, onProgress: DecryptProgress) {
  const {cipher, cost} = params
  const seeds = new Uint32Array(params.seeds.buffer)
  const salt = new Uint32Array(params.salt.buffer)

  const pbkdf2Params: Pbkdf2Params = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: salt,
    iterations: 1e7,
  }
  let pbkdfId = 0

  const parall = seeds.length
  const costPreThread = Math.ceil(cost / parall)
  const costLastThread = costPreThread - (parall * costPreThread - cost)

  // slow_hash 1st seed
  let hash = Uint32Array.of(seeds[0])
 
  for (let i = 0; i < costPreThread; i++) {
    salt[0] ^= pbkdfId
    hash = await pbkdf2(hash, pbkdf2Params)
    salt[0] ^= pbkdfId

    if (onProgress(++pbkdfId, hash) === false) {
      return
    }
  }

  let key = hash

  // slow_hash 2nd+ seeds
  for (let p = 1; p < parall; p++) {
    const costThisThread = (p === parall - 1) ? costLastThread : costPreThread

    const seed = seeds[p] ^ key[0]
    hash = Uint32Array.of(seed)

    for (let i = 0; i < costThisThread; i++) {
      salt[0] ^= pbkdfId
      hash = await pbkdf2(hash, pbkdf2Params)
      salt[0] ^= pbkdfId

      if (onProgress(++pbkdfId, hash) === false) {
        return
      }
    }
    xorArr(key, hash)
  }

  try {
    return await aesDecrypt(cipher, key, new Uint8Array(16))
  } catch {
    throw Error('decrypt failed')
  }
}
