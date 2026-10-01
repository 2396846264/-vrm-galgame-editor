import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { createOilPaintComposer } from './oil-paint-effect.js';

const boneNames = {
  Hips:'hips',Spine:'spine',Spine1:'chest',Spine2:'upperChest',Neck:'neck',Head:'head',
  LeftShoulder:'leftShoulder',LeftArm:'leftUpperArm',LeftForeArm:'leftLowerArm',LeftHand:'leftHand',
  RightShoulder:'rightShoulder',RightArm:'rightUpperArm',RightForeArm:'rightLowerArm',RightHand:'rightHand',
  LeftUpLeg:'leftUpperLeg',LeftLeg:'leftLowerLeg',LeftFoot:'leftFoot',LeftToeBase:'leftToes',
  RightUpLeg:'rightUpperLeg',RightLeg:'rightLowerLeg',RightFoot:'rightFoot',RightToeBase:'rightToes'
};
const isIdleMotion = asset => !asset || /idle|待机|静立|原地站立|呼吸/i.test(`${asset.id || ''} ${asset.name || ''} ${asset.path || ''}`);
const isPlantedMotion = asset => {
  if (isIdleMotion(asset)) return true;
  const name = `${asset?.name || ''} ${asset?.path || ''}`;
  return !/坐姿|坐着|坐下|起身|躺|爬行|翻滚/i.test(name) &&
    /说话|说笑|闲聊|交谈|低头发消息|\btalk(?:ing)?\b|\bchat(?:ting)?\b|\bconversation\b/i.test(name);
};
export function motionFrameInfo(clip) {
  if (!clip) return { fps: 30, frames: 0 };
  const intervals = [];
  for (const track of clip.tracks) {
    const times = track.times;
    for (let index = 1; index < Math.min(times.length, 12); index++) {
      const interval = times[index] - times[index - 1];
      if (interval > 0.001 && interval < 0.2) intervals.push(interval);
    }
    if (intervals.length > 100) break;
  }
  intervals.sort((a, b) => a - b);
  const measured = intervals.length ? Math.round(1 / intervals[Math.floor(intervals.length / 2)]) : 30;
  const fps = measured >= 12 && measured <= 120 ? measured : 30;
  return { fps, frames: Math.max(1, Math.round(clip.duration * fps) + 1) };
}
function playbackSettings(value = {}) {
  return {
    loop: value?.loop !== false,
    startFrame: Math.max(1, Math.floor(Number(value?.startFrame) || 1)),
    endFrame: Number(value?.endFrame) > 0 ? Math.floor(Number(value.endFrame)) : null,
    after: value?.after === 'idle' ? 'idle' : 'hold',
    placement: value?.placement === 'free' ? 'free' : 'bounded',
    feet: value?.feet === 'lock' || value?.feet === 'free' ? value.feet : 'auto'
  };
}
export function boundedMotionOffset(x, z, radius = 0.45) {
  const distance = Math.hypot(x, z);
  if (!Number.isFinite(distance) || distance <= radius) return [0, 0];
  const correction = 1 - radius / distance;
  return [-x * correction, -z * correction];
}
function motionSegment(clip, settings, cache) {
  const { fps, frames } = motionFrameInfo(clip);
  const start = Math.min(settings.startFrame, frames);
  const end = Math.max(start, Math.min(settings.endFrame || frames, frames));
  if (start === 1 && end === frames) return { clip, start, end, fps, frames };
  const key = `${clip.uuid}:${start}:${end}:${fps}`;
  if (cache.has(key)) return { clip: cache.get(key), start, end, fps, frames };
  const startTime = Math.min(clip.duration, (start - 1) / fps);
  const singleFrame = start === end;
  const endTime = singleFrame ? startTime : Math.min(clip.duration, (end - 1) / fps);
  const duration = singleFrame ? 1 / fps : Math.max(1 / fps, endTime - startTime);
  const tracks = clip.tracks.map(track => {
    const size = track.getValueSize();
    const interpolant = track.createInterpolant();
    const times = [0];
    const values = Array.from(interpolant.evaluate(startTime));
    for (let index = 0; index < track.times.length; index++) {
      const time = track.times[index];
      if (singleFrame || time <= startTime + 1e-7 || time >= endTime - 1e-7) continue;
      times.push(time - startTime);
      for (let component = 0; component < size; component++)
        values.push(track.values[index * size + component]);
    }
    times.push(duration);
    values.push(...interpolant.evaluate(endTime));
    const part = track.clone();
    part.times = new track.times.constructor(times);
    part.values = new track.values.constructor(values);
    return part;
  });
  const segment = new THREE.AnimationClip(`${clip.name} ${start}-${end}`, duration, tracks);
  cache.set(key, segment);
  return { clip: segment, start, end, fps, frames };
}
for (const side of ['Left','Right']) {
  for (const finger of ['Thumb','Index','Middle','Ring','Pinky']) {
    for (let index = 1; index <= 3; index++) {
      const suffix = finger === 'Thumb'
        ? ['Metacarpal','Proximal','Distal'][index - 1]
        : ['Proximal','Intermediate','Distal'][index - 1];
      boneNames[`${side}Hand${finger}${index}`] = `${side.toLowerCase()}${finger === 'Pinky' ? 'Little' : finger}${suffix}`;
    }
  }
}

export const assetUrl = asset => asset ? `https://project.galgame/${asset.path.split('/').map(encodeURIComponent).join('/')}${asset.revision ? `?v=${encodeURIComponent(asset.revision)}` : ''}` : '';

