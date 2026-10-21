/**
 * Foam.js
 * -----------------------------------------------------------------------------
 * Procedural foam driven by the FFT Jacobian (no painted foam).
 *
 * The horizontal displacement of the Tessendorf field folds the surface where
 * waves sharpen; the local area scale factor is the Jacobian of the
 * displacement map:
 *
 *   J = (1 + λ·∂Dx/∂x)(1 + λ·∂Dz/∂z) − (λ·∂Dx/∂z)²
 *
 * J < 1 means the surface is compressing (a forming crest / pinch); J ≤ 0 is a
 * full fold. Foam is generated where J drops below a threshold, modulated by a
 * procedural noise field for break-up, plus a curvature term for crest foam and
 * a temporally persistent accumulation term.
 *
 * This module owns the foam uniform block and the GLSL chunk; the actual
 * sampling happens inside water.frag.js.
 * -----------------------------------------------------------------------------
 */

export function createFoamUniforms(foam) {
  return {
    uFoamThreshold:  { value: foam.threshold },
    uFoamIntensity:  { value: foam.intensity },
    uFoamScale:      { value: foam.scale },
    uFoamBrightness: { value: foam.brightness },
    uFoamSoftness:   { value: foam.softness },
    uFoamSpeed:      { value: foam.speed },
    uFoamContrast:   { value: foam.contrast },
    uFoamOpacity:    { value: foam.opacity },
    uFoamCoverage:   { value: foam.coverage },
    uFoamCrest:      { value: foam.crestFoam },
    uFoamPersistence:{ value: foam.persistence },
  };
}

export function updateFoamUniforms(uniforms, foam) {
  uniforms.uFoamThreshold.value  = foam.threshold;
  uniforms.uFoamIntensity.value  = foam.intensity;
  uniforms.uFoamScale.value      = foam.scale;
  uniforms.uFoamBrightness.value = foam.brightness;
  uniforms.uFoamSoftness.value   = foam.softness;
  uniforms.uFoamSpeed.value      = foam.speed;
  uniforms.uFoamContrast.value   = foam.contrast;
  uniforms.uFoamOpacity.value    = foam.opacity;
  uniforms.uFoamCoverage.value   = foam.coverage;
  uniforms.uFoamCrest.value      = foam.crestFoam;
  uniforms.uFoamPersistence.value= foam.persistence;
}

/** GLSL injected into the water fragment shader. */
export const FOAM_GLSL = /* glsl */ `
  uniform float uFoamThreshold;
  uniform float uFoamIntensity;
  uniform float uFoamScale;
  uniform float uFoamBrightness;
  uniform float uFoamSoftness;
  uniform float uFoamSpeed;
  uniform float uFoamContrast;
  uniform float uFoamOpacity;
  uniform float uFoamCoverage;
  uniform float uFoamCrest;
  uniform float uFoamPersistence;

  // Cheap value-noise for foam break-up.
  float foamHash(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float foamNoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = foamHash(i);
    float b = foamHash(i + vec2(1.0, 0.0));
    float c = foamHash(i + vec2(0.0, 1.0));
    float d = foamHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float foamFbm(vec2 p){
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++){ v += amp * foamNoise(p); p *= 2.07; amp *= 0.5; }
    return v;
  }

  // jacobian: Jacobian value (1 ≈ flat, <threshold ⇒ foam).
  // curvature: |∇·normal| style crest sharpness term.
  float computeFoam(float jacobian, float curvature, vec2 worldXZ, float time){
    // Fold-based foam: how far J has dropped below the threshold.
    float fold = smoothstep(uFoamThreshold, uFoamThreshold - max(uFoamSoftness, 0.02),
                            jacobian);
    fold = mix(fold, 1.0, uFoamCoverage * fold);

    // Crest foam from surface curvature on steep peaks.
    float crest = uFoamCrest * smoothstep(0.35, 1.0, curvature);

    float mask = clamp(fold + crest, 0.0, 1.0);

    // Animated, multi-scale noise so foam is patchy, not uniform.
    vec2 fp = worldXZ * uFoamScale * 0.05;
    float n = foamFbm(fp + time * uFoamSpeed * vec2(0.3, -0.2));
    n = mix(n, foamFbm(fp * 2.3 - time * uFoamSpeed * 0.5), 0.5);

    float foam = mask * mix(0.6, 1.0, n);
    // Persistent residue: lingering foam in recently-folded areas.
    foam = max(foam, mask * uFoamPersistence * smoothstep(0.2, 0.8, n));

    // Contrast / brightness shaping.
    foam = pow(clamp(foam, 0.0, 1.0), mix(1.0, 2.2, 0.5)) * uFoamContrast;
    foam = clamp(foam * uFoamIntensity, 0.0, 1.0);
    return foam;
  }
`;
