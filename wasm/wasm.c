#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define EXPORT       __attribute__((used))

// SHA256 utils
#define Ch(x, y, z)   ((x & (y ^ z)) ^ z)
#define Maj(x, y, z)  ((x & (y | z)) | (y & z))
#define SHR(x, n)     (x >> n)
#define ROTR(x, n)    ((x >> n) | (x << (32 - n)))

#define S0(x)         (ROTR(x,  2) ^ ROTR(x, 13) ^ ROTR(x, 22))
#define S1(x)         (ROTR(x,  6) ^ ROTR(x, 11) ^ ROTR(x, 25))
#define s0(x)         (ROTR(x,  7) ^ ROTR(x, 18) ^ SHR(x, 3))
#define s1(x)         (ROTR(x, 17) ^ ROTR(x, 19) ^ SHR(x, 10))

#define RND(a, b, c, d, e, f, g, h, k)  \
  t0 = h + S1(e) + Ch(e, f, g) + k;     \
  t1 = S0(a) + Maj(a, b, c);            \
  d += t0;                              \
  h  = t0 + t1;


static const uint32_t K[64] = {
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
  0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
  0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
  0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
  0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
  0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
  0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
  0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
  0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
};

static const uint32_t SHA256_STATE[8] = {
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
};

#if 0x44434241 == 'ABCD'
  static inline uint32_t be32(uint32_t x) { return x; }
  static inline uint64_t be64(uint64_t x) { return x; }
#else
  static inline uint32_t be32(uint32_t value) {
    return __builtin_bswap32(value);
  }
  static inline uint64_t be64(uint64_t value) {
    return __builtin_bswap64(value);
  }
#endif


typedef struct {
  uint32_t state[8];
  uint8_t buf[64];
  uint64_t count;
} sha256_ctx;

typedef struct {
  sha256_ctx inner;
  sha256_ctx outer;
} hmac_sha256_ctx;

enum {
  MAX_THREAD = 1024 * 128,
  SALT_LEN = 16,
  HASH_LEN = 32,
};

typedef uint32_t u32x8[8];

u32x8 ctx_w_arr[MAX_THREAD];
u32x8 ctx_r_arr[MAX_THREAD];

static struct {
  u32x8 inner_state;
  u32x8 outer_state;
} start_ctx_arr[MAX_THREAD];

//
// 1st:  hash = pbkdf2(seed)
// 2nd+: hash = pbkdf2(hash)  input reuses output buffer
//
static union {
  // output
  uint8_t hashes[HASH_LEN * MAX_THREAD];

  // input (seed_len <= 32)
  uint8_t seeds[];
} io_buf;


// for test
void pbkdf2_loop(int id, int iter) {

  uint32_t r[8], w[8];
  uint32_t inner_state[8], outer_state[8];

  memcpy(r, ctx_r_arr[id], 32);
  memcpy(w, ctx_w_arr[id], 32);

  memcpy(inner_state, start_ctx_arr[id].inner_state, 32);
  memcpy(outer_state, start_ctx_arr[id].outer_state, 32);

  uint32_t W[16], S[8];
  uint32_t t0, t1;

  // bool inner_flag = true;

  memcpy(S, inner_state, 32);
  memcpy(W, w, 32);

  for (int i = iter * 2; i > 0; i--) {
    W[8] = 2147483648;  // 1 << 31
    W[9] = 0;
    W[10] = 0;
    W[11] = 0;
    W[12] = 0;
    W[13] = 0;
    W[14] = 0;
    W[15] = 768;        // bit len

    for (int t = 0; t < 64; t++) {
      int i = t & 15;

      if (t >= 16) {
        W[i] += W[(i + 9) & 15] + s1(W[(i + 14) & 15]) + s0(W[(i + 1) & 15]);
      }
      RND(
        S[(0 - t) & 7], S[(1 - t) & 7], S[(2 - t) & 7], S[(3 - t) & 7],
        S[(4 - t) & 7], S[(5 - t) & 7], S[(6 - t) & 7], S[(7 - t) & 7],
        W[i] + K[t]
      )
    }

    if ((i & 1) == 0) {
      // inner_flag is true
      for (int i = 0; i < 8; i++) {
        W[i] = S[i] + inner_state[i];
      }
      // inner_flag = false;
      memcpy(S, outer_state, 32);
    } else {
      for (int i = 0; i < 8; i++) {
        W[i] = S[i] + outer_state[i];
        r[i] ^= W[i];
      }
      // inner_flag = true;
      memcpy(S, inner_state, 32);
    }
  }

  memcpy(ctx_w_arr[id], W, 32);
  memcpy(ctx_r_arr[id], r, 32);

  // memcpy(start_ctx_arr[id].inner_state, inner_state, 32);
  // memcpy(start_ctx_arr[id].outer_state, outer_state, 32);
}


static void sha256_init(sha256_ctx *ctx) {
  memcpy(ctx->state, SHA256_STATE, sizeof(SHA256_STATE));
  ctx->count = 0;
}

static void sha256_transform(sha256_ctx *ctx, const uint32_t *buf) {
  uint32_t W[16], S[8];
  uint32_t t0, t1;

  memcpy(S, ctx->state, 32);

  for (int t = 0; t < 64; t++) {
    int i = t & 15;

    if (t < 16) {
      W[i] = be32(buf[i]);
    } else {
      W[i] += W[(i + 9) & 15] + s1(W[(i + 14) & 15]) + s0(W[(i + 1) & 15]);
    }
    RND(
      S[(0 - t) & 7], S[(1 - t) & 7], S[(2 - t) & 7], S[(3 - t) & 7],
      S[(4 - t) & 7], S[(5 - t) & 7], S[(6 - t) & 7], S[(7 - t) & 7],
      W[i] + K[t]
    )
  }
  for (int i = 0; i < 8; i++) {
    ctx->state[i] += S[i];
  }
}

