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

function formatSpeed(hps) {
  if (hps >= 1e9) {
    return (hps / 1e9).toFixed(1) + ' GH/s'
  }
  return (hps / 1e6).toFixed(1) + ' MH/s'
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
}

function endProgress() {
  clearInterval(timerId)
  updateProgress(1)
  txtRemaining.textContent = formatTime(0)
}

function refreshProgressUi(hps) {
  const doneHashes = progressBar.value * 1e9
  const remainHashes = progressBar.max * 1e9 - doneHashes
  const remainMs = remainHashes / hps * 1000
  txtSpeed.textContent = '(' + formatSpeed(hps) + ')'
  txtRemaining.textContent = formatTime(remainMs | 0)
}

function startTimer(module) {
  timerId = setInterval(() => {
    const spd = module.speed
    if (!spd) {
      return
    }
    updateProgress(module.percent)
    refreshProgressUi(spd)
  }, 2000)
}

function parseDecryptParams() {
  if (!txtCipher.value) {
    showError('ciphertext is empty')
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
  if (input.version !== 3) {
    showError('invalid version')
    return
  }
  const params = {
    cost: input.cost,
    ciphertext: base64Decode(input.ciphertext),
    seedNum: input.seedNum,
    seedData: base64Decode(input.seedData),
    constants: new Uint32Array(input.constants),
    iv: base64Decode(input.iv),
  }
  updateDecryptUi(true)

  txtPlain.value = ''
  startProgress(input.cost)
  startTimer(timelock.decrypt)

  const plainBin = await timelock.decrypt.start(params)
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
    plaintext: strToBin(txtPlain.value),
    thread: +txtThread.value,
    constants: window.CONSTANTS,
    cost,
  }
  txtCipher.value = ''

  updateEncryptUi(true)
  startProgress(cost)
  startTimer(timelock.encrypt)

  let output
  try {
    output = await timelock.encrypt.start(params)
  } catch (e) {
    showError(e.message)
    endProgress()
    updateEncryptUi(false)
    return
  }
  const json = {
    version: 3,
    cost,
    ciphertext: base64Encode(output.ciphertext),
    seedNum: output.seedNum,
    seedData: base64Encode(output.seedData),
    constants: [...output.constants],
    iv: base64Encode(output.iv),
    checksum: '',
  }
  json.checksum = await checksum(json)

  txtCipher.value = JSON.stringify(json, null, 2)
  txtPlain.value = ''
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
    const totalHashes = cost * 1e9
    const seconds = totalHashes / benchmarkSpeed
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
    ciphertext: query.get('ciphertext'),
    seedNum: +query.get('seedNum'),
    seedData: query.get('seedData'),
    constants: (query.get('constants') || '').split(',').map(Number),
    iv: query.get('iv'),
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


async function initEncryptPage() {
  window.CONSTANTS = new Uint32Array([
    0x85EBCA6B,  // MurmurHash3
    0xC2B2AE35,  // MurmurHash3
    0x9E3779B9,  // xxHash
    0x27D4EB2F,  // xxHash
    0xED5AD4BB,  // lowbias32
    0xAC4C1B51,  // lowbias32
    0xBF58476D,  // SplitMix
    0x94D049BB,  // SplitMix
  ])

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
  timelock.decrypt.init()

  await timelock.decrypt.benchmark()
  benchmarkSpeed = timelock.decrypt.speed
  onCostChange()
  console.log('decryption benchmark:', formatSpeed(benchmarkSpeed))
}

async function initDecryptPage() {
  timelock.decrypt.init()

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