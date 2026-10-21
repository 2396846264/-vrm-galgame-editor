/**
 * config.js
 * -----------------------------------------------------------------------------
 * Single source of truth for every tunable parameter in the renderer.
 *
 * The object is mutated live by the GUI (Utils/GUI.js). The simulation and
 * material read from it each frame, so there is no duplicated state. Grouping
 * mirrors the GUI folder layout requested in the brief.
 * -----------------------------------------------------------------------------
 */

export const SPECTRA = Object.freeze({
  PHILLIPS: 'Phillips',
  JONSWAP: 'JONSWAP',
  PIERSON_MOSKOWITZ: 'Pierson-Moskowitz',
});

export const QUALITY_PRESETS = Object.freeze({
  Low:    { fftSize: 128, meshResolution: 256, oceanSize: 600 },
  Medium: { fftSize: 256, meshResolution: 400, oceanSize: 900 },
  High:   { fftSize: 256, meshResolution: 512, oceanSize: 1200 },
  Ultra:  { fftSize: 512, meshResolution: 768, oceanSize: 1800 },
});

export const config = {
  // ── Ocean / simulation ────────────────────────────────────────────────────
  ocean: {
    spectrum: SPECTRA.JONSWAP,

    // Wind
    windSpeed: 14.0,           // m/s  — drives spectrum energy & peak frequency
    windDirection: 43.0,       // degrees
    fetch: 80000.0,            // m    — JONSWAP fetch length (longer = developed sea)
    windAlignment: 6.0,        // directional spreading exponent (|k·w|^n)

    // Waves (global shaping on top of the spectrum)
    waveAmplitude: 1.0,        // master vertical displacement gain
    waveLength: 1.0,           // multiplier on patch wavelength content
    steepness: 1.0,            // Gerstner steepness master
    waveSpeed: 1.0,            // dispersion time multiplier
    randomness: 1.0,           // phase randomness of the FFT field

    // Choppiness (horizontal displacement, λ in Tessendorf)
    choppiness: 1.35,

    // Swell — long, directional, low-frequency Gerstner layers
    swell: 0.55,               // primary swell strength
    swellDirection: 20.0,      // degrees
    secondarySwell: 0.28,      // crossing swell strength
    secondarySwellDirection: 110.0,

    // FFT / patch settings
    oceanScale: 1.0,           // world-space multiplier on the whole surface
    timeScale: 1.0,
    fftSize: 256,              // FFT resolution (power of two): 128 / 256 / 512
    patchSize: 220.0,          // world size (m) of one FFT tile — controls wavelength
    cascadeScale: [1.0, 0.27, 0.072], // three cascades to kill tiling (large→fine)

    // Mesh
    meshResolution: 512,       // grid subdivisions of the rendered surface
    oceanSize: 1200,           // world extent of the rendered plane (fades to sky at the edge)
  },

  // ── Water shader (PBR) ──────────────────────────────────────────────────────
  water: {
    roughness: 0.035,
    metallic: 0.0,
    specular: 1.2,
    ior: 1.333,                // physically correct water IOR
    transparency: 0.78,

    // Reflection
    reflectionIntensity: 1.0,
    reflectionBlur: 0.08,
    reflectionRoughness: 0.05,
    reflectionDistortion: 0.22,

    // Refraction
    refractionStrength: 0.55,
    refractionDistortion: 0.18,
    waterThickness: 2.4,
    chromaticOffset: 0.0035,

    // Fresnel
    fresnelPower: 5.0,
    fresnelBias: 0.02,

    // Normal-map micro detail
    normalScale: 1.0,
    detailScale: 1.0,
    microDetail: 0.6,
  },

  // ── Foam ─────────────────────────────────────────────────────────────────
  foam: {
    threshold: 0.62,           // Jacobian fold threshold (lower = more foam)
    intensity: 1.0,
    scale: 2.4,                // foam texture frequency
    brightness: 1.15,
    softness: 0.35,
    speed: 0.35,
    contrast: 1.4,
    opacity: 0.95,
    coverage: 0.5,
    crestFoam: 0.6,            // foam on steep crests (curvature)
    persistence: 0.55,         // accumulated/decaying foam over time
  },

  // ── Sand floor (PBR texture set seen through the water) ────────────────────
  sand: {
    depth: 7.0,                // metres from the water surface down to the sand
    textureScale: 0.12,        // texture repeats per metre (the "resize" control)
    normalStrength: 1.2,       // bump strength of the normal map
    brightness: 1.05,          // sea-bed albedo gain
    causticIntensity: 0.7,
    causticScale: 0.35,
    causticSpeed: 0.6,
  },

  // ── Color ─────────────────────────────────────────────────────────────────
  color: {
    deepColor: '#0a3550',      // deep open-water blue (far / deep)
    surfaceColor: '#1aa7c0',   // mid turquoise
    scatterColor: '#1d9ab0',   // in-scattered water tint (builds with depth)
    horizonColor: '#cfe6f3',   // light sky blue (crisp, not grey)
    horizonBlend: 0.32,
    absorption: 1.0,           // Beer-Lambert strength (extinction multiplier)
    scattering: 1.0,           // in-scatter strength
    saturation: 1.1,
    contrast: 1.04,
    brightness: 1.0,
    exposure: 1.05,
  },

  // ── Atmospheric fog (blueish haze where the sea meets the sky) ─────────────
  fog: {
    color: '#bcd7e8',          // soft blue horizon haze
    density: 0.0016,           // exp² fog density (higher = closer/thicker)
    strength: 1.0,             // overall fog amount on the water
    skyAmount: 0.6,            // how strongly the sky horizon band picks up fog
  },

  // ── Lighting ────────────────────────────────────────────────────────────────
  lighting: {
    sunElevation: 38.0,        // degrees above horizon (bright daytime)
    sunAzimuth: 50.0,          // degrees
    sunIntensity: 4.0,
    sunColor: '#fff6ec',
    envIntensity: 1.0,
    cloudiness: 0.5,           // 0 = overcast, 1 = clear sky
  },

  // ── Performance ─────────────────────────────────────────────────────────────
  performance: {
    preset: 'High',
    pixelRatioCap: 2.0,
  },
};
