(module
  (func $mulxor (export "mulxor") (param $seed i64) (param $loop i32) (result i64)
    (local $a i32)
    (local $b i32)
    (local.set $b (i32.wrap_i64 (i64.shr_u (local.get $seed) (i64.const 32))))
    (local.set $a (i32.wrap_i64 (local.get $seed)))
    (block $exit
      (br_if $exit (i32.eqz (local.get $loop)))
      (loop $iter

        ;; 8 placeholder constants (0x1000007F, odd), filled at runtime
        (local.set $a (i32.mul (local.get $a) (i32.const 0x1000007F)))
        (local.set $b (i32.xor (local.get $b) (local.get $a)))
        (local.set $b (i32.mul (local.get $b) (i32.const 0x1000007F)))
        (local.set $a (i32.xor (local.get $a) (local.get $b)))

        (local.set $a (i32.mul (local.get $a) (i32.const 0x1000007F)))
        (local.set $b (i32.xor (local.get $b) (local.get $a)))
        (local.set $b (i32.mul (local.get $b) (i32.const 0x1000007F)))
        (local.set $a (i32.xor (local.get $a) (local.get $b)))

        (local.set $a (i32.mul (local.get $a) (i32.const 0x1000007F)))
        (local.set $b (i32.xor (local.get $b) (local.get $a)))
        (local.set $b (i32.mul (local.get $b) (i32.const 0x1000007F)))
        (local.set $a (i32.xor (local.get $a) (local.get $b)))

        (local.set $a (i32.mul (local.get $a) (i32.const 0x1000007F)))
        (local.set $b (i32.xor (local.get $b) (local.get $a)))
        (local.set $b (i32.mul (local.get $b) (i32.const 0x1000007F)))
        (local.set $a (i32.xor (local.get $a) (local.get $b)))

        (br_if $iter (local.tee $loop (i32.sub (local.get $loop) (i32.const 1))))
      )
    )
    (i64.or
      (i64.extend_i32_u (local.get $a))
      (i64.shl (i64.extend_i32_u (local.get $b)) (i64.const 32))
    )
  )
)
