#include <stdint.h>
#include <stdio.h>
#include <time.h>

// 8 placeholder constants (0x1000007F, odd), filled at runtime
const uint32_t C1 = 0x1000007F;
const uint32_t C2 = 0x1000007F;
const uint32_t C3 = 0x1000007F;
const uint32_t C4 = 0x1000007F;
const uint32_t C5 = 0x1000007F;
const uint32_t C6 = 0x1000007F;
const uint32_t C7 = 0x1000007F;
const uint32_t C8 = 0x1000007F;


__attribute__((used))
uint64_t mulxor(uint64_t seed, uint32_t loop) {
  uint32_t a = (uint32_t)seed;
  uint32_t b = (uint32_t)(seed >> 32);

  for (uint32_t i = loop; i > 0; i--) {
    a *= C1; b ^= a;
    b *= C2; a ^= b;

    a *= C3; b ^= a;
    b *= C4; a ^= b;

    a *= C5; b ^= a;
    b *= C6; a ^= b;

    a *= C7; b ^= a;
    b *= C8; a ^= b;
  }
  return ((uint64_t)b << 32) | a;
}

int main() {
  clock_t t0 = clock();
  uint64_t result = mulxor(1234567890, 1e9);
  clock_t t1 = clock();

  int elapsed = (t1 - t0) * 1000 / CLOCKS_PER_SEC;
  printf("result: %llu time: %d ms\n", result, elapsed);
  return 0;
}