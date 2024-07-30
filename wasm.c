#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define WASM_FN       __attribute__((used))

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

// WebGL type
typedef struct {
  uint32_t r;
  uint32_t g;
  uint32_t b;
  uint32_t a;
} uvec4;

enum {
  MAX_GPU_THREAD = 65536,
  SALT_LEN = 12,
  HASH_LEN = 32,
};

// Ra[P], Rb[P], Wa[P], Wb[P]
// Ia[P], Ib[P], Oa[P], Ob[P]
static uvec4 pbkdf_ctx[8 * MAX_GPU_THREAD];

static uint8_t hashes_buf[HASH_LEN * MAX_GPU_THREAD];


// test only
// Wasm is 3x slower than WebCrypto
void pbkdf2_loop(int id, int gpu_thread, int iter) {
  uvec4* ra_arr = &pbkdf_ctx[gpu_thread * 0];
  uvec4* rb_arr = &pbkdf_ctx[gpu_thread * 1];

  uvec4* wa_arr = &pbkdf_ctx[gpu_thread * 2];
  uvec4* wb_arr = &pbkdf_ctx[gpu_thread * 3];

  uvec4* ia_arr = &pbkdf_ctx[gpu_thread * 4];
  uvec4* ib_arr = &pbkdf_ctx[gpu_thread * 5];

  uvec4* oa_arr = &pbkdf_ctx[gpu_thread * 6];
  uvec4* ob_arr = &pbkdf_ctx[gpu_thread * 7];

  uint32_t r[8], w[8], istate[8], ostate[8];

  memcpy(&r[0], &ra_arr[id], sizeof(uvec4));
  memcpy(&r[4], &rb_arr[id], sizeof(uvec4));

  memcpy(&w[0], &wa_arr[id], sizeof(uvec4));
  memcpy(&w[4], &wb_arr[id], sizeof(uvec4));

  memcpy(&istate[0], &ia_arr[id], sizeof(uvec4));
  memcpy(&istate[4], &ib_arr[id], sizeof(uvec4));

  memcpy(&ostate[0], &oa_arr[id], sizeof(uvec4));
  memcpy(&ostate[4], &ob_arr[id], sizeof(uvec4));


  typedef uint32_t uint;
  uint t0, t1;
  uint S0, S1, S2, S3, S4, S5, S6, S7;

  uint W16, W17, W18, W19, W20, W21, W22, W23;
  uint W24, W25, W26, W27, W28, W29, W30, W31;
  uint W32, W33, W34, W35, W36, W37, W38, W39;
  uint W40, W41, W42, W43, W44, W45, W46, W47;
  uint W48, W49, W50, W51, W52, W53, W54, W55;
  uint W56, W57, W58, W59, W60, W61, W62, W63;

  uint W00 = w[0];
  uint W01 = w[1];
  uint W02 = w[2];
  uint W03 = w[3];
  uint W04 = w[4];
  uint W05 = w[5];
  uint W06 = w[6];
  uint W07 = w[7];

  const uint W08 = 2147483648;
  const uint W09 = 0;
  const uint W10 = 0;
  const uint W11 = 0;
  const uint W12 = 0;
  const uint W13 = 0;
  const uint W14 = 0;
  const uint W15 = 768;

  int inner = 1;

  for (int i = 0; i < iter * 2; i++) {
    W16 = s1(W14) + W09 + s0(W01) + W00;
    W17 = s1(W15) + W10 + s0(W02) + W01;
    W18 = s1(W16) + W11 + s0(W03) + W02;
    W19 = s1(W17) + W12 + s0(W04) + W03;
    W20 = s1(W18) + W13 + s0(W05) + W04;
    W21 = s1(W19) + W14 + s0(W06) + W05;
    W22 = s1(W20) + W15 + s0(W07) + W06;
    W23 = s1(W21) + W16 + s0(W08) + W07;
    W24 = s1(W22) + W17 + s0(W09) + W08;
    W25 = s1(W23) + W18 + s0(W10) + W09;
    W26 = s1(W24) + W19 + s0(W11) + W10;
    W27 = s1(W25) + W20 + s0(W12) + W11;
    W28 = s1(W26) + W21 + s0(W13) + W12;
    W29 = s1(W27) + W22 + s0(W14) + W13;
    W30 = s1(W28) + W23 + s0(W15) + W14;
    W31 = s1(W29) + W24 + s0(W16) + W15;
    W32 = s1(W30) + W25 + s0(W17) + W16;
    W33 = s1(W31) + W26 + s0(W18) + W17;
    W34 = s1(W32) + W27 + s0(W19) + W18;
    W35 = s1(W33) + W28 + s0(W20) + W19;
    W36 = s1(W34) + W29 + s0(W21) + W20;
    W37 = s1(W35) + W30 + s0(W22) + W21;
    W38 = s1(W36) + W31 + s0(W23) + W22;
    W39 = s1(W37) + W32 + s0(W24) + W23;
    W40 = s1(W38) + W33 + s0(W25) + W24;
    W41 = s1(W39) + W34 + s0(W26) + W25;
    W42 = s1(W40) + W35 + s0(W27) + W26;
    W43 = s1(W41) + W36 + s0(W28) + W27;
    W44 = s1(W42) + W37 + s0(W29) + W28;
    W45 = s1(W43) + W38 + s0(W30) + W29;
    W46 = s1(W44) + W39 + s0(W31) + W30;
    W47 = s1(W45) + W40 + s0(W32) + W31;
    W48 = s1(W46) + W41 + s0(W33) + W32;
    W49 = s1(W47) + W42 + s0(W34) + W33;
    W50 = s1(W48) + W43 + s0(W35) + W34;
    W51 = s1(W49) + W44 + s0(W36) + W35;
    W52 = s1(W50) + W45 + s0(W37) + W36;
    W53 = s1(W51) + W46 + s0(W38) + W37;
    W54 = s1(W52) + W47 + s0(W39) + W38;
    W55 = s1(W53) + W48 + s0(W40) + W39;
    W56 = s1(W54) + W49 + s0(W41) + W40;
    W57 = s1(W55) + W50 + s0(W42) + W41;
    W58 = s1(W56) + W51 + s0(W43) + W42;
    W59 = s1(W57) + W52 + s0(W44) + W43;
    W60 = s1(W58) + W53 + s0(W45) + W44;
    W61 = s1(W59) + W54 + s0(W46) + W45;
    W62 = s1(W60) + W55 + s0(W47) + W46;
    W63 = s1(W61) + W56 + s0(W48) + W47;

    S0 = inner ? istate[0] : ostate[0];
    S1 = inner ? istate[1] : ostate[1];
    S2 = inner ? istate[2] : ostate[2];
    S3 = inner ? istate[3] : ostate[3];
    S4 = inner ? istate[4] : ostate[4];
    S5 = inner ? istate[5] : ostate[5];
    S6 = inner ? istate[6] : ostate[6];
    S7 = inner ? istate[7] : ostate[7];

    RND(S0, S1, S2, S3, S4, S5, S6, S7, W00 + 0x428A2F98u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W01 + 0x71374491u);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W02 + 0xB5C0FBCFu);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W03 + 0xE9B5DBA5u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W04 + 0x3956C25Bu);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W05 + 0x59F111F1u);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W06 + 0x923F82A4u);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W07 + 0xAB1C5ED5u);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W08 + 0xD807AA98u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W09 + 0x12835B01u);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W10 + 0x243185BEu);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W11 + 0x550C7DC3u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W12 + 0x72BE5D74u);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W13 + 0x80DEB1FEu);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W14 + 0x9BDC06A7u);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W15 + 0xC19BF174u);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W16 + 0xE49B69C1u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W17 + 0xEFBE4786u);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W18 + 0x0FC19DC6u);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W19 + 0x240CA1CCu);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W20 + 0x2DE92C6Fu);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W21 + 0x4A7484AAu);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W22 + 0x5CB0A9DCu);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W23 + 0x76F988DAu);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W24 + 0x983E5152u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W25 + 0xA831C66Du);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W26 + 0xB00327C8u);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W27 + 0xBF597FC7u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W28 + 0xC6E00BF3u);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W29 + 0xD5A79147u);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W30 + 0x06CA6351u);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W31 + 0x14292967u);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W32 + 0x27B70A85u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W33 + 0x2E1B2138u);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W34 + 0x4D2C6DFCu);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W35 + 0x53380D13u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W36 + 0x650A7354u);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W37 + 0x766A0ABBu);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W38 + 0x81C2C92Eu);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W39 + 0x92722C85u);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W40 + 0xA2BFE8A1u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W41 + 0xA81A664Bu);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W42 + 0xC24B8B70u);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W43 + 0xC76C51A3u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W44 + 0xD192E819u);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W45 + 0xD6990624u);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W46 + 0xF40E3585u);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W47 + 0x106AA070u);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W48 + 0x19A4C116u);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W49 + 0x1E376C08u);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W50 + 0x2748774Cu);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W51 + 0x34B0BCB5u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W52 + 0x391C0CB3u);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W53 + 0x4ED8AA4Au);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W54 + 0x5B9CCA4Fu);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W55 + 0x682E6FF3u);
    RND(S0, S1, S2, S3, S4, S5, S6, S7, W56 + 0x748F82EEu);
    RND(S7, S0, S1, S2, S3, S4, S5, S6, W57 + 0x78A5636Fu);
    RND(S6, S7, S0, S1, S2, S3, S4, S5, W58 + 0x84C87814u);
    RND(S5, S6, S7, S0, S1, S2, S3, S4, W59 + 0x8CC70208u);
    RND(S4, S5, S6, S7, S0, S1, S2, S3, W60 + 0x90BEFFFAu);
    RND(S3, S4, S5, S6, S7, S0, S1, S2, W61 + 0xA4506CEBu);
    RND(S2, S3, S4, S5, S6, S7, S0, S1, W62 + 0xBEF9A3F7u);
    RND(S1, S2, S3, S4, S5, S6, S7, S0, W63 + 0xC67178F2u);

    W00 = S0 + (inner ? istate[0] : ostate[0]);
    W01 = S1 + (inner ? istate[1] : ostate[1]);
    W02 = S2 + (inner ? istate[2] : ostate[2]);
    W03 = S3 + (inner ? istate[3] : ostate[3]);
    W04 = S4 + (inner ? istate[4] : ostate[4]);
    W05 = S5 + (inner ? istate[5] : ostate[5]);
    W06 = S6 + (inner ? istate[6] : ostate[6]);
    W07 = S7 + (inner ? istate[7] : ostate[7]);

    if (inner == 0) {
      r[0] ^= W00;
      r[1] ^= W01;
      r[2] ^= W02;
      r[3] ^= W03;
      r[4] ^= W04;
      r[5] ^= W05;
      r[6] ^= W06;
      r[7] ^= W07;
    }
    inner = !inner;
  }

  w[0] = W00;
  w[1] = W01;
  w[2] = W02;
  w[3] = W03;
  w[4] = W04;
  w[5] = W05;
  w[6] = W06;
  w[7] = W07;

  memcpy(&ra_arr[id], &r[0], sizeof(uvec4));
  memcpy(&rb_arr[id], &r[4], sizeof(uvec4));

  memcpy(&wa_arr[id], &w[0], sizeof(uvec4));
  memcpy(&wb_arr[id], &w[4], sizeof(uvec4));

  memcpy(&ia_arr[id], &istate[0], sizeof(uvec4));
  memcpy(&ib_arr[id], &istate[4], sizeof(uvec4));

  memcpy(&oa_arr[id], &ostate[0], sizeof(uvec4));
  memcpy(&ob_arr[id], &ostate[4], sizeof(uvec4));
}

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

