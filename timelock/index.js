var A={d:(a,e)=>{for(var n in e)A.o(e,n)&&!A.o(a,n)&&Object.defineProperty(a,n,{enumerable:!0,get:e[n]})},o:(A,a)=>Object.prototype.hasOwnProperty.call(A,a),r:A=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(A,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(A,"__esModule",{value:!0})}},a={};A.d(a,{Y:()=>n,w:()=>e});var e={};A.r(e),A.d(e,{benchmark:()=>V,getBenchmarkInfo:()=>$,init:()=>X,isGpuAvailable:()=>z,pause:()=>AA,resume:()=>aA,start:()=>nA,stop:()=>eA});var n={};function r(A){for(let a=0;a<A.length;a+=65536){const e=A.subarray(a,a+65536);crypto.getRandomValues(e)}}function g(A,a,e){for(let n=0;n<e;n++)A[n]^=a[n]}function t(A,a,e){const n=e*a;return A.subarray(n,n+a)}function S(A){return A.slice(0)}function i(A){return A===Math.floor(A)}function b(A){return A>0&&i(A)}A.r(n),A.d(n,{pause:()=>gA,resume:()=>tA,start:()=>rA,stop:()=>SA});const o=()=>{const A=postMessage;let a,e,n;self.onmessage=r=>{const g=r.data;switch(g.type){case 0:!async function(e,r,g){n=!1;const t={name:"PBKDF2",hash:"SHA-256",salt:r,iterations:0},S=Math.ceil(g/1e7);let i=e,b=g;for(let e=0;e<S;e++){t.iterations=Math.min(b,1e7),b-=1e7;const e=await crypto.subtle.importKey("raw",i,"PBKDF2",!1,["deriveBits"]),r=await crypto.subtle.deriveBits(t,e,256);if(i=new Uint8Array(r),a&&await a,n)return void A({type:2});A({type:0,iterAdded:t.iterations})}A({type:1,hash:i})}(g.seed,g.salt,g.iter);break;case 1:n=!0;break;case 2:a=new Promise((A=>{e=A}));break;case 3:e(),a=void 0;break;case 4:!async function(a){const e=crypto.getRandomValues(new Uint8Array(32)),n={name:"PBKDF2",hash:"SHA-256",salt:new Uint8Array(16),iterations:a},r=await crypto.subtle.importKey("raw",e,"PBKDF2",!1,["deriveBits"]),g=performance.now();await crypto.subtle.deriveBits(n,r,256);const t=performance.now();A({type:3,startTime:g,endTime:t})}(g.iter)}}};class c extends Worker{threadId;constructor(A,a){super(A),this.threadId=a}sendMsg(A){super.postMessage(A)}}const I=[];let s,C,B,Q,u,D,E,W;function d(A){if(!s){const A=new Blob(["("+o+")()"]);s=URL.createObjectURL(A)}let a=I[A];return a||(a=new c(s,A),a.onmessage=h,I[A]=a),a}function f(A){for(let a=0;a<Q;a++)I[a].sendMsg(A)}function h(A){const{threadId:a}=this,e=A.data;switch(e.type){case 0:W(e.iterAdded);break;case 1:if(C[a]=e.hash,++B===Q){const A=function(A){const a=new Uint8Array(32*Q);let e=0;for(const n of A)a.set(n,e),e+=n.length;return a}(C);E(A)}break;case 2:E();break;case 3:if(u.push(e)===Q){const A=Math.min(...u.map((A=>A.startTime))),a=Math.max(...u.map((A=>A.endTime)));D(a-A)}}}function w(A,a){Q=A,u=[];for(let e=0;e<A;e++)d(e).sendMsg({type:4,iter:a});return new Promise((A=>{D=A}))}function y(){f({type:1})}const N="#version 300 es\n\n#define TEX_H   __TEX_H__\n\nprecision highp int;\nprecision highp float;\nprecision highp usampler2D;\n\nuniform usampler2D in_tex;\nuniform uint in_iter;\n\n\nlayout(location = 0) out uvec4 out_ra;\nlayout(location = 1) out uvec4 out_rb;\nlayout(location = 2) out uvec4 out_wa;\nlayout(location = 3) out uvec4 out_wb;\n\n// SHA256 utils\n#define Ch(x, y, z)   ((x & (y ^ z)) ^ z)\n#define Maj(x, y, z)  ((x & (y | z)) | (y & z))\n#define SHR(x, n)     (x >> n)\n#define ROTR(x, n)    ((x >> n) | (x << (32 - n)))\n\n#define S0(x)         (ROTR(x,  2) ^ ROTR(x, 13) ^ ROTR(x, 22))\n#define S1(x)         (ROTR(x,  6) ^ ROTR(x, 11) ^ ROTR(x, 25))\n#define s0(x)         (ROTR(x,  7) ^ ROTR(x, 18) ^ SHR(x, 3))\n#define s1(x)         (ROTR(x, 17) ^ ROTR(x, 19) ^ SHR(x, 10))\n\n#define RND(a, b, c, d, e, f, g, h, k)  \\\n  t0 = h + S1(e) + Ch(e, f, g) + k;     \\\n  t1 = S0(a) + Maj(a, b, c);            \\\n  d += t0;                              \\\n  h  = t0 + t1;\n\n\n#if TEX_H == 1\n  #define GET_Y(Y, I)   (I)\n#else\n  // y + i * texH\n  #define GET_Y(Y, I)   (Y | (I * TEX_H))\n#endif\n\n\nvoid main() {\n  uint x = uint(gl_FragCoord.x);\n  uint y = uint(gl_FragCoord.y);\n\n  uint t0, t1;\n  uvec4 Sa, Sb;\n\n  uvec4 Ra = texelFetch(in_tex, ivec2(x, GET_Y(y, 0u)), 0);\n  uvec4 Rb = texelFetch(in_tex, ivec2(x, GET_Y(y, 1u)), 0);\n\n  // W00, W01, W02, W03\n  uvec4 Wa = texelFetch(in_tex, ivec2(x, GET_Y(y, 2u)), 0);\n\n  // W04, W05, W06, W07\n  uvec4 Wb = texelFetch(in_tex, ivec2(x, GET_Y(y, 3u)), 0);\n\n  // W08, W09, W10, W11\n  const uvec4 Wc = uvec4(2147483648u, 0u, 0u, 0u);\n\n  // W12, W13, W14, W15\n  const uvec4 Wd = uvec4(0u, 0u, 0u, 768u);\n\n  // W16 - W63\n  uvec4 We, Wf, Wg, Wh, Wi, Wj, Wk, Wl, Wm, Wn, Wo, Wp;\n\n  uvec4 Ia = texelFetch(in_tex, ivec2(x, GET_Y(y, 4u)), 0);\n  uvec4 Ib = texelFetch(in_tex, ivec2(x, GET_Y(y, 5u)), 0);\n  uvec4 Oa = texelFetch(in_tex, ivec2(x, GET_Y(y, 6u)), 0);\n  uvec4 Ob = texelFetch(in_tex, ivec2(x, GET_Y(y, 7u)), 0);\n\n  bool inner = true;\n\n  for (uint i = in_iter; i != 0u; i--) {\n    We.rg = s1(Wd.ba) + s0(Wa.gb) + Wc.gb + Wa.rg;\n    We.ba = s1(We.rg) + Wa.ba + uvec2(Wc.a + s0(Wa.a), Wd.r + s0(Wb.r));\n\n    Wf.rg = s1(We.ba) + s0(Wb.gb) + Wd.gb + Wb.rg;\n    Wf.ba = s1(Wf.rg) + Wb.ba + uvec2(Wd.a + s0(Wb.a), We.r + s0(Wc.r));\n\n    Wg.rg = s1(Wf.ba) + s0(Wc.gb) + We.gb + Wc.rg;\n    Wg.ba = s1(Wg.rg) + Wc.ba + uvec2(We.a + s0(Wc.a), Wf.r + s0(Wd.r));\n\n    Wh.rg = s1(Wg.ba) + s0(Wd.gb) + Wf.gb + Wd.rg;\n    Wh.ba = s1(Wh.rg) + Wd.ba + uvec2(Wf.a + s0(Wd.a), Wg.r + s0(We.r));\n\n    Wi.rg = s1(Wh.ba) + s0(We.gb) + Wg.gb + We.rg;\n    Wi.ba = s1(Wi.rg) + We.ba + uvec2(Wg.a + s0(We.a), Wh.r + s0(Wf.r));\n\n    Wj.rg = s1(Wi.ba) + s0(Wf.gb) + Wh.gb + Wf.rg;\n    Wj.ba = s1(Wj.rg) + Wf.ba + uvec2(Wh.a + s0(Wf.a), Wi.r + s0(Wg.r));\n\n    Wk.rg = s1(Wj.ba) + s0(Wg.gb) + Wi.gb + Wg.rg;\n    Wk.ba = s1(Wk.rg) + Wg.ba + uvec2(Wi.a + s0(Wg.a), Wj.r + s0(Wh.r));\n\n    Wl.rg = s1(Wk.ba) + s0(Wh.gb) + Wj.gb + Wh.rg;\n    Wl.ba = s1(Wl.rg) + Wh.ba + uvec2(Wj.a + s0(Wh.a), Wk.r + s0(Wi.r));\n\n    Wm.rg = s1(Wl.ba) + s0(Wi.gb) + Wk.gb + Wi.rg;\n    Wm.ba = s1(Wm.rg) + Wi.ba + uvec2(Wk.a + s0(Wi.a), Wl.r + s0(Wj.r));\n\n    Wn.rg = s1(Wm.ba) + s0(Wj.gb) + Wl.gb + Wj.rg;\n    Wn.ba = s1(Wn.rg) + Wj.ba + uvec2(Wl.a + s0(Wj.a), Wm.r + s0(Wk.r));\n\n    Wo.rg = s1(Wn.ba) + s0(Wk.gb) + Wm.gb + Wk.rg;\n    Wo.ba = s1(Wo.rg) + Wk.ba + uvec2(Wm.a + s0(Wk.a), Wn.r + s0(Wl.r));\n\n    Wp.rg = s1(Wo.ba) + s0(Wl.gb) + Wn.gb + Wl.rg;\n    Wp.ba = s1(Wp.rg) + Wl.ba + uvec2(Wn.a + s0(Wl.a), Wo.r + s0(Wm.r));\n\n    Sa = inner ? Ia : Oa;\n    Sb = inner ? Ib : Ob;\n\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wa.r + 0x428A2F98u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wa.g + 0x71374491u)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wa.b + 0xB5C0FBCFu)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wa.a + 0xE9B5DBA5u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wb.r + 0x3956C25Bu)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wb.g + 0x59F111F1u)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wb.b + 0x923F82A4u)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wb.a + 0xAB1C5ED5u)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wc.r + 0xD807AA98u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wc.g + 0x12835B01u)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wc.b + 0x243185BEu)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wc.a + 0x550C7DC3u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wd.r + 0x72BE5D74u)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wd.g + 0x80DEB1FEu)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wd.b + 0x9BDC06A7u)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wd.a + 0xC19BF174u)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, We.r + 0xE49B69C1u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, We.g + 0xEFBE4786u)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, We.b + 0x0FC19DC6u)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, We.a + 0x240CA1CCu)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wf.r + 0x2DE92C6Fu)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wf.g + 0x4A7484AAu)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wf.b + 0x5CB0A9DCu)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wf.a + 0x76F988DAu)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wg.r + 0x983E5152u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wg.g + 0xA831C66Du)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wg.b + 0xB00327C8u)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wg.a + 0xBF597FC7u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wh.r + 0xC6E00BF3u)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wh.g + 0xD5A79147u)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wh.b + 0x06CA6351u)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wh.a + 0x14292967u)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wi.r + 0x27B70A85u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wi.g + 0x2E1B2138u)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wi.b + 0x4D2C6DFCu)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wi.a + 0x53380D13u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wj.r + 0x650A7354u)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wj.g + 0x766A0ABBu)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wj.b + 0x81C2C92Eu)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wj.a + 0x92722C85u)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wk.r + 0xA2BFE8A1u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wk.g + 0xA81A664Bu)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wk.b + 0xC24B8B70u)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wk.a + 0xC76C51A3u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wl.r + 0xD192E819u)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wl.g + 0xD6990624u)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wl.b + 0xF40E3585u)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wl.a + 0x106AA070u)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wm.r + 0x19A4C116u)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wm.g + 0x1E376C08u)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wm.b + 0x2748774Cu)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wm.a + 0x34B0BCB5u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wn.r + 0x391C0CB3u)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wn.g + 0x4ED8AA4Au)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wn.b + 0x5B9CCA4Fu)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wn.a + 0x682E6FF3u)\n    RND(Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Wo.r + 0x748F82EEu)\n    RND(Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Wo.g + 0x78A5636Fu)\n    RND(Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Wo.b + 0x84C87814u)\n    RND(Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Sb.r, Wo.a + 0x8CC70208u)\n    RND(Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Sa.a, Wp.r + 0x90BEFFFAu)\n    RND(Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Sa.b, Wp.g + 0xA4506CEBu)\n    RND(Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Sa.g, Wp.b + 0xBEF9A3F7u)\n    RND(Sa.g, Sa.b, Sa.a, Sb.r, Sb.g, Sb.b, Sb.a, Sa.r, Wp.a + 0xC67178F2u)\n\n    if (inner) {\n      inner = false;\n      Wa = Sa + Ia;\n      Wb = Sb + Ib;\n    } else {\n      inner = true;\n      Wa = Sa + Oa;\n      Wb = Sb + Ob;\n      Ra ^= Wa;\n      Rb ^= Wb;\n    }\n  }\n\n  out_ra = Ra;\n  out_rb = Rb;\n  out_wa = Wa;\n  out_wb = Wb;\n}",l=()=>{const A=postMessage;let a,e,n,r,g,t,S,i;function b(A){return new Promise((a=>{setTimeout(a,A)}))}function o(A,a){const n=e.createShader(a);if(!n)throw Error("createShader failed");if(e.shaderSource(n,A),e.compileShader(n),!e.getShaderParameter(n,35713)){const A=e.getShaderInfoLog(n);throw Error(A)}return n}function c(A){r!==A&&(r=A,e.uniform1ui(n,2*A))}function I(A){if(g===A)return;g=A,a=g/4,e.viewport(0,0,a,4);for(let A=0;A<4;A++){const n=e.createTexture();if(!n)throw Error("create outTex failed");e.bindTexture(3553,n),e.texImage2D(3553,0,36208,a,4,0,36249,5125,null),e.framebufferTexture2D(36160,36064+A,3553,n,0)}e.drawBuffers([36064,36065,36066,36067]);const n=e.createTexture();if(!n)throw Error("create inTex failed");e.bindTexture(3553,n),e.texParameteri(3553,10241,9728),e.texParameteri(3553,10240,9728)}function s(A){e.texImage2D(3553,0,36208,a,32,0,36249,5125,A)}function C(A){for(let n=0;n<4;n++){const r=n*g*16;e.readBuffer(36064+n),e.readPixels(0,0,a,4,36249,5125,A,r/4)}}function B(){e.drawArrays(5,0,4);for(let A=0;A<4;A++){const n=0,r=4*A;e.readBuffer(36064+A),e.copyTexSubImage2D(3553,0,n,r,0,0,a,4)}}self.onmessage=a=>{const Q=a.data;switch(Q.type){case 0:!function(a){let r="";try{!function(A){const a=new OffscreenCanvas(0,0),r=a.getContext("webgl2",{failIfMajorPerformanceCaveat:!0,powerPreference:"high-performance"});if(!r)throw Error("webgl2 is not available");e=r,a.oncontextlost=()=>{console.warn("webgl oncontextlost")},a.oncontextrestored=()=>{console.warn("webgl oncontextrestored")};const g=new Float32Array([-1,1,-1,-1,1,1,1,-1]);e.bindBuffer(34962,e.createBuffer()),e.bufferData(34962,g,35044);const t=e.createProgram();if(!t)throw Error("createProgram failed");const S=o("#version 300 es\nin vec2 v_pos;\nvoid main() {\n  gl_Position = vec4(v_pos, 0., 1.);\n}",35633),i=o(A.replace("__TEX_H__","4u"),35632);e.attachShader(t,i),e.attachShader(t,S),e.linkProgram(t),e.useProgram(t),e.vertexAttribPointer(0,2,5126,!1,0,0),e.enableVertexAttribArray(0),n=e.getUniformLocation(t,"in_iter");const b=e.createFramebuffer();if(!b)throw Error("createFramebuffer failed");e.bindFramebuffer(36160,b)}(a)}catch(A){r=A.message}A({type:3,errMsg:r})}(Q.shader);break;case 1:!async function(a){t=!1;const{ctxBuf:n,iter:i}=a;s(n);let o=i,I=0,Q=0;for(;;){if(o<=r){const a=r;c(o),B(),c(a),I+=o*g,A({type:1,iterAdded:I});break}if(B(),o-=r,I+=r*g,10==++Q&&(Q=0,C(n),A({type:1,iterAdded:I}),I=0,await b(1),S&&await S,t))return}C(n),A({type:2,ctxBuf:e.isContextLost()?void 0:n})}(Q);break;case 2:t=!0;break;case 3:S=new Promise((A=>{i=A}));break;case 4:i(),S=void 0;break;case 5:c(Q.iter);break;case 6:I(Q.thread);break;case 7:!async function(a,e){I(a),c(e);const n=new Uint32Array(8*a*16/4);s(n);let r=1e9;for(let A=0;A<30;A++){const A=performance.now();B(),C(n);const a=performance.now()-A;if(a<r&&(r=a),a<16)break;await b(1)}A({type:0,time:r})}(Q.thread,Q.iter)}}};let x,p,R,k,m;function G(A){x.postMessage(A)}function H(A){const a=A.data;switch(a.type){case 3:p(a.errMsg);break;case 1:m(a.iterAdded);break;case 2:k(a.ctxBuf);break;case 0:R(a.time)}}function Y(A,a){return G({type:7,iter:a,thread:A}),new Promise((A=>{R=A}))}function F(A,a,e){return m=e,G({type:1,ctxBuf:A.slice(0),iter:a}),new Promise((A=>{k=A}))}function M(A){G({type:5,iter:A})}const J="data:application/wasm;base64,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";let K,v;function U(A,a){K.pbkdf2_pre(A,a)}function P(A){K.pbkdf2_post(A)}const j="/.timelock/benchmark.json";let q,T,Z,_,L=0,O=!0;async function X(){if(0!==L)return;L=1,await async function(){const A=await fetch(J),{instance:a}=await WebAssembly.instantiateStreaming(A);K=a.exports}();const A=await function(){const A=new Blob(["("+l+")()"]),a=URL.createObjectURL(A);return x=new Worker(a),x.onmessage=H,G({type:0,shader:N}),new Promise((A=>{p=A}))}();A&&(console.warn("init webgl error:",A),O=!1),v=await async function(){const A=await async function(A){const a=await caches.open("timelock");return await a.match(A)}(j);if(!A)return;let a;try{a=await A.json()}catch{return void console.warn("invalid benchmark cache")}return"object"==typeof a&&b(a.cpuThread)&&b(a.cpuHashPerSec)&&i(a.gpuThread)&&i(a.gpuHashPerSec)?a:void 0}(),L=2}function z(){return O}async function V(A){if(2!==L)return;L=3;const a={cpuThread:0,gpuThread:0,cpuHashPerSec:0,gpuHashPerSec:0};await async function(A){const a=2e6;console.log("evaluating CPU single thread performance...");const e=a/await w(1,a)*1e3|0,n=await w(1,e),r=e/n|0;console.log("speed: ~"+r+" iter/ms"),console.log("estimating CPU thread count...");let g=1;"safari"in window&&(g=navigator.hardwareConcurrency);for(;;){const a=Math.ceil(1.2*g);await w(a,1);const t=await w(a,e)/n;if(A(r,a),console.log("try thread:",a,"ratio:",t),t>1.2)break;g=a}A(r,g)}(((e,n)=>{a.cpuHashPerSec=1e3*e*2,a.cpuThread=n,A(a)})),O&&await async function(A){let a,e=256,n=256;for(console.log("evaluating GPU single thread performance...");M(e),a=await Y(n,e),A(e/a|0,n),console.log("try iter:",e,"time:",a),!(a>17);)e=1.25*e|0;let r=a;for(console.log("estimating GPU thread count...");;){const g=2*n,t=await Y(g,e);if(t<10){console.warn("webgl crashed"),r=-1;break}t<a&&(a=t);const S=t/a;if(A(e/t|0,g),console.log("try thread:",g,"ratio:",S),S>=1.9)break;n=g,r=t}A(e/r|0,n)}(((e,n)=>{a.gpuHashPerSec=1e3*e*2,a.gpuThread=n,A(a)})),await async function(A){const a=JSON.stringify(A);await async function(A,a){const e=await caches.open("timelock"),n=new Response(a);await e.put(A,n)}(j,a)}(a),v=a,L=2}function $(){return v}function AA(){4===L&&(L=5,f({type:2}),G({type:3}))}function aA(){5===L&&(L=4,f({type:3}),G({type:4}))}function eA(){4===L&&(L=2,y(),G({type:2}))}async function nA(A,a){if(2!==L)throw Error("invalid status");v||await V((()=>{})),L=4;const e=A.plain,n=A.cost,i=0|A.seedLen;let b=0|A.cpuThread,o=0|A.gpuThread;if(O||(o=0),b<0)throw Error("cpuThread must be >= 0");if(o<0)throw Error("gpuThread must be >= 0");if(b+o===0)throw Error("no available thread");if(n<1)throw Error("cost must be >= 1");if(i<=0||i>32)throw Error("seedLen must in [1, 32]");var c;o&&o<32&&(o=32),(c=o)&c-1&&(o=1<<Math.log2(o)),b>512&&(b=512),o>65536&&(o=65536);const I=o+b,s=Math.round(1e6*n/2),{cpuHashPerSec:u,gpuHashPerSec:D}=v,f=o?Math.round(u/D):1,h=o+b*f,w=Math.ceil(s/h),N=new Uint8Array(I*i);r(N);const l=[],x=new Uint8Array(32*I);let p=!1;const R=w*h;let k=0;const m=A=>{k+=A,a(k/R)};if(await Promise.all([(async()=>{if(0===o)return;console.time("gpu encryption");const A=function(){const A=K.get_salt_buf();return new Uint8Array(K.memory.buffer,A,12)}();r(A),M(D/1e3/2*25|0),function(A){G({type:6,thread:A})}(o);const e=function(A){const a=K.get_ctx_buf();return new Uint32Array(K.memory.buffer,a,128*A/4)}(o),n=function(A){const a=K.get_hashes_buf();return new Uint8Array(K.memory.buffer,a,32*A)}(o),g=N.subarray(0,i*o);n.set(g),U(o,i);let t=w;do{const A=Math.min(t,1e7)-1;m(o);const a=await F(e,A,m);if(!a){p=!0,O=!1;break}e.set(a),P(o),U(o,32),t-=1e7}while(t>0);if(console.timeEnd("gpu encryption"),p)return b&&y(),void a(-1);l[0]={name:"GPU (WebGL)",iter:w,seedLen:i,seedNum:o,seeds:g,salt:S(A)},x.set(n)})(),(async()=>{if(0===b)return;console.time("cpu encryption");const A=i*o,a=i*(o+b),e=N.subarray(A,a),n=new Uint8Array(12);r(n);const g=w*f,c=await function(A,a,e,n,r,g){Q=A,C=[],B=0,W=g;const i=new Uint8Array(16),b=new DataView(i.buffer);i.set(n);for(let n=0;n<A;n++){const A=t(a,e,n);b.setUint32(12,n),d(n).sendMsg({type:0,seed:S(A),salt:i,iter:r})}return new Promise((A=>{E=A}))}(b,e,i,n,g,m);console.timeEnd("cpu encryption"),c&&(l[1]={name:"CPU (WebCrypto)",iter:g,seedNum:b,seedLen:i,seeds:e,salt:n},x.set(c,32*o))})()]),p)return void(L=2);const H=new Uint8Array(32);for(let A=0;A<I;A++){const a=t(x,32,A);g(t(N,i,A),H,i),g(H,a,32)}const Y=await async function(A,a,e){const n=await crypto.subtle.importKey("raw",a,"AES-GCM",!1,["encrypt"]),r=await crypto.subtle.encrypt({name:"AES-GCM",iv:e},n,A);return new Uint8Array(r)}(e,H,new Uint8Array(16)),J={cost:n,cipher:Y,nodes:l.filter((A=>A))};return L=2,J}async function rA(A,a){if(q)throw Error("invalid status");q=!0,T=!1;let e=0,n=0;for(const a of A.nodes){const{iter:A,seedNum:e,seedLen:r,seeds:g}=a;if(!b(A))throw Error("iter must be a positive integer");if(!b(r))throw Error("seedLen must be a positive integer");if(!b(e))throw Error("thread must be a positive integer");if(g.length!==r*e)throw Error("seeds.length != seedLen * thread");n+=A*e}const r={name:"PBKDF2",hash:"SHA-256",salt:void 0,iterations:0},S=async(A,g)=>{const t=Math.ceil(g/1e7);let S=A,i=g;for(let A=0;A<t;A++){r.iterations=Math.min(i,1e7),i-=1e7;const A=await crypto.subtle.importKey("raw",S,"PBKDF2",!1,["deriveBits"]),g=performance.now(),t=await crypto.subtle.deriveBits(r,A,256),b=performance.now()-g,o=r.iterations/b*1e3*2;if(S=new Uint8Array(t),Z&&await Z,T)break;e+=r.iterations,a(e/n,o)}return S},i=new Uint8Array(32);for(const a of A.nodes){const{iter:A,seedNum:e,seedLen:n,seeds:b,salt:o}=a,c=new Uint8Array(o.length+4),I=new DataView(c.buffer);c.set(o),r.salt=c;for(let a=0;a<e;a++){I.setUint32(o.length,a);const e=t(b,n,a);if(g(e,i,n),g(i,await S(e,A),32),T)return void(q=!1)}}try{return await async function(A,a,e){const n=await crypto.subtle.importKey("raw",a,"AES-GCM",!1,["decrypt"]),r=await crypto.subtle.decrypt({name:"AES-GCM",iv:e},n,A);return new Uint8Array(r)}(A.cipher,i,new Uint8Array(16))}catch{}finally{q=!1}}function gA(){Z=new Promise((A=>{_=A}))}function tA(){Z=void 0,_()}function SA(){T=!0}var iA=a.Y,bA=a.w;export{iA as decrypt,bA as encrypt};
//# sourceMappingURL=index.js.map