/**
 * fftKernels.js
 * -----------------------------------------------------------------------------
 * GLSL3 fragment kernels for the GPU Tessendorf FFT ocean.
 *
 * Pipeline per frame (all run as full-screen passes by FFT.js):
 *
 *   1. SPECTRUM_UPDATE  — evolve the static spectrum h0(k) to time t, producing
 *                         the complex frequency-domain fields. Two output sets
 *                         (uTarget = 0 / 1) pack 8 real result fields into 4
 *                         complex channels using the "two-reals-per-complex-FFT"
 *                         trick (input = F + i·G  ⇒  IFFT gives  f + i·g).
 *
 *      Set 0 (→ displacement texture):  R=Dy  G=Dx  B=Dz  A=∂Dy/∂x
 *      Set 1 (→ derivatives texture) :  R=∂Dy/∂z  G=∂Dx/∂x  B=∂Dz/∂z  A=∂Dx/∂z
 *
 *      Each RGBA texel carries two complex fields: RG and BA, transformed
 *      independently by the butterfly below.
 *
 *   2. BUTTERFLY        — one Cooley–Tukey radix-2 DIT stage. Run log2(N) times
 *                         horizontally then log2(N) times vertically, ping-pong.
 *
 *   3. PERMUTATION      — final inverse-DFT normalization (1/N²) and the
 *                         (-1)^(x+y) recentering that undoes the m = index-N/2
 *                         wavevector offset used when the spectrum was built.
 * -----------------------------------------------------------------------------
 */

const COMMON = /* glsl */ `
  #define PI 3.141592653589793
  const float G = 9.81;
  // complex multiply
  vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
  // pack two complex spectra F, G into one IFFT input  (F + i*G)
  vec2 packFG(vec2 F, vec2 G){ return vec2(F.x - G.y, F.y + G.x); }
`;

export const SPECTRUM_UPDATE = /* glsl */ `
${COMMON}
in vec2 vUv;
out vec4 frag;

uniform sampler2D uH0;     // (h0.re, h0.im, h0(-k)*.re, h0(-k)*.im)
uniform float uTime;
uniform float uN;          // FFT resolution
uniform float uL;          // patch size (m)
uniform float uWaveSpeed;
uniform float uLoopPeriod; // seconds; dispersion is quantized to loop
uniform int   uTarget;     // 0 → displacement set, 1 → derivative set

void main(){
  float N = uN;
  vec2 id = floor(vUv * N);
  vec2 m  = id - N * 0.5;                 // wave index in [-N/2, N/2)
  vec2 k  = (2.0 * PI / uL) * m;          // world-space wavevector (rad/m)
  float kLen = length(k);
  vec2 khat = kLen > 1e-6 ? k / kLen : vec2(0.0);

  // Static spectrum amplitudes h0(k) and conj(h0(-k)).
  vec4 h0data = texture(uH0, vUv);
  vec2 h0        = h0data.xy;
  vec2 h0mkConj  = vec2(h0data.z, -h0data.w);

  // Deep-water dispersion ω = √(g·k), quantized so the patch loops seamlessly.
  float w0 = 2.0 * PI / max(uLoopPeriod, 1e-3);
  float w  = floor(sqrt(G * max(kLen, 1e-8)) / w0) * w0 * uWaveSpeed;

  float c = cos(w * uTime);
  float s = sin(w * uTime);
  // h(k,t) = h0·e^{+iωt} + conj(h0(-k))·e^{-iωt}
  vec2 h = cmul(h0, vec2(c, s)) + cmul(h0mkConj, vec2(c, -s));

  vec2 ih = vec2(-h.y, h.x);              // i·h

  if (uTarget == 0) {
    vec2 Dy    = h;                       // vertical displacement
    vec2 Dx    = -khat.x * ih;            // horizontal displacement x
    vec2 Dz    = -khat.y * ih;            // horizontal displacement z
    vec2 dDydx =  k.x * ih;               // slope ∂y/∂x
    frag = vec4(packFG(Dy, Dx), packFG(Dz, dDydx));
  } else {
    vec2 dDydz = k.y * ih;                // slope ∂y/∂z
    vec2 dDxdx = (kLen > 1e-6 ? k.x*k.x/kLen : 0.0) * h;  // ∂Dx/∂x
    vec2 dDzdz = (kLen > 1e-6 ? k.y*k.y/kLen : 0.0) * h;  // ∂Dz/∂z
    vec2 dDxdz = (kLen > 1e-6 ? k.x*k.y/kLen : 0.0) * h;  // ∂Dx/∂z
    frag = vec4(packFG(dDydz, dDxdx), packFG(dDzdz, dDxdz));
  }
}
`;

export const BUTTERFLY = /* glsl */ `
${COMMON}
in vec2 vUv;
out vec4 frag;

uniform sampler2D uButterfly; // (twiddle.re, twiddle.im, indexA, indexB)
uniform sampler2D uSource;    // ping-pong input
uniform int uStage;           // current FFT stage
uniform int uDirection;       // 0 = horizontal, 1 = vertical

void main(){
  ivec2 coord = ivec2(gl_FragCoord.xy);
  int axis = (uDirection == 0) ? coord.x : coord.y;
  vec4 bf = texelFetch(uButterfly, ivec2(uStage, axis), 0);
  vec2 w  = bf.xy;
  int ia = int(bf.z);
  int ib = int(bf.w);

  ivec2 ca = (uDirection == 0) ? ivec2(ia, coord.y) : ivec2(coord.x, ia);
  ivec2 cb = (uDirection == 0) ? ivec2(ib, coord.y) : ivec2(coord.x, ib);

  vec4 p = texelFetch(uSource, ca, 0);
  vec4 q = texelFetch(uSource, cb, 0);

  // Two independent complex channels: RG and BA, same twiddle.
  vec2 rg = p.rg + cmul(w, q.rg);
  vec2 ba = p.ba + cmul(w, q.ba);
  frag = vec4(rg, ba);
}
`;

export const PERMUTATION = /* glsl */ `
${COMMON}
in vec2 vUv;
out vec4 frag;

uniform sampler2D uSource;
uniform float uN;

void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 data = texelFetch(uSource, c, 0);
  // (-1)^(x+y) recentering + inverse-DFT normalization (1/N²).
  float sign = ((c.x + c.y) & 1) == 0 ? 1.0 : -1.0;
  frag = data * (sign / (uN * uN));
}
`;
