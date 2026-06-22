struct Params {
  iterations: u32,
  _rev0: u32,
  _rev1: u32,
  _rev2: u32,
};

@group(0) @binding(0)
var<uniform> input: Params;

@group(0) @binding(1)
var<storage, read_write> ctx_arr: array<vec2u>;

@group(0) @binding(2)
var<storage, read_write> dispatch_counts: array<u32>;

@compute @workgroup_size(__WORKGROUP_SIZE__)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>
) {
  let base = gid.x * 4;

  var a = vec4<u32>(
    ctx_arr[base + 0].x,
    ctx_arr[base + 1].x,
    ctx_arr[base + 2].x,
    ctx_arr[base + 3].x,
  );
  var b = vec4<u32>(
    ctx_arr[base + 0].y,
    ctx_arr[base + 1].y,
    ctx_arr[base + 2].y,
    ctx_arr[base + 3].y,
  );

  for (var i = input.iterations; i > 0; i--) {
    a *= __C1__; b ^= a;
    b *= __C2__; a ^= b;

    a *= __C3__; b ^= a;
    b *= __C4__; a ^= b;

    a *= __C5__; b ^= a;
    b *= __C6__; a ^= b;

    a *= __C7__; b ^= a;
    b *= __C8__; a ^= b;
  }

  ctx_arr[base + 0] = vec2u(a[0], b[0]);
  ctx_arr[base + 1] = vec2u(a[1], b[1]);
  ctx_arr[base + 2] = vec2u(a[2], b[2]);
  ctx_arr[base + 3] = vec2u(a[3], b[3]);

  dispatch_counts[gid.x]++;
}