// Render a separate, transparent bust portrait without moving the stage actor.
export async function captureVrmPortrait(modelAsset, motionAsset = null, poseFrame = 1, legacySeconds = null) {
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  loader.register(parser => new VRMAnimationLoaderPlugin(parser));
  const gltf = await loader.loadAsync(assetUrl(modelAsset));
  const vrm = gltf.userData.vrm;
  if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('文件里没有找到 VRM 角色'); }
  let renderer;
  let motionScene;
  let actualFrame = 1;
  try {
    const scene = new THREE.Scene();
    scene.add(vrm.scene);
    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.y > 0) vrm.scene.scale.multiplyScalar(1.8 / size.y);
    vrm.scene.updateMatrixWorld(true);
    vrm.scene.position.y -= new THREE.Box3().setFromObject(vrm.scene).min.y;
    vrm.scene.updateMatrixWorld(true);
    if (motionAsset) {
      let clip;
      if (motionAsset.path.toLowerCase().endsWith('.vrma')) {
        const motion = await loader.loadAsync(assetUrl(motionAsset));
        motionScene = motion.scene;
        const animation = motion.userData.vrmAnimations?.[0];
        if (!animation) throw new Error('VRMA 文件里没有动作');
        clip = createVRMAnimationClip(animation, vrm);
      } else {
        motionScene = await new FBXLoader().loadAsync(assetUrl(motionAsset));
        clip = VRMStage.loadMixamo(motionScene, vrm);
      }
      vrm.humanoid.resetNormalizedPose();
      const mixer = new THREE.AnimationMixer(vrm.scene);
      mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
      const { fps, frames } = motionFrameInfo(clip);
      const requestedFrame = legacySeconds === null ? poseFrame : Math.round(legacySeconds * fps) + 1;
      actualFrame = Math.max(1, Math.min(frames, Math.floor(Number(requestedFrame) || 1)));
      mixer.setTime(Math.max(0, Math.min(clip.duration - 0.00001, (actualFrame - 1) / fps)));
    } else {
      const leftArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (leftArm) leftArm.rotation.z = -1.05;
      if (rightArm) rightArm.rotation.z = 1.05;
    }
    vrm.update(0);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    const target = head?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, 1.55, 0);
    const camera = new THREE.OrthographicCamera(-0.20, 0.20, 0.20, -0.20, 0.01, 20);
    camera.position.set(target.x - 0.85, target.y + 0.05, target.z + 1.7);
    camera.lookAt(target.x, target.y + 0.03, target.z);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8497b0, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2, 4, 5);
    scene.add(key);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(512, 512, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    return { dataUrl: renderer.domElement.toDataURL('image/png'), frame: actualFrame };
  } finally {
    renderer?.dispose();
    if (motionScene) VRMUtils.deepDispose(motionScene);
    VRMUtils.deepDispose(gltf.scene);
  }
}

