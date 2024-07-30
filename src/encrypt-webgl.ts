import {WebGL2Const as GL} from './webgl-const'
import {SIZE} from './util'
import FRAG_SHADER from './assets/shader.glsl'

//
// page to worker message
//
const enum ReqMsgType {
  INIT,
  START,
  STOP,
  PAUSE,
  RESUME,
  SET_ITER_PER_DRAW,
  SET_THREAD,
  BENCHMARK,
}
type ReqMsgInit = {
  type: ReqMsgType.INIT
  shader: string
}
type ReqMsgStart = {
  type: ReqMsgType.START
  ctxBuf: Uint32Array
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
type ReqMsgSetIterPerDraw = {
  type: ReqMsgType.SET_ITER_PER_DRAW
  iter: number
}
type ReqMsgSetThread = {
  type: ReqMsgType.SET_THREAD
  thread: number
}
type ReqMsgBenchmark = {
  type: ReqMsgType.BENCHMARK
  iter: number
  thread: number
}
type ReqMsg =
  ReqMsgInit | ReqMsgStart | ReqMsgStop | ReqMsgPause | ReqMsgResume |
  ReqMsgSetIterPerDraw | ReqMsgSetThread | ReqMsgBenchmark

//
// worker to page message
//
const enum ResMsgType {
  BENCHMARK,
  PROGRESS,
  COMPLETE,
  INIT,
}
type ResMsgProgress = {
  type: ResMsgType.PROGRESS
  iterAdded: number
}
type ResMsgComplete = {
  type: ResMsgType.COMPLETE
  ctxBuf: Uint32Array
}
type ResMsgBenchmark = {
  type: ResMsgType.BENCHMARK
  time: number
}
type ResMsgInit = {
  type: ResMsgType.INIT
  errMsg: string
}
type ResMsg =
  ResMsgInit | ResMsgProgress | ResMsgComplete | ResMsgBenchmark

//
// this function will be run in the worker context
//
const workerEnv = () => {
  const sendMsgToPage: ((msg: ResMsg) => void) = postMessage

  // "Transform Feedback" is simpler, but crashes frequently,
  // so we still use the GPGPU solution of WebGL1.

  // colors per thread
  const IN_COLOR_NUM = 8
  const OUT_COLOR_NUM = 4

  //
  // threadNum = texW * texH
  //
  // inTex:
  //
  // |----------- texW ------------|
  // |             Ra             texH
  // |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
  // |             Rb             texH
  // |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
  // |            ....             |
  // |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
  // |             Ob             texH
  // |-----------------------------|
  // (Ra, Rb, Wa, Wb, Ia, Ib, Oa, Ob)
  //
  //
  // outTex:
  //
  // color_attachment0
  // |----------- texW ------------|
  // |             Ra             texH
  // |-----------------------------|
  //
  // color_attachment1
  // |----------- texW ------------|
  // |             Rb             texH
  // |-----------------------------|
  //
  // color_attachment2
  // |----------- texW ------------|
  // |             Wa             texH
  // |-----------------------------|
  //
  // color_attachment3
  // |----------- texW ------------|
  // |             Wb             texH
  // |-----------------------------|
  //
  const texH = 4
  let texW: number

  let gl: WebGL2RenderingContext
  let iterHandle: WebGLUniformLocation
  let iterPerDraw: number
  let threadNum: number

  let isStopping: boolean
  let pausedSignal: Promise<void> | undefined
  let resumeCallback: () => void


  function sleep(ms: number) {
    return new Promise(fn => {
      setTimeout(fn, ms)
    })
  }

  function createShader(code: string, type: number) {
    const shader = gl.createShader(type)
    if (!shader) {
      throw Error('createShader failed')
    }
    gl.shaderSource(shader, code)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, GL.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(shader)!
      throw Error(msg)
    }
    return shader
  }

  function initWebGl(shader: string) {
    const canvas = new OffscreenCanvas(0, 0)

    const ctx = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
    })
    if (!ctx) {
      throw Error('webgl2 is not available')
    }
    gl = ctx

    canvas.oncontextlost = () => {
      console.warn('webgl oncontextlost')
    }
    canvas.oncontextrestored = () => {
      console.warn('webgl oncontextrestored')
    }

    const vertexData = new Float32Array([
      -1, +1, // left top
      -1, -1, // left bottom
      +1, +1, // right top
      +1, -1, // right bottom
    ])
    gl.bindBuffer(GL.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(GL.ARRAY_BUFFER, vertexData, GL.STATIC_DRAW)

    const program = gl.createProgram()
    if (!program) {
      throw Error('createProgram failed')
    }
    const VERTEX_SHADER = `\
#version 300 es
in vec2 v_pos;
void main() {
  gl_Position = vec4(v_pos, 0., 1.);
}`
    const vertexShader = createShader(VERTEX_SHADER, GL.VERTEX_SHADER)

    const fragShaderCode = shader.replace('__TEX_H__', texH + 'u')
    const fragShader = createShader(fragShaderCode, GL.FRAGMENT_SHADER)

    gl.attachShader(program, fragShader)
    gl.attachShader(program, vertexShader)

    gl.linkProgram(program)
    gl.useProgram(program)

    const posHandle = 0
    gl.vertexAttribPointer(posHandle, 2 /*vec2*/, GL.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(posHandle)

    iterHandle = gl.getUniformLocation(program, 'in_iter')!

    const frameBuffer = gl.createFramebuffer()
    if (!frameBuffer) {
      throw Error('createFramebuffer failed')
    }
    gl.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer)
  }

  function setIterPerDraw(value: number) {
    if (iterPerDraw === value) {
      return
    }
    iterPerDraw = value

    // 1x iter => 2x hash
    gl.uniform1ui(iterHandle, value * 2)
  }

  function setThread(thread: number) {
    if (threadNum === thread) {
      return
    }
    threadNum = thread

    // threadNum is a power of 2
    texW = threadNum / texH
    gl.viewport(0, 0, texW, texH)

    for (let i = 0; i < OUT_COLOR_NUM; i++) {
      const outTex = gl.createTexture()
      if (!outTex) {
        throw Error('create outTex failed')
      }
      gl.bindTexture(GL.TEXTURE_2D, outTex)

      gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32UI, texW, texH,
        0, GL.RGBA_INTEGER, GL.UNSIGNED_INT, null)

      gl.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0 + i,
        GL.TEXTURE_2D, outTex, 0)
    }

    gl.drawBuffers([
      GL.COLOR_ATTACHMENT0, GL.COLOR_ATTACHMENT1,
      GL.COLOR_ATTACHMENT2, GL.COLOR_ATTACHMENT3,
    ])

    const inTex = gl.createTexture()
    if (!inTex) {
      throw Error('create inTex failed')
    }
    gl.bindTexture(GL.TEXTURE_2D, inTex)
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST)
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST)
  }

  function write(buf: Uint32Array) {
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32UI, texW, texH * IN_COLOR_NUM,
      0, GL.RGBA_INTEGER, GL.UNSIGNED_INT, buf)
  }

  function read(buf: Uint32Array) {
    for (let i = 0; i < OUT_COLOR_NUM; i++) {
      const ptr = i * threadNum * SIZE.PIXEL

      gl.readBuffer(GL.COLOR_ATTACHMENT0 + i)
      gl.readPixels(0, 0, texW, texH,
        GL.RGBA_INTEGER, GL.UNSIGNED_INT, buf, ptr / 4)
    }
  }

  function draw() {
    gl.drawArrays(GL.TRIANGLE_STRIP, 0, 4)

    // copy outTex[i] to inTex at P(0, i * texH)
    for (let i = 0; i < OUT_COLOR_NUM; i++) {    
      const dstX = 0
      const dstY = i * texH

      gl.readBuffer(GL.COLOR_ATTACHMENT0 + i)
      gl.copyTexSubImage2D(GL.TEXTURE_2D, 0, dstX, dstY, 0, 0, texW, texH)
    }
  }

  async function benchmark(thread: number, iter: number) {
    setThread(thread)
    setIterPerDraw(iter)

    const ctxBuf = new Uint32Array(thread * IN_COLOR_NUM * SIZE.PIXEL / 4)
    write(ctxBuf)

    const SAMPLE_NUM = 30
    let timeMin = 1e9

    for (let i = 0; i < SAMPLE_NUM; i++) {
      const startTime = performance.now()
      draw()
      read(ctxBuf)
      const endTime = performance.now()

      const time = endTime - startTime
      if (time < timeMin) {
        timeMin = time
      }
      if (time < 16) {
        break
      }
      await sleep(1)
    }

    sendMsgToPage({
      type: ResMsgType.BENCHMARK,
      time: timeMin,
    })
  }


  const DRAWS_PER_SYNC = 10

  async function start(params: ReqMsgStart) {
    isStopping = false

    const {ctxBuf, iter} = params
    write(ctxBuf)

    let iterRemain = iter
    let iterAdded = 0
    let drawCount = 0

    for (;;) {
      if (iterRemain <= iterPerDraw) {
        const backup = iterPerDraw
        setIterPerDraw(iterRemain)
        draw()
        setIterPerDraw(backup)

        iterAdded += iterRemain * threadNum
        sendMsgToPage({
          type: ResMsgType.PROGRESS,
          iterAdded,
        })
        break
      }
      draw()
      iterRemain -= iterPerDraw
      iterAdded += iterPerDraw * threadNum

      // TODO: WebGLSync
      if (++drawCount === DRAWS_PER_SYNC) {
        drawCount = 0
        read(ctxBuf)

        sendMsgToPage({
          type: ResMsgType.PROGRESS,
          iterAdded,
        })
        iterAdded = 0
        await sleep(1)

        if (pausedSignal) {
          await pausedSignal
        }
        if (isStopping) {
          return
        }
      }
    }
    if (gl.isContextLost()) {
      sendMsgToPage({
        type: ResMsgType.PROGRESS,
        iterAdded: -1,
      })
      return
    }
    read(ctxBuf)
    sendMsgToPage({
      type: ResMsgType.COMPLETE,
      ctxBuf,
    })
  }

  function init(shader: string) {
    let errMsg = ''
    try {
      initWebGl(shader)
    } catch (err: any) {
      errMsg = err.message
    }
    sendMsgToPage({
      type: ResMsgType.INIT,
      errMsg,
    })
  }


  self.onmessage = (e) => {
    const msg: ReqMsg = e.data

    switch (msg.type) {
    case ReqMsgType.INIT:
      init(msg.shader)
      break
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
    case ReqMsgType.SET_ITER_PER_DRAW:
      setIterPerDraw(msg.iter)
      break
    case ReqMsgType.SET_THREAD:
      setThread(msg.thread)
      break
    case ReqMsgType.BENCHMARK:
      benchmark(msg.thread, msg.iter)
      break
    }
  }
}


