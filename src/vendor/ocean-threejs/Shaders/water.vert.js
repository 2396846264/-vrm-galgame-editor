/**
 * water.vert.js  (GLSL3 / WebGL2)
 * -----------------------------------------------------------------------------
 * Hybrid displacement vertex stage.
 *
 *   • FFT field   — sampled from the Tessendorf displacement texture at THREE
 *                   world scales ("cascades"). One FFT tile reused at large /
 *                   medium / fine wavelengths removes visible tiling and gives
 *                   an endless ocean. R=height, G/B=horizontal (choppiness).
 *
 *   • Gerstner    — up to 6 long, directional trochoidal swell components added
 *                   on top, with their analytic normal accumulated (GPU Gems
 *                   formulation) and passed to the fragment stage.
 *
 * Three.js injects: position, uv, modelMatrix, viewMatrix, projectionMatrix,
 * cameraPosition. We declare only our own uniforms/varyings.
 * -----------------------------------------------------------------------------
 */

import { MAX_GERSTNER } from '../Ocean/Gerstner.js';

export const WATER_VERT = /* glsl */ `
precision highp float;

uniform sampler2D uDisplacement;
uniform float uPatchSize;
uniform vec3  uCascadeScale;   // world-size multiplier per cascade
uniform vec3  uCascadeWeight;  // amplitude weight per cascade
uniform float uChoppiness;
uniform float uOceanScale;
uniform float uTime;
uniform vec2  uModelOffset;   // camera-snapped XZ so the grid follows the viewer

uniform vec2 uGerstnerDir[${MAX_GERSTNER}];
uniform vec4 uGerstnerParams[${MAX_GERSTNER}]; // (k, amplitude, steepness, omega)

out vec3 vWorldPos;
out vec2 vWorldXZ;
out vec3 vGerstnerNormal;
out float vFftHeight;

vec2 cascadeUv(vec2 worldXZ, int i){
  return (worldXZ * uOceanScale) / (uPatchSize * uCascadeScale[i]);
}

void main() {
  // Geometry lives in the XZ plane (built horizontal), Y is up. The grid is
  // shifted to follow the camera so the visible ocean never reaches an edge,
  // while wave sampling stays in stable world space (no swimming).
  vec2 worldXZ = position.xz + uModelOffset;

  // ── FFT displacement, summed over three cascades ──────────────────────────
  vec3 disp = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 d = texture(uDisplacement, cascadeUv(worldXZ, i));
    float w = uCascadeWeight[i];
    disp.y += d.r * w;
    disp.x += d.g * uChoppiness * w;
    disp.z += d.b * uChoppiness * w;
  }
  vFftHeight = disp.y;

  // ── Gerstner swell + analytic normal ──────────────────────────────────────
  vec3 g = vec3(0.0);
  vec3 gN = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < ${MAX_GERSTNER}; i++) {
    vec4 P = uGerstnerParams[i];
    float k = P.x;
    if (k <= 0.0) continue;
    vec2 D = uGerstnerDir[i];
    float A = P.y, Q = P.z, w = P.w;
    float phase = k * dot(D, worldXZ) - w * uTime;
    float c = cos(phase), s = sin(phase);
    g.x += Q * A * D.x * c;
    g.z += Q * A * D.y * c;
    g.y += A * s;
    float WA = k * A;
    gN.x -= D.x * WA * c;
    gN.z -= D.y * WA * c;
    gN.y -= Q * WA * s;
  }

  vec3 displaced = vec3(worldXZ.x + disp.x + g.x,
                        disp.y + g.y,
                        worldXZ.y + disp.z + g.z);

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = world.xyz;
  vWorldXZ = worldXZ;
  vGerstnerNormal = gN;

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