static void sha256_init(sha256_ctx *ctx) {
  ctx->state[0] = 0x6A09E667;
  ctx->state[1] = 0xBB67AE85;
  ctx->state[2] = 0x3C6EF372;
  ctx->state[3] = 0xA54FF53A;
  ctx->state[4] = 0x510E527F;
  ctx->state[5] = 0x9B05688C;
  ctx->state[6] = 0x1F83D9AB;
  ctx->state[7] = 0x5BE0CD19;
  ctx->count = 0;
}

static void sha256_transform(sha256_ctx *ctx, const uint32_t *buf) {
  uint32_t W[64];
  uint32_t S[8];
  uint32_t t0, t1;

  for (int i = 0; i < 16; i++) {
    W[i] = be32(buf[i]);
  }
  for (int i = 16; i < 64; i++) {
    W[i] = s1(W[i - 2]) + W[i - 7] + s0(W[i - 15]) + W[i - 16];
  }

  memcpy(S, ctx->state, 32);

  for (int i = 0; i < 64; i++) {
    RND(
      S[(64 - i) % 8], S[(65 - i) % 8],
      S[(66 - i) % 8], S[(67 - i) % 8],
      S[(68 - i) % 8], S[(69 - i) % 8],
      S[(70 - i) % 8], S[(71 - i) % 8],
      W[i] + K[i]
    );
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
  const uint8_t *src = in;

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

WASM_FN
void pbkdf2_pre(size_t gpu_thread, size_t elem_len) {
  uvec4* ra_arr = &pbkdf_ctx[gpu_thread * 0];
  uvec4* rb_arr = &pbkdf_ctx[gpu_thread * 1];

  uvec4* wa_arr = &pbkdf_ctx[gpu_thread * 2];
  uvec4* wb_arr = &pbkdf_ctx[gpu_thread * 3];

  uvec4* ia_arr = &pbkdf_ctx[gpu_thread * 4];
  uvec4* ib_arr = &pbkdf_ctx[gpu_thread * 5];

  uvec4* oa_arr = &pbkdf_ctx[gpu_thread * 6];
  uvec4* ob_arr = &pbkdf_ctx[gpu_thread * 7];

  uint8_t pwd_buf[64] = {0};

  for (int p = 0; p < gpu_thread; p++) {
    memcpy(pwd_buf, &hashes_buf[elem_len * p], elem_len);

    hmac_sha256_ctx start_ctx;
    hmac_sha256_init(&start_ctx, pwd_buf);

    uint32_t ublock[16] = {0};
    ublock[8] = 0x80;
    ublock[15] = 0x30000;

    const uint32_t thread_id = be32(p);
    memcpy(&salt_buf[SALT_LEN], &thread_id, sizeof(thread_id));

    hmac_sha256_ctx ctx = start_ctx;
    hmac_sha256_update(&ctx, salt_buf, SALT_LEN + sizeof(thread_id));

    const uint32_t count = be32(1);
    hmac_sha256_update(&ctx, &count, sizeof(count));
    hmac_sha256_final(&ctx, ublock);

    for (int i = 0; i < 8; i++) {
      ublock[i] = be32(ublock[i]);
    }

    memcpy(&ra_arr[p], &ublock[0], sizeof(uvec4));
    memcpy(&rb_arr[p], &ublock[4], sizeof(uvec4));

    memcpy(&wa_arr[p], &ublock[0], sizeof(uvec4));
    memcpy(&wb_arr[p], &ublock[4], sizeof(uvec4));

    memcpy(&ia_arr[p], &start_ctx.inner.state[0], sizeof(uvec4));
    memcpy(&ib_arr[p], &start_ctx.inner.state[4], sizeof(uvec4));

    memcpy(&oa_arr[p], &start_ctx.outer.state[0], sizeof(uvec4));
    memcpy(&ob_arr[p], &start_ctx.outer.state[4], sizeof(uvec4));
  }
}

WASM_FN
void pbkdf2_post(size_t gpu_thread) {
  const uvec4* ra_arr = &pbkdf_ctx[gpu_thread * 0];
  const uvec4* rb_arr = &pbkdf_ctx[gpu_thread * 1];

  uvec4* r_arr = (uvec4*) hashes_buf;
  int p = 0;

  for (int i = 0; i < gpu_thread; i++) {
    r_arr[p++] = ra_arr[i];
    r_arr[p++] = rb_arr[i];
  }

  uint32_t* hashes_u32 = (uint32_t*) hashes_buf;
  for (int i = 0; i < gpu_thread * 8; i++) {
    hashes_u32[i] = be32(hashes_u32[i]);
  }
}

WASM_FN
void* get_salt_buf() {
  return salt_buf;
}

WASM_FN
void* get_hashes_buf() {
  return hashes_buf;
}

WASM_FN
void* get_ctx_buf() {
  return pbkdf_ctx;
}


// ./build-test.sh && ./test
int main() {
  enum {thread = 4};

  uint32_t seeds[thread];
  for (int p = 0; p < thread; p++) {
    seeds[p] = p;
  }
  const int seed_len = sizeof(seeds[0]);

  uint32_t* salt_buf = get_salt_buf();
  salt_buf[0] = 0x11223344;
  salt_buf[1] = 0x55667788;
  salt_buf[2] = 0xAABBCCDD;

  uint32_t* hashes = get_hashes_buf();
  memcpy(hashes, seeds, seed_len * thread);

  pbkdf2_pre(thread, seed_len);
  for (int p = 0; p < thread; p++) {
    pbkdf2_loop(p, thread, 1000);
  }
  pbkdf2_post(thread);

  for (int p = 0; p < thread; p++) {
    printf("[%d]\n", p);
    uint32_t* hash = &hashes[p * 8];

    for (int i = 0; i < 8; i++) {
      printf("  %d: %u\t(0x%08X)\n", i, hash[i], hash[i]);
    }
  }
  return 0;
}

/*** verify ***
const thread = 4
for (let i = 0; i < thread; i++) {
  pbkdf2_test(i)
}
async function pbkdf2_test(id, iter) {
  const pwd = Uint32Array.of(id)
  const salt = Uint32Array.of(0x11223344, 0x55667788, 0xAABBCCDD, 0)
  const view = new DataView(salt.buffer)
  view.setUint32(12, id)
  const k = await crypto.subtle.importKey('raw', pwd, 'PBKDF2', false, ['deriveBits'])
  const buf = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 1 + 1000,
    salt,
  }, k, 256)
  console.log(id, new Uint32Array(buf))
}
***************/