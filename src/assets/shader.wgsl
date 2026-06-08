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
  let ctx = &ctx_arr[gid.x];
  var x = (*ctx).x;
  var y = (*ctx).y;

  for (var i = input.iterations; i > 0; i--) {
    x *= __C1__; y ^= x;
    y *= __C2__; x ^= y;

    x *= __C3__; y ^= x;
    y *= __C4__; x ^= y;

    x *= __C5__; y ^= x;
    y *= __C6__; x ^= y;

    x *= __C7__; y ^= x;
    y *= __C8__; x ^= y;
  }
  (*ctx).x = x;
  (*ctx).y = y;
  dispatch_counts[gid.x]++;
}