/**
 * GPUCompute.js
 * -----------------------------------------------------------------------------
 * Tiny helper to run full-screen fragment "kernels" into float render targets.
 * This is the substrate the FFT pipeline is built on: every Tessendorf stage
 * (spectrum update, butterfly passes, permutation) is just a full-screen draw
 * of a ShaderMaterial into an RGBA float target.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { FULLSCREEN_VERT } from '../Shaders/fullscreen.vert.js';

export function createFloatRenderTarget(size, { count = 1, linear = false, type = THREE.FloatType } = {}) {
  // Compute stages use FloatType + Nearest (texelFetch ignores filtering).
  // Final output targets use HalfFloatType + Linear: half-float is core-
  // filterable in WebGL2, so the displaced surface samples smoothly.
  const filter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  const options = {
    type,
    format: THREE.RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  };
  const rt = new THREE.WebGLRenderTarget(size, size, { ...options, count });
  return rt;
}

/**
 * A reusable full-screen pass. Swap `material` between draws to run different
 * kernels against the same quad/camera.
 */
export class FullscreenPass {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geometry, null);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }

  render(renderer, material, target) {
    this.mesh.material = material;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    this.geometry.dispose();
  }
}

/** Convenience factory for a compute ShaderMaterial (no lighting, no fog). */
export function makeComputeMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    glslVersion: THREE.GLSL3,
  });
}
