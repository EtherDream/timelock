#version 300 es

#define TEX_H   __TEX_H__

precision highp int;
precision highp float;
precision highp usampler2D;

uniform usampler2D in_tex;
uniform uint in_iter;


layout(location = 0) out uvec4 out_ra;
layout(location = 1) out uvec4 out_rb;
layout(location = 2) out uvec4 out_wa;
layout(location = 3) out uvec4 out_wb;

// SHA256 utils
#define Ch(x, y, z)   ((x & (y ^ z)) ^ z)
#define Maj(x, y, z)  ((x & (y | z)) | (y & z))
#define SHR(x, n)     (x >> n)
#define ROTR(x, n)    ((x >> n) | (x << (32 - n)))

#define S0(x)         (ROTR(x,  2) ^ ROTR(x, 13) ^ ROTR(x, 22))
#define S1(x)         (ROTR(x,  6) ^ ROTR(x, 11) ^ ROTR(x, 25))
#define s0(x)         (ROTR(x,  7) ^ ROTR(x, 18) ^ SHR(x, 3))
#define s1(x)         (ROTR(x, 17) ^ ROTR(x, 19) ^ SHR(x, 10))

#define RND(a, b, c, d, e, f, g, h, k)  \
  t0 = h + S1(e) + Ch(e, f, g) + k;     \
  t1 = S0(a) + Maj(a, b, c);            \
  d += t0;                              \
  h  = t0 + t1;


#if TEX_H == 1
  #define GET_Y(Y, I)   (I)
#else
  // y + i * texH
  #define GET_Y(Y, I)   (Y | (I * TEX_H))
#endif


