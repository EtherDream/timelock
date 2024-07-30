emcc wasm.c \
    -o src/assets/timelock.wasm \
    -O2 \
    -g2 \
    --no-entry \
    -flto \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -s SUPPORT_ERRNO=0 \
    -s SUPPORT_LONGJMP=0