# 基于浏览器的时间锁：把信息发送到未来

> 想象一下，你写了一个锦囊妙计，但希望对方只能在一段时间后才能打开。这时候，你需要一种神奇的密码学技术 —— **时间锁（Time-Lock Puzzle）**。

## 1. 最直观的思路：丢弃密钥，然后暴力破解

时间锁的核心需求很简单：加密很容易，但解密必须花费指定的时间。

最直观的想法是这样的：

1. 生成一个随机密钥 K
2. 用 K 加密消息，得到密文 C
3. **丢弃 K**，只保留 C
4. 解密者只能通过暴力枚举所有可能的密钥来尝试解密

听起来很完美？等等，这里有个致命问题。

假设你设计了一个 40 位的密钥空间，期望解密者需要枚举 $2^{40}$ ≈ 1 万亿次才能找到正确的密钥。如果单次枚举需要 1 微秒，那么总时间大约是 $10^6$ 秒 ≈ 11.5 天。

但解密者可以召唤 1000 台机器同时暴力破解！这样实际等待时间就缩短到了 11.5 天 / 1000 ≈ 16 分钟。

问题的根源在于：暴力破解是可并行化的。每个密钥的尝试都是独立的，互不依赖。只要你有足够的硬件资源，就能线性地加速解密过程。

这就引出了时间锁的核心原则：解密过程无法并行化。

## 2. RSA 时间锁：用串行平方建造时间胶囊

1996 年，Ron Rivest（RSA 算法中的 R）、Adi Shamir（S）和 David Wagner 在论文 [《Time-Lock Puzzles and Timed-Release Crypto》](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf) 中提出了一个基于 RSA 的时间锁，它利用了**模幂运算的串行特性** 计算：

$$x_T = x^{2^T} \pmod n$$

若知道 $n$ 的质因数分解，就能将指数 $2^T$ 约成一个短指数，用快速幂很快算出；否则只能老老实实地做 $T$ 次模平方：

* 第 1 步：$x_1 = x^2 \pmod n$
* 第 2 步：$x_2 = x_1^2 \pmod n$
* 第 3 步：$x_3 = x_2^2 \pmod n$
* ...
* 第 T 步：$x_T = x_{T-1}^2 \pmod n$

每一步都依赖前一步的输出，无法并行加速。

加密者可以预先计算好结果作为“提示”，而解密者必须一步一步地平方 $T$ 次才能得到最终结果。这个过程本质上是串行的，无法通过并行计算加速。

RSA 时间锁的美妙之处在于：

- **加密成本很低**：加密者只需计算一次模幂
- **解密成本可控**：通过调整 T 的值控制解密时间
- **天然抗并行化**：每一步都依赖前一步的结果，无法分工合作

## 3. 浏览器的困境：BigInt 为何撑不起时间锁

如果你想把 RSA 时间锁移植到浏览器中，很快就会遇到一个尴尬的问题：**JavaScript 的大数运算太慢了**。

虽然现代浏览器有 `BigInt`，但它是通用的大数运算，并不会为时间锁中的运算进行特殊优化。当然，你也可以使用 WebAssembly 直接移植原始算法，但由于虚拟机的开销，以及缺少针对特定平台的极致优化，这会比成熟的本地库慢不少。

假设你期望接收者在浏览器里花费 5 小时解密，但使用本地程序……可能只需 1 小时。没有耐心的接收者完全可用原生程序来解密，比你的预期提前数小时看到结果。

**时间锁的计算“贬值”了。**

## 4. WebCrypto 登场：浏览器原生慢函数

既然浏览器的大数运算靠不住，那我们能不能找一个**浏览器原生支持** 的耗时函数呢？

答案是：WebCrypto API 的 **PBKDF2** 函数。

PBKDF2（Password-Based Key Derivation Function 2）是一个标准的密钥派生函数，被广泛用于密码存储和密钥生成。其核心操作是重复执行某个 Hash 函数（例如 HMAC-SHA256）成千上万次，故意让 Hash 计算变得“昂贵”，从而大幅提高数据库泄露后攻击者“跑字典”的成本。

由于是原生实现，这些函数会使用 CPU 加速指令，例如 x86 的 SHA-NI、ARMv8 Crypto Extensions 等，从而弥补和本地程序的性能差距。

因此我们尝试用它实现一个不是很“正宗”但仍可用的时间锁。

## 5. 加密过程：并行蓄能，链式传递

