import * as timelock from './timelock.js'

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
  const sortedMap = {}
  Object.keys(json).sort().forEach(s => {
    sortedMap[s] = json[s]
  })
  const payload = strToBin(JSON.stringify(sortedMap))
  const buf = await crypto.subtle.digest('SHA-256', payload)
  const bin = new Uint8Array(buf, 0, 4)
  return base64Encode(bin)
}

function formatTime(sec) {
  const time = new Date(sec).toISOString().slice(11, 19)
  const day = sec / 86400000 | 0
  if (day) {
    return `${day}day ${time}`
  }
  return time
}

function showError(msg) {
  txtError.textContent = msg
}

let startTime
let timerId

function updateProgress(value) {
  const percent = (value / progressBar.max) * 100
  txtProgPercent.textContent = percent.toFixed(2)
  progressBar.value = value
  txtProgVal.textContent = value
}

function startProgress(cost) {
  isRunning = true
  fieldset.disabled = true
  progressBar.max = cost
  txtProgMax.textContent = cost
  txtRemaining.textContent = 'estimating...'

  showError('')
  updateProgress(0, cost)

  startTime = Date.now()
  timerId = setInterval(updateTime, 2000)
}

function endProgress() {
  txtRemaining.textContent = '-'
  fieldset.disabled = false
  isRunning = false
  clearInterval(timerId)
}

function updateTime() {
  const completedCost = progressBar.value
  if (completedCost === 0) {
    return
  }
  const timeUsed = Date.now() - startTime
  const timePerCost = timeUsed / completedCost

  const remainCost = progressBar.max - completedCost
  txtRemaining.textContent = formatTime(remainCost * timePerCost)
}

function parseDecryptParams() {
  if (!txtCipher.value) {
    showError('ciphertext empty')
    return
  }
  try {
    return JSON.parse(txtCipher.value)
  } catch {
    showError('invalid format')
  }
}

btnDecrypt.onclick = async function() {
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
    cipher: base64Decode(input.cipher),
    cost,
    seeds:  base64Decode(input.seeds),
    salt: base64Decode(input.salt),
  }
  txtPlain.value = ''
  startProgress(cost)

  let plainBin
  try {
    plainBin = await timelock.decrypt(params, (completedCost, hash) => {
      updateProgress(completedCost)
    })
  } catch (err) {
    showError(err.message)
    return
  }
  txtPlain.value = binToStr(plainBin)
  endProgress()
}

btnEncrypt.onclick = async function() {
  if (!txtPlain.value) {
    showError('plaintext empty')
    return
  }
  txtCipher.value = ''

  const cost = +txtCost.value
  if (cost > 1e10) {
    showError('too much cost')
    return
  }
  startProgress(cost)

  const plain = txtPlain.value
  const cpuThread = +txtCpuThread.value
  const params = {
    plain: strToBin(plain),
    cost,
    cpuThread,
  }
  const output = await timelock.encrypt(params, (completedCost) => {
    updateProgress(completedCost)
  })
  const json = {
    version: '0.0.1',
    cost: output.cost,
    cipher: base64Encode(output.cipher),
    seeds: base64Encode(output.seeds),
    salt: base64Encode(output.salt),
    check: '',
  }
  json.check = await hashParams(json)

  txtCipher.value = JSON.stringify(json, null, 2)
  endProgress()
}

btnShare.onclick = function() {
  const params = parseDecryptParams()
  if (!params) {
    return
  }
  const url = new URL(location.href)
  url.hash = new URLSearchParams(params)
  navigator.clipboard.writeText(url)
  alert('link copied')
}

function readDecryptParams() {
  const input = location.hash.substring(1)
  if (!input) {
    return
  }
  const params = new URLSearchParams(input)
  const json = Object.fromEntries(params)
  json.cost >>>= 0
  txtCipher.value = JSON.stringify(json, null, 2)
  txtCost.value = json.cost
}
window.onhashchange = readDecryptParams


window.onbeforeunload = function() {
  if (isRunning) {
    return 'do you want to leave?'
  }
}

function main() {
  txtCpuThread.value = navigator.hardwareConcurrency

  if (!isSecureContext) {
    showError('This program must be hosted on HTTPS or localhost')
  }
  readDecryptParams()
}
main()