# Timelock

The sender encrypts the message and the receiver cannot decrypt it immediately, but must wait for a specified time before seeing the message.

Data and algorithms are public, no servers are required.

## Demo

https://etherdream.github.io/timelock/

## Test

https://etherdream.github.io/timelock/#iter=30&key=0xF9C2255127986BD3&cipher=0xF38626AA8BEC4E5E2DDCFF8987BB79440ABEF08693DFC5299DACBB

Click the "Decrypt" button and the message will be decrypted after ~30s.

## How it works

Encryption:

```javascript
key = gen_random_bytes()
dk = key

for i = 1 to cost
  dk = pbkdf2_sha256(dk, '', 1e7)

ciphertext = aes_encrypt(plaintext, dk)
```

Output `key`, `cost` and `ciphertext`, the temporary value `dk` will be discarded.

Decryption:

```javascript
dk = key

for i = 1 to cost
  dk = pbkdf2_sha256(dk, '', 1e7)

plaintext = aes_decrypt(ciphertext, dk)
```

This program uses `PBKDF2_SHA256` with 10 million iterations as the delay function for encryption and decryption, which takes about 1s per call on recent CPU generations.

Why call PBKDF2 multiple times instead of just once with a larger iteration parameter? Because PBKDF2 in the browser does not support callbacks and cannot get progress, so large iterations are split into multiple serial calls to avoid this problem. This makes no difference in crypto strength.

You may have noticed that **this solution is silly because encryption takes the same time as decryption**. In theory, encryption can be done quickly. For example, the authors of the RSA explained how to implement time-lock puzzles in [this paper](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf) decades ago.

Of course, these algorithms can be ported to the browser, but obviously it will not run as efficiently as native programs because a lot of performance will be lost in the JavaScript/WebAssembly VM. For impatient receivers, there is no need to decrypt the message in the browser, it can be done earlier using a native program.

Since browsers support PBKDF2 natively and are optimized for it, using this API reduces the performance gap between browsers and native programs. Although this is not friendly to the sender, it makes no difference to the receiver.

However, fast encryption can still be tried. We can pre-compute `<key, dk>` records for common costs using idle devices, and take a record directly from the pool when we use it. For hourly or even daily costs, this is feasible.


## Known issues

FireFox is not optimized for PBKDF2（~50% slower)


## When to use

* CPU performance benchmarks.

* Post a CPU race on SNS, the first person to unlock it will get a coupon link. It is more interesting to compete on hardware than on luck.

* Temporarily lock an account, such as hiding the wallet private key in a time capsule. Let Moore's Law take over your account, not your spirit.
