struct Params {
  step: u32,
  _rev0: u32,
  _rev1: u32,
  _rev2: u32,
};

struct u32x8 {
  a: vec4u,
  b: vec4u,
};

struct StartCtx {
  inner_state: u32x8,
  outer_state: u32x8,
};

@group(0) @binding(0)
var<uniform> input: Params;

@group(0) @binding(1)
var<storage, read> start_ctxs: array<StartCtx>;

@group(0) @binding(2)
var<storage, read_write> ctx_w_arr: array<u32x8>;

@group(0) @binding(3)
var<storage, read_write> ctx_r_arr: array<u32x8>;


// inline
fn rotr(x: u32, n: u32) -> u32 {
  return (x >> n) | (x << (32u - n));
}
fn Sigma0(x: u32) -> u32 {
  return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u);
}
fn Sigma1(x: u32) -> u32 {
  return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u);
}
fn sigma0(x: u32) -> u32 {
  return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u);
}
fn sigma1(x: u32) -> u32 {
  return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u);
}
fn Ch(x: u32, y: u32, z: u32) -> u32 {
  return (x & y) ^ (~x & z);
}
fn Maj(x: u32, y: u32, z: u32) -> u32 {
  return (x & y) ^ (x & z) ^ (y & z);
}


const W08 = 2147483648;  // 1 << 31
const W09 = 0;
const W10 = 0;
const W11 = 0;
const W12 = 0;
const W13 = 0;
const W14 = 0;
const W15 = 768;        // bit len


