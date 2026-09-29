import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Render the characters and their outline into the same buffer as the background.
class StagePass extends Pass {
  constructor(stage) {
    super();
    this.stage = stage;
    this.needsSwap = false;
  }

  render(renderer, _writeBuffer, readBuffer) {
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clear(true, true, true);
    if (this.stage.outlineEffect.enabled) this.stage.outlineEffect.render(this.stage.scene, this.stage.camera);
    else renderer.render(this.stage.scene, this.stage.camera);
    renderer.setRenderTarget(previousTarget);
    renderer.autoClear = previousAutoClear;
  }
}

const oilPaintShader = {
  name: 'OilPaintEffect',
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    strength: { value: 0.65 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 center = texture2D(tDiffuse, vUv);
      if (center.a < 0.01) {
        gl_FragColor = center;
        return;
      }

      vec3 sum0 = vec3(0.0), sum1 = vec3(0.0), sum2 = vec3(0.0), sum3 = vec3(0.0);
      float sq0 = 0.0, sq1 = 0.0, sq2 = 0.0, sq3 = 0.0;
      float count0 = 0.0, count1 = 0.0, count2 = 0.0, count3 = 0.0;
      vec2 pixel = 1.0 / resolution;
      for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
          vec4 sampleColor = texture2D(tDiffuse, clamp(vUv + vec2(float(x), float(y)) * pixel, vec2(0.0), vec2(1.0)));
          if (sampleColor.a < 0.12) continue;
          vec3 color = sampleColor.rgb;
          float squared = dot(color, color);
          if (x <= 0 && y <= 0) { sum0 += color; sq0 += squared; count0 += 1.0; }
          if (x >= 0 && y <= 0) { sum1 += color; sq1 += squared; count1 += 1.0; }
          if (x <= 0 && y >= 0) { sum2 += color; sq2 += squared; count2 += 1.0; }
          if (x >= 0 && y >= 0) { sum3 += color; sq3 += squared; count3 += 1.0; }
        }
      }
      vec3 mean0 = sum0 / max(count0, 1.0);
      vec3 mean1 = sum1 / max(count1, 1.0);
      vec3 mean2 = sum2 / max(count2, 1.0);
      vec3 mean3 = sum3 / max(count3, 1.0);
      float variance = sq0 / max(count0, 1.0) - dot(mean0, mean0) + (9.0 - count0) * 0.025;
      vec3 paint = mean0;
      float nextVariance = sq1 / max(count1, 1.0) - dot(mean1, mean1) + (9.0 - count1) * 0.025;
      if (nextVariance < variance) { variance = nextVariance; paint = mean1; }
      nextVariance = sq2 / max(count2, 1.0) - dot(mean2, mean2) + (9.0 - count2) * 0.025;
      if (nextVariance < variance) { variance = nextVariance; paint = mean2; }
      nextVariance = sq3 / max(count3, 1.0) - dot(mean3, mean3) + (9.0 - count3) * 0.025;
      if (nextVariance < variance) paint = mean3;

      float detail = length(center.rgb - paint);
      float preserveDetail = 1.0 - smoothstep(0.07, 0.28, detail) * 0.68;
      vec3 color = mix(center.rgb, paint, strength * 0.72 * preserveDetail);
      float dab = hash(floor(vUv * resolution / 3.5));
      float canvasGrain = hash(floor(vUv * resolution));
      color *= 1.0 + strength * (0.075 * (dab - 0.5) + 0.025 * (canvasGrain - 0.5));
      color = mix(color, floor(color * 24.0 + 0.5) / 24.0, strength * 0.16);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), center.a);
    }
  `
};

export function createOilPaintComposer(stage) {
  const composer = new EffectComposer(stage.renderer);
  composer.addPass(new StagePass(stage));
  const paintPass = new ShaderPass(oilPaintShader);
  composer.addPass(paintPass);
  composer.addPass(new OutputPass());
  return { composer, paintPass };
}
