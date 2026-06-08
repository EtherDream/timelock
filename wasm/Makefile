WAT_SRC  = mulxor.wat
WASM_OUT = ../src/assets/mulxor.wasm
NATIVE   = benchmark

.PHONY: all bench clean

all: $(NATIVE) $(WASM_OUT)

$(NATIVE): mulxor.c
	clang -O3 -o $@ $<

$(WASM_OUT): $(WAT_SRC)
	wat2wasm $< -o $@

bench: $(NATIVE) $(WASM_OUT)
	./$(NATIVE)
	node benchmark.mjs

clean:
	rm -f $(NATIVE)
