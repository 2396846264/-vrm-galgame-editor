/**
 * Gerstner.js
 * -----------------------------------------------------------------------------
 * The "swell" half of the hybrid wave system. The FFT field gives a rich,
 * non-repeating wind sea, but very long ground swell is better authored
 * directly: a handful of low-frequency, highly directional Gerstner trochoids
 * give big rolling hills that read as open-ocean swell and break up any residual
 * FFT tiling at large scales.
 *
 * Gerstner wave (one component), with k = wavenumber, A = amplitude,
 * Q = steepness, D = direction, ω = √(gk)·speed, φ = k·(D·x) − ω·t:
 *
 *   x += Q·A·D·cos(φ)
 *   y +=     A·sin(φ)
 *
 * Derivatives for the analytic normal/tangent are computed in the shader.
 *
 * This module just authors the wave set from the GUI swell parameters; the
 * evaluation lives in water.vert.js.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';

export const MAX_GERSTNER = 6;
const GRAVITY = 9.81;

/**
 * Build a fixed-length array of Gerstner components.
 * Returns:
 *   directions : THREE.Vector2[]  (unit wave directions)
 *   params     : THREE.Vector4[]  (k, amplitude, steepness, omega)
 * Unused slots are zeroed so the shader can iterate a constant count.
 */
export function buildGerstnerWaves(ocean) {
  const directions = [];
  const params = [];

  const make = (dirDeg, wavelength, amplitude, steepness, speedMul) => {
    const a = THREE.MathUtils.degToRad(dirDeg);
    const k = (2.0 * Math.PI) / wavelength;
    const omega = Math.sqrt(GRAVITY * k) * speedMul * ocean.waveSpeed;
    directions.push(new THREE.Vector2(Math.cos(a), Math.sin(a)));
    params.push(new THREE.Vector4(k, amplitude * ocean.waveAmplitude, steepness * ocean.steepness, omega));
  };

  const primary = ocean.swell;
  const secondary = ocean.secondarySwell;
  const pDir = ocean.swellDirection;
  const sDir = ocean.secondarySwellDirection;

  // Primary swell train — three slightly spread, long components.
  make(pDir - 8.0, 180.0, 1.40 * primary, 0.62, 1.00);
  make(pDir + 6.0, 120.0, 0.95 * primary, 0.55, 1.05);
  make(pDir + 17.0, 78.0, 0.55 * primary, 0.48, 1.10);

  // Secondary (crossing) swell — adds natural interference.
  make(sDir - 5.0, 96.0, 0.85 * secondary, 0.5, 1.0);
  make(sDir + 12.0, 61.0, 0.5 * secondary, 0.45, 1.08);

  // Filler so the array is always MAX_GERSTNER long.
  while (directions.length < MAX_GERSTNER) {
    directions.push(new THREE.Vector2(1, 0));
    params.push(new THREE.Vector4(0, 0, 0, 0));
  }

  return { directions, params };
}
