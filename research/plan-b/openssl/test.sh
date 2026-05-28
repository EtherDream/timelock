clang main.c \
  -O3 \
  -o test \
  -l ssl \
  -l crypto \
  -L/opt/homebrew/opt/openssl@3/lib \
  -I/opt/homebrew/opt/openssl@3/include
