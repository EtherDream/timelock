#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <openssl/evp.h>
#include <openssl/sha.h>
#include <openssl/aes.h>
#include <openssl/hmac.h>


int main() {
  int in_len = 1024 * 1024 * 64;
  // int in_len = 1024;
  uint8_t* in_buf = malloc(in_len);
  memset(in_buf, 0, in_len);

  //
  // HMAC
  //
  uint8_t hmac[64];

  for (int i = 0; i < 10; i++) {
    uint8_t data[1] = {0};

    clock_t begin = clock();
    HMAC(EVP_sha512(), in_buf, in_len, data, sizeof(data), hmac, NULL);
    clock_t end = clock();

    double time_spent = (double)(end - begin) / CLOCKS_PER_SEC * 1000;
    printf("hmac: %fms\n", time_spent);
  }

  for (int i = 0; i < 10; i++) {
    printf("%d ", hmac[i]);
  }
  printf("\n");

  //
  // Hash
  //
  uint8_t hash[SHA512_DIGEST_LENGTH];

  for (int i = 0; i < 10; i++) {
    EVP_MD_CTX *ctx = EVP_MD_CTX_new();
    EVP_DigestInit(ctx, EVP_sha512());

    clock_t begin = clock();
    EVP_DigestUpdate(ctx, in_buf, in_len);
    clock_t end = clock();

    EVP_DigestFinal_ex(ctx, hash, NULL);

    double time_spent = (double)(end - begin) / CLOCKS_PER_SEC * 1000;
    printf("sha: %fms\n", time_spent);
  }

  for (int i = 0; i < 10; i++) {
    printf("%d ", hash[i]);
  }
  printf("\n");


  //
  // AES
  //
  uint8_t key[16] = {0};
  uint8_t iv[16] = {0};
  uint8_t* out_buf = malloc(in_len);
  int out_len;

  for (int i = 0; i < 10; i++) {
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    EVP_CipherInit(ctx, EVP_aes_128_cbc(), key, iv, 1);
    EVP_CIPHER_CTX_block_size(ctx);

    clock_t begin = clock();
    EVP_CipherUpdate(ctx, out_buf, &out_len, in_buf, in_len);
    clock_t end = clock();

    double time_spent = (double)(end - begin) / CLOCKS_PER_SEC * 1000;
    printf("aes: %fms\n", time_spent);

    EVP_CIPHER_CTX_free(ctx);
  }

  for (int i = 0; i < 10; i++) {
    printf("%d ", out_buf[i]);
  }
  printf("\n");

  return 0;
}