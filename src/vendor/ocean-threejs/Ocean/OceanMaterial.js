/**
 * OceanMaterial.js
 * -----------------------------------------------------------------------------
 * Builds the GLSL3 ShaderMaterial for the water surface and keeps its uniforms
 * synchronized with the central config. All color grading / tone mapping is done
 * inside the shader, so the renderer runs with NoToneMapping.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { WATER_VERT } from '../Shaders/water.vert.js';
import { WATER_FRAG } from '../Shaders/water.frag.js';
import { createFoamUniforms, updateFoamUniforms } from './Foam.js';
import { MAX_GERSTNER } from './Gerstner.js';

const linColor = (hex) => new THREE.Color(hex);

export class OceanMaterial {
  constructor(config) {
    this.config = config;

    const uniforms = {
      // FFT fields
      uDisplacement: { value: null },
      uDerivatives:  { value: null },
      uPatchSize:    { value: config.ocean.patchSize },
      uCascadeScale: { value: new THREE.Vector3(...config.ocean.cascadeScale) },
      uCascadeWeight:{ value: new THREE.Vector3(1.0, 0.55, 0.28) },
      uChoppiness:   { value: config.ocean.choppiness },
      uOceanScale:   { value: config.ocean.oceanScale },
      uTime:         { value: 0 },
      uModelOffset:  { value: new THREE.Vector2(0, 0) },

      // Gerstner
      uGerstnerDir:    { value: Array.from({ length: MAX_GERSTNER }, () => new THREE.Vector2(1, 0)) },
      uGerstnerParams: { value: Array.from({ length: MAX_GERSTNER }, () => new THREE.Vector4()) },

      // PBR / water
      uRoughness:           { value: config.water.roughness },
      uMetallic:            { value: config.water.metallic },
      uSpecular:            { value: config.water.specular },
      uIor:                 { value: config.water.ior },
      uTransparency:        { value: config.water.transparency },
      uReflectionIntensity: { value: config.water.reflectionIntensity },
      uReflectionBlur:      { value: config.water.reflectionBlur },
      uReflectionDistortion:{ value: config.water.reflectionDistortion },
      uFresnelPower:        { value: config.water.fresnelPower },
      uFresnelBias:         { value: config.water.fresnelBias },
      uRefractionStrength:  { value: config.water.refractionStrength },
      uRefractionDistortion:{ value: config.water.refractionDistortion },
      uWaterThickness:      { value: config.water.waterThickness },
      uChromaticOffset:     { value: config.water.chromaticOffset },
      uRefractionTex:       { value: null },
      uResolution:          { value: new THREE.Vector2(1, 1) },
      uSandLevel:           { value: -config.sand.depth },
      uExtinction:          { value: new THREE.Vector3(0.32, 0.085, 0.06) },
      uNormalScale:         { value: config.water.normalScale },
      uDetailScale:         { value: config.water.detailScale },
      uMicroDetail:         { value: config.water.microDetail },

      // Color
      uDeepColor:    { value: linColor(config.color.deepColor) },
      uSurfaceColor: { value: linColor(config.color.surfaceColor) },
      uScatterColor: { value: linColor(config.color.scatterColor) },
      uHorizonColor: { value: linColor(config.color.horizonColor) },
      uHorizonBlend: { value: config.color.horizonBlend },
      uOceanExtent:  { value: config.ocean.oceanSize },
      uFogColor:     { value: linColor(config.fog.color) },
      uFogDensity:   { value: config.fog.density },
      uFogStrength:  { value: config.fog.strength },
      uAbsorption:   { value: config.color.absorption },
      uScattering:   { value: config.color.scattering },
      uSaturation:   { value: config.color.saturation },
      uContrast:     { value: config.color.contrast },
      uBrightness:   { value: config.color.brightness },
      uExposure:     { value: config.color.exposure },

      // Lighting / env
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor:     { value: linColor(config.lighting.sunColor) },
      uSunIntensity: { value: config.lighting.sunIntensity },
      uEnvIntensity: { value: config.lighting.envIntensity },
      uCloudiness:   { value: config.lighting.cloudiness },
      uHasEnv:       { value: 0 },
      uEnvMap:       { value: null },
      uEnvMaxLod:    { value: 8 },

      // Foam
      ...createFoamUniforms(config.foam),
    };

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      side: THREE.DoubleSide,
    });
    this.uniforms = uniforms;
  }

  setFFTTextures(displacement, derivatives) {
    this.uniforms.uDisplacement.value = displacement;
    this.uniforms.uDerivatives.value = derivatives;
  }

  setGerstner(directions, params) {
    for (let i = 0; i < MAX_GERSTNER; i++) {
      this.uniforms.uGerstnerDir.value[i].copy(directions[i]);
      this.uniforms.uGerstnerParams.value[i].copy(params[i]);
    }
  }

  setEnvironment(equirectTexture, maxLod) {
    this.uniforms.uEnvMap.value = equirectTexture;
    this.uniforms.uHasEnv.value = equirectTexture ? 1 : 0;
    if (maxLod) this.uniforms.uEnvMaxLod.value = maxLod;
  }

  setTime(t) { this.uniforms.uTime.value = t; }

  setModelOffset(x, z) { this.uniforms.uModelOffset.value.set(x, z); }

  setRefraction(texture, width, height) {
    this.uniforms.uRefractionTex.value = texture;
    this.uniforms.uResolution.value.set(width, height);
  }

  setSandLevel(y) { this.uniforms.uSandLevel.value = y; }

  /** Push the whole config into uniforms (called when the GUI changes). */
  sync() {
    const { ocean, water, color, lighting, foam, fog } = this.config;
    const u = this.uniforms;

    u.uFogColor.value.copy(linColor(fog.color));
    u.uFogDensity.value = fog.density;
    u.uFogStrength.value = fog.strength;

    u.uPatchSize.value = ocean.patchSize;
    u.uCascadeScale.value.set(...ocean.cascadeScale);
    u.uChoppiness.value = ocean.choppiness;
    u.uOceanScale.value = ocean.oceanScale;
    u.uSandLevel.value = -this.config.sand.depth;
    u.uOceanExtent.value = ocean.oceanSize;

    u.uRoughness.value = water.roughness;
    u.uMetallic.value = water.metallic;
    u.uSpecular.value = water.specular;
    u.uIor.value = water.ior;
    u.uTransparency.value = water.transparency;
    u.uReflectionIntensity.value = water.reflectionIntensity;
    u.uReflectionBlur.value = water.reflectionBlur;
    u.uReflectionDistortion.value = water.reflectionDistortion;
    u.uFresnelPower.value = water.fresnelPower;
    u.uFresnelBias.value = water.fresnelBias;
    u.uRefractionStrength.value = water.refractionStrength;
    u.uRefractionDistortion.value = water.refractionDistortion;
    u.uWaterThickness.value = water.waterThickness;
    u.uChromaticOffset.value = water.chromaticOffset;
    u.uNormalScale.value = water.normalScale;
    u.uDetailScale.value = water.detailScale;
    u.uMicroDetail.value = water.microDetail;

    u.uDeepColor.value.copy(linColor(color.deepColor));
    u.uSurfaceColor.value.copy(linColor(color.surfaceColor));
    u.uScatterColor.value.copy(linColor(color.scatterColor));
    u.uHorizonColor.value.copy(linColor(color.horizonColor));
    u.uHorizonBlend.value = color.horizonBlend;
    u.uAbsorption.value = color.absorption;
    u.uScattering.value = color.scattering;
    u.uSaturation.value = color.saturation;
    u.uContrast.value = color.contrast;
    u.uBrightness.value = color.brightness;
    u.uExposure.value = color.exposure;

    u.uSunColor.value.copy(linColor(lighting.sunColor));
    u.uSunIntensity.value = lighting.sunIntensity;
    u.uEnvIntensity.value = lighting.envIntensity;
    u.uCloudiness.value = lighting.cloudiness;

    updateFoamUniforms(u, foam);
  }

  dispose() { this.material.dispose(); }
}
