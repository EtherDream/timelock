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

[Decryption Test](https://etherdream.github.io/timelock/decrypt.html#version=2&cost=1000&salt=Q3OHRL0_1QILGjJqksF40g%3D%3D&cipher=yCyGJXWWy1ogKX3phWPmch0d1xOO7-ZfvQzoyFB3m9VcsGtqeYmL0XNrJd9PibB3NPLl5i_Y5XKG7H1RMzUUSjJ-6_K2N_kivk_YhC5UpvOo3cgFjA%3D%3D&seedLen=4&seedNum=512&seeds=sIVHmkGF5t5LvJalb7TloAIW-oVteu8c5rLLJ15QH2brHTyJFn0jYO5wT23KMfpo1RuxG-IFYyPQL-WXt1gjPzW_TdK0sX6pX3ik0KZm5edH9ZT2YIMPnrlWyclxVcH3cqdqcS-g7-ahKOJkORQGsbmV88b0G1ACMx9fQ_bm2TEv40VTY-_4s4xlmlJ339cj8JaU_qmvfKrBN1JXXyJq4HhNGxqb26dqHbYW5OLGmN96eQMFUoPLEdEcslwEk-l1FeXpTQl-kqBBWHL9XXvgQS4asQlnFhK0dVFJeUljv6P7sEF7fHh4z8SVxSHVgKBXspkct6FL61z1NX6xUOgV8fsF0iBw46iinwzst0zt9GfKm7wqcbybipLxDuhiaWdPxCYX3tzCIjUzDOI_0twtNrXAat50j1ss6zSPNJC5SR-nY7hF7PcQEAgRHoVFPcF50Ihm3AeOx933lzKXYi0CnVTZlFm2Xx7o9OzSwAFq6LWaiPxuljgfJy-rRkdp575Ss_QymYkR7bsziV8dS54PXOX_MdSLSHtD3y8SskyMxlxUjcbXoaZGUMRzKvh_3758O44tHdVFSrJHCVw8hcr0xVGXlFbKn0rBkOZ1FmyYWjeUdL3iblUGLsWoaIA8zK3J2NrUZ-H4cpLoV5GKtqCCK34UCdj6BO80Pk8RHEDzexx7K5umgWvNDP3bZ2ONjAOS7VwbKxzBahwPmnXEGDpCu1aKLHsOQsrARg1eBSd5JaL7oJhJF-6foP4bwK1wYD1RdPbzdxUW0mtm-uTTWJzZ8v-SuOUbXGSQ1jVL9Y3_eCG4pAhNMj4Hy16j1yhOq55359n5MNWrj8q8Emky08Vh61TqkDrMLpmjBHCrR6LU6WaJFWU1hiwLzEVG_Z7jpXRN0fPFlQvR_XZFkhF3F1_aMiwEQ6GgValjyrRFBbJGZZWASiNW99CYBiIE7B7twQHU34LEjUzeXcATfOpEuLn2DEwrjYshL97-6eCmInydm3a66KSRzoyn3WiqRAhYfD5jEVYAGHArevZY4ue0ZdSGN2hZ9-y9d5kknhqvigEK8EJDXyUIvZUHo-7LR9Oa8vF5a_tmPj465szqePcMMTO3KwZXKFJSnjgjMD-gGsZvh3Ex4w3WZVLzlXl36T-BGBlbU5RMLwGhQf-XDW0Fza6eV_NodSut6gozi90VL9pFQKSmR2c3KcpVfBOsHo7b5GbrEZi62snSPtLE3JoEDJ8fPKJwmKPSfUoy7767tM3tfJ8NWWQXCAcCDwVLFaSJ0-0nHCKj88jhPgK7g996K9xvliOsDdgRhdwZKqbp98QOXEfYREazbMYqAl3jNMr4UEmSQEBNxOYjq6niKXCGanb0_j0DkjJJrRmSzD-_feLwAMJ0jyUVcbTO5QCWtGIvTH3VX36SqTHsrRWBqKwZmiTefoVI8Wj5mymQZju-mJ013yki1lw-QMcycn4DSwVmywuhWaBCw-9Pr-05Y262F8hEjssVtgP_pOv0tM8-_baDRR7YO22NE6NQtDdbS35IJj8UFX__qmb32_VcttL6w3HzeaT8QTllPymVCe98DQmGFNW2lJe5vBf6VeTym2_Y2icCrSRPOMNSRfLbc2Ulm8mCL-_2fNfbc3lHbt_V6RR9eyNrTQbrcz2k5WSb0G3eQB4l_Ei1vxFGDjcGAFvw4oE99UgNWe3CS6ostTqBqEONDQlQBus_KHq9uxzVzKv5UGf4Nu0POF2ztFuSasLfSwo-9AU3hUwoaYkvZ-4ISS9q5YgXDTMoxt_cEWDo8wbXfi5xFRxJsIcJyn_QrlpUhercYzZ272KhOaL6IxsafPvEracdUta8IjSYFu1yn5rugDCN7PbPunpw7ghrG_PBenAN683tuaYL6AybQWDJ-ZWw1y4PCMRpbYOmu7WAglylPJ8H-GCldSzmxxqq4foSeK4JwguZN_g2t-q7d2eUwP2PmUMeuT48X58SAdsqrycsqIC3ADyv_V6qTSkNXiVum3vkYqmwx2c316ZULaFK4fD9CDZfp7ymNDUpKV9R0G4wmBGuX9eqC-vNGVnpMXZSXK3P0_lKI2my__e53REz8EG_3OL1S7HroQOu2Mzz8GOwAUWBxFcyR_2BcA5Au4k983CmvTcJ9uB91T0QeEK5vju3qB0-SC2gZzmuT-PQAHw_1RsPp-gqDxtgFIkMivfYYS3-LWR5y4qvD1Ax6cGuynwv5g_EaR5-nHHeR7rLEtuuW_8XF7JDeWP39RDKS_da6aVzB5EKhUwRj2yY1KJEy1Q-7TlPqdf75tQ7zFQ_pTKTa3YMuCeZ5KISZwHksctrh0S58ZxYu3zGVDyAxo6B4KSiqa233dtMDxiZc_NT-G26mRrXVgCjUHfjemZaDRkBmZSM_MElEIqY97NV_mw5Tv-9K04DHINsRPaYl6UvKc_mFevqEMq2v3Pzdf4rz9qjgFiGQwn5YUwgRtun_J2eUpuBuZ9PNo-oE23O8B_6JWzdI8qts6N2s3_XSKD6ITECna-TrYcoXY7MFZAQzsQYf6gZIxOKgp-_vkuDM_RKwaxpFIET2EpOvCkuQR7CxQzHDS0ropvxIdwvzi3JZbR5DYWpKKiOA3yxNz3X-bTT0pkSS3ISqYMtZEhWYhfImNNLW6ual3WbTd6oM0Zk626x7r2Jz5o3cxHuKhSBewjDQHhEChHshQKZ0EFSAx3mhgTDBEw7qXRJwTthjMHFUSGznYsmGsc%3D&checksum=2098817500)

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
  encrypted_seed[i] = xor(seed[i], key)
  key = xor(hash[i], key)
end

ciphertext = encrypt(plaintext, key)
```

Share `ciphertext`, `seed[1]`, and `encrypted_seed[]`.


### 🔓 Decryption

![decryption](docs/images/decryption.webp)

```lua
key = slow_hash(seed[1])

for i = 2 to P
  seed = xor(encrypted_seed[i], key)
  hash = slow_hash(seed)
  key = xor(hash, key)
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

![encryption](docs/images/encryption-2.webp)

Because the final key is derived through a dependency chain (key4 depends on key3, which depends on key2, etc.), even though each seed is only 4 bytes, an attacker still cannot brute-force starting from the last seed alone; all seeds must be involved in the computation.

> To use longer seeds, modify `SEED_LEN` in the browser console.


## When to use

* CPU/GPU performance benchmarks.

* Posting a CPU race on social media: the first person to unlock it gets a coupon link. Competing on hardware is more interesting than competing on luck.

* Temporarily locking an account (e.g., storing a wallet key in a time capsule).
