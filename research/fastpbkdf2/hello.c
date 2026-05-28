#include <stdio.h>
#include <string.h>
#include <time.h>
#include "fastpbkdf2/fastpbkdf2.h"


int main() {
  char *pwd = "HelloWorld";
  char *salt = "salt1234";

  // size_t in_len = 32;
  // char* in_buf = malloc(in_len);
  // memset(in_buf, 0, in_len);

  // uint8_t salt[1];
  uint8_t hash[32];

  for (int i = 0; i < 1; i++) {
    clock_t begin = clock();

    fastpbkdf2_hmac_sha256((uint8_t*) pwd, strlen(pwd),
                          (uint8_t*) salt, strlen(salt),
                          2e7, hash, 32);

    clock_t end = clock();

    double time_spent = (double)(end - begin) / CLOCKS_PER_SEC * 1000;
    printf("[%d] pbkdf2_sha256: %fms\n", i, time_spent);

    printf("[%d] ", i);
    for (int j = 0; j < 10; j++) {
      printf("%d ", hash[j]);
    }
    printf("\n");
  }
  return 0;
}