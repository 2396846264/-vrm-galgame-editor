import * as THREE from 'three';

export const weatherNames = { none: '无天气', sunny: '阳光明媚', cloudy: '阴天', rain: '下雨', snow: '下雪', wind: '刮风' };
export const weatherDefaults = { type: 'none', intensity: .55, wind: .25, direction: 1, ground: .78,
  splashes: true, atmosphere: true, autoMood: true, windMotion: true, sunX: .8, soundId: 'auto', volume: .65 };
const bounded = (value, fallback, low = 0, high = 1) => Number.isFinite(Number(value))
  ? Math.max(low, Math.min(high, Number(value))) : fallback;
export function normalizeWeather(value = {}) {
  const w = { ...weatherDefaults, ...value };
  w.type = Object.hasOwn(weatherNames, w.type) ? w.type : 'none';
  for (const key of ['intensity', 'wind', 'ground', 'sunX', 'volume']) w[key] = bounded(w[key], weatherDefaults[key]);
  w.ground = Math.max(.2, w.ground);
  w.direction = Number(w.direction) < 0 ? -1 : 1;
  for (const key of ['splashes', 'atmosphere', 'autoMood', 'windMotion']) w[key] = w[key] !== false;
  w.soundId = typeof w.soundId === 'string' ? w.soundId : 'auto';
  return w;
}
export function weatherMood(value) {
  const w = normalizeWeather(value);
  const strength = w.autoMood ? w.intensity : 0;
  const mood = { rain: [.75, -12, .87], snow: [1.02, -7, .92], cloudy: [.78, -5, .9], sunny: [1.05, 9, 1.04], wind: [.98, -2, 1] }[w.type] || [1, 0, 1];
  return { brightness: 1 + (mood[0] - 1) * strength, temperature: mood[1] * strength,
    saturation: 1 + (mood[2] - 1) * strength };
}

