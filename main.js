import * as timelock from './timelock/index.js'

const CPU_MODEL = {
  "Intel": {
    "Intel 12th": 18,
    "Intel 9th": 5.5
  },
  "Apple": {
    "Apple M1": 21,
    "Apple A17 Pro": 14.5
  }
}

const isEncryption = location.pathname.includes('/encrypt.html')
let isRunning = false


function strToBin(str) {
  return new TextEncoder().encode(str)
}

function binToStr(bin) {
  return new TextDecoder().decode(bin)
}

function base64Decode(str) {
  const b64 = str
    .replace(/\-/g, '+')
    .replace(/\_/g, '/')

  const tmp = atob(b64)
  const bin = new Uint8Array(tmp.length)
  for (let i = 0; i < bin.length; i++) {
    bin[i] = tmp.charCodeAt(i)
  }
  return bin
}

function base64Encode(bin) {
  let str = ''
  for (let i = 0; i < bin.length; i++) {
    str += String.fromCharCode(bin[i])
  }
  return btoa(str)
    .replace(/\=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function hashParams(json) {
  const payload = strToBin(JSON.stringify(json))
  const buf = await crypto.subtle.digest('SHA-256', payload)
  const bin = new Uint8Array(buf, 0, 4)
  return base64Encode(bin)
}

function formatTime(ms) {
  const time = new Date(ms).toISOString().slice(11, 19)
  const day = ms / 86400000 | 0
  if (day) {
    return `${day}day ${time}`
  }
  return time
}

function formatSpeed(hashPerSec) {
  return (hashPerSec / 1e6).toFixed(2) + ' MHash/s'
}

function showError(msg) {
  txtError.textContent = msg
}

let lastTime
let timeUsed
let timerId

function updateProgress(percent) {
  progressBar.value = percent * progressBar.max
  txtProgVal.textContent = Math.round(progressBar.value)
  txtProgPercent.textContent = percent * 100 | 0
}

function startProgress(cost) {
  progressBar.max = cost
  txtProgMax.textContent = cost
  txtRemaining.textContent = '...'

  showError('')
  updateProgress(0)

  timeUsed = 0
  lastTime = Date.now()
  timerId = setInterval(onProgressTimer, 2000)
}

function endProgress() {
  clearInterval(timerId)
  txtRemaining.textContent = ''
  if (!isEncryption) {
    txtSpeed.textContent = ''
  }
}

function onProgressTimer() {
  if (isPaused) {
    return
  }
  if (progressBar.value === 0) {
    return
  }
  const now = Date.now()
  timeUsed += now - lastTime
  lastTime = now

  const timePerCost = timeUsed / progressBar.value
  const remain = progressBar.max - progressBar.value

  txtRemaining.textContent = '≈' + formatTime(remain * timePerCost | 0)

  if (!isEncryption) {
    txtSpeed.textContent = '(' + formatSpeed(curHashPerSec) + ')'
  }
}

function parseDecryptParams() {
  if (!txtCipher.value) {
    showError('cipher is empty')
    return
  }
  try {
    return JSON.parse(txtCipher.value)
  } catch {
    showError('invalid format')
  }
}

function updateDecryptUi() {
  txtCipher.disabled = isRunning
  txtPlain.disabled = isRunning
  btnDecrypt.disabled = isRunning

  btnPause.disabled = !isRunning
  btnStop.disabled = !isRunning
}

let curHashPerSec = 0

async function onDecryptButtonClick() {
  const input = parseDecryptParams()
  if (!input) {
    return
  }
  const checkExp = input.check
  input.check = ''

  const checkGot = await hashParams(input)
  if (checkGot !== checkExp) {
    showError('params corrupted')
    return
  }

  const {cost} = input
  const params = {
    cost,
    cipher: base64Decode(input.cipher),
    nodes: []
  }
  for (const node of input.nodes) {
    params.nodes.push({
      name: node.name,
      iter: node.iter,
      seedNum: node.seedNum,
      seedLen: node.seedLen,
      seeds: base64Decode(node.seeds),
      salt: base64Decode(node.salt),
    })
  }
  isRunning = true
  updateDecryptUi(true)

  txtPlain.value = ''
  curHashPerSec = 0
  startProgress(cost)

  const plainBin = await timelock.decrypt.start(params, (percent, hashPerSec) => {
    curHashPerSec = hashPerSec
    updateProgress(percent)
  })
  endProgress()

  if (isRunning) {
    if (plainBin) {
      txtPlain.value = binToStr(plainBin)
    } else {
      showError('decrypt failed')
    }
  }
  isRunning = false
  updateDecryptUi(false)
}

let isPaused = false

function onDecryptPauseButtonClick() {
  timelock.decrypt.pause()
  btnPause.disabled = true
  btnResume.disabled = false
  showError('paused')
  isPaused = true
}

function onDecryptResumeButtonClick() {
  timelock.decrypt.resume()
  btnPause.disabled = false
  btnResume.disabled = true
  showError('')
  lastTime = Date.now()
  isPaused = false
}


function onDecryptStopButtonClick() {
  if (!confirm('stop?')) {
    return
  }
  isRunning = false
  btnResume.click()
  timelock.decrypt.stop()
  showError('stopped')
}


function updateEncryptUi() {
  txtPlain.disabled = isRunning
  txtCipher.disabled = isRunning

  txtCost.disabled = isRunning
  txtCpuThread.disabled = isRunning
  if (timelock.encrypt.isGpuAvailable()) {
    txtGpuThread.disabled = isRunning
  }

  btnEncrypt.disabled = isRunning
  btnBenchmark.disabled = isRunning
  btnShare.disabled = isRunning
}

async function onEncryptButtonClick() {
  if (!txtPlain.value) {
    showError('input is empty')
    return
  }
  if (!timelock.encrypt.getBenchmarkInfo()) {
    if (confirm('benchmark first?')) {
      startBenchmark()
      return
    }
  }
  const cost = txtCost.value >>> 0
  if (cost < 1) {
    showError('invalid cost')
    return
  }
  const cpuThread = +txtCpuThread.value
  const gpuThread = +txtGpuThread.value
  if (cpuThread < 0 || gpuThread < 0 || cpuThread + gpuThread === 0) {
    showError('invalid threads')
    return
  }

  const params = {
    plain: strToBin(txtPlain.value),
    seedLen: Math.min(window.SEED_LEN, 32),
    cost,
    cpuThread,
    gpuThread,
  }
  txtPlain.value = ''
  txtCipher.value = ''

  isRunning = true
  updateEncryptUi()
  startProgress(cost)

  const output = await timelock.encrypt.start(params, (percent) => {
    if (percent === -1) {
      showError('GPU Crashed')
      txtGpuThread.disabled = true
      txtGpuThread.value = 0
      return
    }
    updateProgress(percent)
  })
  if (!output) {
    return
  }
  const json = {
    version: '1.0.0',
    cost: cost,
    cipher: base64Encode(output.cipher),
    nodes: [],
    check: '',
  }
  for (const node of output.nodes) {
    json.nodes.push({
      name: node.name,
      iter: node.iter,
      seedNum: node.seedNum,
      seedLen: node.seedLen,
      seeds: base64Encode(node.seeds),
      salt: base64Encode(node.salt),
    })
  }
  json.check = await hashParams(json)

  txtCipher.value = JSON.stringify(json, null, 2)
  endProgress()

  isRunning = false
  updateEncryptUi()
}

async function onBenchmarkButtonClick() {
  await startBenchmark()
}

function onShareButtonClick() {
  const params = parseDecryptParams()
  if (!params) {
    return
  }
  const url = new URL(location.href.replace('/encrypt.html', '/decrypt.html'))

  const query = new URLSearchParams()
  query.set('version', params.version)
  query.set('cost', params.cost)
  query.set('cipher', params.cipher)

  for (const node of params.nodes) {
    for (const name of ['name', 'iter', 'seedNum', 'seedLen', 'seeds', 'salt']) {
      query.append('node.' + name, node[name])
    }
  }
  query.set('check', params.check)

  url.hash = query
  navigator.clipboard.writeText(url)
  alert('link copied')
}

function onCostChange() {
  const cost = +txtCost.value
  const speed = +selectCpu.options[selectCpu.selectedIndex].value
  const sec = cost / speed
  txtCostTime.textContent = formatTime(sec * 1000)
  txtProgMax.textContent = cost
}

function updateBenchmarkInfo(info) {
  const {
    cpuThread,
    cpuHashPerSec,
    gpuThread,
    gpuHashPerSec,
  } = info

  txtCpuThread.value = cpuThread
  txtGpuThread.value = gpuThread

  if (cpuHashPerSec) {
    txtCpuSpeed.textContent = formatSpeed(cpuHashPerSec * cpuThread)
  }
  if (gpuHashPerSec) {
    txtGpuSpeed.textContent = formatSpeed(gpuHashPerSec * gpuThread)
  }
  if (gpuHashPerSec < 0) {
    txtGpuSpeed.textContent = 'webgl crashed'
  }
}

async function startBenchmark() {
  isRunning = true
  updateEncryptUi()
  txtCpuThread.value = 0
  txtGpuThread.value = 0

  if (timelock.encrypt.isGpuAvailable()) {
    txtGpuSpeed.textContent = 'benchmarking...'
  }
  txtCpuSpeed.textContent = 'benchmarking...'

  await timelock.encrypt.benchmark(updateBenchmarkInfo)
  showError('')
  isRunning = false
  updateEncryptUi()
}

function readDecryptParams() {
  const frag = location.hash.substring(1)
  if (!frag) {
    return
  }
  const query = new URLSearchParams(frag)
  const params = {
    version: query.get('version'),
    cost: +query.get('cost'),
    cipher: query.get('cipher'),
    nodes: [],
    check: query.get('check'),
  }
  const NUM_TYPE = ['iter', 'seedNum', 'seedLen']

  for (const name of ['name', 'iter', 'seedNum', 'seedLen', 'seeds', 'salt']) {
    query.getAll('node.' + name).forEach((v, i) => {
      const node = params.nodes[i] || (params.nodes[i] = {})
      node[name] = NUM_TYPE.includes(name) ? +v : v
    })
  }
  txtCipher.value = JSON.stringify(params, null, 2)
}

window.onbeforeunload = function() {
  if (isRunning) {
    return 'leave?'
  }
}

async function initEncryptPage() {
  window.SEED_LEN = 4

  await timelock.encrypt.init()

  const benchmarkInfo = timelock.encrypt.getBenchmarkInfo()
  if (benchmarkInfo) {
    txtCpuThread.value = benchmarkInfo.cpuThread
    txtGpuThread.value = benchmarkInfo.gpuThread
  } else {
    txtCpuThread.value = 1
    txtGpuThread.value = 1024
  }

  if (!timelock.encrypt.isGpuAvailable()) {
    txtGpuThread.disabled = true
    txtGpuThread.value = 0
  }

  for (const [vendor, map] of Object.entries(CPU_MODEL)) {
    const optgroup = document.createElement('optgroup')
    optgroup.label = vendor

    for (const [model, iter] of Object.entries(map)) {
      const opt = new Option(model, iter)
      optgroup.appendChild(opt)
    }
    selectCpu.appendChild(optgroup)
  }

  if (navigator.getBattery) {
    const battery = await navigator.getBattery()
    const update = () => {
      if (battery.charging) {
        batteryItem.hidden = true
      } else {
        batteryItem.hidden = false
        txtBatteryIcon.textContent = battery.level < 0.5 ? '🪫' : '🔋'
        txtBatteryLevel.textContent = battery.level * 100
      }
    }
    battery.onchargingchange = update
    battery.onlevelchange = update
    update()
  } else {
    batteryItem.hidden = true
  }

  btnEncrypt.onclick = onEncryptButtonClick
  btnBenchmark.onclick = onBenchmarkButtonClick
  btnShare.onclick = onShareButtonClick

  txtCost.oninput = onCostChange
  selectCpu.oninput = onCostChange
  onCostChange()
}

async function initDecryptPage() {
  window.onhashchange = readDecryptParams
  readDecryptParams()

  btnDecrypt.onclick = onDecryptButtonClick
  btnPause.onclick = onDecryptPauseButtonClick
  btnResume.onclick = onDecryptResumeButtonClick
  btnStop.onclick = onDecryptStopButtonClick
}

async function main() {
  if (!isSecureContext) {
    showError('This program must be hosted on HTTPS or localhost')
    return
  }
  if (isEncryption) {
    await initEncryptPage()
  } else {
    await initDecryptPage()
  }
}
main()