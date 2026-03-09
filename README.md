# Timelock

A sender encrypts a message so that no one can decrypt it immediately; it can only be decrypted after a predetermined amount of time. Send information into the future.

All data and algorithms are public; no servers are required.

## Demo

### 🔐 Encryption

https://etherdream.github.io/timelock/encrypt.html

`Cost` is the decryption cost, i.e. the approximate number of SHA-256 computations required during decryption. The unit is MHash. (1 MHash = 1,000,000 hashes)

`GPUs` is the number of GPU threads used during encryption. More threads can distribute the work and reduce encryption time, but more seeds need to be stored. (1 thread = 1 seed)

> Your browser must support WebGPU; otherwise encryption will not work.

### 🔓 Decryption

https://etherdream.github.io/timelock/decrypt.html

Decryption is inherently single-threaded and runs on the CPU.

[Decryption Test](https://etherdream.github.io/timelock/decrypt.html#version=2&cost=1000&salt=tRpDsrCZQTgVqIhl-gabKg%3D%3D&cipher=MT2GJAqvNf-jZa7hFmzh6LPzSVUV16ewScbySq7E7yHY_6LRM33XMs3wrQ%3D%3D&seedLen=4&seedNum=256&seeds=5rwlIt0HLOi9bMfBaw5GVNEBWavk_SmqRzh6CCjdGq9oExqhihck5o7tyhadzTe9bHXqwZW9KRHeZRidRD3jsGEHJkiUf0u5Szg-FCMf8PQXDSVDeS9xXh-Hcx4qemMSmfQTiEUATye6d-YhRbdfWZGw_r2j0H8PV8Cj8gWMxOpSboXf9LP68HoqSSq34Zy2HFUGy1vVZOvv4u6YSpHOjz-gJsNus3qujNBTiPtIqZ0CTAXXsmEluheW159Q7Jkhu30aYrbpit7Ptpw_Unep0Z1QoCrJSG96m9YY26ObnX1l-JbTD0aNgavIuZPj-9N_HgEaBSui2cO75twUy3teYBQ0BfGhMReLQAqAT-WpmK4mTwfJdmpgwlLbXutt3ukvyQKYeKg2gjQI0dXIwpb9Jspkq1nsHALzSie-7hasTb-le95hM4FNKvGqNXPqan1JnpYrxYqXWA2sacoictSscjkjLqmoLASXVxuhnqPkDLpYTIcmetZh7QSyEH08GTIMPxntmB8eQGxuhAhzhUxpCSlWGOG2YuoDh7Z3acofA01trOB-vFK-FiECU-l1jlV4NzrgJm23ILQeDkvErlxIOShHxpsXmsA3saAllf3mbF3RiDr5vz6JFsmXWi3oY0fuCNMwkEB0D-MUyblPng1YjtdbQjhYM1lBOQFcXJrK-dZ79Sj2Ed4IdxujCSc-4wc9R4x8C1SRaCK9RNM4NTpPOrW_bSL8k1TrTfsXji4bwuVXEGM6JI3y_AeIif6_DmO01r3oVRP2Ffz6_74Vb56QmB3xD7y67oOJ6dpDhnmfehJD5o6zOiDsZSeinPF6gdCqCNZWDH01-S-nQKsweOTgQUIY4nFPG4cZcUW9TxIRyMS7i7_qFW43d-SiiqSTStUq46YaDbVzGDGAmEFyZ4WZsOg0BcI25dBDoco9VFxIPwgny_vrpvAh3ljugjTSBE_wvUQMdOGPzZxNvDTiaJTgE6LLLi8kr_1i1sBFLlgHMpeY1zSi0k5oT4SKzAVVMeIHgbtz24RKF8AW9Fardk4IEHykbhyfC0cPx0y407fw4s9c1Talr6shq2tKbxUC_zt-3wLcz3X5JOgua-Aw-EbHQ-_E9gNqwSgRue1XoDkZlVzcS298DS2Qv2w3YTsTMmntrxa_NstPdiNgfNPDC3-Dm7X1huXCm1tX5KJAQnJziIhGxR0ajM3YrWvMkgjvLcXU9kRWj6Q9PatURcIL6pXDuGBeR6j_95HYT4lY9vJ5VLosXrEkh0Eowm57-xqp8Fql14ZyrLSH09iukTvGULdpJx5Il-xPl9MUSEAf2raPbXY4SM1fDt_vQFUP6mmhRdG8euwTkw1HEcVIPKohHlUwkA%3D%3D&checksum=3948198976)

Click `Decrypt` to decrypt the message in ~1 minute.

## How it works

### 🔐 Encryption

![encryption](docs/images/encryption.webp)

```lua
seed[] = random_bytes()

-- parallel (GPU) --
for i = 1 to P
  hash[i] = slow_hash(seed[i])
end

key = hash[1]

for i = 2 to P
  encrypted_seed[i] = encrypt(seed[i], key)
  key = encrypt(hash[i], key)
end

ciphertext = encrypt(plaintext, key)
```

Share `ciphertext`, `seed[1]`, and `encrypted_seed[]`.


### 🔓 Decryption

![encryption](docs/images/decryption.webp)

```lua
key = slow_hash(seed[1])

for i = 2 to P
  seed = decrypt(encrypted_seed[i], key)
  hash = slow_hash(seed)
  key = decrypt(hash, key)
end

plaintext = decrypt(ciphertext, key)
```

Because each step depends on the previous output, decryption cannot be parallelized and must run sequentially.

## Why use slow hash

For time-lock puzzles, using a slow hash is not ideal because encryption requires roughly the same amount of work as decryption — although encryption can be sped up via parallelism.

A good time-lock scheme should make encryption much cheaper than decryption. For example, Rivest, Shamir, and Wagner described an RSA-based time-lock decades ago in [this paper](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf). Such schemes can be implemented in the browser, but they typically run less efficiently than native code due to VM overhead. An impatient receiver doesn’t have to decrypt in the browser — using a native program can finish earlier.

Browsers, however, natively support slow hash algorithms via WebCrypto PBKDF2. Using this API helps narrow the performance gap between browser and native environments. This makes encryption heavier for the sender, but it doesn’t affect the receiver.

<details>
<summary>What’s PBKDF2?</summary>
PBKDF2 is a wrapper around a PRF (here HMAC-SHA256) that repeats it for a configurable number of iterations, roughly:

```lua
function pbkdf2(password, salt, iter)
  hash = hmac_sha256(password, salt)

  for i = 2 to iter
    hash = hmac_sha256(hash, ...)
  end
  return hash
end
```
</details>

## About slow hash

WebCrypto PBKDF2 does not provide progress reporting, and the iteration count is bounded (up to 2<sup>32</sup>). To work around this, we split a large target iteration count into multiple smaller PBKDF2 calls:

```lua
function slow_hash(seed, iter)
  loop = iter / small_iter
  hash = seed

  for i = 1 to loop
    hash = pbkdf2_sha256(hash, salt, small_iter)
  end
  return hash
end
```

In this project, small_iter is up to `20,000,000`, which takes about 1 second on a recent desktop CPU.

<details>
<summary>Test</summary>

```js
const opt = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  salt: crypto.getRandomValues(new Uint8Array(16)),
  iterations: 2e7
}
const key = await crypto.subtle.importKey(
  'raw', Uint8Array.of(0), 'PBKDF2', false, ['deriveBits']
)
console.time('time')
await crypto.subtle.deriveBits(opt, key, 256)
console.timeEnd('time')
```
</details>

## About security

Because `slow_hash` is intentionally expensive, using parallelism to brute-force the seed space as a shortcut around the sequential decryption work is impractical. This allows us to use shorter seeds to reduce the output size; in this project, each seed is 4 bytes by default, and all seeds share a single 16-byte random salt.

To further harden the design, we incorporate the seed index `p` and the loop index `i` into the salt used by PBKDF2, making precomputation significantly harder.

```lua
function slow_hash(seed, iter, p)
  loop = iter / small_iter
  hash = seed

  for i = 1 to loop
    hash = pbkdf2_sha256(hash, salt || p || i, small_iter)
  end
  return hash
end
```

Without `p` and `i` in the salt, an attacker could compute `slow_hash` for the entire seed space in parallel for a fixed salt, which could turn the sequential decryption work into a large offline precomputation.

With `p` and `i` mixed into the salt, this must be repeated for every distinct `(p, i)`, increasing the attacker’s work by a factor of `P * loop`.

![decryption](docs/images/encryption-2.webp)

Because the final key is derived through a dependency chain (key4 depends on key3, which depends on key2, etc.), even though each seed is only 4 bytes, an attacker still cannot brute-force starting from the last seed alone; all seeds must be involved in the computation.

> To use longer seeds, modify `SEED_LEN` in the browser console.


## When to use

* CPU/GPU performance benchmarks.

* Posting a CPU race on social media: the first person to unlock it gets a coupon link. Competing on hardware is more interesting than competing on luck.

* Temporarily locking an account (e.g., storing a wallet key in a time capsule).