let worker: Worker

function sendMsgToWorker(msg: ReqMsg) {
  worker.postMessage(msg)
}

function onWorkerMsg(e: MessageEvent) {
  const msg: ResMsg = e.data

  switch (msg.type) {
  case ResMsgType.INIT:
    initCallback(msg.errMsg)
    break
  case ResMsgType.PROGRESS:
    if (msg.iterAdded === -1) {
      completeCallback()
    } else {
      progressCallback(msg.iterAdded)
    }
    break
  case ResMsgType.COMPLETE:
    completeCallback(msg.ctxBuf)
    break
  case ResMsgType.BENCHMARK:
    benchmarkThreadCallback(msg.time)
    break
  }
}

let initCallback: (err: string) => void

export function init() {
  const code = '(' + workerEnv + ')()'
  const blob = new Blob([code])
  const workerUrl = URL.createObjectURL(blob)

  worker = new Worker(workerUrl)
  worker.onmessage = onWorkerMsg

  sendMsgToWorker({
    type: ReqMsgType.INIT,
    shader: FRAG_SHADER,
  })
  return new Promise<string>(resolve => {
    initCallback = resolve
  })
}


let benchmarkThreadCallback: (time: number) => void

function benchmarkThread(thread: number, iter: number) {
  sendMsgToWorker({
    type: ReqMsgType.BENCHMARK,
    iter,
    thread,
  })
  return new Promise<number>(resolve => {
    benchmarkThreadCallback = resolve
  })
}