// Camera-facing quads at different world depths. The character depth buffer hides
// distant rain/snow while nearby particles cross in front. GPU animation avoids
// moving hundreds of DOM nodes or allocating a new particle array every frame.
const vertexShader = `
  attribute vec4 seed;
  uniform float time, kind, wind, intensity, ground, aspect, tanFov, splash;
  uniform mat4 cameraWorld;
  varying vec2 vUv;
  varying float vAlpha, vSeed;
  void main() {
    vUv=uv; vSeed=seed.w;
    float depth=mix(2.2,9.0,seed.z);
    float nearFactor=1.0-seed.z;
    float gust=1.0+.22*sin(time*.71)+.12*sin(time*1.63+seed.w*6.28);
    float flow=wind*gust;
    float speed=kind<1.5 ? mix(.6,1.45,nearFactor) : kind<2.5 ? mix(.035,.15,nearFactor) : kind<3.5 ? .025 : .16;
    float bottom=kind<1.5 && splash<.5 ? mix(ground,1.09,seed.w) : 1.1;
    float travel=fract(seed.y+time*speed*(.75+intensity*.35));
    float y=-.12+travel*(bottom+.12);
    float x=fract(seed.x+time*flow*(kind<1.5 ? .11 : .045)+.02*sin(time*(.7+seed.w)+seed.y*30.0))-0.0;
    float angle=kind<1.5 ? -atan(flow*.22,.9) : time*(.35+seed.w)*flow+seed.w*6.28;
    vec2 size;
    if(kind<1.5) size=vec2(mix(.00035,.0010,nearFactor),mix(.009,.043,nearFactor));
    else if(kind<2.5) size=vec2(mix(.0009,.0049,nearFactor))*(.6+seed.w);
    else if(kind<3.5) size=vec2(mix(.00035,.001,nearFactor));
    else size=vec2(mix(.002,.009,nearFactor),mix(.001,.004,nearFactor));
    if(kind>3.5) {
      size.x*=.18+.82*abs(sin(time*(2.0+seed.w)+seed.y*25.0));
      y+=.02*sin(time*(1.1+seed.w)+seed.x*30.0);
    }
    vAlpha=mix(.22,.64,nearFactor)*(.55+seed.w*.45);
    if(splash>.5) {
      depth=mix(3.0,9.0,seed.z);
      x=seed.x;
      y=mix(1.02,ground,pow(seed.z, .65));
      float age=fract(seed.y+time*(1.8+seed.w));
      size=vec2(.003+age*.008,(.003+age*.008)*.21)*(1.0-seed.z*.6);
      vAlpha=(1.0-age)*.24*intensity;
      if(seed.w>.67) {
        x+=(age-.5)*.012*(seed.w-.8);
        y-=sin(age*3.14159)*.009*(1.0-seed.z*.6);
        size=vec2(.00055,.0012)*(1.0-seed.z*.5);
        vAlpha=(1.0-age)*.45*intensity;
      }
      angle=0.0;
    }
    vec2 local=position.xy*size;
    local=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*local;
    // Screen x/y normalized to the current camera frustum, at each actual depth.
    vec2 screen=vec2((x-.5)*2.0*aspect,(.5-y)*2.0)+vec2(local.x,local.y)*2.0;
    vec3 point=vec3(screen*depth*tanFov,-depth);
    gl_Position=projectionMatrix*viewMatrix*cameraWorld*vec4(point,1.0);
  }
`;
const fragmentShader = `
  uniform float kind, splash;
  varying vec2 vUv;
  varying float vAlpha,vSeed;
  void main() {
    vec2 p=vUv*2.0-1.0;
    float alpha;
    vec3 color;
    if(splash>.5) {
      float r=length(p);
      alpha=vSeed>.67 ? exp(-r*r*4.0) : (1.0-smoothstep(.04,.2,abs(r-.72)))*(1.0-smoothstep(.9,1.0,r));
      color=vec3(.75,.84,.87);
    } else if(kind<1.5) {
      alpha=exp(-p.x*p.x*9.0)*(1.0-p.y*p.y)*.8;
      color=vec3(.73,.83,.89);
    } else if(kind<2.5) {
      float r=length(p);
      float edges=.72+.08*sin(atan(p.y,p.x)*6.0+vSeed*5.0);
      alpha=1.0-smoothstep(edges-.28,edges+.1,r);
      color=vec3(.96,.98,1.0);
    } else if(kind<3.5) {
      alpha=exp(-dot(p,p)*4.5)*.42;
      color=vec3(1.0,.93,.73);
    } else {
      float leaf=abs(p.x)+p.y*p.y;
      alpha=1.0-smoothstep(.68,.94,leaf);
      color=mix(vec3(.31,.36,.15),vec3(.69,.45,.19),vSeed);
      color*=.82+.18*abs(sin(vSeed*25.0+p.x*2.0));
    }
    alpha*=vAlpha;
    if(alpha<.015) discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function particleMesh(count, splash = false) {
  const plane = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index.clone();
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, plane.attributes[name].clone());
  plane.dispose();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent: true, depthTest: true,
    depthWrite: false, side: THREE.DoubleSide, uniforms: {
      time: { value: 0 }, kind: { value: 1 }, wind: { value: 0 }, intensity: { value: .5 },
      ground: { value: .78 }, aspect: { value: 1 }, tanFov: { value: 1 },
      splash: { value: splash ? 1 : 0 }, cameraWorld: { value: new THREE.Matrix4() }
    } });
  material.userData.outlineParameters = { visible: false };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = splash ? 'WeatherGroundRipples' : 'WeatherDepthParticles';
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

export class WeatherStage {
  constructor(stage) {
    this.stage = stage;
    this.settings = normalizeWeather();
    this.time = 0;
    this.windJoints = new Map();
    this.windForce = new THREE.Vector3();
    this.forceScratch = new THREE.Vector3();
    this.particles = particleMesh(1800);
    this.ripples = particleMesh(180, true);
    stage.scene.add(this.particles, this.ripples);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'weather-atmosphere';
    this.canvas.setAttribute('aria-hidden', 'true');
    stage.element.after(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.audio = new Audio(); this.audio.loop = true;
    this.soundKey = '';
    this.unlock = () => { if (this.audible) this.startAudio(); };
    document.addEventListener('pointerdown', this.unlock);
    document.addEventListener('keydown', this.unlock);
    this.pageVisibility = () => {
      if (document.hidden) { this.audio.pause(); this.context?.suspend().catch(() => {}); }
      else if (this.audible) this.startAudio();
    };
    document.addEventListener('visibilitychange', this.pageVisibility);
  }
  get active() { return this.settings.type !== 'none' && this.settings.intensity > 0; }
  set(value, audio = {}) {
    this.restoreWind();
    this.settings = normalizeWeather(value);
    this.lastAtmosphere = -1;
    const w = this.settings;
    this.canvas.hidden = !this.active || !w.atmosphere;
    this.particles.visible = this.active && ['rain','snow','wind','sunny'].includes(w.type);
    this.ripples.visible = this.active && w.type === 'rain' && w.splashes;
    const maximum = { rain: 1800, snow: 620, wind: 110, sunny: 65 }[w.type] || 0;
    this.particles.geometry.instanceCount = Math.round(maximum * w.intensity);
    this.ripples.geometry.instanceCount = Math.round(180 * w.intensity);
    const key = `${w.type}:${w.soundId}:${audio.url || ''}`;
    if (key !== this.soundKey) {
      this.stopAudio(); this.soundKey = key;
      this.audio.removeAttribute('src');
      if (w.soundId !== 'auto' && audio.url) this.audio.src = audio.url;
      this.audio.load();
    }
    this.audible = Boolean(audio.playing && this.active && w.soundId);
    this.setVolume(audio.master ?? 1, audio.effects ?? 1);
    if (this.audible && !document.hidden) this.startAudio(); else this.stopAudio(false);
  }
  setVolume(master, effects) {
    this.audioLevel = bounded(master, 1) * bounded(effects, 1) * this.settings.volume;
    this.audio.volume = this.audioLevel;
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.audible ? this.audioLevel * .18 : 0, this.context.currentTime, .12);
  }
  startAudio() {
    if (!this.audible || document.hidden) return;
    if (this.settings.soundId !== 'auto') {
      if (this.audio.getAttribute('src') && this.audio.paused) this.audio.play().catch(() => {});
      return;
    }
    if (!['rain','snow','wind','cloudy'].includes(this.settings.type)) return;
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext();
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = this.context.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
        this.low = this.context.createBiquadFilter(); this.low.type = 'lowpass';
        this.high = this.context.createBiquadFilter(); this.high.type = 'highpass';
        this.gain = this.context.createGain(); this.gain.gain.value = 0;
        this.noise.connect(this.low).connect(this.high).connect(this.gain).connect(this.context.destination);
        this.noise.start();
      }
      this.context.resume().catch(() => {});
      this.high.frequency.setTargetAtTime(this.settings.type === 'rain' ? 400 : 40, this.context.currentTime, .2);
      this.low.frequency.setTargetAtTime(this.settings.type === 'rain' ? 5200 : 430, this.context.currentTime, .2);
      this.gain.gain.setTargetAtTime(this.audioLevel * (this.settings.type === 'snow' ? .05 : .18) * this.settings.intensity, this.context.currentTime, .2);
    } catch { /* Audio can be retried on the next player gesture. */ }
  }
  stopAudio(reset = true) {
    this.audio.pause();
    if (this.context) {
      this.gain?.gain.setTargetAtTime(0, this.context.currentTime, .05);
      this.context.suspend().catch(() => {});
    }
    if (reset) this.audible = false;
  }
  applyWind(record) {
    const w = this.settings;
    if (!this.active || !w.windMotion || !w.wind) return;
    const joints = record.vrm.springBoneManager?.joints;
    if (!joints) return;
    this.stage.camera.updateMatrixWorld();
    this.windForce.setFromMatrixColumn(this.stage.camera.matrixWorld,0).multiplyScalar(
      w.direction*w.wind*w.intensity*.035*(.8+.18*Math.sin(this.time*.71)+.12*Math.sin(this.time*1.63)));
    for (const joint of joints) {
      const settings=joint.settings;
      if (!settings?.gravityDir?.isVector3 || !Number.isFinite(settings.gravityPower)) continue;
      let original=this.windJoints.get(joint);
      if (!original) { original={power:settings.gravityPower,dir:settings.gravityDir.clone()};this.windJoints.set(joint,original); }
      this.forceScratch.copy(original.dir).multiplyScalar(original.power).add(this.windForce);
      settings.gravityPower=this.forceScratch.length();
      settings.gravityDir.copy(this.forceScratch).normalize();
    }
  }
  restoreWind() {
    for (const [joint,original] of this.windJoints) {
      joint.settings.gravityPower=original.power;
      joint.settings.gravityDir.copy(original.dir);
    }
    this.windJoints.clear();
  }
  update(delta) {
    if (!this.active || document.hidden) return;
    this.time += Math.min(delta, .05);
    const w = this.settings, camera = this.stage.camera;
    camera.updateMatrixWorld();
    for (const mesh of [this.particles, this.ripples]) {
      const u = mesh.material.uniforms;
      u.time.value = this.time; u.kind.value = { rain: 1, snow: 2, sunny: 3, wind: 4 }[w.type] || 1;
      u.wind.value = w.wind * w.direction; u.intensity.value = w.intensity;
      u.ground.value = w.splashes ? w.ground : 1.1;
      u.aspect.value = camera.aspect; u.tanFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      u.cameraWorld.value.copy(camera.matrixWorld);
    }
    // Slow gusts in the wind bed, without abrupt volume jumps.
    if (this.gain && this.context?.state === 'running' && w.soundId === 'auto') {
      const gust = w.type === 'rain' ? 1 : .8 + Math.sin(this.time * .7) * .15;
      this.gain.gain.setTargetAtTime(this.audioLevel * (w.type === 'snow' ? .05 : .18) * w.intensity * gust, this.context.currentTime, .3);
    }
    if (w.atmosphere) this.drawAtmosphere();
  }
  drawAtmosphere() {
    if (this.time - this.lastAtmosphere < 1 / 30) return;
    this.lastAtmosphere = this.time;
    const rect = this.stage.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(1, 1100 / rect.width);
    const width = Math.round(rect.width * scale), height = Math.round(rect.height * scale);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const ctx = this.ctx, w = this.settings, strength = w.intensity;
    ctx.clearRect(0, 0, width, height);
    if (w.type === 'sunny') {
      const x = w.sunX * width, y = -.1 * height;
      ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createRadialGradient(x, y, 0, x, y, height * .8);
      glow.addColorStop(0, `rgba(255,247,210,${.16*strength})`); glow.addColorStop(1, 'rgba(255,247,210,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 4; i++) {
        const end = x + (i - 1.5) * width * .3 + Math.sin(this.time*.1+i)*width*.04;
        const beam = ctx.createLinearGradient(x, 0, end, height);
        beam.addColorStop(0, `rgba(255,247,219,${.025*strength})`);
        beam.addColorStop(.45, `rgba(255,247,219,${.055*strength})`); beam.addColorStop(1, 'rgba(255,247,219,0)');
        ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x-20, y); ctx.lineTo(end-width*.06,height); ctx.lineTo(end+width*.07,height); ctx.lineTo(x+20,y); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (['rain','snow','cloudy'].includes(w.type)) {
      const mist = ctx.createLinearGradient(0, 0, 0, height);
      const tint = w.type === 'snow' ? '220,232,240' : '139,158,170';
      mist.addColorStop(0, w.type === 'snow' ? `rgba(${tint},${.03*strength})` : `rgba(34,47,61,${.13*strength})`);
      mist.addColorStop(.62, `rgba(${tint},${.075*strength})`); mist.addColorStop(1, `rgba(${tint},${.025*strength})`);
      ctx.fillStyle = mist; ctx.fillRect(0,0,width,height);
    }
  }
  dispose() {
    this.restoreWind();
    this.stopAudio(); this.noise?.stop(); this.context?.close().catch(() => {});
    this.audio.removeAttribute('src'); this.audio.load();
    document.removeEventListener('pointerdown', this.unlock); document.removeEventListener('keydown', this.unlock);
    document.removeEventListener('visibilitychange', this.pageVisibility);
    for (const mesh of [this.particles,this.ripples]) { this.stage.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    this.canvas.remove();
  }
}
