import {
  SIZE,
  NUM,
  indexBuf,
  cloneBuf,
  concatBuf,
} from './util'

//
// page to worker message
//
const enum ReqMsgType {
  START,
  STOP,
  PAUSE,
  RESUME,
  BENCHMARK,
}
type ReqMsgStart = {
  type: ReqMsgType.START
  seed: Uint8Array
  salt: Uint8Array
  iter: number
}
type ReqMsgStop = {
  type: ReqMsgType.STOP
}
type ReqMsgPause = {
  type: ReqMsgType.PAUSE
}
type ReqMsgResume = {
  type: ReqMsgType.RESUME
}
type ReqMsgBenchmark = {
  type: ReqMsgType.BENCHMARK
  iter: number
}
type ReqMsg =
  ReqMsgStart | ReqMsgStop | ReqMsgPause | ReqMsgResume | ReqMsgBenchmark

//
// worker to page message
//
const enum ResMsgType {
  PROGRESS,
  COMPLETE,
  STOPPED,
  BENCHMARK,
}
type ResMsgProgress = {
  type: ResMsgType.PROGRESS
  iterAdded: number
}
type ResMsgComplete = {
  type: ResMsgType.COMPLETE
  hash: Uint8Array
}
type ResMsgStopped = {
  type: ResMsgType.STOPPED
}
type ResMsgBenchmark = {
  type: ResMsgType.BENCHMARK
  startTime: number
  endTime: number
}
type ResMsg =
  ResMsgProgress | ResMsgComplete | ResMsgStopped | ResMsgBenchmark

//
// this function will be run in the worker context
//
const workerEnv = () => {
  const sendMsgToPage: ((msg: ResMsg) => void) = postMessage

  let pausedSignal: Promise<void> | undefined
  let resumeCallback: () => void
  let isStopping: boolean


  async function start(params: ReqMsgStart) {
    isStopping = false

    const {seed, salt, iter} = params
    const loop = Math.ceil(iter / NUM.ITER_PER_LOOP)

    const pbkdfOpt: Pbkdf2Params = {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 0,
    }
    let hash = seed
    let iterRemain = iter

    for (let i = 0; i < loop; i++) {
      pbkdfOpt.iterations = Math.min(iterRemain, NUM.ITER_PER_LOOP)
      iterRemain -= NUM.ITER_PER_LOOP

      const k = await crypto.subtle.importKey(
        'raw', hash, 'PBKDF2', false, ['deriveBits']
      )
      const buf = await crypto.subtle.deriveBits(pbkdfOpt, k, SIZE.HASH * 8)
      hash = new Uint8Array(buf)

      if (pausedSignal) {
        await pausedSignal
      }
      if (isStopping) {
        sendMsgToPage({
          type: ResMsgType.STOPPED,
        })
        return
      }
      sendMsgToPage({
        type: ResMsgType.PROGRESS,
        iterAdded: pbkdfOpt.iterations,
      })
    }
    sendMsgToPage({
      type: ResMsgType.COMPLETE,
      hash,
    })
  }

  async function benchmark(iter: number) {
    const pwd = crypto.getRandomValues(new Uint8Array(32))
    const opt: Pbkdf2Params = {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new Uint8Array(16),
      iterations: iter,
    }
    const key = await crypto.subtle.importKey(
      'raw', pwd, 'PBKDF2', false, ['deriveBits']
    )
    const startTime = performance.now()
    await crypto.subtle.deriveBits(opt, key, SIZE.HASH * 8)
    const endTime = performance.now()

    sendMsgToPage({
      type: ResMsgType.BENCHMARK,
      startTime,
      endTime,
    })
  }


  self.onmessage = (e) => {
    const msg: ReqMsg = e.data

    switch (msg.type) {
    case ReqMsgType.START:
      start(msg)
      break
    case ReqMsgType.STOP:
      isStopping = true
      break
    case ReqMsgType.PAUSE:
      pausedSignal = new Promise(resolve => {
        resumeCallback = resolve
      })
      break
    case ReqMsgType.RESUME:
      resumeCallback()
      pausedSignal = undefined
      break
    case ReqMsgType.BENCHMARK:
      benchmark(msg.iter)
      break
    }
  }
}

class MyWorker extends Worker {
  constructor(url: string, public threadId: number) {
    super(url)
  }
  sendMsg(msg: ReqMsg) {
    super.postMessage(msg)
  }
}

const workerPool: MyWorker[] = []
let workerUrl: string


function allocWorker(id: number) {
  if (!workerUrl) {
    const code = '(' + workerEnv + ')()'
    const blob = new Blob([code])
    workerUrl = URL.createObjectURL(blob)
  }
  let worker = workerPool[id]
  if (!worker) {
    worker = new MyWorker(workerUrl, id)
    worker.onmessage = onWorkerMsg
    workerPool[id] = worker
  }
  return worker
}