![](https://oss-ata.alibaba.com/article/2026/03/d1e570f0-df2b-42d9-87e7-99c3d0883f59.png)

```bash
# 1. 生成 P 个随机种子（上述图中 P 为 4）
seed[1..P] = random_bytes()

# 2. 计算每个种子的慢哈希（使用 GPU 加速）
for i = 1 to P
    hash[i] = slow_hash(seed[i])

# 3. 第一个哈希值，作为密钥 key 的初始值
key = hash[1]

for i = 2 to P
    # 4. 使用 key 加密第 i 个种子
    encrypted_seed[i] = encrypt(seed[i], key)

    # 5. 使用第 i 个哈希值，派生出新的 key
    key = encrypt(hash[i], key)

# 6. 使用最终的 key 加密消息
ciphertext = encrypt(plaintext, key)
```

公开内容：

* 密文 `ciphertext`
* 第一个明文种子 `seed[1]`
* 后续加密的种子 `encrypted_seed[2..P]`
* 盐值 `salt`

演示：https://etherdream.github.io/timelock/encrypt.html

## 6. 解密过程：串行计算，无法加速

![](https://oss-ata.alibaba.com/article/2026/03/c2ae9156-b127-49ca-979d-52cddbe67571.png)

```bash
# 1. 计算第一个种子的哈希值，作为密钥 key 的初始值
key = slow_hash(seed[1])

for i = 2 to P
    # 2. 使用 key 解密出第 i 个种子
    seed = decrypt(encrypted_seed[i], key)

    # 3. 计算该种子的哈希值
    hash = slow_hash(seed)

    # 4. 使用哈希值，派生出新的 key
    key = decrypt(hash, key)

# 5. 使用最终的 key 解密消息
plaintext = decrypt(ciphertext, key)
```

由于每一步都依赖上一步的结果，因此无论你的 CPU 有多少核心，都无法加速这个过程！

演示：https://etherdream.github.io/timelock/decrypt.html

[解密测试](https://etherdream.github.io/timelock/decrypt.html#version=2&cost=1000&salt=BleKXJAoxHh4IuEcGKajyA%3D%3D&cipher=Ldl2d5p3gxBNIUhtU9BFIp-4C_ShZUJRQ7jkRNavsbxy54Ac6Som5En3&seedLen=4&seedNum=64&seeds=8miYnIiIkE7xLWHDuoWIyC-6_6Wq35gs_CocC5XnIljbULyTua8kdJDjIT6CVsZTO2XwzMeZ0X27W_Nf_shqt-2oBbMUJw7PUkYiwwpSA4m7dI2Vu92qC2xDT1uzFfMsHQmyEdw-6Wbxis7T3_3g-N4eKc7OVz62jdWwgxhzEE0MbJwjFEmfbwg7a7wH1850BcC3-irK7zEf_0Z5R7A008xfA4s0xqYQmASW-O43Evh-_-Mbfy4YSbk-8TwdDn0YsfGrLEmqcMNAC-U1jcXMZ_e2cuJ41si1EZXqDcegtW2qFP8sLQq8imaY2bvU_iRb3GA8AkdPigNqzCD3QYPqgg%3D%3D&checksum=2799229604)。点击 Decrypt 按钮，大约一分钟后可解开。

细心的你也许注意到，加密过程虽然可用 GPU 加速，但计算总量和解密是一样的。因此，这算不上是一个好的时间锁；严格意义上的时间锁，加密的计算量应远小于解密。不过对于解密者来说，区别倒是不大。

演示源码：https://github.com/EtherDream/timelock/

<details>
<summary>关于更多技术细节，可展开查看</summary>

## 7. WebCrypto 的局限性与改进

使用 WebCrypto PBKDF2 存在两个限制：

1. 无进度反馈：WebCrypto 不提供迭代过程中的进度回调，因此用户无法感知实时进展。

2. 迭代次数上限：PBKDF2 的迭代次数为 32 位无符号整数，难以支撑超长时间的需求。

为此，我们采用“分段接力”策略：将 slow_hash 拆解成多个串行调用的 PBKDF2 子任务，每个子任务使用较小的迭代次数：

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

这样不仅可实时展示进度和灵活存档，还可突破单次迭代的次数上限。本项目中 small_iter 最大为 2000 万，在最新的桌面 CPU 上大约 1 秒钟。

## 8. 优化种子长度

加密时，每个 GPU 线程处理一个种子。然而 GPU 通常有成千上万的并发数，这意味着产出的种子密文会占用可观的空间。如果每个种子密文 32 字节，那么 10000 个则需 32 KB，这对分享（例如通过超链接参数）是一个不小的负担。

然而 slow hash 本身非常耗时，攻击者想通过“超大并发”的离线计算来绕过串行，成本是极高的。因此我们可使用更短的种子密文，例如演示中甚至只用 4 字节（明文和密文都是 4 字节）。

4 个字节听起来很不安全，但回顾加密过程：

![](https://oss-ata.alibaba.com/article/2026/03/4d9e04cf-39be-422a-b8a2-4830ced8e5d8.png)

最终的 key 是层层依赖的，例如 key4 依赖于 key3，key3 又依赖于 key2 …… 即使每个种子只有 4 字节的空间，但攻击者无法从最后一个种子直接破解，而必须计算前面所有步骤。

> 要使用更长的种子，可在浏览器控制台中修改 `SEED_LEN` 变量。

## 9. 增加离线计算的攻击成本

此外，我们还可进一步增强安全性：在每次调用 PBKDF2 时，将种子序号 **p** 和子任务序号 **i** 融入到 salt 中：

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

这样攻击者必须针对每一个 *(p, i)* 组合单独建表，这使得离线计算的成本增加 *P * loop* 倍。

## 10. PBKDF2 的缺陷

虽然 WebCrypto 会使用 CPU 加速指令提升性能，但对于特定算法的 PBKDF2，例如 PBKDF2_SHA256，经过针对性的优化后仍可提升不少性能。例如 [fastpbkdf2](https://github.com/ctz/fastpbkdf2) 相比 Chrome 使用的 BoringSSL 仍快一些，相比 OpenSSL 甚至快数倍。

因此攻击者仍可利用实现层面的优势更早解密消息，而无法做到和本地程序完全一样的公平性。

</details>