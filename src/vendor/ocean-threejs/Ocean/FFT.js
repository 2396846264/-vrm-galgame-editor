/**
 * FFT.js
 * -----------------------------------------------------------------------------
 * GPU implementation of Tessendorf's FFT ocean. Owns:
 *   • the static spectrum texture h0(k)  (rebuilt on the CPU when the sea state
 *     changes — Spectra.js provides the variance model),
 *   • the precomputed radix-2 butterfly/twiddle texture,
 *   • the ping-pong render targets and the per-frame pass schedule.
 *
 * Outputs two RGBA-float textures consumed by the water material:
 *   displacementTexture : R=Dy  G=Dx  B=Dz  A=∂Dy/∂x
 *   derivativesTexture  : R=∂Dy/∂z  G=∂Dx/∂x  B=∂Dz/∂z  A=∂Dx/∂z
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { createFloatRenderTarget, FullscreenPass, makeComputeMaterial } from '../Utils/GPUCompute.js';
import { SPECTRUM_UPDATE, BUTTERFLY, PERMUTATION } from '../Shaders/fftKernels.js';
import { spectrumVariance, gaussianPair, mulberry32, GRAVITY } from './Spectra.js';

export class FFT {
  constructor(renderer, size) {
    this.renderer = renderer;
    this.pass = new FullscreenPass();
    this.setSize(size);
  }

  /** (Re)allocate everything that depends on the FFT resolution N. */
  setSize(size) {
    this.N = size;
    this.stages = Math.log2(size);
    if (!Number.isInteger(this.stages)) {
      throw new Error(`FFT size must be a power of two, got ${size}`);
    }

    this._disposeTargets();
    this.butterflyTexture?.dispose();this.h0Texture?.dispose();
    this.spectrumMat?.dispose();this.butterflyMat?.dispose();this.permutationMat?.dispose();

    // Ping-pong buffers (shared between the two field sets, processed serially).
    this.ping = [createFloatRenderTarget(size), createFloatRenderTarget(size)];
    // Output targets: half-float so the water shader can sample them linearly.
    this.displacementTarget = createFloatRenderTarget(size, { linear: true, type: THREE.HalfFloatType });
    this.derivativesTarget = createFloatRenderTarget(size, { linear: true, type: THREE.HalfFloatType });

    this.butterflyTexture = this._buildButterflyTexture(size);

    this.h0Texture = new THREE.DataTexture(
      new Float32Array(size * size * 4), size, size,
      THREE.RGBAFormat, THREE.FloatType
    );
    this.h0Texture.minFilter = THREE.NearestFilter;
    this.h0Texture.magFilter = THREE.NearestFilter;
    this.h0Texture.wrapS = THREE.RepeatWrapping;
    this.h0Texture.wrapT = THREE.RepeatWrapping;
    this.h0Texture.needsUpdate = true;

    this._buildMaterials();
  }

  _buildMaterials() {
    this.spectrumMat = makeComputeMaterial(SPECTRUM_UPDATE, {
      uH0:        { value: this.h0Texture },
      uTime:      { value: 0 },
      uN:         { value: this.N },
      uL:         { value: 200.0 },
      uWaveSpeed: { value: 1.0 },
      uLoopPeriod:{ value: 200.0 },
      uTarget:    { value: 0 },
    });

    this.butterflyMat = makeComputeMaterial(BUTTERFLY, {
      uButterfly: { value: this.butterflyTexture },
      uSource:    { value: null },
      uStage:     { value: 0 },
      uDirection: { value: 0 },
    });

    this.permutationMat = makeComputeMaterial(PERMUTATION, {
      uSource: { value: null },
      uN:      { value: this.N },
    });
  }

  /**
   * Precompute the butterfly texture: width = log2(N) stages, height = N.
   * Each texel stores (twiddle.re, twiddle.im, indexA, indexB) for a radix-2
   * decimation-in-time inverse FFT. Stage 0 reads bit-reversed source indices.
   */
  _buildButterflyTexture(N) {
    const stages = Math.log2(N);
    const data = new Float32Array(stages * N * 4);

    const bits = stages;
    const bitReversed = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      let x = i, r = 0;
      for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; }
      bitReversed[i] = r;
    }

    for (let stage = 0; stage < stages; stage++) {
      for (let y = 0; y < N; y++) {
        // twiddle factor for the inverse transform (e^{+i 2π k / N})
        const k = (y * (N >> (stage + 1))) % N;
        const angle = (2.0 * Math.PI * k) / N;
        const twR = Math.cos(angle);
        const twI = Math.sin(angle);

        const span = 1 << stage;
        const topWing = (y % (1 << (stage + 1))) < span;

        let ia, ib;
        if (stage === 0) {
          if (topWing) { ia = bitReversed[y]; ib = bitReversed[y + 1]; }
          else         { ia = bitReversed[y - 1]; ib = bitReversed[y]; }
        } else {
          if (topWing) { ia = y; ib = y + span; }
          else         { ia = y - span; ib = y; }
        }

        const idx = (stage + y * stages) * 4; // column-major: x=stage, y=row
        data[idx + 0] = twR;
        data[idx + 1] = twI;
        data[idx + 2] = ia;
        data[idx + 3] = ib;
      }
    }

    const tex = new THREE.DataTexture(data, stages, N, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Rebuild the static spectrum texture h0(k) from the current sea state.
   * Called whenever wind / spectrum / patch parameters change (not per frame).
   */
  buildSpectrum(oceanConfig) {
    const N = this.N;
    const L = this.patchSize = oceanConfig.patchSize;
    const data = this.h0Texture.image.data;

    const rng = mulberry32(1337 + Math.floor(oceanConfig.randomness * 9973));

    const params = {
      windSpeed: oceanConfig.windSpeed,
      windDirRad: THREE.MathUtils.degToRad(oceanConfig.windDirection),
      fetch: oceanConfig.fetch,
      spreadExp: oceanConfig.windAlignment,
      amplitude: 1.0, // absolute scale is normalized below; only the SHAPE matters
    };

    const twoPiOverL = (2.0 * Math.PI) / L;
    const wl = Math.max(oceanConfig.waveLength, 1e-3);

    // √(S(k)/2) · Gaussian, evaluated at k stretched by the wavelength control.
    const ampOf = (m, n) => {
      const kx = (twoPiOverL * m) / wl;
      const kz = (twoPiOverL * n) / wl;
      let s = spectrumVariance(oceanConfig.spectrum, kx, kz, params);
      if (!isFinite(s) || s < 0) s = 0;
      return Math.sqrt(s * 0.5);
    };

    // Pass 1: fill h0 and accumulate elevation variance (Σ|h0|²).
    let sumSq = 0;
    for (let y = 0; y < N; y++) {
      const n = y - N / 2;
      for (let x = 0; x < N; x++) {
        const m = x - N / 2;
        const a = ampOf(m, n);
        const am = ampOf(-m, -n);
        const [gr, gi] = gaussianPair(rng);
        const [gr2, gi2] = gaussianPair(rng);
        const h0r = a * gr,  h0i = a * gi;
        const hmr = am * gr2, hmi = am * gi2;
        const idx = (x + y * N) * 4;
        data[idx + 0] = h0r;
        data[idx + 1] = h0i;
        data[idx + 2] = hmr;
        data[idx + 3] = hmi;
        sumSq += h0r * h0r + h0i * h0i;
      }
    }

    // Pass 2: normalize to a target significant wave height so any spectrum /
    // any internal constant produces believable, controllable wave heights.
    //   σ ≈ √(2·Σ|h0|²),  Hs = 4σ,  target Hs from fully-developed sea theory.
    const sigma = Math.sqrt(2.0 * sumSq) || 1e-6;
    const Hs = 4.0 * sigma;
    const HsTarget = THREE.MathUtils.clamp(
      0.21 * (oceanConfig.windSpeed * oceanConfig.windSpeed) / GRAVITY, 0.05, 14.0
    ) * oceanConfig.waveAmplitude;
    // Compensate for the inverse transform's N-squared normalization.
    const scale = HsTarget / Hs * N * N;
    for (let i = 0; i < data.length; i++) data[i] *= scale;

    // Packed real transforms require Hermitian symmetry: reuse h0(-k).
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const i=(x+y*N)*4,j=(((N-x)%N)+((N-y)%N)*N)*4;
      data[i+2]=data[j];data[i+3]=data[j+1];
    }
    this.h0Texture.needsUpdate = true;

    // Loop period from the longest resolvable wave's period (seamless looping).
    const kMin = twoPiOverL;
    this.loopPeriod = (2.0 * Math.PI) / (Math.sqrt(GRAVITY * kMin)) ;
    this.spectrumMat.uniforms.uL.value = L;
    this.spectrumMat.uniforms.uLoopPeriod.value = this.loopPeriod * 8.0;
  }

  /** Advance the simulation to `time` and produce the output textures. */
  update(time, waveSpeed) {
    this.spectrumMat.uniforms.uTime.value = time;
    this.spectrumMat.uniforms.uWaveSpeed.value = waveSpeed;

    this._transformField(0, this.displacementTarget);
    this._transformField(1, this.derivativesTarget);
  }

  _transformField(target, outputTarget) {
    const r = this.renderer;

    // 1. spectrum → ping[0]
    this.spectrumMat.uniforms.uTarget.value = target;
    this.pass.render(r, this.spectrumMat, this.ping[0]);

    // 2. horizontal then vertical butterfly stages, ping-pong
    let src = 0;
    for (let dir = 0; dir < 2; dir++) {
      this.butterflyMat.uniforms.uDirection.value = dir;
      for (let stage = 0; stage < this.stages; stage++) {
        this.butterflyMat.uniforms.uStage.value = stage;
        this.butterflyMat.uniforms.uSource.value = this.ping[src].texture;
        this.pass.render(r, this.butterflyMat, this.ping[1 - src]);
        src = 1 - src;
      }
    }

    // 3. permutation/normalization → output
    this.permutationMat.uniforms.uSource.value = this.ping[src].texture;
    this.pass.render(r, this.permutationMat, outputTarget);
  }

  get displacementTexture() { return this.displacementTarget.texture; }
  get derivativesTexture()  { return this.derivativesTarget.texture; }

  _disposeTargets() {
    [this.ping?.[0], this.ping?.[1], this.displacementTarget, this.derivativesTarget]
      .forEach((rt) => rt && rt.dispose());
  }

  dispose() {
    this._disposeTargets();
    this.butterflyTexture?.dispose();
    this.h0Texture?.dispose();
    this.spectrumMat?.dispose();this.butterflyMat?.dispose();this.permutationMat?.dispose();
    this.pass.dispose();
  }
}