let completedHashes: Uint8Array[]
let completedNum: number
let threadNum: number

let benchmarkInfo: ResMsgBenchmark[]
let benchmarkCallback: (time: number) => void


function sendMsgToWorkers(msg: ReqMsg) {
  for (let i = 0; i < threadNum; i++) {
    workerPool[i].sendMsg(msg)
  }
}

function onWorkerMsg(this: Worker, e: MessageEvent) {
  const {threadId} = this as MyWorker
  const msg: ResMsg = e.data

  switch (msg.type) {
  case ResMsgType.PROGRESS:
    encryptOnProgress(msg.iterAdded)
    break
  case ResMsgType.COMPLETE:
    completedHashes[threadId] = msg.hash
    if (++completedNum === threadNum) {
      const buf = concatBuf(completedHashes, threadNum * SIZE.HASH)
      encryptOnComplete(buf)
    }
    break
  case ResMsgType.STOPPED:
    encryptOnComplete()
    break
  case ResMsgType.BENCHMARK:
    if (benchmarkInfo.push(msg) === threadNum) {
      const startTimeMin = Math.min(...benchmarkInfo.map(v => v.startTime))
      const endTimeMax = Math.max(...benchmarkInfo.map(v => v.endTime))
      const totalTime = endTimeMax - startTimeMin
      benchmarkCallback(totalTime)
    }
    break
  }
}

function benchmarkThread(thread: number, iter: number) {
  threadNum = thread
  benchmarkInfo = []

  for (let p = 0; p < thread; p++) {
    const worker = allocWorker(p)
    worker.sendMsg({
      type: ReqMsgType.BENCHMARK,
      iter,
    })
  }
  return new Promise<number>(resolve => {
    benchmarkCallback = resolve
  })
}


export async function benchmark(
  onProgress: (iterPerMs: number, thread: number) => void
) {
  const MAX_LOSS_RATIO = 1.2
  const PROBE_ITER = 2e6
  const THREAD_GROW = 1.2

  console.log('evaluating CPU single thread performance...')

  const probeTime = await benchmarkThread(1, PROBE_ITER)
  const iterPerSec = PROBE_ITER / probeTime * 1000 | 0

  const singleThreadTime = await benchmarkThread(1, iterPerSec)
  const iterPerMs = iterPerSec / singleThreadTime | 0

  console.log('speed: ~' + iterPerMs + ' iter/ms')

  console.log('estimating CPU thread count...')
  let thread = 1

  if ('safari' in window) {
    thread = navigator.hardwareConcurrency
  }

  for (;;) {
    const tryThread = Math.ceil(thread * THREAD_GROW)
    // init worker
    await benchmarkThread(tryThread, 1)

    const totalTime = await benchmarkThread(tryThread, iterPerSec)
    const ratio = totalTime / singleThreadTime

    onProgress(iterPerMs, tryThread)
    console.log('try thread:', tryThread, 'ratio:', ratio)

    if (ratio > MAX_LOSS_RATIO) {
      break
    }
    thread = tryThread
  }
  onProgress(iterPerMs, thread)
}


let encryptOnComplete: (hashes?: Uint8Array) => void
let encryptOnProgress: (iterAdded: number) => void

export function start(
  thread: number,
  seedsBuf: Uint8Array,
  seedLen: number,
  saltBuf: Uint8Array,
  iter: number,
  onProgress: typeof encryptOnProgress,
) {
  threadNum = thread
  completedHashes = []
  completedNum = 0
  encryptOnProgress = onProgress

  const saltIdBuf = new Uint8Array(SIZE.SALT_WITH_ID)
  const saltIdView = new DataView(saltIdBuf.buffer)
  saltIdBuf.set(saltBuf)

  for (let p = 0; p < thread; p++) {
    const seed = indexBuf(seedsBuf, seedLen, p)
    saltIdView.setUint32(SIZE.SALT, p)

    const worker = allocWorker(p)
    worker.sendMsg({
      type: ReqMsgType.START,
      seed: cloneBuf(seed),
      salt: saltIdBuf,
      iter,
    })
  }
  return new Promise<Uint8Array | undefined>(resolve => {
    encryptOnComplete = resolve
  })
}

export function stop() {
  sendMsgToWorkers({
    type: ReqMsgType.STOP,
  })
}

export function pause() {
  sendMsgToWorkers({
    type: ReqMsgType.PAUSE,
  })
}

export function resume() {
  sendMsgToWorkers({
    type: ReqMsgType.RESUME,
  })
}
