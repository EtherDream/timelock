import fs from "node:fs"

const salt = Uint32Array.of(
  0x00112233, 0x44556677, 0x8899AABB, 0xCCDDEEFF,
  0, 0,
)
const view = new DataView(salt.buffer)
const opt = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 0,
  salt,
}

async function pbkdf2_test(seed, seq) {
  const pwd = new Uint32Array(8)
  pwd.fill(seed)

  view.setUint32(16, seed)
  view.setUint32(20, seq)

  const k = await crypto.subtle.importKey('raw', pwd, 'PBKDF2', false, ['deriveBits'])
  const digest = await crypto.subtle.deriveBits(opt, k, 256)

  return digest
}

async function main() {
  const thread = +process.env.THREAD
  if (!thread) {
    console.error('missing env.THREAD')
    return
  }
  const iter = +process.env.ITER
  if (!iter) {
    console.error('missing env.ITER')
    return
  }
  opt.iterations = iter + 1

  const bufs = []

  for (let p = 0; p < thread; p++) {
    const digest = await pbkdf2_test(p, 0)
    bufs.push(Buffer.from(digest))
  }
  fs.writeFileSync('.test-data.bin', Buffer.concat(bufs))
}

main()