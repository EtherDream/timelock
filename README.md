# ⏳ Timelock

**Send a message into the future.** Encrypt it today, no one can read it until tomorrow — no server, no trust, just math and time.

## ✨ Features

- 🚀 **Near-native in the browser** — a short, register-only arithmetic core keeps WASM performance close to native
- 🔐 **GPU-powered encryption** — WebGPU parallel computation
- ⏱️ **Time-bound decryption** — sequential by design, with no known practical shortcut

## 🌐 Demo

### 🔐 [Encrypt](https://etherdream.github.io/timelock/encrypt.html)

- **Cost**: total iterations required for decryption (in billions)
- **GPUs**: number of GPU threads. More threads = faster encryption, but larger output

> Requires WebGPU support.

### 🔓 [Decrypt](https://etherdream.github.io/timelock/decrypt.html)

Single-threaded, CPU-only. The wait is the point.

> Try it: [a sample message unlockable in ~1 minute](https://etherdream.github.io/timelock/decrypt.html#version=3&cost=10&ciphertext=NohbF-0z3BYZGwcCC_FFg2SEqbWKcmaLLV59uXJnTJQeIybdRvCHeur1zqlkIAs5hbObyqJIZcYdlLtd9T9SkErH&seedNum=64&seedData=qACr7lbMZdOiYHmwLa5jw-YCCPpAaWE0g8iUYFRpXjiouK1RMl9T1pbrQvpqJlu6Eqmd6jyvyRGFNPI69V-nmsTEISR1fguvrf0yCgu8Xm6XzjyeTQE2ymrwP1wQZ0lsPNds9STg2Dbp37vc7t90BhGV-NonhH3DJiFR8i2xLmruSWkukyjePR1eKrS_dCQteOir_21xNpA1wcdcTR87xF1TFFYfw02QHqpyyeavVKO9-ENW1B64LgkSPpKJYq4kYay__J6SxNCk9Qd9jsM1f9NuobHI1YuJHzHmxNHndgElcYHCAP0fNhjrwazIo2EApqDeH1GzYoyZgKBvsGvPZ7vQeFAawwDt03630ovf6i7iJPda8G3K6sQ-xE-7X-nO0JZSWFno_6tfcVbMUuxipA5vjp3qN-5c3lDCywMng10rgVBwhgmKb0X9xxhKCtrpexqd0_sDXKZX2wWaeoAqOFRcrD01hEgtF2JUcYT_jllZcu0PLlZETEaB1Aec1wenqLSuvtMoJu9zqHy6lQkdqeB1biITH1wslJu18BFSEMq28CUhFqskp6etJFZ7N5SmfAoftDGbMxv_koOoLql78wj8W_k62C7IuCiNZkXv_mYDpOvRRVuXAVM_WT1R_Az-s2zHkx8qXESeIPoSvl04sh4AMFz4y2siN9AKnDddKis%3D&constants=2246822507%2C3266489909%2C2654435769%2C668265263%2C3982152891%2C2890668881%2C3210233709%2C2496678331&iv=BMdUB1o0btko4t8i&checksum=1224452476).

## 📊 Performance

|             Device                  | Encrypt (GPU) | Decrypt (CPU)  | Ratio       |
|-------------------------------------|---------------|----------------|-------------|
| MacBook Pro M1 (3.2 GHz)            | ~65 GH/s      | ~100 MH/s      | **~600×**   |
| GTX 1660 Ti / i5-9600K (4.6 GHz)    | ~190 GH/s     | ~140 MH/s      | **~1000×**  |
| RTX 5090 / i9-14900K (5.8 GHz)      | ~4 TH/s       | ~180 MH/s      | **~20000×** |

> Example: 5s encrypt → ~1 day decrypt

## ⚖️ Why Not RSA?

Rivest, Shamir, and Wagner proposed an [RSA-based time-lock](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf) decades ago. It's theoretically elegant but relies on big-integer modular exponentiation.

In the browser, big-integer modular exponentiation runs **~3× slower** than hand-optimized native libraries like GMP, which use assembly-level techniques (ADX/MULX, unrolled Montgomery multiplication) that browsers cannot match. An impatient user would simply use a native program to decrypt faster, defeating the purpose of a browser-based tool.

The same issue extends to hardware: big-integer arithmetic benefits much more from FPGA or ASIC acceleration, creating more room for specialized implementations to pull ahead.

**This project takes a different approach**: the algorithm uses only 32-bit multiply and XOR — simple operations in a very short, register-only hot loop, allowing WASM performance to stay close to native. This greatly reduces the incentive to leave the browser, and likely also limits the advantage of specialized hardware. **The trade-off is that encryption is no longer cheap: it requires about as much total computation as decryption, but parallelizes well on GPUs.**

| | RSA time-lock | This project |
|---|---|---|
| Encryption cost | $O(\log n)$ — very cheap | $O(n)$ — needs GPU parallelism |
| Browser decryption | ~3× slower than native | **≈ native speed** |

## ⚙️ How It Works

### Encryption

The GPU computes `slow_hash` for all seeds in parallel, then chains the results to encrypt each subsequent seed. The final key is used to encrypt the plaintext.

![encryption](docs/images/encryption.webp)

```lua
seed[1 .. P] = random_data()

-- parallel --
for i = 1 to P
  hash[i] = slow_hash(seed[i], cost / P)

-- chain --
key = hash[1]

for i = 2 to P
  encrypted_seed[i] = seed[i] XOR key
  key = key XOR hash[i]

ciphertext = encrypt(plaintext, key)
```

Share `seed[1]`, `encrypted_seed[2..P]`, and `ciphertext`.


### Decryption

![decryption](docs/images/decryption.webp)

```lua
key = slow_hash(seed[1], cost / P)

for i = 2 to P
  seed[i] = encrypted_seed[i] XOR key
  hash[i] = slow_hash(seed[i], cost / P)
  key = key XOR hash[i]

plaintext = decrypt(ciphertext, key)
```

Starting from `seed[1]`, each subsequent seed must be recovered using the current key, then hashed to derive the next one. This makes decryption sequential by construction.

## 🔁 The slow_hash

A simple multiplication-based delay function:

```c
// Default values selected from well-known PRNG/hash constants.
const uint32_t C1 = 0x85EBCA6B;  // MurmurHash3
const uint32_t C2 = 0xC2B2AE35;  // MurmurHash3
const uint32_t C3 = 0x9E3779B9;  // xxHash
const uint32_t C4 = 0x27D4EB2F;  // xxHash
const uint32_t C5 = 0xED5AD4BB;  // lowbias32
const uint32_t C6 = 0xAC4C1B51;  // lowbias32
const uint32_t C7 = 0xBF58476D;  // SplitMix
const uint32_t C8 = 0x94D049BB;  // SplitMix

uint64_t slow_hash(uint64_t seed, int n) {
  uint32_t a = seed;
  uint32_t b = seed >> 32;

  for (int i = 0; i < n; i++) {
    a *= C1; b ^= a;
    b *= C2; a ^= b;

    a *= C3; b ^= a;
    b *= C4; a ^= b;

    a *= C5; b ^= a;
    b *= C6; a ^= b;

    a *= C7; b ^= a;
    b *= C8; a ^= b;
  }
  return (uint64_t)b << 32 | a;
}
```
Strictly speaking, this is a **permutation**, not a hash — it has no compression and is invertible. An [earlier version](https://github.com/EtherDream/timelock/tree/pbkdf2) used WebCrypto PBKDF2-SHA256 as the slow hash. While conservative and well-studied, it has practical drawbacks for time-lock use:

- Browser implementations vary significantly in speed (Chrome is ~2× faster than Safari)
- Native libraries like [fastpbkdf2](https://github.com/ctz/fastpbkdf2) outperform even the fastest browser by ~10%
- CPUs with hardware acceleration (e.g. SHA-NI, ARMv8 Crypto Extensions) gain an unfair advantage over those without

The current approach reduces these gaps: it uses only very simple operations, leaving relatively little room for platform-specific optimization.

Additionally, its simplicity makes it highly efficient on GPU, yielding a much higher GPU-encrypt / CPU-decrypt speed ratio than PBKDF2.

### Why use MUL-XOR as a delay function?

Multiplication tends to mix bits more aggressively than addition or rotation, and for a delay function, a heavier primitive is a feature rather than a drawback.

But strong mixing alone is not enough — a delay function must also resist shortcut evaluation, with no known way to compute $f^n(x)$ significantly faster than iterating $f$ one step at a time.

- ❌ **Pure multiplication**: $f^n(x) = x \cdot C^n \bmod 2^{32}$, where $C^n$ is computable in $O(\log n)$ via fast exponentiation — unsuitable for a delay function.
- ❌ **Affine recurrences** (such as LCGs) are similarly reducible via a closed-form expression over $\mathbb{Z}/2^{32}\mathbb{Z}$.
- 🧩 **Alternating MUL and XOR** mixes operations from different algebraic structures: multiplication propagates carries across bit positions (ring $\mathbb{Z}/2^{32}\mathbb{Z}$), while XOR acts independently on each bit over $\mathrm{GF}(2)^{32}$. This disrupts the simple algebraic structure that makes purely multiplicative or affine recurrences easy to shortcut.

> This is design intuition, not a proof of sequential hardness.

### Implementation Note

Since `slow_hash` outputs only 64 bits, the final key has limited entropy. The actual implementation derives the AES key as `sha256(hash[1..P])`, producing a 256-bit key suitable for AES.

### Why not 64-bit multiplications?

The current `slow_hash` uses two 32-bit state variables with 32-bit multiplications internally. A variant using a single 64-bit state with 64-bit multiplications would offer stronger ASIC resistance:

```c
uint64_t slow_hash_64(uint64_t seed, int n) {
  while (n--) {
    seed *= 0xD1342543DE82EF95ULL;
    seed ^= seed >> 32;

    // ...
  }
  return seed;
}
```

On many modern CPUs, 32-bit and 64-bit integer multiplications have similar latency and often use the same underlying hardware path. However, a 32-bit multiplier has a shorter critical path in silicon, meaning a custom ASIC could clock 32-bit multiply faster — a potential advantage for attackers.

The trade-off is on the **encryption side**: GPU ALUs are natively 32-bit. Emulating 64-bit multiplication in a shader significantly reduces encryption throughput. Since this project relies on GPU parallelism to make encryption fast, 32-bit is the pragmatic choice — it maximizes the encrypt/decrypt time ratio that makes the time-lock effective.

### Custom Constants

You can override the default constants by setting `CONSTANTS` in the browser console before encrypting. They are included in the output, so decryption works automatically.

Constants are inlined into both WebGPU shader and WASM bytecode at runtime — zero overhead compared to hardcoded values.

### Roadmap

Beyond constants, future versions may support **randomized programs** — varying instruction sequences (e.g. bitwise rotations, shifts). Similar to [RandomX](https://github.com/tevador/RandomX)'s approach, this makes the algorithm itself non-fixed, increasing the difficulty of analysis and specialized hardware optimization.

## ⚠️ Caveats

This is an experimental time-lock construction, not a formally proven delay function. Unlike RSA-based time-locks, which are tied to well-studied number-theoretic assumptions, the sequential hardness here is heuristic.

The design is intended to avoid obvious shortcut structures, but no theorem rules out deeper attacks. No practical shortcut is currently known, but none has been proven impossible either.

Custom hardware may achieve constant-factor speedups, and real-world performance varies by CPU microarchitecture and implementation. Unlock times should therefore be treated as approximate rather than exact.

## 🕹️ Use Cases

- ⏰ **Time capsule** — lock a message until a specific date
- 🏁 **CPU race** — first to decrypt wins a prize (compete on hardware, not luck)
- 🔑 **Delayed key release** — publish encrypted content now, key unlocks later
- 📊 **Hardware benchmark** — measure your CPU and GPU performance
