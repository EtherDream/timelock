if (!Uint8Array.prototype.toHex) {
  await import('https://cdnjs.cloudflare.com/ajax/libs/core-js/3.45.1/minified.js')
}
import * as timelock from './index.js'

const isEncryption = location.pathname.includes('/encrypt.html')


function strToBin(str) {
  return new TextEncoder().encode(str)
}
function binToStr(bin) {
  return new TextDecoder().decode(bin)
}
function base64Decode(str) {
  return Uint8Array.fromBase64(str, {alphabet: 'base64url'})
}
function base64Encode(bin) {
  return bin.toBase64({alphabet: 'base64url'})
}

async function checksum(json) {
  const payload = strToBin(JSON.stringify(json))
  const buf = await crypto.subtle.digest('SHA-256', payload)
  const u32 = new Uint32Array(buf)
  return u32[0]
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
  return Math.round(hashPerSec / 1e6).toLocaleString() + ' MHash/s'
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
  txtSpeed.textContent = ''
  txtRemaining.textContent = '-'

  showError('')
  updateProgress(0)

  timeUsed = 0
  lastTime = Date.now()
  timerId = setInterval(onProgressTimer, 2000)
}

function endProgress() {
  clearInterval(timerId)
  txtRemaining.textContent = formatTime(0)
}

function onProgressTimer() {
  if (progressBar.value === 0) {
    return
  }
  const now = Date.now()
  timeUsed += now - lastTime
  lastTime = now

  const timePerCost = timeUsed / progressBar.value
  const remain = progressBar.max - progressBar.value

  txtRemaining.textContent = formatTime(remain * timePerCost | 0)
  txtSpeed.textContent = '(' + formatSpeed(curHashPerSec) + ')'
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

function updateDecryptUi(isRunning) {
  txtCipher.disabled = isRunning
  txtPlain.disabled = isRunning
  btnDecrypt.disabled = isRunning
}

let curHashPerSec = 0

async function onDecryptButtonClick() {
  const input = parseDecryptParams()
  if (!input || typeof input !== 'object') {
    showError('invalid input')
    return
  }
  const chksumExp = input.checksum
  input.checksum = ''

  const chksumGot = await checksum(input)
  if (chksumGot !== chksumExp) {
    showError('params corrupted')
    return
  }
  if (input.version !== 2) {
    showError('invalid version')
    return
  }
  const params = {
    cost: input.cost,
    salt: base64Decode(input.salt),
    cipher: base64Decode(input.cipher),
    seedLen: input.seedLen,
    seedNum: input.seedNum,
    seeds: base64Decode(input.seeds),
  }
  updateDecryptUi(true)

  txtPlain.value = ''
  curHashPerSec = 0
  startProgress(input.cost)

  const plainBin = await timelock.decrypt.start(params, (percent, speed) => {
    curHashPerSec = speed
    updateProgress(percent)
  })
  endProgress()

  if (plainBin) {
    txtPlain.value = binToStr(plainBin)
  } else {
    showError('decrypt failed')
  }
  updateDecryptUi(false)
}


function updateEncryptUi(isRunning) {
  txtPlain.disabled = isRunning
  txtCipher.disabled = isRunning
  txtCost.disabled = isRunning
  txtThread.disabled = isRunning

  btnEncrypt.disabled = isRunning
  btnShare.disabled = isRunning
}

async function onEncryptButtonClick() {
  if (!txtPlain.value) {
    showError('input is empty')
    return
  }
  if (!txtCost.validity.valid || !txtThread.validity.valid) {
    showError('invalid params')
    return
  }
  const cost = +txtCost.value

  const params = {
    plain: strToBin(txtPlain.value),
    seedLen: Math.min(window.SEED_LEN, 32),
    thread: +txtThread.value,
    cost,
  }
  txtPlain.value = ''
  txtCipher.value = ''

  updateEncryptUi(true)
  startProgress(cost)

  const output = await timelock.encrypt.start(params, (percent, speed) => {
    curHashPerSec = speed
    updateProgress(percent)
  })
  const json = {
    version: 2,
    cost,
    iter: output.iter,
    salt: base64Encode(output.salt),
    cipher: base64Encode(output.cipher),
    seedLen: output.seedLen,
    seedNum: output.seedNum,
    seeds: base64Encode(output.seeds),
    checksum: '',
  }
  json.checksum = await checksum(json)

  txtCipher.value = JSON.stringify(json, null, 2)
  endProgress()
  updateEncryptUi(false)
}


function onShareButtonClick() {
  const params = parseDecryptParams()
  if (!params) {
    return
  }
  const url = new URL(location.href)
  url.pathname = url.pathname.replace('/encrypt.html', '/decrypt.html')
  url.hash = new URLSearchParams(params)

  navigator.clipboard.writeText(url)
  alert('link copied')
}

function onCostChange() {
  const cost = +txtCost.value
  txtProgMax.textContent = cost

  if (benchmarkSpeed) {
    const hashNum = cost * 1e6
    const seconds = hashNum / benchmarkSpeed
    txtEstimatedTime.textContent = formatTime(seconds * 1000)
  }
}

function readDecryptParams() {
  const frag = location.hash.substring(1)
  if (!frag) {
    return
  }
  const query = new URLSearchParams(frag)
  const params = {
    version: +query.get('version'),
    cost: +query.get('cost'),
    salt: query.get('salt'),
    cipher: query.get('cipher'),
    seedLen: +query.get('seedLen'),
    seedNum: +query.get('seedNum'),
    seeds: query.get('seeds'),
    checksum: +query.get('checksum'),
  }
  txtCipher.value = JSON.stringify(params, null, 2)
}


async function showBattery() {
  const battery = await navigator.getBattery()
  const update = () => {
    if (battery.charging) {
      batteryItem.hidden = true
    } else {
      batteryItem.hidden = false
      txtBatteryLevel.textContent = battery.level * 100 | 0
    }
  }
  battery.onchargingchange = update
  battery.onlevelchange = update
  update()
}

let benchmarkSpeed = 0

async function benchmark(iter) {
  const opt = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: crypto.getRandomValues(new Uint8Array(16)),
    iterations: iter
  }
  const k = await crypto.subtle.importKey(
    'raw', Uint8Array.of(0), 'PBKDF2', false, ['deriveBits']
  )
  const t0 = performance.now()
  await crypto.subtle.deriveBits(opt, k, 256)
  const t1 = performance.now()

  return iter / (t1 - t0) * 1000 * 2
}

async function initEncryptPage() {
  window.SEED_LEN = 4

  const ok = await timelock.encrypt.init()
  if (!ok) {
    showError('WebGPU is not available')
    return
  }
  btnEncrypt.onclick = onEncryptButtonClick
  btnShare.onclick = onShareButtonClick

  txtCost.oninput = onCostChange
  
  if (navigator.getBattery) {
    showBattery()
  } else {
    batteryItem.hidden = true
  }

  // warmup
  await benchmark(1e5)  
  benchmarkSpeed = await benchmark(1e6)
  onCostChange()
  console.log('decryption benckmark:', formatSpeed(benchmarkSpeed))
}

async function initDecryptPage() {
  window.onhashchange = readDecryptParams
  readDecryptParams()
  btnDecrypt.onclick = onDecryptButtonClick
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