export async function benchmark(
  onProgress: (iterPerMs: number, thread: number) => void
) {
  let iter = 256
  let thread = 256

  let singleThreadTime: number
  console.log('evaluating GPU single thread performance...')

  for (;;) {
    setIterPerDraw(iter)
    singleThreadTime = await benchmarkThread(thread, iter)

    onProgress(iter / singleThreadTime | 0, thread)
    console.log('try iter:', iter, 'time:', singleThreadTime)

    if (singleThreadTime > 17) {
      break
    }
    iter = iter * 1.25 | 0
  }

  let multiThreadTime = singleThreadTime
  console.log('estimating GPU thread count...')

  for (;;) {
    const tryThread = thread * 2
    const time = await benchmarkThread(tryThread, iter)
    if (time < 10) {
      console.warn('webgl crashed')
      multiThreadTime = -1
      break
    }
    if (time < singleThreadTime) {
      singleThreadTime = time
    }
    const ratio = time / singleThreadTime
    onProgress(iter / time | 0, tryThread)

    console.log('try thread:', tryThread, 'ratio:', ratio)
    if (ratio >= 1.9) {
      break
    }
    thread = tryThread
    multiThreadTime = time
  }

  onProgress(iter / multiThreadTime | 0, thread)
}


let completeCallback: (ctxBuf?: Uint32Array) => void
let progressCallback: (iterAdded: number) => void

export function start(
  ctxBuf: Uint32Array,
  iter: number,
  onProgress: typeof progressCallback,
) {
  progressCallback = onProgress

  sendMsgToWorker({
    type: ReqMsgType.START,
    ctxBuf: ctxBuf.slice(0),
    iter,
  })
  return new Promise<Uint32Array | undefined>(resolve => {
    completeCallback = resolve
  })
}

export function stop() {
  sendMsgToWorker({
    type: ReqMsgType.STOP,
  })
}

export function pause() {
  sendMsgToWorker({
    type: ReqMsgType.PAUSE,
  })
}

export function resume() {
  sendMsgToWorker({
    type: ReqMsgType.RESUME,
  })
}

export function setIterPerDraw(value: number) {
  sendMsgToWorker({
    type: ReqMsgType.SET_ITER_PER_DRAW,
    iter: value,
  })
}

export function setThread(value: number) {
  sendMsgToWorker({
    type: ReqMsgType.SET_THREAD,
    thread: value,
  })
}
