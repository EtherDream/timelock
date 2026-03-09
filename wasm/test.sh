set -e

clang++ test.cpp -o .test \
    -fsanitize=address \
    -fsanitize=undefined \
    -fno-sanitize-recover=all \
    -fno-sanitize=null \
    -fno-sanitize=alignment


function wasm_test {
    echo "run (thread: $THREAD iter: $ITER)"
    node test.mjs
    ./.test
}

export THREAD=$((4))
export ITER=1000
wasm_test

export THREAD=$((1024 * 128))
export ITER=2
wasm_test