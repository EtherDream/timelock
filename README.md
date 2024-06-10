# Timelock

The sender encrypts the message and the receiver cannot decrypt it immediately, but must wait for a specified time before seeing the message.

Data and algorithms are public, no servers are required.

## Demo

https://etherdream.github.io/timelock/

## Test

https://etherdream.github.io/timelock/#version=0.0.1&cost=30&cipher=wYta9UpqaR67wS_ROa4kZeELXnyPwR-nr5MPsqD1yOaQ7ZhuQiHt88Pskw&seeds=pD0WMcnIvbWMlyNoI9DgVnN1TYAVdflsR5_6D6de1UCwNA4GqXrUcA&salt=nRMSoM9DrlA&check=HR55lQ

Click the "Decrypt" button and the message will be decrypted after ~30s.

## How it works

### Encryption

![encryption](https://github.com/EtherDream/timelock/assets/1072787/d143de8b-0469-4816-b25d-cb1fdfa884c9)

```lua
-- parallel --
for i = 1 to P
  seed[i] = random_bytes()
  hash[i] = slow_hash(seed[i])
end

key = hash[1]

for i = 2 to P
  seed[i] ^= key
  key ^= hash[i]
end

ciphertext = encrypt(plaintext, key)
```

`P` is the parallel number (4 in the illustration). Each seed can be slow-hashed in parallel, e.g. using GPUs or even distributed devices. Finally all seeds (except the first one) will be encrypted, with each key depending on its previous hash.

Share `ciphertext` and `seed[]`.


### Decryption

![decryption](https://github.com/EtherDream/timelock/assets/1072787/5f21e749-437a-44ed-9ed6-c79de615500e)

```lua
key = slow_hash(seed[1])

for i = 2 to P
  hash = slow_hash(seed[i] ^ key)
  key ^= hash
end

plaintext = decrypt(ciphertext, key)
```

Since each key depends on its previous result, decryption cannot be accelerated in parallel, only serially.

## Why use slow hash

For time-lock puzzles, using slow hash is a bad strategy because encryption takes the same amount of work as decryption, although encryption can be accelerated by parallelization.

In theory, encryption takes much less work than decryption. For example, authors of the RSA explained how to implement time-lock puzzles in [this paper](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf) decades ago. Of course, these algorithms can be ported to the browser, but obviously it will not run as efficiently as native programs because a lot of performance will be lost in the JavaScript/WebAssembly VM. For impatient receivers, there is no need to decrypt the message in the browser, it can be done earlier using a native program.

However browsers natively support slow hash algorithms (`PBKDF2`) and have optimized them, using this API reduces the performance gap between browsers and native programs. Although this is not friendly to the sender, it makes no difference to the receiver.

## About slow hash

Unfortunately WebCrypto PBKDF2 does not provide a way to get progress, pause and resume, and has a maximum limit on iterations (2<sup>32</sup>). To avoid these problems, we split a single large iteration into multiple small calls.

```lua
function slow_hash(dk)
  for i = 1 to cost_pre_thread
    id = thread_id * cost_pre_thread + i
    dk = pbkdf2_sha256(dk, salt ^ id, 1e7)
  end
  return dk
end
```

This program uses `PBKDF2_SHA256` with 10 million iterations as the delay function, which takes about 1s per call on recent CPU generations.

We mix the call count (`id` above) into the salt to make pre-computation more difficult.

## Known issues

* Firefox: PBKDF2 is not optimized.（~50% slower)

* Chrome: PBKDF2 cannot be run in parallel. (if it's a feature, I will consider using wasm instead)


## When to use

* CPU performance benchmarks.

* Post a CPU race on SNS, the first person to unlock it will get a coupon link. It is more interesting to compete on hardware than on luck.

* Temporarily lock an account, such as hiding the wallet private key in a time capsule. Let Moore's Law take over your account, not your spirit.


## TODO

* Using WebGL2/WebGPU for parallel computing

* Support saving and restoring progress

* Shorten the seed length without reducing crypto strength