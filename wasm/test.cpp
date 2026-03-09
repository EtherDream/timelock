#include "wasm.c"
#include <iostream>
#include <fstream>
#include <vector>


int main() {
  int thread;
  int iter;

  if (char* s = getenv("THREAD")) {
    thread = std::stoi(s);
  } else {
    std::cerr << "missing env.THREAD\n";
    return 1;
  }

  if (char* s = getenv("ITER")) {
    iter = std::stoi(s);
  } else {
    std::cerr << "missing env.ITER\n";
    return 1;
  }

  uint32_t* seed_buf = (uint32_t*) get_io_buf();
  uint8_t* result_buf = (uint8_t*) get_io_buf();

  // max seed_len
  const int seed_len = 32;

  for (int p = 0; p < thread; p++) {
    for (int i = 0; i < 8; i++) {
      seed_buf[p * 8 + i] = p;
    }
  }

  uint32_t* salt_buf = (uint32_t*) get_salt_buf();
  salt_buf[0] = 0x00112233;
  salt_buf[1] = 0x44556677;
  salt_buf[2] = 0x8899AABB;
  salt_buf[3] = 0xCCDDEEFF;

  // input
  pbkdf2_pre(thread, seed_len, 0);

  // GPU
  for (int p = 0; p < thread; p++) {
    pbkdf2_loop(p, iter);
  }

  // output
  pbkdf2_post(thread);


  // read test data
  std::vector<uint8_t> exp_hash_buf(thread * HASH_LEN);
  std::ifstream ifs(".test-data.bin", std::ios::binary);
  ifs.read((char*) exp_hash_buf.data(), exp_hash_buf.size());


  for (int p = 0; p < thread; p++) {
    uint8_t* hash_got = &result_buf[p * HASH_LEN];
    uint8_t* hash_exp = &exp_hash_buf[p * HASH_LEN];

    if (memcmp(hash_got, hash_exp, HASH_LEN)) {
      printf("incorrect! thread: %d\n", p);
      printf("exp: ");
      for (int i = 0; i < 32; i++) {
        printf("%02x", hash_exp[i]);
      }
      printf("\n");
      printf("got: ");
      for (int i = 0; i < 32; i++) {
        printf("%02x", hash_got[i]);
      }
      printf("\n");
      return 1;
    }
  }

  printf("correct\n");
  return 0;
}