/**
 * water.frag.js  (GLSL3 / WebGL2)
 * -----------------------------------------------------------------------------
 * Film-quality physically based water surface shading.
 *
 * Surface normal:
 *   FFT slopes (∂y/∂x, ∂y/∂z) summed over 3 cascades + Gerstner analytic normal
 *   + two layers of animated procedural micro-detail normals.
 *
 * Reflection:  GGX-importance-weighted environment (HDRI equirect or analytic
 *              physical sky), roughness-driven mip blur, Fresnel-weighted.
 * Refraction:  Beer–Lambert depth coloration (deep↔surface) — no scene needed,
 *              plus a sub-surface scattering approximation that lights crests
 *              from behind toward the camera. Optional chromatic offset.
 * Specular:    Cook–Torrance GGX (D·G·F) sun highlight with Smith geometry.
 * Foam:        procedural, from the FFT Jacobian + curvature (Foam.js chunk).
 *
 * Energy: refraction is weighted by (1 − Fresnel·reflIntensityClamped) so the
 * reflection/refraction split conserves energy.
 * -----------------------------------------------------------------------------
 */

import { FOAM_GLSL } from '../Ocean/Foam.js';

export const WATER_FRAG = /* glsl */ `
precision highp float;

#define PI 3.141592653589793

in vec3 vWorldPos;
in vec2 vWorldXZ;
in vec3 vGerstnerNormal;
in float vFftHeight;

out vec4 fragColor;

// FFT fields
uniform sampler2D uDisplacement; // R=Dy G=Dx B=Dz A=∂Dy/∂x
uniform sampler2D uDerivatives;  // R=∂Dy/∂z G=∂Dx/∂x B=∂Dz/∂z A=∂Dx/∂z
uniform float uPatchSize;
uniform vec3  uCascadeScale;
uniform vec3  uCascadeWeight;
uniform float uChoppiness;
uniform float uOceanScale;
uniform float uTime;

// PBR / water
uniform float uRoughness;
uniform float uMetallic;
uniform float uSpecular;
uniform float uIor;
uniform float uTransparency;
uniform float uReflectionIntensity;
uniform float uReflectionBlur;
uniform float uReflectionDistortion;
uniform float uFresnelPower;
uniform float uFresnelBias;
uniform float uRefractionStrength;
uniform float uRefractionDistortion;
uniform float uWaterThickness;
uniform float uChromaticOffset;
uniform sampler2D uRefractionTex;  // sand sea-bed captured behind the water
uniform vec2  uResolution;
uniform float uSandLevel;          // world-Y of the sand plane
uniform vec3  uExtinction;         // base per-channel Beer-Lambert coefficients
uniform float uNormalScale;
uniform float uDetailScale;
uniform float uMicroDetail;

// Color grading
uniform vec3  uDeepColor;
uniform vec3  uSurfaceColor;
uniform vec3  uScatterColor;
uniform vec3  uHorizonColor;
uniform float uHorizonBlend;
uniform float uOceanExtent;        // world width of the surface plane
uniform vec3  uFogColor;
uniform float uFogDensity;
uniform float uFogStrength;
uniform float uAbsorption;
uniform float uScattering;
uniform float uSaturation;
uniform float uContrast;
uniform float uBrightness;
uniform float uExposure;

// Lighting / environment
uniform vec3  uSunDirection;
uniform vec3  uSunColor;
uniform float uSunIntensity;
uniform float uEnvIntensity;
uniform float uCloudiness;
uniform float uHasEnv;
uniform sampler2D uEnvMap;       // equirectangular HDR (optional)
uniform float uEnvMaxLod;

${FOAM_GLSL}

vec2 cascadeUv(vec2 worldXZ, int i){
  return (worldXZ * uOceanScale) / (uPatchSize * uCascadeScale[i]);
}

// ── Procedural physical sky (fallback + always used for the sun disk) ────────
vec2 equirectUv(vec3 d){
  return vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5,
              asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
}

// Cloud noise — kept identical in spirit to Sky.js so reflections match.
float skyHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float skyNoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),
             mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1,1)),f.x), f.y);
}
float skyFbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*skyNoise(p);p*=2.03;a*=0.5;} return v; }
float skyClouds(vec3 dir){
  if (dir.y <= 0.015) return 0.0;
  vec2 uv = dir.xz / dir.y;
  uv = uv * 0.45 + uTime * 0.006;
  float d = skyFbm(uv) * 0.7 + skyFbm(uv * 3.1 - uTime * 0.01) * 0.3;
  float cover = mix(0.62, 0.34, clamp(uCloudiness, 0.0, 1.0));
  float c = smoothstep(cover, cover + 0.22, d);
  return c * smoothstep(0.0, 0.32, dir.y);
}

vec3 proceduralSky(vec3 dir){
  float up = clamp(dir.y, -1.0, 1.0);
  vec3 zenith  = vec3(0.07, 0.30, 0.66);
  vec3 horizon = uHorizonColor;
  vec3 ground  = mix(uHorizonColor, uDeepColor, 0.65);

  vec3 col;
  if (up >= 0.0) col = mix(horizon, zenith, pow(up, 0.48));
  else           col = mix(horizon, ground, clamp(-up * 3.5, 0.0, 1.0));

  // Clouds, lit toward the sun.
  float sd = max(dot(normalize(dir), uSunDirection), 0.0);
  float cl = skyClouds(dir);
  vec3 cloudLit = mix(vec3(0.72, 0.78, 0.86), vec3(1.05, 1.02, 0.97), 0.6 + 0.4 * sd);
  col = mix(col, cloudLit, cl * 0.9);

  // Sun disk + atmospheric glow (dimmed where clouds occlude it).
  float disk = smoothstep(0.9995, 0.99986, sd);
  float glow = pow(sd, 220.0) * 0.5 + pow(sd, 16.0) * 0.18;
  col += uSunColor * uSunIntensity * (disk * 8.0 + glow) * (1.0 - cl * 0.7);
  return col;
}

vec3 sampleEnvironment(vec3 dir, float roughness){
  vec3 sky = proceduralSky(dir);
  if (uHasEnv > 0.5){
    float lod = roughness * uEnvMaxLod;
    vec3 hdri = textureLod(uEnvMap, equirectUv(dir), lod).rgb * uEnvIntensity;
    // Keep the analytic sun disk on top of the HDRI for a crisp specular sun.
    float sd = max(dot(normalize(dir), uSunDirection), 0.0);
    hdri += uSunColor * uSunIntensity * smoothstep(0.9995, 0.99986, sd) * 6.0;
    return hdri;
  }
  return sky;
}

// ── Animated multi-layer micro-detail normals ────────────────────────────────
vec3 microNormal(vec2 p, float freq, float t, vec2 flow){
  float e = 0.35 / freq;
  vec2 q = p * freq + flow * t;
  float h  = foamFbm(q);
  float hx = foamFbm(q + vec2(e, 0.0));
  float hz = foamFbm(q + vec2(0.0, e));
  vec2 grad = vec2(hx - h, hz - h) / e;
  return normalize(vec3(-grad.x, 1.0, -grad.y));
}

// Blend a tangent-space-ish detail normal into a world normal (RNM-style).
vec3 applyDetail(vec3 N, vec3 d, float strength){
  d = normalize(mix(vec3(0.0, 1.0, 0.0), d, strength));
  return normalize(vec3(N.x + d.x, N.y, N.z + d.z));
}

// ── GGX / Cook–Torrance ──────────────────────────────────────────────────────
float D_GGX(float NoH, float a){
  float a2 = a * a;
  float d = (NoH * NoH) * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
float G_SmithGGX(float NoV, float NoL, float a){
  float k = (a * a) * 0.5;
  float gv = NoV / (NoV * (1.0 - k) + k);
  float gl = NoL / (NoL * (1.0 - k) + k);
  return gv * gl;
}
vec3 F_Schlick(float cosT, vec3 F0){
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosT, 0.0, 1.0), 5.0);
}

vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 saturate3(vec3 c, float s){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, s);
}

void main(){
  // ── Reconstruct surface normal & Jacobian from FFT derivative fields ───────
  vec2 slope = vec2(0.0);
  float dDxdx = 0.0, dDzdz = 0.0, dDxdz = 0.0;
  for (int i = 0; i < 3; i++){
    vec2 uvc = cascadeUv(vWorldXZ, i);
    vec4 d0 = texture(uDisplacement, uvc);
    vec4 d1 = texture(uDerivatives,  uvc);
    float w = uCascadeWeight[i];
    slope += vec2(d0.a, d1.r) * w;            // (∂y/∂x, ∂y/∂z)
    float wc = w * uChoppiness;
    dDxdx += d1.g * wc;
    dDzdz += d1.b * wc;
    dDxdz += d1.a * wc;
  }

  // FFT normal from slope, fused with the Gerstner analytic normal.
  vec3 nFft = normalize(vec3(-slope.x * uNormalScale, 1.0, -slope.y * uNormalScale));
  vec3 nG   = normalize(vGerstnerNormal);
  vec3 N = normalize(vec3(nFft.x + (nG.x / max(nG.y, 0.05)),
                          1.0,
                          nFft.z + (nG.z / max(nG.y, 0.05))));

  // Two animated micro-detail layers (fine ripples & wind streaks).
  vec3 dA = microNormal(vWorldXZ, 0.18 * uDetailScale, uTime, vec2(0.6, -0.4));
  vec3 dB = microNormal(vWorldXZ, 0.55 * uDetailScale, uTime, vec2(-0.3, 0.7));
  N = applyDetail(N, dA, uMicroDetail * 0.5);
  N = applyDetail(N, dB, uMicroDetail * 0.3);
  N = normalize(N);

  // ── View / light vectors ───────────────────────────────────────────────────
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunDirection);
  vec3 H = normalize(V + L);
  float NoV = max(dot(N, V), 1e-3);
  float NoL = max(dot(N, L), 0.0);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);

  // ── Fresnel (physically correct F0 from IOR) ───────────────────────────────
  float f0s = (1.0 - uIor) / (1.0 + uIor);
  vec3  F0 = mix(vec3(f0s * f0s), uSurfaceColor, uMetallic);
  float fresnel = clamp(uFresnelBias +
                  (1.0 - uFresnelBias) * pow(1.0 - NoV, uFresnelPower), 0.0, 1.0);
  fresnel *= uReflectionIntensity;

  // ── Reflection ─────────────────────────────────────────────────────────────
  vec3 R = reflect(-V, N);
  R = normalize(R + uReflectionDistortion * vec3(N.x, 0.0, N.z));
  float roughBlur = clamp(uRoughness + uReflectionBlur, 0.0, 1.0);
  vec3 reflection = sampleEnvironment(R, roughBlur) * uEnvIntensity;

  // ── Refraction through the water onto the sand floor ───────────────────────
  // Screen-space sample of the refraction target (the sand sea-bed behind the
  // water), distorted by the surface normal so the bed wobbles through the waves.
  vec2 screenUV = gl_FragCoord.xy / uResolution;
  vec2 refrOffset = N.xz * uRefractionDistortion * 0.08 * uRefractionStrength;
  vec3 sandColor = texture(uRefractionTex, clamp(screenUV + refrOffset, 0.001, 0.999)).rgb;

  // Optional chromatic dispersion: split R/B sample offsets.
  if (uChromaticOffset > 0.0){
    float ca = uChromaticOffset * 12.0;
    sandColor.r = texture(uRefractionTex, clamp(screenUV + refrOffset * (1.0 + ca), 0.001, 0.999)).r;
    sandColor.b = texture(uRefractionTex, clamp(screenUV + refrOffset * (1.0 - ca), 0.001, 0.999)).b;
  }

  // Underwater path length: surface point → sand plane along the refracted view
  // ray. Looking straight down = short path (sand shows); grazing = long path
  // (absorbed to blue). This single angle term creates the near→far gradient.
  vec3 refrDir = refract(-V, N, 1.0 / uIor);
  float downward = max(-refrDir.y, 0.06);
  float depthBelow = max(vWorldPos.y - uSandLevel, 0.0);
  float pathLen = depthBelow / downward;

  // Beer–Lambert extinction, per channel (red dies first → turquoise → deep blue).
  vec3 ext = uExtinction * uAbsorption;
  vec3 trans = exp(-ext * pathLen);
  // In-scattered water colour accumulates with depth (single-scatter approx).
  vec3 inscatter = mix(uScatterColor, uDeepColor, clamp(pathLen / 28.0, 0.0, 1.0));
  vec3 refraction = sandColor * trans + inscatter * (1.0 - trans) * uScattering;

  // Subtle sub-surface glow on lit, raised crests.
  float crest = clamp(vFftHeight * 0.5 + 0.5, 0.0, 1.0);
  float wrapSSS = max(dot(N, L) * 0.5 + 0.5, 0.0);
  refraction += uScatterColor * pow(crest, 3.0) * wrapSSS * 0.12 * uScattering;

  // ── Cook–Torrance GGX sun specular ─────────────────────────────────────────
  float a = max(uRoughness * uRoughness, 1e-3);
  float D = D_GGX(NoH, a);
  float Gf = G_SmithGGX(NoV, NoL, a);
  vec3  Fs = F_Schlick(VoH, F0);
  vec3 specular = (D * Gf * Fs) / max(4.0 * NoV * NoL, 1e-3) * NoL;
  specular *= uSunColor * uSunIntensity * uSpecular;

  // ── Combine (energy-conserving reflection/refraction split) ────────────────
  vec3 color = mix(refraction, reflection, fresnel);
  color += specular;
  // Ambient sun wrap on the body for a little diffuse fill.
  color += refraction * NoL * 0.05 * uSunColor;

  // Caustic-style sun sparkle: sharp glints on micro facets, broken up by
  // animated noise so the surface twinkles in the sun glitter path.
  float glint = pow(max(dot(R, L), 0.0), 350.0);
  float sparkleMask = smoothstep(0.55, 0.95, skyFbm(vWorldXZ * 2.5 + uTime * 0.5));
  color += uSunColor * glint * sparkleMask * uSunIntensity * 2.5 * uSpecular;

  float dist = length(cameraPosition.xz - vWorldPos.xz);

  // ── Blueish atmospheric horizon fog (exp² distance fog) ────────────────────
  float fog = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
  fog = clamp(fog * uFogStrength, 0.0, 1.0);
  color = mix(color, uFogColor, fog);

  // Fade the outer ring of the finite plane into the sky (tinted by the fog) so
  // there is no visible plane edge → a clean, open horizon. The sand floor,
  // which shares the ocean's footprint, vanishes into the same band.
  float halfExt = uOceanExtent * 0.5;
  float hazeStart = halfExt * mix(0.85, 0.30, clamp(uHorizonBlend, 0.0, 1.0));
  float edge = smoothstep(hazeStart, halfExt * 0.99, dist);
  vec3 skyCol = sampleEnvironment(normalize(vec3(-V.x, 0.06, -V.z)), 0.35);
  color = mix(color, mix(skyCol, uFogColor, 0.6), edge);

  // ── Foam overlay ───────────────────────────────────────────────────────────
  float jacobian = (1.0 + dDxdx) * (1.0 + dDzdz) - dDxdz * dDxdz;
  float curvature = clamp(length(slope) * 0.6 + (1.0 - jacobian), 0.0, 1.0);
  float foam = computeFoam(jacobian, curvature, vWorldXZ, uTime);
  vec3 foamCol = vec3(uFoamBrightness) * mix(vec3(0.9, 0.95, 1.0), uSunColor, 0.15);
  foamCol *= (0.5 + 0.5 * NoL + 0.3 * uSunIntensity * 0.1);
  color = mix(color, foamCol, foam * uFoamOpacity);

  // ── Tone mapping & color grading ────────────────────────────────────────────
  // Host adaptation: shared render presets own color grading.
  fragColor = vec4(color, 1.0);
  #ifdef TONE_MAPPING
  fragColor.rgb=toneMapping(fragColor.rgb);
  #endif
  fragColor = linearToOutputTexel(fragColor);
}
`;
