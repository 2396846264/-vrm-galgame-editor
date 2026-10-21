/**
 * Spectra.js
 * -----------------------------------------------------------------------------
 * Ocean wave variance spectra used to seed the Tessendorf FFT field.
 *
 * The FFT ocean works in the spatial-frequency (wavevector k) domain. For each
 * k we need the *variance* S(k) of the surface elevation contributed by that
 * wave. The initial complex amplitudes are then
 *
 *     h0(k) = (1/√2) (ξr + i·ξi) · √( S(k) )
 *
 * where ξr, ξi ~ N(0,1) (Box–Muller Gaussians). This file implements three
 * classic oceanographic spectra, all expressed directly as a 2D wavenumber
 * variance S(k) [m² per (rad/m)²] with directional spreading folded in:
 *
 *   • Phillips            — Tessendorf's original empirical spectrum.
 *   • Pierson–Moskowitz   — fully developed sea (infinite fetch).
 *   • JONSWAP             — fetch-limited sea with peak enhancement γ.
 *
 * For PM and JONSWAP the omnidirectional frequency spectrum S(ω) is mapped to a
 * wavenumber spectrum using deep-water dispersion ω² = g·k and the Jacobian
 *
 *     S(k) = S(ω) · (dω/dk) / k ,   dω/dk = ½·√(g/k)
 *
 * (the extra 1/k spreads the 1D frequency energy over the 2D k-annulus).
 * Directional spreading D(θ) ∝ |cos((θ-θw)/2)|^(2s) concentrates energy around
 * the wind direction.
 * -----------------------------------------------------------------------------
 */

import { SPECTRA } from '../config.js';

export const GRAVITY = 9.81;

/** Box–Muller: two independent standard normals from two uniforms. */
export function gaussianPair(rng) {
  let u1 = Math.max(rng(), 1e-7);
  let u2 = rng();
  const r = Math.sqrt(-2.0 * Math.log(u1));
  const t = 2.0 * Math.PI * u2;
  return [r * Math.cos(t), r * Math.sin(t)];
}

/** Deterministic, seedable PRNG (mulberry32) so a given sea state is repeatable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Directional spreading factor in [0,1]; `s` sharpens alignment to the wind. */
function directionalSpread(kx, kz, windDirRad, s) {
  const kLen = Math.hypot(kx, kz);
  if (kLen < 1e-8) return 0.0;
  const wx = Math.cos(windDirRad);
  const wz = Math.sin(windDirRad);
  const cosTheta = (kx * wx + kz * wz) / kLen;
  // |cos|^(2s) lobe; keep a little back-facing energy so the sea isn't 1-D.
  const lobe = Math.pow(Math.max(cosTheta, 0.0), 2.0 * s);
  const back = 0.07 * Math.pow(Math.max(-cosTheta, 0.0), 2.0 * s);
  return lobe + back;
}

/**
 * Phillips spectrum (Tessendorf 2001).
 *   P(k) = A · exp(-1/(k·L)²) / k⁴ · |k̂·ŵ|² · exp(-k²·l²)
 * L = V²/g is the largest wave from wind V; l is a short-wave cutoff.
 */
function phillips(kx, kz, params) {
  const k2 = kx * kx + kz * kz;
  if (k2 < 1e-12) return 0.0;
  const k = Math.sqrt(k2);
  const L = (params.windSpeed * params.windSpeed) / GRAVITY;
  const l = L * 0.0015; // small-wave suppression length

  const kHat = directionalSpread(kx, kz, params.windDirRad, params.spreadExp);
  const damp = Math.exp(-k2 * l * l);
  const main = Math.exp(-1.0 / (k2 * L * L)) / (k2 * k2);
  return params.amplitude * main * kHat * damp;
}

/**
 * Pierson–Moskowitz, fully developed sea.
 *   S(ω) = α·g² / ω⁵ · exp(-β·(ω_p/ω)⁴)
 * with ω_p = g/(1.026·V) (peak), α = 0.0081, β = 1.25 (the 5/4 form).
 */
function piersonMoskowitz(kx, kz, params) {
  const k = Math.hypot(kx, kz);
  if (k < 1e-6) return 0.0;
  const omega = Math.sqrt(GRAVITY * k);
  const omegaP = GRAVITY / (1.026 * params.windSpeed);

  const alpha = 0.0081;
  const Sw = (alpha * GRAVITY * GRAVITY / Math.pow(omega, 5.0)) *
             Math.exp(-1.25 * Math.pow(omegaP / omega, 4.0));

  // S(ω) -> S(k): multiply by dω/dk and spread over the k-annulus (1/k).
  const dwdk = 0.5 * Math.sqrt(GRAVITY / k);
  const Sk = Sw * dwdk / k;

  const dir = directionalSpread(kx, kz, params.windDirRad, params.spreadExp);
  return params.amplitude * Sk * dir;
}

/**
 * JONSWAP, fetch-limited sea.
 *   S(ω) = α·g²/ω⁵ · exp(-1.25·(ω_p/ω)⁴) · γ^r,
 *   r = exp(-(ω-ω_p)² / (2σ²ω_p²)),  σ = 0.07 (ω≤ω_p) / 0.09 (ω>ω_p)
 * α and ω_p come from the dimensionless fetch.
 */
function jonswap(kx, kz, params) {
  const k = Math.hypot(kx, kz);
  if (k < 1e-6) return 0.0;
  const omega = Math.sqrt(GRAVITY * k);

  const V = params.windSpeed;
  const F = Math.max(params.fetch, 1.0);
  const dimlessFetch = (GRAVITY * F) / (V * V);

  const alpha = 0.076 * Math.pow(dimlessFetch, -0.22);
  const omegaP = 22.0 * Math.pow((GRAVITY * GRAVITY) / (V * F), 1.0 / 3.0);
  const gamma = 3.3;

  const sigma = omega <= omegaP ? 0.07 : 0.09;
  const r = Math.exp(-Math.pow(omega - omegaP, 2.0) /
                     (2.0 * sigma * sigma * omegaP * omegaP));

  const Sw = (alpha * GRAVITY * GRAVITY / Math.pow(omega, 5.0)) *
             Math.exp(-1.25 * Math.pow(omegaP / omega, 4.0)) *
             Math.pow(gamma, r);

  const dwdk = 0.5 * Math.sqrt(GRAVITY / k);
  const Sk = Sw * dwdk / k;

  const dir = directionalSpread(kx, kz, params.windDirRad, params.spreadExp);
  return params.amplitude * Sk * dir;
}

/** Dispatch to the selected spectrum. Returns elevation variance at k. */
export function spectrumVariance(spectrumName, kx, kz, params) {
  switch (spectrumName) {
    case SPECTRA.PHILLIPS:           return phillips(kx, kz, params);
    case SPECTRA.PIERSON_MOSKOWITZ:  return piersonMoskowitz(kx, kz, params);
    case SPECTRA.JONSWAP:
    default:                         return jonswap(kx, kz, params);
  }
}