void main() {
  uint x = uint(gl_FragCoord.x);
  uint y = uint(gl_FragCoord.y);

  uint t0, t1;
  uvec4 Sa, Sb;

  uvec4 Ra = texelFetch(in_tex, ivec2(x, GET_Y(y, 0u)), 0);
  uvec4 Rb = texelFetch(in_tex, ivec2(x, GET_Y(y, 1u)), 0);

  // W00, W01, W02, W03
  uvec4 Wa = texelFetch(in_tex, ivec2(x, GET_Y(y, 2u)), 0);

  // W04, W05, W06, W07
  uvec4 Wb = texelFetch(in_tex, ivec2(x, GET_Y(y, 3u)), 0);

  // W08, W09, W10, W11
  const uvec4 Wc = uvec4(2147483648u, 0u, 0u, 0u);

  // W12, W13, W14, W15
  const uvec4 Wd = uvec4(0u, 0u, 0u, 768u);

  // W16 - W63
  uvec4 We, Wf, Wg, Wh, Wi, Wj, Wk, Wl, Wm, Wn, Wo, Wp;

  uvec4 Ia = texelFetch(in_tex, ivec2(x, GET_Y(y, 4u)), 0);
  uvec4 Ib = texelFetch(in_tex, ivec2(x, GET_Y(y, 5u)), 0);
  uvec4 Oa = texelFetch(in_tex, ivec2(x, GET_Y(y, 6u)), 0);
  uvec4 Ob = texelFetch(in_tex, ivec2(x, GET_Y(y, 7u)), 0);

  bool inner = true;

  for (uint i = in_iter; i != 0u; i--) {
    We.rg = s1(Wd.ba) + s0(Wa.gb) + Wc.gb + Wa.rg;
    We.ba = s1(We.rg) + Wa.ba + uvec2(Wc.a + s0(Wa.a), Wd.r + s0(Wb.r));

    Wf.rg = s1(We.ba) + s0(Wb.gb) + Wd.gb + Wb.rg;
    Wf.ba = s1(Wf.rg) + Wb.ba + uvec2(Wd.a + s0(Wb.a), We.r + s0(Wc.r));

    Wg.rg = s1(Wf.ba) + s0(Wc.gb) + We.gb + Wc.rg;
    Wg.ba = s1(Wg.rg) + Wc.ba + uvec2(We.a + s0(Wc.a), Wf.r + s0(Wd.r));

    Wh.rg = s1(Wg.ba) + s0(Wd.gb) + Wf.gb + Wd.rg;
    Wh.ba = s1(Wh.rg) + Wd.ba + uvec2(Wf.a + s0(Wd.a), Wg.r + s0(We.r));

    Wi.rg = s1(Wh.ba) + s0(We.gb) + Wg.gb + We.rg;
    Wi.ba = s1(Wi.rg) + We.ba + uvec2(Wg.a + s0(We.a), Wh.r + s0(Wf.r));

    Wj.rg = s1(Wi.ba) + s0(Wf.gb) + Wh.gb + Wf.rg;
    Wj.ba = s1(Wj.rg) + Wf.ba + uvec2(Wh.a + s0(Wf.a), Wi.r + s0(Wg.r));

    Wk.rg = s1(Wj.ba) + s0(Wg.gb) + Wi.gb + Wg.rg;
    Wk.ba = s1(Wk.rg) + Wg.ba + uvec2(Wi.a + s0(Wg.a), Wj.r + s0(Wh.r));

    Wl.rg = s1(Wk.ba) + s0(Wh.gb) + Wj.gb + Wh.rg;
    Wl.ba = s1(Wl.rg) + Wh.ba + uvec2(Wj.a + s0(Wh.a), Wk.r + s0(Wi.r));

    Wm.rg = s1(Wl.ba) + s0(Wi.gb) + Wk.gb + Wi.rg;
    Wm.ba = s1(Wm.rg) + Wi.ba + uvec2(Wk.a + s0(Wi.a), Wl.r + s0(Wj.r));

    Wn.rg = s1(Wm.ba) + s0(Wj.gb) + Wl.gb + Wj.rg;
    Wn.ba = s1(Wn.rg) + Wj.ba + uvec2(Wl.a + s0(Wj.a), Wm.r + s0(Wk.r));

    Wo.rg = s1(Wn.ba) + s0(Wk.gb) + Wm.gb + Wk.rg;
    Wo.ba = s1(Wo.rg) + Wk.ba + uvec2(Wm.a + s0(Wk.a), Wn.r + s0(Wl.r));

    Wp.rg = s1(Wo.ba) + s0(Wl.gb) + Wn.gb + Wl.rg;
    Wp.ba = s1(Wp.rg) + Wl.ba + uvec2(Wn.a + s0(Wl.a), Wo.r + s0(Wm.r));

    Sa = inner ? Ia : Oa;
    Sb = inner ? Ib : Ob;

    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wa.r + 0x428A2F98u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wa.g + 0x71374491u)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wa.b + 0xB5C0FBCFu)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wa.a + 0xE9B5DBA5u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wb.r + 0x3956C25Bu)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wb.g + 0x59F111F1u)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wb.b + 0x923F82A4u)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wb.a + 0xAB1C5ED5u)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wc.r + 0xD807AA98u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wc.g + 0x12835B01u)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wc.b + 0x243185BEu)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wc.a + 0x550C7DC3u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wd.r + 0x72BE5D74u)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wd.g + 0x80DEB1FEu)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wd.b + 0x9BDC06A7u)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wd.a + 0xC19BF174u)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, We.r + 0xE49B69C1u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, We.g + 0xEFBE4786u)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, We.b + 0x0FC19DC6u)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, We.a + 0x240CA1CCu)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wf.r + 0x2DE92C6Fu)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wf.g + 0x4A7484AAu)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wf.b + 0x5CB0A9DCu)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wf.a + 0x76F988DAu)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wg.r + 0x983E5152u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wg.g + 0xA831C66Du)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wg.b + 0xB00327C8u)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wg.a + 0xBF597FC7u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wh.r + 0xC6E00BF3u)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wh.g + 0xD5A79147u)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wh.b + 0x06CA6351u)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wh.a + 0x14292967u)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wi.r + 0x27B70A85u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wi.g + 0x2E1B2138u)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wi.b + 0x4D2C6DFCu)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wi.a + 0x53380D13u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wj.r + 0x650A7354u)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wj.g + 0x766A0ABBu)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wj.b + 0x81C2C92Eu)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wj.a + 0x92722C85u)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wk.r + 0xA2BFE8A1u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wk.g + 0xA81A664Bu)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wk.b + 0xC24B8B70u)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wk.a + 0xC76C51A3u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wl.r + 0xD192E819u)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wl.g + 0xD6990624u)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wl.b + 0xF40E3585u)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wl.a + 0x106AA070u)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wm.r + 0x19A4C116u)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wm.g + 0x1E376C08u)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wm.b + 0x2748774Cu)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wm.a + 0x34B0BCB5u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wn.r + 0x391C0CB3u)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wn.g + 0x4ED8AA4Au)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wn.b + 0x5B9CCA4Fu)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wn.a + 0x682E6FF3u)
    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wo.r + 0x748F82EEu)
    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wo.g + 0x78A5636Fu)
    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wo.b + 0x84C87814u)
    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wo.a + 0x8CC70208u)
    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wp.r + 0x90BEFFFAu)
    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wp.g + 0xA4506CEBu)
    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wp.b + 0xBEF9A3F7u)
    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wp.a + 0xC67178F2u)

    if (inner) {
      inner = false;
      Wa = Sa + Ia;
      Wb = Sb + Ib;
    } else {
      inner = true;
      Wa = Sa + Oa;
      Wb = Sb + Ob;
      Ra ^= Wa;
      Rb ^= Wb;
    }
  }

  out_ra = Ra;
  out_rb = Rb;
  out_wa = Wa;
  out_wb = Wb;
}