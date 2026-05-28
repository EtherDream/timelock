clang -O3 hello.c \
  -o test \
  -lfastpbkdf2 -Lfastpbkdf2 \
  -lcrypto -L /opt/homebrew/opt/openssl@3/lib