static const uint8_t PADDING[64] = {
  0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

static void sha256_update(sha256_ctx *ctx, const void *in, size_t len) {
  const uint8_t *src = (uint8_t *) in;

  /* Number of bytes left in the buffer from previous updates. */
  int r = (ctx->count >> 3) & 0x3F;

  /* Update number of bits. */
  ctx->count += (uint64_t)(len) << 3;

  /* Handle the case where we don't need to perform any transforms. */
  if (len < 64 - r) {
    memcpy(&ctx->buf[r], src, len);
    return;
  }

  /* Finish the current block. */
  memcpy(&ctx->buf[r], src, 64 - r);
  sha256_transform(ctx, (uint32_t*) ctx->buf);
  src += 64 - r;
  len -= 64 - r;

  /* Perform complete blocks. */
  while (len >= 64) {
    sha256_transform(ctx, (uint32_t*) src);
    src += 64;
    len -= 64;
  }

  /* Copy left over data into buffer. */
  memcpy(ctx->buf, src, len);
}

static void sha256_pad(sha256_ctx * ctx) {
  /*
   * Convert length to a vector of bytes -- we do this now rather
   * than later because the length will change after we pad.
   */
  uint64_t len = be64(ctx->count);

  /* Add 1--64 bytes so that the resulting length is 56 mod 64. */
  int r = (ctx->count >> 3) & 0x3F;
  int plen = (r < 56) ? (56 - r) : (120 - r);
  sha256_update(ctx, PADDING, plen);

  /* Add the terminating bit-count. */
  sha256_update(ctx, &len, 8);
}

static void sha256_final(sha256_ctx *ctx, uint32_t out[8]) {
  sha256_pad(ctx);

  for (int i = 0; i < 8; i++) {
    out[i] = be32(ctx->state[i]);
  }
}

static void hmac_sha256_init(hmac_sha256_ctx *ctx, const uint8_t *key) {
  uint8_t inner[64];
  uint8_t outer[64];

  for (int i = 0; i < 64; i++) {
    inner[i] = 0x36 ^ key[i];
    outer[i] = 0x5C ^ key[i];
  }
  sha256_init(&ctx->inner);
  sha256_update(&ctx->inner, inner, sizeof(inner));

  sha256_init(&ctx->outer);
  sha256_update(&ctx->outer, outer, sizeof(outer));
}

static void hmac_sha256_update(hmac_sha256_ctx *ctx, const void *data, size_t len) {
  sha256_update(&ctx->inner, data, len);
}

static void hmac_sha256_final(hmac_sha256_ctx *ctx, uint32_t out[8]) {
  sha256_final(&ctx->inner, out);
  sha256_update(&ctx->outer, out, 32);
  sha256_final(&ctx->outer, out);
}

static uint8_t salt_buf[64] = {0};


EXPORT void pbkdf2_pre(int thread, int seed_len, int seq) {

  uint8_t pwd_buf[64] = {0};

  for (int p = 0; p < thread; p++) {
    memcpy(pwd_buf, &io_buf.seeds[seed_len * p], seed_len);

    hmac_sha256_ctx start_ctx;
    hmac_sha256_init(&start_ctx, pwd_buf);

    uint32_t ublock[16] = {0};
    ublock[8] = 0x80;
    ublock[15] = 0x30000;

    const uint32_t seed_id = be32(p);
    const uint32_t seq_id = be32(seq);

    memcpy(&salt_buf[SALT_LEN + 0], &seed_id, 4);
    memcpy(&salt_buf[SALT_LEN + 4], &seq_id, 4);

    hmac_sha256_ctx ctx = start_ctx;
    hmac_sha256_update(&ctx, salt_buf, SALT_LEN + 8);

    const uint32_t count = be32(1);
    hmac_sha256_update(&ctx, &count, sizeof(count));
    hmac_sha256_final(&ctx, ublock);

    for (int i = 0; i < 8; i++) {
      ublock[i] = be32(ublock[i]);
    }
    memcpy(ctx_r_arr[p], ublock, 32);
    memcpy(ctx_w_arr[p], ublock, 32);

    memcpy(start_ctx_arr[p].inner_state, start_ctx.inner.state, 32);
    memcpy(start_ctx_arr[p].outer_state, start_ctx.outer.state, 32);
  }
}

EXPORT void pbkdf2_post(size_t thread) {
  uint32_t* hashes_u32 = (uint32_t*) io_buf.hashes;

  for (int p = 0; p < thread; p++) {
    for (int i = 0; i < 8; i++) {
      hashes_u32[p * 8 + i] = be32(ctx_r_arr[p][i]);
    }
  }
}

EXPORT void* get_io_buf() {
  return &io_buf;
}

EXPORT void* get_salt_buf() {
  return salt_buf;
}

EXPORT void* get_start_ctx_buf() {
  return start_ctx_arr;
}

EXPORT void* get_ctx_w_buf() {
  return ctx_w_arr;
}

EXPORT void* get_ctx_r_buf() {
  return ctx_r_arr;
}
