clang wasm.c -o test \
    -D_DEBUG \
    -fsanitize=address \
    -fsanitize=undefined \
    -fno-sanitize-recover=all \
    -fno-sanitize=null \
    -fno-sanitize=alignment

# clang wasm.c -O3 -o test