export class VRMStage {
  constructor(element, onError = () => {}) {
    this.element = element;
    this.element.style.visibility = 'hidden';
    this.onError = onError;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 1.3, 4.3);
    this.camera.lookAt(0, 1.05, 0);
    this.ambientLight = new THREE.HemisphereLight(0xffffff, 0x7181a2, 2.0);
    this.scene.add(this.ambientLight);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.keyLight.position.set(-2, 4, 5);
    this.scene.add(this.keyLight);
    this.shadowLight = new THREE.DirectionalLight(0xffffff, 0.0001);
    this.shadowLight.position.set(0, 5, -4);
    this.shadowLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.shadowLight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 20 });
    this.shadowLight.shadow.camera.updateProjectionMatrix();
    this.shadowLight.shadow.bias = -0.0005;
    this.shadowLight.shadow.normalBias = 0.02;
    this.shadowLight.shadow.radius = 3;
    this.scene.add(this.shadowLight, this.shadowLight.target);
    const shadowGround = new THREE.PlaneGeometry(18, 18, 72, 72);
    shadowGround.rotateX(-Math.PI / 2);
    this.shadowPlane = new THREE.Mesh(shadowGround,
      new THREE.ShadowMaterial({ color: 0x101820, opacity: 0.45, depthWrite: false }));
    this.shadowGroundPoints = [];
    this.shadowGroundKey = '';
    this.shadowPlane.frustumCulled = false;
    this.shadowPlane.receiveShadow = true;
    this.shadowPlane.renderOrder = -1;
    this.shadowPlane.visible = false;
    this.scene.add(this.shadowPlane);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.aaMode = 'standard';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.outlineEffect = new OutlineEffect(this.renderer);
    this.originalMaterialSettings = new WeakMap();
    this.paintComposer = null;
    this.paintPass = null;
    this.paintPixelRatio = 1;
    this.paintBackgroundAsset = null;
    this.paintBackgroundVideo = null;
    this.paintBackgroundTexture = null;
    this.paintBackgroundRequest = 0;
    this.paintEnabled = false;
    this.renderSettings = { antialias: 'standard', style: 'original', outline: 0, autoLight: true, lightStrength: 0.6,
      shadowEnabled: false, shadowAngle: 0, shadowOpacity: 0.45, shadowHeight: 0,
      paintEffect: 'none', paintStrength: 0.65 };
    this.setRenderSettings(this.renderSettings);
    this.element.appendChild(this.renderer.domElement);
    this.loader = new GLTFLoader();
    this.loader.register(parser => new VRMLoaderPlugin(parser));
    this.loader.register(parser => new VRMAnimationLoaderPlugin(parser));
    this.fbxLoader = new FBXLoader();
    this.clock = new THREE.Clock();
    this.averageFrameMs = 0;
    this.vrm = null;
    this.mixer = null;
    this.activeRecord = null;
    this.visibleRecords = new Map();
    this.backgroundProfiles = new Map();
    this.currentModelId = null;
    this.currentMotionId = undefined;
    this.requestNumber = 0;
    this.cacheGeneration = 0;
    this.modelCache = new Map();
    this.motionCache = new Map();
    this.clipCache = new Map();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);
    this.resize();
    this.running = true;
    this.animate();
  }
  resize() {
    const { width, height } = this.element.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.paintComposer) {
      this.paintComposer.setPixelRatio(this.paintPixelRatio);
      this.paintComposer.setSize(width, height);
      this.paintPass.uniforms.resolution.value.set(
        Math.max(1, Math.round(width * this.paintPixelRatio)),
        Math.max(1, Math.round(height * this.paintPixelRatio)));
    }
    this.updatePaintBackgroundCrop();
  }
  setCameraAngle(degrees = 0) {
    const angle = THREE.MathUtils.degToRad(Math.max(0, Math.min(65, Number(degrees) || 0)));
    this.camera.position.set(0, 1.3 + Math.sin(angle) * 4.3, Math.cos(angle) * 4.3);
    this.camera.lookAt(0, 1.05, 0);
    this.camera.updateProjectionMatrix();
  }
  setPortraitCamera() {
    this.camera.position.set(0, 1.7, 1.9);
    this.camera.lookAt(0, 1.7, 0);
    this.camera.updateProjectionMatrix();
  }
  setMotionPoseFrame(frame = 1) {
    const record = this.activeRecord;
    if (!record?.currentAction) return;
    const clip = record.currentAction.getClip();
    const { fps, frames } = motionFrameInfo(clip);
    const selected = Math.max(1, Math.min(frames, Math.floor(Number(frame) || 1)));
    record.mixer.setTime(Math.max(0, Math.min(clip.duration - 0.00001, (selected - 1) / fps)));
    record.mixer.timeScale = 0;
    this.applyMotionPlacement(record);
    record.vrm.update(0);
  }
  animate() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.averageFrameMs = this.averageFrameMs ? this.averageFrameMs * 0.94 + delta * 1000 * 0.06 : delta * 1000;
    const updated = new Set();
    for (const record of this.visibleRecords.values()) {
      if (updated.has(record)) continue;
      updated.add(record);
      this.restoreFootPose(record);
      record.mixer.update(delta);
      this.updateTransitions(record, delta);
      this.applyMotionPlacement(record);
      this.applyFootLock(record);
      record.vrm.update(delta);
    }
    this.updateShadowGround();
    if (this.paintEnabled && this.paintComposer) this.paintComposer.render(delta);
    else if (this.outlineEffect.enabled) this.outlineEffect.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.clear();
    this.shadowPlane.geometry.dispose();
    this.shadowPlane.material.dispose();
    this.releasePaintBackground();
    this.paintComposer?.dispose();
    this.renderer.dispose();
  }
  loadModel(modelAsset, actorKey = modelAsset?.id) {
    if (!modelAsset) return Promise.resolve(null);
    const existing = this.modelCache.get(actorKey);
    if (existing) return existing;
    const generation = this.cacheGeneration;
    const task = this.loader.loadAsync(assetUrl(modelAsset)).then(gltf => {
      if (generation !== this.cacheGeneration) {
        VRMUtils.deepDispose(gltf.scene);
        return null;
      }
      const vrm = gltf.userData.vrm;
      if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('文件里没有找到 VRM 角色'); }
      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      VRMUtils.removeUnnecessaryJoints(vrm.scene);
      vrm.scene.traverse(object => { object.frustumCulled = false; });
      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      if (size.y > 0) vrm.scene.scale.multiplyScalar(1.8 / size.y);
      vrm.scene.updateMatrixWorld(true);
      const fittedBounds = new THREE.Box3().setFromObject(vrm.scene);
      vrm.scene.position.y -= fittedBounds.min.y;
      vrm.scene.visible = false;
      const anchor = new THREE.Object3D();
      anchor.name = 'CharacterAnchor';
      const motionRoot = new THREE.Object3D();
      motionRoot.name = 'MotionRoot';
      this.scene.add(anchor);
      anchor.add(motionRoot);
      motionRoot.add(vrm.scene);
      anchor.updateMatrixWorld(true);
      const hips = vrm.humanoid.getNormalizedBoneNode('hips');
      const referenceHips = hips
        ? motionRoot.worldToLocal(hips.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3();
      const materials = new Map();
      vrm.scene.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material?.color && !materials.has(material)) materials.set(material, material.color.clone());
        }
      });
      this.applyMaterialStyle(vrm.scene);
      this.applyOutline(vrm.scene);
      this.applyShadowCasting(vrm.scene);
      const idleClip = this.createIdleClip(vrm);
      const record = {
        vrm, anchor, motionRoot, referenceHips, mixer: new THREE.AnimationMixer(vrm.scene),
        fitScale: vrm.scene.scale.clone(), fitPosition: vrm.scene.position.clone(), materials,
        currentMotionId: undefined, idleClip, currentAction: null, fadeOutActions: [], footLock: null,
        segmentClips: new Map(), currentMotionToken: '', currentMotionOptions: null
      };
      record.mixer.addEventListener('finished', event => this.onMotionFinished(record, event.action));
      return record;
    }).catch(error => {
      if (this.modelCache.get(actorKey) === task) this.modelCache.delete(actorKey);
      throw error;
    });
    this.modelCache.set(actorKey, task);
    return task;
  }
  loadMotionSource(motionAsset) {
    if (!motionAsset) return Promise.resolve(null);
    const existing = this.motionCache.get(motionAsset.id);
    if (existing) return existing;
    const generation = this.cacheGeneration;
    const task = (motionAsset.path.toLowerCase().endsWith('.vrma')
      ? this.loader.loadAsync(assetUrl(motionAsset)).then(gltf => {
          const animation = gltf.userData.vrmAnimations?.[0];
          if (!animation) throw new Error('VRMA 文件里没有动作');
          return { kind: 'vrma', animation, scene: gltf.scene };
        })
      : this.fbxLoader.loadAsync(assetUrl(motionAsset)).then(fbx => ({ kind: 'fbx', fbx }))
    ).then(source => {
      if (generation !== this.cacheGeneration) {
        VRMUtils.deepDispose(source.scene || source.fbx);
        return null;
      }
      return source;
    }).catch(error => {
      if (this.motionCache.get(motionAsset.id) === task) this.motionCache.delete(motionAsset.id);
      throw error;
    });
    this.motionCache.set(motionAsset.id, task);
    return task;
  }
  prepareClip(modelAsset, motionAsset, actorKey = modelAsset?.id) {
    if (!modelAsset || !motionAsset) return Promise.resolve(null);
    const key = `${actorKey}:${motionAsset.id}`;
    const existing = this.clipCache.get(key);
    if (existing) return existing;
    const generation = this.cacheGeneration;
    const task = Promise.all([this.loadModel(modelAsset, actorKey), this.loadMotionSource(motionAsset)]).then(([record, source]) => {
      if (generation !== this.cacheGeneration || !record || !source) return null;
      return source.kind === 'vrma'
        ? createVRMAnimationClip(source.animation, record.vrm)
        : VRMStage.loadMixamo(source.fbx, record.vrm);
    }).catch(error => {
      if (this.clipCache.get(key) === task) this.clipCache.delete(key);
      throw error;
    });
    this.clipCache.set(key, task);
    return task;
  }
  async prepareAct(entries) {
    this.clear();
    const models = new Map();
    const motions = new Map();
    for (const { modelAsset, motionAsset, actorKey } of entries) {
      if (modelAsset) models.set(actorKey || modelAsset.id, modelAsset);
      if (motionAsset) motions.set(motionAsset.id, motionAsset);
    }
    const report = result => {
      if (result.status === 'rejected') this.onError(result.reason?.message || String(result.reason));
    };
    (await Promise.allSettled([...models].map(([key, item]) => this.loadModel(item, key)))).forEach(report);
    (await Promise.allSettled([...motions.values()].map(item => this.loadMotionSource(item)))).forEach(report);
    const pairs = new Map();
    for (const { modelAsset, motionAsset, actorKey } of entries)
      if (modelAsset && motionAsset) pairs.set(`${actorKey || modelAsset.id}:${motionAsset.id}`, { modelAsset, motionAsset, actorKey: actorKey || modelAsset.id });
    (await Promise.allSettled([...pairs.values()].map(pair => this.prepareClip(pair.modelAsset, pair.motionAsset, pair.actorKey)))).forEach(report);
  }
  async show(modelAsset, motionAsset, expressionWeights = {}, position = 'center', transform = {}, actorKey = modelAsset?.id,
    motionOptions = {}, playbackKey = '') {
    const request = ++this.requestNumber;
    try {
      const record = await this.loadModel(modelAsset, actorKey);
      const clip = motionAsset ? await this.prepareClip(modelAsset, motionAsset, actorKey) : null;
      if (request !== this.requestNumber) return;
      for (const visible of this.visibleRecords.values())
        if (visible !== record) visible.vrm.scene.visible = false;
      this.visibleRecords.clear();
      this.activeRecord = record;
      this.vrm = record?.vrm || null;
      this.mixer = record?.mixer || null;
      const modelId = modelAsset?.id ?? null;
      const motionId = motionAsset?.id ?? null;
      if (record) {
        record.returnMotionAsset = null;
        record.returnMotionClip = null;
        this.poseRecord(record, clip, motionAsset, false, motionOptions, playbackKey);
        this.transformRecord(record, position, transform);
        this.applyMotionPlacement(record);
        this.expressRecord(record, expressionWeights);
        this.dimRecord(record, 1);
        record.vrm.update(0);
        record.vrm.scene.visible = true;
        this.visibleRecords.set(actorKey, record);
      }
      this.element.style.visibility = record ? 'visible' : 'hidden';
      this.currentModelId = modelId;
      this.currentMotionId = motionId;
    } catch (error) {
      if (request === this.requestNumber) {
        for (const visible of this.visibleRecords.values()) visible.vrm.scene.visible = false;
        this.visibleRecords.clear();
        this.activeRecord = null;
        this.vrm = null;
        this.mixer = null;
        this.currentModelId = null;
        this.onError(error.message || String(error));
      }
    }
  }
  async showCast(entries, speaker, smooth = false) {
    const request = ++this.requestNumber;
    try {
      const loaded = await Promise.all(entries.map(async entry => ({
        ...entry,
        record: await this.loadModel(entry.modelAsset, entry.actorKey),
        baseClip: entry.motionAsset ? await this.prepareClip(entry.modelAsset, entry.motionAsset, entry.actorKey) : null,
        clip: (entry.actorKey === speaker?.actorKey ? speaker.motionAsset : entry.motionAsset)
          ? await this.prepareClip(entry.modelAsset,
            entry.actorKey === speaker?.actorKey ? speaker.motionAsset : entry.motionAsset, entry.actorKey) : null
      })));
      if (request !== this.requestNumber) return;
      const next = new Map();
      for (const entry of loaded) if (entry.record) next.set(entry.actorKey, entry.record);
      for (const [key, record] of this.visibleRecords)
        if (!next.has(key)) record.vrm.scene.visible = false;
      this.visibleRecords = next;
      const speakingRecord = next.get(speaker?.actorKey);
      for (const entry of loaded) {
        const record = entry.record;
        if (!record) continue;
        const speaking = entry.actorKey === speaker?.actorKey;
        record.returnMotionAsset = entry.motionAsset || null;
        record.returnMotionClip = entry.baseClip || null;
        this.poseRecord(record, entry.clip, speaking ? speaker.motionAsset : entry.motionAsset, smooth,
          speaking ? speaker.motionOptions : entry.motionOptions,
          speaking ? speaker.playbackKey : entry.playbackKey);
        if (speaking) {
          this.expressRecord(record, speaker.expressionWeights || {}, smooth);
        } else this.expressRecord(record, entry.expressionWeights || {}, smooth);
        this.transformRecord(record, entry.position, speaking ? speaker.transform : entry.transform, smooth);
        this.applyMotionPlacement(record);
        this.dimRecord(record, speakingRecord ? (speaking ? 1 : 0.65) : 1);
        record.vrm.update(0);
        record.vrm.scene.visible = true;
      }
      this.element.style.visibility = next.size ? 'visible' : 'hidden';
      this.activeRecord = speakingRecord || null;
      this.vrm = speakingRecord?.vrm || null;
      this.mixer = speakingRecord?.mixer || null;
      this.currentModelId = speaker?.modelAsset?.id || null;
      this.currentMotionId = speaker?.motionAsset?.id || null;
    } catch (error) {
      if (request === this.requestNumber) this.onError(error.message || String(error));
    }
  }
  createIdleClip(vrm) {
    vrm.humanoid.resetNormalizedPose();
    const leftArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    if (leftArm) leftArm.rotation.z = -1.05;
    if (rightArm) rightArm.rotation.z = 1.05;
    const tracks = [];
    for (const [name, bone] of Object.entries(vrm.humanoid.normalizedHumanBones)) {
      const node = bone?.node;
      if (!node) continue;
      const quaternion = node.quaternion.toArray();
      tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, [0, 1], [...quaternion, ...quaternion]));
      if (name === 'hips') {
        const position = node.position.toArray();
        tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.position`, [0, 1], [...position, ...position]));
      }
    }
    return new THREE.AnimationClip('Standing idle', 1, tracks);
  }
  poseRecord(record, clip, motionAsset, smooth = false, options = {}, playbackKey = '') {
    const motionId = motionAsset?.id ?? null;
    const settings = playbackSettings(options);
    const source = clip || record.idleClip;
    const segment = motionAsset ? motionSegment(source, settings, record.segmentClips) : { clip: source };
    const token = JSON.stringify([motionId, settings.loop, segment.start, segment.end, settings.after, settings.placement, settings.feet,
      settings.loop ? '' : playbackKey]);
    if (record.currentMotionToken === token && record.vrm.scene.visible) return;
    record.mixer.timeScale = 1;
    const previousLock = record.footLock;
    this.restoreFootPose(record);
    const lockFeet = settings.feet === 'lock' || (settings.feet === 'auto' && isPlantedMotion(motionAsset));
    record.footLock = lockFeet ? previousLock || {
      left: this.footChain(record.vrm, 'left'), right: this.footChain(record.vrm, 'right'), prePose: null
    } : null;
    if (record.footLock) record.footLock.preserveDuringFade = Boolean(previousLock);
    const nextAction = record.mixer.clipAction(segment.clip);
    const previous = record.currentAction;
    nextAction.setLoop(settings.loop ? THREE.LoopRepeat : THREE.LoopOnce, settings.loop ? Infinity : 1);
    nextAction.clampWhenFinished = !settings.loop;
    nextAction.enabled = true;
    if (smooth && record.vrm.scene.visible && previous && previous !== nextAction) {
      nextAction.reset().play();
      nextAction.crossFadeFrom(previous, 0.3, false);
      record.fadeOutActions.push({ action: previous, remaining: 0.34 });
    } else {
      record.mixer.stopAllAction();
      record.vrm.humanoid.resetNormalizedPose();
      nextAction.reset().play();
      record.mixer.update(0);
      record.fadeOutActions.length = 0;
    }
    record.currentAction = nextAction;
    record.currentMotionId = motionId;
    record.currentMotionToken = token;
    record.currentMotionOptions = settings;
  }
  applyMotionPlacement(record) {
    const root = record.motionRoot;
    if (record.currentMotionOptions?.placement === 'free') {
      root.position.set(0, 0, 0);
      return;
    }
    const hips = record.vrm.humanoid.getNormalizedBoneNode('hips');
    if (!hips) return;
    record.anchor.updateMatrixWorld(true);
    const local = root.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
    const [x, z] = boundedMotionOffset(local.x - record.referenceHips.x,
      local.z - record.referenceHips.z);
    root.position.set(x, 0, z);
    root.updateMatrixWorld(true);
  }
  onMotionFinished(record, action) {
    if (action !== record.currentAction || record.currentMotionOptions?.loop) return;
    if (record.currentMotionOptions.after === 'idle' && record.vrm.scene.visible)
      this.poseRecord(record, record.returnMotionClip, record.returnMotionAsset, true,
        { loop: true }, 'finished-base-motion');
  }
  footChain(vrm, side) {
    const upper = vrm.humanoid.getNormalizedBoneNode(`${side}UpperLeg`);
    const lower = vrm.humanoid.getNormalizedBoneNode(`${side}LowerLeg`);
    const foot = vrm.humanoid.getNormalizedBoneNode(`${side}Foot`);
    return upper && lower && foot ? { upper, lower, foot, anchor: null, rotation: null } : null;
  }
  restoreFootPose(record) {
    const lock = record.footLock;
    if (!lock?.prePose) return;
    for (const { bone, quaternion, position } of lock.prePose) {
      bone.quaternion.copy(quaternion);
      if (position) bone.position.copy(position);
    }
    lock.prePose = null;
  }
  rotateBoneToward(bone, from, to) {
    if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
    const parentRotation = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const worldRotation = bone.getWorldQuaternion(new THREE.Quaternion());
    const correction = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
    bone.quaternion.copy(parentRotation.invert().multiply(correction.multiply(worldRotation)));
  }
  applyFootLock(record) {
    const lock = record.footLock;
    if (!lock) return;
    if (record.transformBlend || (record.fadeOutActions.length && !lock.preserveDuringFade)) {
      for (const chain of [lock.left, lock.right]) if (chain) chain.anchor = null;
      return;
    }
    const root = record.vrm.scene;
    root.updateMatrixWorld(true);
    lock.prePose = [];
    for (const chain of [lock.left, lock.right]) {
      if (!chain) continue;
      const { upper, lower, foot } = chain;
      const hip = upper.getWorldPosition(new THREE.Vector3());
      const knee = lower.getWorldPosition(new THREE.Vector3());
      const ankle = foot.getWorldPosition(new THREE.Vector3());
      if (!chain.anchor) {
        chain.anchor = ankle.clone();
        chain.rotation = foot.getWorldQuaternion(new THREE.Quaternion());
      }
      lock.prePose.push(
        { bone: upper, quaternion: upper.quaternion.clone() },
        { bone: lower, quaternion: lower.quaternion.clone() },
        { bone: foot, quaternion: foot.quaternion.clone(), position: foot.position.clone() }
      );
      const thigh = hip.distanceTo(knee);
      const shin = knee.distanceTo(ankle);
      const reach = chain.anchor.clone().sub(hip);
      const distance = reach.length();
      if (thigh > 1e-5 && shin > 1e-5 && distance > 1e-5) {
        const direction = reach.multiplyScalar(1 / distance);
        const along = (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
        const kneeAlong = THREE.MathUtils.clamp(along, -thigh, thigh);
        const bendHeight = Math.sqrt(Math.max(0, thigh * thigh - kneeAlong * kneeAlong));
        const bend = knee.clone().sub(hip).addScaledVector(direction, -knee.clone().sub(hip).dot(direction));
        if (bend.lengthSq() < 1e-8) {
          bend.set(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
          bend.addScaledVector(direction, -bend.dot(direction));
        }
        bend.normalize();
        const targetKnee = hip.clone().addScaledVector(direction, kneeAlong).addScaledVector(bend, bendHeight);
        this.rotateBoneToward(upper, knee.clone().sub(hip), targetKnee.sub(hip));
        upper.updateMatrixWorld(true);
        const movedKnee = lower.getWorldPosition(new THREE.Vector3());
        const movedAnkle = foot.getWorldPosition(new THREE.Vector3());
        this.rotateBoneToward(lower, movedAnkle.sub(movedKnee), chain.anchor.clone().sub(movedKnee));
        lower.updateMatrixWorld(true);
      }
      const parentRotation = foot.parent.getWorldQuaternion(new THREE.Quaternion());
      foot.quaternion.copy(parentRotation.invert().multiply(chain.rotation));
      chain.lastResidual = foot.getWorldPosition(new THREE.Vector3()).distanceTo(chain.anchor);
      foot.position.copy(chain.anchor.clone().applyMatrix4(foot.parent.matrixWorld.clone().invert()));
      foot.updateMatrixWorld(true);
    }
  }
  transformRecord(record, position = 'center', transform = {}, smooth = false) {
    const size = Math.max(0.5, Math.min(5, Number(transform?.size) || 1.15));
    const offsetX = Number(transform?.offsetX) || 0;
    const offsetY = Number(transform?.offsetY) || 0;
    const offsetZ = Math.max(-2, Math.min(1.5, Number(transform?.offsetZ) || 0));
    const yaw = Math.max(-120, Math.min(120, Number(transform?.yaw) || 0));
    const pitch = Math.max(-60, Math.min(60, Number(transform?.pitch) || 0));
    const multiple = this.visibleRecords.size > 1;
    const baseX = position === 'left' ? (multiple ? -1.22 : -0.7) : position === 'right' ? (multiple ? 1.22 : 0.7) : 0;
    const targetScale = new THREE.Vector3(size, size, size);
    const targetPosition = new THREE.Vector3(baseX + offsetX, offsetY, offsetZ);
    const targetYaw = THREE.MathUtils.degToRad(yaw);
    const targetPitch = THREE.MathUtils.degToRad(pitch);
    const oldTarget = record.transformTarget;
    if (smooth && record.vrm.scene.visible &&
      (!oldTarget || !oldTarget.position.equals(targetPosition) || !oldTarget.scale.equals(targetScale) || oldTarget.yaw !== targetYaw || oldTarget.pitch !== targetPitch)) {
      record.transformBlend = { elapsed: 0, duration: 0.3,
        fromPosition: record.anchor.position.clone(), fromScale: record.anchor.scale.clone(), fromYaw: record.anchor.rotation.y, fromPitch: record.anchor.rotation.x,
        toPosition: targetPosition, toScale: targetScale, toYaw: targetYaw, toPitch: targetPitch };
    } else if (!smooth || !record.vrm.scene.visible) {
      record.transformBlend = null;
      record.anchor.position.copy(targetPosition);
      record.anchor.scale.copy(targetScale);
      record.anchor.rotation.y = targetYaw;
      record.anchor.rotation.x = targetPitch;
    }
    record.transformTarget = { position: targetPosition, scale: targetScale, yaw: targetYaw, pitch: targetPitch };
    if (record.footLock && (!oldTarget || !oldTarget.position.equals(targetPosition) || !oldTarget.scale.equals(targetScale) || oldTarget.yaw !== targetYaw || oldTarget.pitch !== targetPitch))
      for (const chain of [record.footLock.left, record.footLock.right]) if (chain) chain.anchor = null;
  }
  expressRecord(record, weights = {}, smooth = false) {
    const manager = record?.vrm.expressionManager;
    if (!manager) return;
    const target = Object.fromEntries(manager.expressions.map(expression => {
      const name = expression.expressionName;
      return [name, Math.max(0, Math.min(1, Number(weights?.[name]) || 0))];
    }));
    const changed = !record.expressionTarget || Object.keys(target).some(name => target[name] !== record.expressionTarget[name]);
    if (smooth && record.vrm.scene.visible && changed) {
      record.expressionBlend = { elapsed: 0, duration: 0.3,
        from: Object.fromEntries(Object.keys(target).map(name => [name, manager.getValue(name) || 0])), target };
    } else if (!smooth || !record.vrm.scene.visible) {
      record.expressionBlend = null;
      manager.resetValues();
      for (const [name, value] of Object.entries(target)) if (value > 0) manager.setValue(name, value);
      record.vrm.update(0);
    }
    record.expressionTarget = target;
  }
  updateTransitions(record, delta) {
    if (record.expressionBlend) {
      const blend = record.expressionBlend;
      blend.elapsed += delta;
      const t = Math.min(1, blend.elapsed / blend.duration);
      const eased = t * t * (3 - 2 * t);
      for (const name of Object.keys(blend.target))
        record.vrm.expressionManager.setValue(name, THREE.MathUtils.lerp(blend.from[name], blend.target[name], eased));
      if (t >= 1) record.expressionBlend = null;
    }
    if (record.transformBlend) {
      const blend = record.transformBlend;
      blend.elapsed += delta;
      const t = Math.min(1, blend.elapsed / blend.duration);
      const eased = t * t * (3 - 2 * t);
      record.anchor.position.copy(blend.fromPosition).lerp(blend.toPosition, eased);
      record.anchor.scale.copy(blend.fromScale).lerp(blend.toScale, eased);
      record.anchor.rotation.y = THREE.MathUtils.lerp(blend.fromYaw, blend.toYaw, eased);
      record.anchor.rotation.x = THREE.MathUtils.lerp(blend.fromPitch, blend.toPitch, eased);
      if (t >= 1) record.transformBlend = null;
    }
    record.fadeOutActions = record.fadeOutActions.filter(item => {
      item.remaining -= delta;
      if (item.remaining > 0) return true;
      if (item.action !== record.currentAction) item.action.stop();
      return false;
    });
  }
  dimRecord(record, brightness) {
    for (const [material, original] of record.materials) material.color.copy(original).multiplyScalar(brightness);
  }
  setTransform(position = 'center', transform = {}) {
    if (this.activeRecord) this.transformRecord(this.activeRecord, position, transform);
  }
  setExpressions(weights = {}) {
    this.expressRecord(this.activeRecord, weights);
  }
  expressions() {
    return this.vrm?.expressionManager?.expressions?.map(expression => expression.expressionName) ?? [];
  }
  setRenderSettings(settings = {}) {
    this.renderSettings = { ...this.renderSettings, ...settings };
    const quality = this.renderSettings.antialias;
    if (this.renderer.aaMode !== quality) {
      const previous = this.renderer;
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: quality !== 'off' });
      this.renderer.aaMode = quality;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.element.replaceChild(this.renderer.domElement, previous.domElement);
      this.paintComposer?.dispose();
      this.paintComposer = null;
      this.paintPass = null;
      previous.dispose();
      this.outlineEffect = new OutlineEffect(this.renderer);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(quality === 'off' ? 1 : quality === 'high' ? Math.min(3, dpr * 1.5) : dpr);
    const style = this.renderSettings.style;
    this.renderer.toneMapping = style === 'cinematic' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = style === 'cinematic' ? 1.18 : 1;
    this.outlineEffect.enabled = Number(this.renderSettings.outline) > 0;
    this.applyPaintSettings();
    this.applyShadowSettings();
    for (const task of this.modelCache?.values() || []) task.then(record => {
      if (record) { this.applyMaterialStyle(record.vrm.scene); this.applyOutline(record.vrm.scene); this.applyShadowCasting(record.vrm.scene); }
    }).catch(() => {});
    this.applyLighting(this.currentLightProfile);
    this.resize();
  }
  applyPaintSettings() {
    const enabled = this.renderSettings.paintEffect === 'oil' && Number(this.renderSettings.paintStrength) > 0;
    if (enabled && !this.paintComposer) {
      const { composer, paintPass } = createOilPaintComposer(this);
      this.paintComposer = composer;
      this.paintPass = paintPass;
      this.paintPixelRatio = Math.min(this.renderer.getPixelRatio(), 1.5) * 0.7;
    }
    if (this.paintPass)
      this.paintPass.uniforms.strength.value = Math.max(0, Math.min(1, Number(this.renderSettings.paintStrength) || 0));
    if (enabled !== this.paintEnabled) {
      this.paintEnabled = enabled;
      if (enabled) this.setPaintBackground(this.paintBackgroundAsset, this.paintBackgroundVideo);
      else this.releasePaintBackground();
    }
    if (!enabled && this.paintComposer) {
      this.paintComposer.dispose();
      this.paintComposer = null;
      this.paintPass = null;
    }
  }
  releasePaintBackground() {
    this.paintBackgroundRequest++;
    this.scene.background = null;
    this.paintBackgroundTexture?.dispose();
    this.paintBackgroundTexture = null;
  }
  setPaintBackground(backgroundAsset, video = null) {
    this.paintBackgroundAsset = backgroundAsset || null;
    this.paintBackgroundVideo = video;
    this.releasePaintBackground();
    if (!this.paintEnabled || !backgroundAsset) return;
    const request = this.paintBackgroundRequest;
    if (backgroundAsset.type === 'video' && video) {
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.paintBackgroundTexture = texture;
      const activate = () => {
        if (request !== this.paintBackgroundRequest || video.readyState < 2) return;
        this.scene.background = texture;
        this.updatePaintBackgroundCrop();
      };
      video.addEventListener('loadeddata', activate, { once: true });
      video.addEventListener('loadedmetadata', () => {
        if (request === this.paintBackgroundRequest) this.updatePaintBackgroundCrop();
      }, { once: true });
      activate();
    } else if (backgroundAsset.type === 'image') {
      new THREE.TextureLoader().loadAsync(assetUrl(backgroundAsset)).then(texture => {
        if (request !== this.paintBackgroundRequest) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        this.paintBackgroundTexture = texture;
        this.scene.background = texture;
        this.updatePaintBackgroundCrop();
      }).catch(() => {});
    }
  }
  updatePaintBackgroundCrop() {
    const texture = this.paintBackgroundTexture;
    const image = texture?.image;
    const width = image?.videoWidth || image?.width;
    const height = image?.videoHeight || image?.height;
    const bounds = this.element.getBoundingClientRect();
    if (!width || !height || !bounds.width || !bounds.height) return;
    const aspect = (width / height) / (bounds.width / bounds.height);
    texture.offset.set(aspect > 1 ? (1 - 1 / aspect) / 2 : 0,
      aspect > 1 ? 0 : (1 - aspect) / 2);
    texture.repeat.set(aspect > 1 ? 1 / aspect : 1, aspect > 1 ? 1 : aspect);
  }
  applyShadowSettings() {
    const enabled = this.renderSettings.shadowEnabled === true && Number(this.renderSettings.shadowOpacity) > 0;
    this.renderer.shadowMap.enabled = enabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.shadowLight.castShadow = enabled;
    this.shadowPlane.visible = enabled;
    this.element.closest('.stage-frame')?.classList.toggle('shadows-on', enabled);
    this.shadowPlane.material.opacity = Math.max(0, Math.min(1, Number(this.renderSettings.shadowOpacity) || 0));
    const angle = THREE.MathUtils.degToRad(Number(this.renderSettings.shadowAngle) || 0);
    this.shadowLight.position.set(-Math.sin(angle) * 4, 5, -Math.cos(angle) * 4);
    this.shadowLight.target.position.set(0, 0, 0);
    this.shadowLight.target.updateMatrixWorld();
  }
  shadowGroundHeightAt(x, z) {
    if (!this.shadowGroundPoints.length) return -0.02 + (Number(this.renderSettings.shadowHeight) || 0);
    let weightedHeight = 0;
    let totalWeight = 0;
    for (const point of this.shadowGroundPoints) {
      const distanceSquared = (x - point.x) ** 2 + (z - point.z) ** 2;
      if (distanceSquared < 0.000001) return point.y;
      const weight = 1 / (distanceSquared ** 2);
      weightedHeight += point.y * weight;
      totalWeight += weight;
    }
    return weightedHeight / totalWeight;
  }
  updateShadowGround() {
    if (!this.shadowPlane.visible) return;
    const heightOffset = Math.max(-0.4, Math.min(0.4, Number(this.renderSettings.shadowHeight) || 0));
    const points = [...this.visibleRecords.values()]
      .filter(record => record.vrm.scene.visible)
      .map(record => ({ x: record.anchor.position.x, z: record.anchor.position.z,
        y: record.anchor.position.y - 0.02 + heightOffset }));
    const key = points.map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`).join(';');
    if (key === this.shadowGroundKey) return;
    this.shadowGroundKey = key;
    this.shadowGroundPoints = points;
    const positions = this.shadowPlane.geometry.attributes.position;
    for (let index = 0; index < positions.count; index++)
      positions.setY(index, this.shadowGroundHeightAt(positions.getX(index), positions.getZ(index)));
    positions.needsUpdate = true;
  }
  applyShadowCasting(scene) {
    const enabled = this.renderSettings.shadowEnabled === true && Number(this.renderSettings.shadowOpacity) > 0;
    scene.traverse(object => { if (object.isMesh) object.castShadow = enabled; });
  }
  applyMaterialStyle(scene) {
    const anime = this.renderSettings.style === 'anime';
    const visited = new Set();
    scene.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material || visited.has(material)) continue;
        visited.add(material);
        let original = this.originalMaterialSettings.get(material);
        if (!original) {
          original = material.isMToonMaterial ? {
            toony: material.shadingToonyFactor,
            shift: material.shadingShiftFactor,
            rim: material.parametricRimColorFactor.clone(),
            matcap: material.matcapFactor.clone()
          } : material.isMeshStandardMaterial ? {
            metalness: material.metalness, roughness: material.roughness
          } : {};
          this.originalMaterialSettings.set(material, original);
        }
        if (material.isMToonMaterial) {
          material.shadingToonyFactor = anime ? Math.max(original.toony, 0.96) : original.toony;
          material.shadingShiftFactor = anime ? Math.max(-0.18, original.shift - 0.07) : original.shift;
          material.parametricRimColorFactor.copy(original.rim).multiplyScalar(anime ? 0.55 : 1);
          material.matcapFactor.copy(original.matcap).multiplyScalar(anime ? 0.65 : 1);
        } else if (material.isMeshStandardMaterial) {
          material.metalness = anime ? 0 : original.metalness;
          material.roughness = anime ? Math.max(0.9, original.roughness) : original.roughness;
        }
      }
    });
  }
  applyOutline(scene) {
    const width = Math.max(0, Math.min(4, Number(this.renderSettings.outline) || 0));
    scene.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        material.userData.outlineParameters = { thickness: width * 0.0015, color: [0.08, 0.06, 0.11], visible: width > 0 && !material.isOutline };
      }
    });
  }
  async setBackgroundLighting(backgroundAsset) {
    const token = backgroundAsset?.id || '';
    this.currentBackgroundId = token;
    if (!backgroundAsset || backgroundAsset.type !== 'image' || !this.renderSettings.autoLight) {
      this.currentLightProfile = null;
      this.applyLighting(null);
      return;
    }
    let task = this.backgroundProfiles.get(token);
    if (!task) {
      task = this.analyzeBackground(backgroundAsset).catch(() => null);
      this.backgroundProfiles.set(token, task);
    }
    const profile = await task;
    if (this.currentBackgroundId !== token) return;
    this.currentLightProfile = profile;
    this.applyLighting(profile);
  }
  async analyzeBackground(backgroundAsset) {
    const response = await fetch(assetUrl(backgroundAsset));
    if (!response.ok) throw new Error(`背景读取失败：${response.status}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 36;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, 64, 36);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, 64, 36).data;
    const samples = [];
    let sum = [0, 0, 0], count = 0;
    for (let y = 2; y < 32; y += 2) for (let x = 2; x < 62; x += 2) {
      const i = (y * 64 + x) * 4;
      if (pixels[i + 3] < 128) continue;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      samples.push({ x, y, r, g, b, brightness });
      sum[0] += r; sum[1] += g; sum[2] += b; count++;
    }
    if (!count) return null;
    samples.sort((a, b) => b.brightness - a.brightness);
    const bright = samples.slice(0, Math.max(1, Math.round(samples.length * 0.15)));
    let bx = 0, by = 0, br = 0, bg = 0, bb = 0, weight = 0;
    for (const sample of bright) {
      const w = Math.max(1, sample.brightness);
      bx += sample.x * w; by += sample.y * w;
      br += sample.r * w; bg += sample.g * w; bb += sample.b * w; weight += w;
    }
    return { average: sum.map(value => value / count / 255),
      bright: [br / weight / 255, bg / weight / 255, bb / weight / 255],
      x: bx / weight / 64, y: by / weight / 36 };
  }
  applyLighting(profile) {
    const style = this.renderSettings?.style || 'original';
    const soft = style === 'soft';
    const strength = this.renderSettings?.autoLight ? Math.max(0, Math.min(1, Number(this.renderSettings.lightStrength) || 0)) : 0;
    const ambient = new THREE.Color(0xffffff);
    const key = new THREE.Color(0xffffff);
    if (profile && strength > 0) {
      const avg = new THREE.Color(...profile.average).lerp(new THREE.Color(0xffffff), 0.35);
      const lit = new THREE.Color(...profile.bright).lerp(new THREE.Color(0xffffff), 0.25);
      ambient.lerp(avg, strength);
      key.lerp(lit, strength);
    }
    this.ambientLight.color.copy(ambient);
    this.ambientLight.intensity = style === 'anime' ? 0.9 : soft ? 2.4 : style === 'cinematic' ? 1.45 : 2.0;
    this.keyLight.color.copy(key);
    this.keyLight.intensity = style === 'anime' ? 2.5 : soft ? 1.5 : style === 'cinematic' ? 2.6 : 2.2;
    const x = profile && strength > 0 ? (profile.x - 0.5) * 6 : -2;
    const y = profile && strength > 0 ? 2 + (1 - profile.y) * 3 : 4;
    this.keyLight.position.set(x, y, 5);
  }
  clear() {
    this.requestNumber++;
    this.element.style.visibility = 'hidden';
    this.cacheGeneration++;
    this.activeRecord?.mixer.stopAllAction();
    for (const record of this.visibleRecords.values()) record.mixer.stopAllAction();
    this.visibleRecords.clear();
    for (const task of this.modelCache.values()) task.then(record => {
      if (record) {
        this.scene.remove(record.anchor);
        VRMUtils.deepDispose(record.vrm.scene);
      }
    }).catch(() => {});
    for (const task of this.motionCache.values()) task.then(source => {
      if (source) VRMUtils.deepDispose(source.scene || source.fbx);
    }).catch(() => {});
    this.modelCache.clear();
    this.motionCache.clear();
    this.clipCache.clear();
    this.activeRecord = null;
    this.vrm = null;
    this.mixer = null;
    this.currentModelId = null;
    this.currentMotionId = undefined;
  }
  static loadMixamo(asset, vrm) {
    const clip = asset.animations[0];
    if (!clip) throw new Error('FBX 文件里没有动作');
    asset.updateMatrixWorld(true);
    const hips = asset.getObjectByName('mixamorigHips') || asset.getObjectByName('mixamorig:Hips');
    if (!hips) throw new Error('不是标准 Mixamo 骨骼。请导入从 Mixamo 直接下载的 FBX 动作。');
    const modelHips = vrm.humanoid.normalizedRestPose.hips.position[1];
    const scale = Math.abs(hips.position.y) > 0.001 ? modelHips / hips.position.y : 1;
    const tracks = [];
    const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
    const sourceTracks = new Map(clip.tracks.map(track => [track.name, track]));
    const sourceAncestors = [];
    for (let parent = hips.parent; parent && parent !== asset; parent = parent.parent)
      sourceAncestors.unshift(parent);
    const movingNodes = [...sourceAncestors, hips].map(object => ({
      object,
      rotation: sourceTracks.get(`${object.name}.quaternion`),
      position: sourceTracks.get(`${object.name}.position`)
    }));
    const sample = (track, time, fallback) => track
      ? track.createInterpolant().evaluate(time) : fallback;
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      if (dot < 0) continue;
      const sourceName = track.name.slice(0, dot).replace(/^mixamorig:?/, '');
      const bone = boneNames[sourceName];
      const node = bone && vrm.humanoid.getNormalizedBoneNode(bone);
      const source = asset.getObjectByName(track.name.slice(0, dot));
      if (!node || !source) continue;
      const property = track.name.slice(dot + 1);
      if (bone === 'hips') continue;
      if (track instanceof THREE.QuaternionKeyframeTrack) {
        const inverse = source.getWorldQuaternion(new THREE.Quaternion()).invert();
        const parentRotation = source.parent.getWorldQuaternion(new THREE.Quaternion());
        const values = Array.from(track.values);
        for (let i = 0; i < values.length; i += 4) {
          const quaternion = new THREE.Quaternion().fromArray(values, i);
          quaternion.premultiply(parentRotation).multiply(inverse);
          quaternion.toArray(values, i);
        }
        if (vrm.meta?.metaVersion === '0')
          for (let i = 0; i < values.length; i++) if (i % 2 === 0) values[i] *= -1;
        tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.${property}`, track.times, values));
      }
    }
    if (hipsNode) {
      const keyTimes = [...new Set([0, clip.duration, ...movingNodes.flatMap(({ rotation, position }) =>
        [...(rotation?.times || []), ...(position?.times || [])])])].sort((a, b) => a - b);
      const sourceRestInverse = hips.getWorldQuaternion(new THREE.Quaternion()).invert();
      const rootRotation = asset.getWorldQuaternion(new THREE.Quaternion());
      const restPosition = vrm.humanoid.normalizedRestPose.hips.position;
      const quaternionValues = [];
      const positionValues = [];
      for (const time of keyTimes) {
        const worldRotation = rootRotation.clone();
        const movement = new THREE.Vector3();
        for (const { object, rotation, position } of movingNodes) {
          worldRotation.multiply(new THREE.Quaternion().fromArray(sample(rotation, time, object.quaternion.toArray())));
          if (position) {
            const current = sample(position, time, object.position.toArray());
            const start = sample(position, 0, object.position.toArray());
            movement.add(new THREE.Vector3(current[0] - start[0], current[1] - start[1], current[2] - start[2]));
          }
        }
        const targetRotation = worldRotation.multiply(sourceRestInverse);
        const q = targetRotation.toArray();
        const p = [restPosition[0] + movement.x * scale,
          restPosition[1] + movement.y * scale, restPosition[2] + movement.z * scale];
        if (vrm.meta?.metaVersion === '0') {
          q[0] *= -1; q[2] *= -1;
          p[0] *= -1; p[2] *= -1;
        }
        quaternionValues.push(...q);
        positionValues.push(...p);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${hipsNode.name}.quaternion`, keyTimes, quaternionValues));
      tracks.push(new THREE.VectorKeyframeTrack(`${hipsNode.name}.position`, keyTimes, positionValues));
    }
    if (!tracks.length) throw new Error('没有找到可用于此 VRM 的 Mixamo 骨骼动作');
    return new THREE.AnimationClip(clip.name || 'Mixamo', clip.duration, tracks);
  }
}
