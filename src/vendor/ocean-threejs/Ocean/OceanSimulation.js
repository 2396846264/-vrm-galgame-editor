/**
 * OceanSimulation.js
 * -----------------------------------------------------------------------------
 * Glue between the FFT solver, the Gerstner swell set and the water material.
 *
 *   • Owns the FFT instance and the static-spectrum rebuild lifecycle.
 *   • Advances simulation time each frame and feeds the resulting textures to
 *     the material.
 *   • Rebuilds the Gerstner uniforms when swell parameters change.
 *
 * "Dirty" flags keep the expensive CPU spectrum rebuild off the per-frame path.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { FFT } from './FFT.js';
import { buildGerstnerWaves } from './Gerstner.js';

export class OceanSimulation {
  constructor(renderer, config, material) {
    this.renderer = renderer;
    this.config = config;
    this.material = material;
    this.time = 0;

    this.fft = new FFT(renderer, config.ocean.fftSize);
    this.spectrumDirty = true;
    this.gerstnerDirty = true;

    this._sun = new THREE.Vector3();
  }

  markSpectrumDirty() { this.spectrumDirty = true; }
  markGerstnerDirty() { this.gerstnerDirty = true; }

  setFFTSize(size) {
    if (size === this.fft.N) return;
    this.fft.setSize(size);
    this.config.ocean.fftSize = size;
    this.spectrumDirty = true;
  }

  updateSun() {
    const { sunElevation, sunAzimuth } = this.config.lighting;
    const el = THREE.MathUtils.degToRad(sunElevation);
    const az = THREE.MathUtils.degToRad(sunAzimuth);
    this._sun.set(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az)
    ).normalize();
    this.material.uniforms.uSunDirection.value.copy(this._sun);
    return this._sun;
  }

  update(dt) {
    if (this.spectrumDirty) {
      this.fft.buildSpectrum(this.config.ocean);
      this.spectrumDirty = false;
    }
    if (this.gerstnerDirty) {
      const { directions, params } = buildGerstnerWaves(this.config.ocean);
      this.material.setGerstner(directions, params);
      this.gerstnerDirty = false;
    }

    this.time += dt * this.config.ocean.timeScale;
    this.fft.update(this.time, this.config.ocean.waveSpeed);

    this.material.setFFTTextures(this.fft.displacementTexture, this.fft.derivativesTexture);
    this.material.setTime(this.time);
    this.updateSun();
  }

  dispose() { this.fft.dispose(); }
}