@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>
) {
  // let start_ctx = &start_ctxs[gid.x];

  var inner_state = start_ctxs[gid.x].inner_state;
  var outer_state = start_ctxs[gid.x].outer_state;

  let ctx_w = &ctx_w_arr[gid.x];
  let ctx_r = &ctx_r_arr[gid.x];

  var Wa = (*ctx_w).a;    // W[0..3]
  var Wb = (*ctx_w).b;    // W[4..7]

  var Wc: vec4u;          // W[8..11]
  var Wd: vec4u;          // W[12..15]

  var Sa = inner_state.a;
  var Sb = inner_state.b;
  var t: u32;

  //
  // input.step is an even number.
  // inner_flag: true, false, true, false, ...
  //
  for (var i = input.step; i > 0u; i--) {

    // 0..15
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wa.x + 0x428A2F98u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wa.y + 0x71374491u; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wa.z + 0xB5C0FBCFu; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wa.w + 0xE9B5DBA5u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wb.x + 0x3956C25Bu; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wb.y + 0x59F111F1u; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wb.z + 0x923F82A4u; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wb.w + 0xAB1C5ED5u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + W08  + 0xD807AA98u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + W09  + 0x12835B01u; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + W10  + 0x243185BEu; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + W11  + 0x550C7DC3u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + W12  + 0x72BE5D74u; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + W13  + 0x80DEB1FEu; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + W14  + 0x9BDC06A7u; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + W15  + 0xC19BF174u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);

    // message schedule 1
    Wa.x += sigma1(W14)  + W09  + sigma0(Wa.y);
    Wa.y += sigma1(W15)  + W10  + sigma0(Wa.z);
    Wa.z += sigma1(Wa.x) + W11  + sigma0(Wa.w);
    Wa.w += sigma1(Wa.y) + W12  + sigma0(Wb.x);
    Wb.x += sigma1(Wa.z) + W13  + sigma0(Wb.y);
    Wb.y += sigma1(Wa.w) + W14  + sigma0(Wb.z);
    Wb.z += sigma1(Wb.x) + W15  + sigma0(Wb.w);
    Wb.w += sigma1(Wb.y) + Wa.x + sigma0(W08);

    Wc.x = W08 + sigma1(Wb.z) + Wa.y + sigma0(W09);
    Wc.y = W09 + sigma1(Wb.w) + Wa.z + sigma0(W10);
    Wc.z = W10 + sigma1(Wc.x) + Wa.w + sigma0(W11);
    Wc.w = W11 + sigma1(Wc.y) + Wb.x + sigma0(W12);
    Wd.x = W12 + sigma1(Wc.z) + Wb.y + sigma0(W13);
    Wd.y = W13 + sigma1(Wc.w) + Wb.z + sigma0(W14);
    Wd.z = W14 + sigma1(Wd.x) + Wb.w + sigma0(W15);
    Wd.w = W15 + sigma1(Wd.y) + Wc.x + sigma0(Wa.x);

    // 16..31
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wa.x + 0xE49B69C1u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wa.y + 0xEFBE4786u; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wa.z + 0x0FC19DC6u; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wa.w + 0x240CA1CCu; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wb.x + 0x2DE92C6Fu; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wb.y + 0x4A7484AAu; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wb.z + 0x5CB0A9DCu; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wb.w + 0x76F988DAu; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wc.x + 0x983E5152u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wc.y + 0xA831C66Du; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wc.z + 0xB00327C8u; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wc.w + 0xBF597FC7u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wd.x + 0xC6E00BF3u; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wd.y + 0xD5A79147u; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wd.z + 0x06CA6351u; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wd.w + 0x14292967u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);

    // message schedule 2
    Wa.x += sigma1(Wd.z) + Wc.y + sigma0(Wa.y);
    Wa.y += sigma1(Wd.w) + Wc.z + sigma0(Wa.z);
    Wa.z += sigma1(Wa.x) + Wc.w + sigma0(Wa.w);
    Wa.w += sigma1(Wa.y) + Wd.x + sigma0(Wb.x);

    Wb.x += sigma1(Wa.z) + Wd.y + sigma0(Wb.y);
    Wb.y += sigma1(Wa.w) + Wd.z + sigma0(Wb.z);
    Wb.z += sigma1(Wb.x) + Wd.w + sigma0(Wb.w);
    Wb.w += sigma1(Wb.y) + Wa.x + sigma0(Wc.x);

    Wc.x += sigma1(Wb.z) + Wa.y + sigma0(Wc.y);
    Wc.y += sigma1(Wb.w) + Wa.z + sigma0(Wc.z);
    Wc.z += sigma1(Wc.x) + Wa.w + sigma0(Wc.w);
    Wc.w += sigma1(Wc.y) + Wb.x + sigma0(Wd.x);

    Wd.x += sigma1(Wc.z) + Wb.y + sigma0(Wd.y);
    Wd.y += sigma1(Wc.w) + Wb.z + sigma0(Wd.z);
    Wd.z += sigma1(Wd.x) + Wb.w + sigma0(Wd.w);
    Wd.w += sigma1(Wd.y) + Wc.x + sigma0(Wa.x);

    // 32..47
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wa.x + 0x27B70A85u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wa.y + 0x2E1B2138u; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wa.z + 0x4D2C6DFCu; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wa.w + 0x53380D13u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wb.x + 0x650A7354u; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wb.y + 0x766A0ABBu; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wb.z + 0x81C2C92Eu; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wb.w + 0x92722C85u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wc.x + 0xA2BFE8A1u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wc.y + 0xA81A664Bu; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wc.z + 0xC24B8B70u; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wc.w + 0xC76C51A3u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wd.x + 0xD192E819u; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wd.y + 0xD6990624u; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wd.z + 0xF40E3585u; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wd.w + 0x106AA070u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);

    // message schedule 3
    Wa.x += sigma1(Wd.z) + Wc.y + sigma0(Wa.y);
    Wa.y += sigma1(Wd.w) + Wc.z + sigma0(Wa.z);
    Wa.z += sigma1(Wa.x) + Wc.w + sigma0(Wa.w);
    Wa.w += sigma1(Wa.y) + Wd.x + sigma0(Wb.x);
    Wb.x += sigma1(Wa.z) + Wd.y + sigma0(Wb.y);
    Wb.y += sigma1(Wa.w) + Wd.z + sigma0(Wb.z);
    Wb.z += sigma1(Wb.x) + Wd.w + sigma0(Wb.w);
    Wb.w += sigma1(Wb.y) + Wa.x + sigma0(Wc.x);
    Wc.x += sigma1(Wb.z) + Wa.y + sigma0(Wc.y);
    Wc.y += sigma1(Wb.w) + Wa.z + sigma0(Wc.z);
    Wc.z += sigma1(Wc.x) + Wa.w + sigma0(Wc.w);
    Wc.w += sigma1(Wc.y) + Wb.x + sigma0(Wd.x);
    Wd.x += sigma1(Wc.z) + Wb.y + sigma0(Wd.y);
    Wd.y += sigma1(Wc.w) + Wb.z + sigma0(Wd.z);
    Wd.z += sigma1(Wd.x) + Wb.w + sigma0(Wd.w);
    Wd.w += sigma1(Wd.y) + Wc.x + sigma0(Wa.x);

    // 48..63
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wa.x + 0x19A4C116u; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wa.y + 0x1E376C08u; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wa.z + 0x2748774Cu; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wa.w + 0x34B0BCB5u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wb.x + 0x391C0CB3u; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wb.y + 0x4ED8AA4Au; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wb.z + 0x5B9CCA4Fu; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wb.w + 0x682E6FF3u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);
    t = Sb.w + Sigma1(Sb.x) + Ch(Sb.x, Sb.y, Sb.z) + Wc.x + 0x748F82EEu; Sa.w += t; Sb.w = t + Sigma0(Sa.x) + Maj(Sa.x, Sa.y, Sa.z);
    t = Sb.z + Sigma1(Sa.w) + Ch(Sa.w, Sb.x, Sb.y) + Wc.y + 0x78A5636Fu; Sa.z += t; Sb.z = t + Sigma0(Sb.w) + Maj(Sb.w, Sa.x, Sa.y);
    t = Sb.y + Sigma1(Sa.z) + Ch(Sa.z, Sa.w, Sb.x) + Wc.z + 0x84C87814u; Sa.y += t; Sb.y = t + Sigma0(Sb.z) + Maj(Sb.z, Sb.w, Sa.x);
    t = Sb.x + Sigma1(Sa.y) + Ch(Sa.y, Sa.z, Sa.w) + Wc.w + 0x8CC70208u; Sa.x += t; Sb.x = t + Sigma0(Sb.y) + Maj(Sb.y, Sb.z, Sb.w);
    t = Sa.w + Sigma1(Sa.x) + Ch(Sa.x, Sa.y, Sa.z) + Wd.x + 0x90BEFFFAu; Sb.w += t; Sa.w = t + Sigma0(Sb.x) + Maj(Sb.x, Sb.y, Sb.z);
    t = Sa.z + Sigma1(Sb.w) + Ch(Sb.w, Sa.x, Sa.y) + Wd.y + 0xA4506CEBu; Sb.z += t; Sa.z = t + Sigma0(Sa.w) + Maj(Sa.w, Sb.x, Sb.y);
    t = Sa.y + Sigma1(Sb.z) + Ch(Sb.z, Sb.w, Sa.x) + Wd.z + 0xBEF9A3F7u; Sb.y += t; Sa.y = t + Sigma0(Sa.z) + Maj(Sa.z, Sa.w, Sb.x);
    t = Sa.x + Sigma1(Sb.y) + Ch(Sb.y, Sb.z, Sb.w) + Wd.w + 0xC67178F2u; Sb.x += t; Sa.x = t + Sigma0(Sa.y) + Maj(Sa.y, Sa.z, Sa.w);

    if ((i & 1) == 0) {   // inner_flag == true
      Wa = Sa + inner_state.a;
      Wb = Sb + inner_state.b;

      // inner_flag = false;
      Sa = outer_state.a;
      Sb = outer_state.b;
    } else {
      Wa = Sa + outer_state.a;
      Wb = Sb + outer_state.b;

      // inner_flag = true;
      Sa = inner_state.a;
      Sb = inner_state.b;

      (*ctx_r).a ^= Wa;
      (*ctx_r).b ^= Wb;
    }
  }

  (*ctx_w).a = Wa;
  (*ctx_w).b = Wb;
}