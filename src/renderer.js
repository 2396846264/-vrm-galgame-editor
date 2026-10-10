import {BindingView} from './binding-view.js';
import {motionPlayback,motionFeetLocked,loopMotionClip,rootTravel,updateMotionRoot,motionFinishTarget} from './character-motion.js';
import {CharacterProps} from './character-props.js';
import {dialogueSlotPosition} from './dialogue-cast.js';
import {FrameRateMeter} from './frame-rate.js';
﻿import * as THREE from 'three';
import {fitEnvironmentShadow,environmentShadowBounds} from './environment-shadows.js';
import {EnvironmentRuntime} from './environment-runtime.js';
import {CharacterSceneLighting,environmentAmbient} from './character-scene-lighting.js';
import {LivePortrait} from './live-portrait.js';
import {capturePortraitBodyFrame} from './portrait-body-frame.js';
import {loadMmdActor,loadVmdMotion,createVmdMotion} from './mmd-loader.js';
import {setShoulderPortraitCamera} from './portrait-camera.js';
import {createFbxActor, retargetFbxClip} from './fbx-character.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {CompatibleFBXLoader as FBXLoader} from './fbx-loader.js';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import {StylizedPipeline} from './stylized-render.js';
import {normalizeGraphics,graphicsPlan,graphicsLimits,shadowMapSize} from './player-graphics.js';
import {normalizeRender,effectiveStyle} from './render-style.js';
import {applyStylizedMaterials} from './stylized-materials.js';

import { WeatherStage, normalizeWeather, weatherMood } from './weather.js';
import { createTalkingMouth } from './talking-mouth.js';

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
  return motionPlayback(value);
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
export async function captureCharacterPortrait(modelAsset, motionAsset = null, poseFrame = 1, legacySeconds = null, fileThumbnail = false) {
  if(!['vrm','fbxCharacter','mmdCharacter'].includes(modelAsset?.type))throw Error('自动头像需要人物模型');
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  loader.register(parser => new VRMAnimationLoaderPlugin(parser));
  const fbxBlobs=new Set(),fbxManager=new THREE.LoadingManager();
  fbxManager.addHandler(/\.tga$/i,new TGALoader());
  fbxManager.setURLModifier(url=>{if(url.startsWith('blob:'))fbxBlobs.add(url);return url;});
  let texturesReady=new Promise(resolve=>fbxManager.onLoad=resolve),gltf,vrm;
  let renderer;
  let motionScene;
  let mixer;
  let actualFrame = 1;
  try {
    if(modelAsset.type==='fbxCharacter'){
      const root=await new FBXLoader(fbxManager).loadAsync(assetUrl(modelAsset));gltf={scene:root};await texturesReady;vrm=createFbxActor(root);
    }else if(modelAsset.type==='mmdCharacter'){vrm=await loadMmdActor(modelAsset,assetUrl,{physics:false});gltf={scene:vrm.scene};}
    else{gltf=await loader.loadAsync(assetUrl(modelAsset));vrm=gltf.userData.vrm;}
    if(!vrm)throw Error('文件里没有找到人物模型');
    const scene = new THREE.Scene();
    scene.add(vrm.scene);
    if(vrm.isFbx){mixer=new THREE.AnimationMixer(vrm.scene);mixer.clipAction(vrm.idleClip).play();mixer.update(0);}
    const bounds = new THREE.Box3().setFromObject(vrm.scene,vrm.isFbx===true);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.y > 0) vrm.scene.scale.multiplyScalar(1.8 / size.y);
    vrm.scene.updateMatrixWorld(true);
    vrm.scene.position.y -= new THREE.Box3().setFromObject(vrm.scene,vrm.isFbx===true).min.y;
    vrm.scene.updateMatrixWorld(true);
    if (motionAsset) {
      let clip;
      if (motionAsset.path.toLowerCase().endsWith('.vrma')) {
        if(vrm.isFbx)throw Error('FBX 人物头像请选 Mixamo FBX 动作或保持站立');
        const motion = await loader.loadAsync(assetUrl(motionAsset));
        motionScene = motion.scene;
        const animation = motion.userData.vrmAnimations?.[0];
        if (!animation) throw new Error('VRMA 文件里没有动作');
        clip = createVRMAnimationClip(animation, vrm);
      } else {
        motionScene = await new FBXLoader().loadAsync(assetUrl(motionAsset));
        clip = vrm.isFbx?retargetFbxClip(motionScene,vrm):VRMStage.loadMixamo(motionScene, vrm);
      }
      vrm.humanoid.resetNormalizedPose();
      mixer?.stopAllAction();mixer?.uncacheRoot(vrm.scene);mixer = new THREE.AnimationMixer(vrm.scene);
      mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
      const { fps, frames } = motionFrameInfo(clip);
      const requestedFrame = legacySeconds === null ? poseFrame : Math.round(legacySeconds * fps) + 1;
      actualFrame = Math.max(1, Math.min(frames, Math.floor(Number(requestedFrame) || 1)));
      mixer.setTime(Math.max(0, Math.min(clip.duration - 0.00001, (actualFrame - 1) / fps)));
    } else if(!vrm.isFbx) {
      const leftArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (leftArm) leftArm.rotation.z = -1.05;
      if (rightArm) rightArm.rotation.z = 1.05;
    }
    vrm.update(0);
    vrm.scene.updateMatrixWorld(true);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    const target = head?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, 1.55, 0);
    const camera = new THREE.OrthographicCamera(-0.20, 0.20, 0.20, -0.20, 0.01, 20);
    setShoulderPortraitCamera(camera,target);
    if(fileThumbnail){const top=new THREE.Box3().setFromObject(vrm.scene,true).max.y;camera.top=Math.min(.55,Math.max(.25,top-target.y+.07));camera.bottom=-.24;const width=(camera.top-camera.bottom)/2;camera.left=-width;camera.right=width;camera.updateProjectionMatrix();}
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8497b0, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2, 4, 5);
    scene.add(key);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(512, 512, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    return { dataUrl: renderer.domElement.toDataURL('image/png'), frame: actualFrame,framing:{cameraOffset:camera.position.clone().sub(target).toArray(),halfHeight:camera.top,size:512},staticImage:true };
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();mixer?.stopAllAction();if(vrm)mixer?.uncacheRoot(vrm.scene);
    if (motionScene) VRMUtils.deepDispose(motionScene);
    vrm?.dispose?.();if(gltf)VRMUtils.deepDispose(gltf.scene);
    for(const url of fbxBlobs)URL.revokeObjectURL(url);
  }
}
export const captureVrmPortrait=captureCharacterPortrait;

export class VRMStage {
  constructor(element, onError = () => {}) {
    this.element = element;
    this.element.style.visibility = 'hidden';
    this.onError = onError;
    this.scene = new THREE.Scene();
    this.environmentRuntime = new EnvironmentRuntime(this.scene);
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
    this.graphicsSettings=normalizeGraphics();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.originalMaterialSettings = new WeakMap();
    this.characterSceneLighting=new CharacterSceneLighting();
    this.livePortrait=new LivePortrait();
    this.stylePipeline=null;
    this.renderSettings=normalizeRender();
    this.setRenderSettings(this.renderSettings);
    this.element.appendChild(this.renderer.domElement);
    this.bindingView=new BindingView(this.camera,this.renderer.domElement);
    this.loader = new GLTFLoader();
    this.loader.register(parser => new VRMLoaderPlugin(parser));
    this.loader.register(parser => new VRMAnimationLoaderPlugin(parser));
    const fbxManager=new THREE.LoadingManager(),fbxBlobs=new Set();
    fbxManager.setURLModifier(url=>{if(url.startsWith('blob:'))fbxBlobs.add(url);return url;});
    fbxManager.onLoad=()=>{for(const url of fbxBlobs)URL.revokeObjectURL(url);fbxBlobs.clear();};
    fbxManager.addHandler(/\.tga$/i,new TGALoader());
    this.fbxLoader = new FBXLoader(fbxManager);
    this.clock = new THREE.Clock();
    this.averageFrameMs = 0;
    this.frameRateMeter=new FrameRateMeter();
    this.vrm = null;
    this.mixer = null;
    this.activeRecord = null;
    this.visibleRecords = new Map();
    this.characterProps = new CharacterProps(assetUrl);
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
    const limits=graphicsLimits(this.renderer),ratio=Math.min(window.devicePixelRatio||1,2,limits.maxDimension/width,limits.maxDimension/height,Math.sqrt(limits.maxPixels/(width*height)));
    this.renderer.setPixelRatio(ratio);
    if(!graphicsPlan(this.graphicsSettings,width*ratio,height*ratio,limits).supported){this.graphicsSettings=normalizeGraphics({...this.graphicsSettings,aa:'fxaa',upscale:'off',renderScale:100});this.onGraphicsFallback?.(this.graphicsSettings);}
    this.renderer.setSize(width, height, false);
    this.stylePipeline?.resize(width,height);
  }
  async setEnvironment(environment,assets=[]) {
    const request=this.environmentRequest=(this.environmentRequest||0)+1;
    await this.environmentRuntime.load(environment,assets);
    if(request!==this.environmentRequest)return;
    this.environmentSettings=environment;
    if(this.environmentRuntime.root)this.applyMaterialStyle(this.environmentRuntime.root);
    this.applyLighting(this.currentLightProfile);
    for(const task of this.modelCache.values())Promise.resolve(task).then(record=>{if(record)this.applyMaterialStyle(record.vrm.scene);}).catch(()=>{});
    this.environmentShadowBounds=environment?environmentShadowBounds(this.environmentRuntime.root):null;this.environmentShadowKey='';
    this.applyShadowSettings();for(const task of this.modelCache.values()){Promise.resolve(task).then(record=>{if(record)this.applyShadowCasting(record.vrm.scene);}).catch(()=>{});}
    this.scene.background=environment?new THREE.Color(environment.background):null;
    if(environment){this.camera.far=300;this.camera.position.fromArray(environment.camera.position);this.camera.lookAt(...environment.camera.target);this.camera.fov=environment.camera.fov;this.camera.updateProjectionMatrix();this.keyLight.color.set(environment.lighting.color);this.keyLight.intensity=environment.lighting.intensity;}
    this.element.style.visibility=this.environmentRuntime.root||this.visibleRecords.size||this.weather?.active?'visible':'hidden';
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
    record.vrm.beforeAnimation?.();record.vrm.resetPhysics?.();
    record.mixer.setTime(Math.max(0, Math.min(clip.duration - 0.00001, (selected - 1) / fps)));
    record.mixer.timeScale = 0;
    this.applyMotionPlacement(record);
    record.vrm.update(0);
  }
  animate() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.animate());
    if(this.renderSuspended||window.__editorModulePreviewActive===false){this.clock.getDelta();return;}
    const elapsed=this.clock.getDelta();
    this.frameRateMeter.sample(elapsed,document.hidden);
    const delta = Math.min(elapsed, 0.1);
    this.averageFrameMs = this.averageFrameMs ? this.averageFrameMs * 0.94 + delta * 1000 * 0.06 : delta * 1000;
    const updated = new Set();
    this.camera.updateMatrixWorld();const physicsFrustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));
    for (const record of [...this.visibleRecords.values(),this.livePortrait.record]) {
      if(!record)continue;
      if (updated.has(record)) continue;
      updated.add(record);
      if(record.vrm.isMmd){const center=record.vrm.humanoid.getNormalizedBoneNode('hips')?.getWorldPosition(new THREE.Vector3())||record.anchor.getWorldPosition(new THREE.Vector3());record.vrm.setPhysicsActive(record===this.livePortrait.record||physicsFrustum.intersectsSphere(new THREE.Sphere(center,1.4*Math.abs(record.anchor.scale.y))));}
      record.talkingMouth?.restore();
      record.vrm.beforeAnimation?.();
      this.restoreFootPose(record);
      record.mixer.update(delta);
      this.updateTransitions(record, delta);
      record.talkingMouth?.update(delta);
      this.applyMotionPlacement(record);
      this.applyFootLock(record);
      this.weather?.applyWind(record);
      record.vrm.update(delta);
      this.applyRawFootLock(record);
      if(this.environmentSettings)this.characterSceneLighting.apply(record.vrm.scene,true);
      this.characterProps.update(record);
    }
    this.environmentRuntime.update(this.camera,delta,Boolean(this.sceneAnimationsPaused?.()));this.updateShadowGround();
    this.weather?.update(delta);
    if(this.stylePipeline)this.stylePipeline.render(delta);else this.renderer.render(this.scene,this.camera);
    this.livePortrait.render(this.renderer,this.scene,this.element);
  }
  destroy() {
    this.bindingView.dispose();
    this.running = false;
    this.weather?.dispose();
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.clear();
    this.environmentRuntime.clear();
    this.livePortrait.dispose();
    this.shadowPlane.geometry.dispose();
    this.shadowPlane.material.dispose();
    this.stylePipeline?.dispose();
    this.renderer.dispose();
  }
  loadModel(modelAsset, actorKey = modelAsset?.id) {
    if (!modelAsset) return Promise.resolve(null);
    const existing = this.modelCache.get(actorKey);
    if (existing?.modelAssetId === modelAsset.id) return existing;
    if (existing) existing.then(record => {
      if (!record) return;
      record.propToken=(record.propToken||0)+1;
      for(const p of record.attachedProps?.values()||[])p.root.removeFromParent();
      record.mixer.stopAllAction();record.anchor.removeFromParent();record.vrm.dispose?.();VRMUtils.deepDispose(record.vrm.scene);
      if(this.visibleRecords.get(actorKey)===record)this.visibleRecords.delete(actorKey);
    }).catch(()=>{});
    const generation = this.cacheGeneration;
    const task = (modelAsset.type==='mmdCharacter'?loadMmdActor(modelAsset,assetUrl).then(vrm=>({scene:vrm.scene,userData:{vrm}})):modelAsset.type === 'fbxCharacter' ? this.fbxLoader.loadAsync(assetUrl(modelAsset)).then(fbx => ({scene:fbx,userData:{vrm:createFbxActor(fbx)}})) : this.loader.loadAsync(assetUrl(modelAsset))).then(async gltf => {
      if (generation !== this.cacheGeneration) {
        gltf.userData.vrm?.dispose?.();
        VRMUtils.deepDispose(gltf.scene);
        return null;
      }
      const vrm = gltf.userData.vrm;
      if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('文件里没有找到 VRM 角色'); }
      if (!vrm.isFbx&&!vrm.isMmd) { VRMUtils.removeUnnecessaryVertices(vrm.scene); VRMUtils.removeUnnecessaryJoints(vrm.scene); }
      // FBX bind pose and its first animation frame can have different root heights.
      // Fit the visible initial pose, while keeping the original rig rest data for retargeting.
      if (vrm.isFbx) {
        const fitMixer = new THREE.AnimationMixer(vrm.scene);
        fitMixer.clipAction(vrm.idleClip).play();
        fitMixer.update(0);
        const pose = new Map();
        for (const bone of vrm.bones.values()) pose.set(bone, {
          position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone()
        });
        fitMixer.stopAllAction();
        fitMixer.uncacheRoot(vrm.scene);
        for (const [bone, value] of pose) {
          bone.position.copy(value.position); bone.quaternion.copy(value.quaternion); bone.scale.copy(value.scale);
        }
        vrm.scene.updateMatrixWorld(true);
      }
      vrm.scene.traverse(object => { object.frustumCulled = false; });
      const bounds = new THREE.Box3().setFromObject(vrm.scene, vrm.isFbx === true);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      if (size.y > 0) vrm.scene.scale.multiplyScalar(1.8 / size.y);
      vrm.scene.updateMatrixWorld(true);
      const fittedBounds = new THREE.Box3().setFromObject(vrm.scene, vrm.isFbx === true);
      vrm.scene.position.y -= fittedBounds.min.y;
      vrm.scene.visible = false;
      const anchor = new THREE.Object3D();
      anchor.name = 'CharacterAnchor';
      anchor.userData.nprCharacter=true;
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
      this.characterSceneLighting.capture(vrm.scene);
      this.applyMaterialStyle(vrm.scene);
      this.applyOutline(vrm.scene);
      this.applyShadowCasting(vrm.scene);
      const idleClip = vrm.isFbx ? vrm.idleClip : this.createIdleClip(vrm);
      vrm.setPhysicsEnabled?.(this.graphicsSettings.mmdPhysics!=='off');
      vrm.setPhysicsQuality?.(this.graphicsSettings.mmdPhysics);
      if(vrm.isMmd){vrm.update(0);await vrm.preparePhysics(()=>generation===this.cacheGeneration);if(generation!==this.cacheGeneration){anchor.removeFromParent();vrm.dispose();VRMUtils.deepDispose(vrm.scene);return null;}}
      const record = {
        vrm, anchor, motionRoot, referenceHips, mixer: new THREE.AnimationMixer(vrm.scene),
        portraitRestHeadQuaternion: vrm.humanoid.getNormalizedBoneNode('head')?.getWorldQuaternion(new THREE.Quaternion()),
        portraitBodyReference: capturePortraitBodyFrame(vrm,anchor),
        fitScale: vrm.scene.scale.clone(), fitPosition: vrm.scene.position.clone(), materials,
        currentMotionId: undefined, idleClip, currentAction: null, fadeOutActions: [], footLock: null,
        segmentClips: new Map(), currentMotionToken: '', currentMotionOptions: null
      };
      record.finishedHandler=event=>this.onMotionFinished(record,event.action);
      record.mixer.addEventListener('finished',record.finishedHandler);
      record.loopHandler=event=>{if(event.action===record.currentAction)record.motionLoops=(record.motionLoops||0)+event.loopDelta;};
      record.mixer.addEventListener('loop',record.loopHandler);
      return record;
    }).catch(error => {
      if (this.modelCache.get(actorKey) === task) this.modelCache.delete(actorKey);
      throw error;
    });
    task.modelAssetId=modelAsset.id;
    this.modelCache.set(actorKey, task);
    return task;
  }
  loadMotionSource(motionAsset) {
    if (!motionAsset) return Promise.resolve(null);
    const existing = this.motionCache.get(motionAsset.id);
    if (existing) return existing;
    const generation = this.cacheGeneration;
    const task = (motionAsset.path.toLowerCase().endsWith('.vmd')?loadVmdMotion(motionAsset,assetUrl).then(vmd=>({vmd,kind:'vmd'})):motionAsset.path.toLowerCase().endsWith('.vrma')
      ? this.loader.loadAsync(assetUrl(motionAsset)).then(gltf => {
          const animation = gltf.userData.vrmAnimations?.[0];
          if (!animation) throw new Error('VRMA 文件里没有动作');
          return { kind: 'vrma', animation, scene: gltf.scene };
        })
      : this.fbxLoader.loadAsync(assetUrl(motionAsset)).then(fbx => ({ kind: 'fbx', fbx }))
    ).then(source => {
      if (generation !== this.cacheGeneration) {
        if(source.scene||source.fbx)VRMUtils.deepDispose(source.scene || source.fbx);
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
    const key = `${actorKey}:${modelAsset.id}:${motionAsset.id}`;
    const existing = this.clipCache.get(key);
    if (existing) return existing;
    const generation = this.cacheGeneration;
    const task = Promise.all([this.loadModel(modelAsset, actorKey), this.loadMotionSource(motionAsset)]).then(([record, source]) => {
      if (generation !== this.cacheGeneration || !record || !source) return null;
      if(source.kind==='vmd'){if(!record.vrm.isMmd)throw Error('VMD 动作请用于 MMD 人物。');return createVmdMotion(source.vmd,record.vrm);}
      if(record.vrm.isFbx) { if(source.kind !== 'fbx') throw new Error('FBX 人物请使用 Mixamo FBX 动作'); return retargetFbxClip(source.fbx,record.vrm); }
      return source.kind === 'vrma'
        ? createVRMAnimationClip(source.animation, record.vrm.normalizedRig||record.vrm)
        : VRMStage.loadMixamo(source.fbx, record.vrm.normalizedRig||record.vrm);
    }).catch(error => {
      if (this.clipCache.get(key) === task) this.clipCache.delete(key);
      throw error;
    });
    this.clipCache.set(key, task);
    return task;
  }
  async warmPreparedGraphics(bundle,gate){
    const renderer=this.renderer,visible=new Map(),props=[],culling=new Map();
    if(bundle.environment.root)bundle.stage.applyMaterialStyle(bundle.environment.root);
    try{
      for(const task of bundle.stage.modelCache.values()){const record=await task;if(record){visible.set(record.vrm.scene,record.vrm.scene.visible);record.vrm.scene.visible=true;for(const attached of record.attachedProps?.values()||[]){visible.set(attached.root,attached.root.visible);attached.root.visible=true;}}}
      for(const task of bundle.stage.characterProps.cache.values()){const root=await task;if(root){props.push(root);bundle.stage.scene.add(root);}}
      const textures=new Set();bundle.stage.scene.traverse(object=>{if(object.isMesh){culling.set(object,object.frustumCulled);object.frustumCulled=false;}for(const material of(Array.isArray(object.material)?object.material:[object.material]))if(material)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);});
      for(const texture of textures){await gate();if(renderer!==this.renderer)return;renderer.initTexture(texture);}
      await gate();if(renderer===this.renderer){
        await renderer.compileAsync(bundle.stage.scene,bundle.camera);
        await gate();if(renderer!==this.renderer||!this.running)return;
        const target=new THREE.WebGLRenderTarget(1,1),previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),test=renderer.getScissorTest(),auto=renderer.autoClear,shadow=renderer.shadowMap.autoUpdate;
        try{renderer.setRenderTarget(target);renderer.setViewport(0,0,1,1);renderer.setScissorTest(false);renderer.autoClear=true;renderer.shadowMap.autoUpdate=false;renderer.render(bundle.stage.scene,bundle.camera);}finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.autoClear=auto;renderer.shadowMap.autoUpdate=shadow;target.dispose();}
      }
    }finally{for(const [object,value]of visible)object.visible=value;for(const [object,value]of culling)object.frustumCulled=value;for(const root of props)root.removeFromParent();}
  }
  async prepareAct(entries) {
    this.residentActId='';
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
    const bindings=new Map();for(const entry of entries)if(entry.modelAsset){const key=entry.actorKey||entry.modelAsset.id;if(!bindings.has(key))bindings.set(key,entry);}
    for(const [key,entry]of bindings){const record=await this.loadModel(entry.modelAsset,key);if(record)await this.characterProps.sync(record,entry.props||[],[],entry.assets||[],()=>true);}
  }
  async show(modelAsset, motionAsset, expressionWeights = {}, position = 'center', transform = {}, actorKey = modelAsset?.id,
    motionOptions = {}, playbackKey = '', propSettings = {}) {
    this.stopTalking();
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
        await this.characterProps.sync(record,propSettings.bindings||[],propSettings.visibleIds||[],propSettings.assets||[],()=>request===this.requestNumber);
      }
      this.element.style.visibility = record || this.environmentRuntime.root || this.weather?.active ? 'visible' : 'hidden';
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
    this.stopTalking();
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
        record.returnMotionAsset = entry.returnToIdle ? null : entry.motionAsset || null;
        record.returnMotionClip = entry.returnToIdle ? null : entry.baseClip || null;
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
        await this.characterProps.sync(record,entry.props||[],entry.visiblePropIds||[],entry.assets||[],()=>request===this.requestNumber);
        if(request!==this.requestNumber)return;
      }
      this.element.style.visibility = next.size || this.environmentRuntime.root || this.weather?.active ? 'visible' : 'hidden';
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
    const rigKind=motionAsset?.path?.toLowerCase().endsWith('.vmd')?'vmd':'humanoid';
    if(record.vrm.isMmd&&record.mmdMotionKind!==rigKind){this.restoreFootPose(record);record.mixer.stopAllAction();record.currentAction=null;record.footLock=null;record.currentMotionToken='';record.fadeOutActions.length=0;record.mmdMotionKind=rigKind;}
    record.vrm.setMotionKind?.(rigKind);
    const motionId = motionAsset?.id ?? null;
    const settings = playbackSettings(options);
    const source = clip || record.idleClip;
    const segment = motionAsset ? motionSegment(source, settings, record.segmentClips) : { clip: source };
    const hips=record.vrm.humanoid.getNormalizedBoneNode('hips');
    if(settings.loop)segment.clip=loopMotionClip(segment.clip,hips,record.segmentClips);
    const token = JSON.stringify([motionId, settings.loop, segment.start, segment.end, settings.after, settings.placement, settings.feet,
      settings.loop ? '' : playbackKey]);
    if (record.currentMotionToken === token && record.vrm.scene.visible) return;
    record.vrm.resetPhysics?.();
    record.mixer.timeScale = 1;
    const previousLock = record.footLock;
    this.restoreFootPose(record);
    const lockFeet = motionFeetLocked(settings,motionAsset || (record.vrm.isFbx?{name:source.name}:record.returnMotionAsset));
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
    record.motionLoops=0;record.rootLoopTravel=rootTravel(segment.clip,hips);record.motionCarry=record.nextFinishTarget?new THREE.Vector3(record.nextFinishTarget.x-record.referenceHips.x,0,record.nextFinishTarget.z-record.referenceHips.z):new THREE.Vector3();record.finishWorldTarget=record.nextFinishTarget;record.nextFinishTarget=null;record.motionRoot.position.copy(record.motionCarry);
    record.anchor.updateMatrixWorld(true);record.motionOrigin=hips?record.motionRoot.worldToLocal(hips.getWorldPosition(new THREE.Vector3())):record.referenceHips.clone();
  }
  applyMotionPlacement(record) {
    updateMotionRoot(record);
  }
  onMotionFinished(record, action) {
    if (action !== record.currentAction || record.currentMotionOptions?.loop) return;
    if (record.currentMotionOptions.after === 'idle' && record.vrm.scene.visible){
      record.nextFinishTarget=motionFinishTarget(record);
      this.poseRecord(record, record.returnMotionClip, record.returnMotionAsset, true,
        { loop: true,feet:record.currentMotionOptions.feet }, 'finished-base-motion');
    }
  }
  async releaseModel(actorKey){
    if(this.visibleRecords.has(actorKey))return false;const task=this.modelCache.get(actorKey);if(!task)return false;this.modelCache.delete(actorKey);
    for(const key of this.clipCache.keys())if(key.startsWith(actorKey+':'))this.clipCache.delete(key);
    const record=await task;if(record){record.propToken=(record.propToken||0)+1;for(const prop of record.attachedProps?.values()||[])prop.root.removeFromParent();record.attachedProps?.clear();record.mixer.stopAllAction();record.mixer.uncacheRoot(record.vrm.scene);record.anchor.removeFromParent();record.vrm.dispose?.();VRMUtils.deepDispose(record.vrm.scene);}return true;
  }
  async releaseMotion(motionId){if([...this.clipCache.keys()].some(k=>k.endsWith(':'+motionId)))return;const task=this.motionCache.get(motionId);if(!task)return;this.motionCache.delete(motionId);const source=await task;if(source&&(source.scene||source.fbx))VRMUtils.deepDispose(source.scene||source.fbx);}
  restartCharacterPreview(){
    for(const record of this.visibleRecords.values()){this.restoreFootPose(record);for(const chain of [record.footLock?.left,record.footLock?.right])if(chain)chain.anchor=null;record.motionLoops=0;record.motionCarry=new THREE.Vector3();record.finishWorldTarget=null;record.currentAction?.reset().play();record.mixer.update(0);this.applyMotionPlacement(record);this.applyFootLock(record);record.vrm.update(0);this.applyRawFootLock(record);}
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
  applyRawFootLock(record) {
    const lock=record.footLock;
    if(!lock?.prePose||record.vrm.isFbx)return;
    record.vrm.scene.updateWorldMatrix(true,true);
    // VRM only transfers the hips position from its normalized rig. Preserve
    // the rendered ankle as well, then restore this correction next frame.
    for(const side of ['left','right']){
      const chain=lock[side],foot=record.vrm.humanoid.getRawBoneNode?.(`${side}Foot`);
      if(!chain?.anchor||!foot||foot===chain.foot)continue;
      if(chain.rawForAnchor!==chain.anchor){chain.rawForAnchor=chain.anchor;chain.rawAnchor=foot.getWorldPosition(new THREE.Vector3());chain.rawRotation=foot.getWorldQuaternion(new THREE.Quaternion());}
      lock.prePose.push({bone:foot,position:foot.position.clone(),quaternion:foot.quaternion.clone()});
      foot.position.copy(foot.parent.worldToLocal(chain.rawAnchor.clone()));
      const parentRotation=foot.parent.getWorldQuaternion(new THREE.Quaternion());
      foot.quaternion.copy(parentRotation.invert().multiply(chain.rawRotation));foot.updateMatrixWorld(true);
      chain.rawLastResidual=foot.getWorldPosition(new THREE.Vector3()).distanceTo(chain.rawAnchor);
    }
  }
  transformRecord(record, position = 'center', transform = {}, smooth = false) {
    const size = Math.max(0.5, Math.min(5, Number(transform?.size) || 1.15));
    const offsetX = Number(transform?.offsetX) || 0;
    const offsetY = Number(transform?.offsetY) || 0;
    const offsetZ = Number(transform?.offsetZ) || 0;
    const yaw = Math.max(-360, Math.min(360, Number(transform?.yaw) || 0));
    const pitch = Math.max(-360, Math.min(360, Number(transform?.pitch) || 0));
    const multiple = this.visibleRecords.size > 1;
    const base = dialogueSlotPosition(position,multiple);
    const targetScale = new THREE.Vector3(size, size, size);
    const targetPosition = new THREE.Vector3(base.x + offsetX, offsetY, base.z + offsetZ);
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
  startTalking(actorKey, enabled = true) {
    this.stopTalking();
    const record = enabled ? this.visibleRecords.get(actorKey)||(this.portraitActorKey===actorKey?this.livePortrait.record:null) : null;
    if (!record || record.vrm.isFbx) return;
    record.talkingMouth ||= createTalkingMouth(record.vrm.expressionManager);
    if (!record.talkingMouth) return;
    this.talkingRecord = record; record.talkingMouth.start();
  }
  talkingLetter(char) { this.talkingRecord?.talkingMouth?.letter(char); }
  clearLivePortrait(){this.portraitRequest=(this.portraitRequest||0)+1;this.portraitActorKey='';this.livePortrait.clear();}
  async setLivePortrait(modelAsset,actorKey,node,weights={}){
    if(!['vrm','mmdCharacter'].includes(modelAsset?.type)){this.clearLivePortrait();return null;}
    const token=this.portraitRequest=(this.portraitRequest||0)+1;
    if(this.portraitActorKey!==actorKey||this.portraitModelId!==modelAsset.id||this.livePortrait.node!==node)this.livePortrait.clear();
    const record=await this.loadModel(modelAsset,actorKey);
    if(token!==this.portraitRequest||!record||record.vrm.isFbx)return null;
    if(!this.visibleRecords.has(actorKey)){
      if(record.currentMotionId===undefined)this.poseRecord(record,null,null,false,{},`portrait:${actorKey}`);
      this.expressRecord(record,weights);record.vrm.update(0);
    }
    this.portraitActorKey=actorKey;this.portraitModelId=modelAsset.id;this.livePortrait.set(record,node);this.element.style.visibility='visible';return record;
  }
  stopTalking() {
    if (this.talkingRecord) {
      this.talkingRecord.talkingMouth?.stop();this.talkingRecord.vrm.beforeAnimation?.(); this.talkingRecord.vrm.update(0);
      this.talkingRecord = null;
    }
  }
  expressions() {
    return this.vrm?.expressionManager?.expressions?.map(expression => expression.expressionName) ?? [];
  }
  setWeather(settings = {}, audio = {}) {
    this.weatherSettings = normalizeWeather(settings);
    if (!this.weather && this.weatherSettings.type !== 'none') this.weather = new WeatherStage(this);
    this.weather?.set(this.weatherSettings, audio);
    this.element.style.visibility = this.visibleRecords?.size || this.environmentRuntime.root || this.weather?.active ? 'visible' : 'hidden';
    this.applyLighting(this.currentLightProfile);
  }
  setRenderSettings(settings = {}) {
    this.renderSettings={...normalizeRender(settings),antialias:'standard',shadowEnabled:true,shadowAngle:0,shadowOpacity:.35,shadowHeight:0};
    this.renderer.toneMapping=THREE.NoToneMapping;this.renderer.toneMappingExposure=1;
    if(!this.stylePipeline)this.stylePipeline=new StylizedPipeline(this);else this.stylePipeline.update(this.renderSettings);
    this.applyShadowSettings();
    for(const task of this.modelCache?.values()||[])task.then(record=>{if(record){this.applyMaterialStyle(record.vrm.scene);this.applyOutline(record.vrm.scene);this.applyShadowCasting(record.vrm.scene);}}).catch(()=>{});
    if(this.environmentRuntime?.root)this.applyMaterialStyle(this.environmentRuntime.root);
    this.applyLighting(null);this.resize();
  }
  setPaintBackground(){}
  graphicsPlan(settings=this.graphicsSettings){const {width,height}=this.element.getBoundingClientRect(),limits=graphicsLimits(this.renderer),ratio=Math.min(window.devicePixelRatio||1,2,limits.maxDimension/Math.max(width,1),limits.maxDimension/Math.max(height,1),Math.sqrt(limits.maxPixels/Math.max(width*height,1)));return graphicsPlan(settings,width*ratio,height*ratio,limits);}
  setGraphicsSettings(settings){const quality=normalizeGraphics(settings),plan=this.graphicsPlan(quality);if(!plan.supported)throw Error(plan.reason);this.graphicsSettings=quality;for(const task of this.modelCache.values())task.then(record=>{record?.vrm.setPhysicsEnabled?.(quality.mmdPhysics!=='off');record?.vrm.setPhysicsQuality?.(quality.mmdPhysics);});this.environmentShadowKey='';this.applyShadowSettings();this.resize();return this.stylePipeline.plan;}
  applyGraphicsShadowQuality(){
    const size=shadowMapSize(this.graphicsSettings.shadows);
    for(const light of [this.keyLight,this.shadowLight]){if(size&&light.shadow.mapSize.x!==size){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.set(size,size);}if(!size)light.castShadow=false;}
    this.environmentRuntime?.root?.traverse(light=>{if(!light.isLight||!light.shadow)return;light.userData.qualityOriginalCastShadow??=light.castShadow;light.castShadow=Boolean(size&&light.userData.qualityOriginalCastShadow);});
    if(!size)this.renderer.shadowMap.enabled=false;
  }
  applyShadowSettings() {
    if(this.environmentSettings){this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.shadowLight.castShadow=false;this.shadowPlane.visible=false;this.keyLight.castShadow=true;this.scene.add(this.keyLight.target);this.element.closest('.stage-frame')?.classList.remove('shadows-on');this.applyGraphicsShadowQuality();this.updateShadowGround();return;}
    this.keyLight.castShadow=false;this.keyLight.target.position.set(0,0,0);this.keyLight.target.updateMatrixWorld();
    const enabled = this.renderSettings.shadowEnabled === true && Number(this.renderSettings.shadowOpacity) > 0&&this.graphicsSettings.shadows!=='off';
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
    this.applyGraphicsShadowQuality();
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
    if(this.environmentSettings){if(this.graphicsSettings.shadows==='off')return;const bounds=this.environmentShadowBounds.clone();for(const record of this.visibleRecords.values()){const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),p=hips?hips.getWorldPosition(new THREE.Vector3()):record.anchor.position,s=record.anchor.scale.x;bounds.expandByPoint(new THREE.Vector3(p.x-s,p.y-1.5*s,p.z-s));bounds.expandByPoint(new THREE.Vector3(p.x+s,p.y+1.5*s,p.z+s));}const key=[...bounds.min.toArray(),...bounds.max.toArray()].map(v=>v.toFixed(2)).join(',');if(key!==this.environmentShadowKey){fitEnvironmentShadow(this.keyLight,bounds,shadowMapSize(this.graphicsSettings.shadows));this.environmentShadowKey=key;}return;}
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
    scene.traverse(object => { if (object.isMesh) {object.castShadow = Boolean(this.environmentSettings)||enabled;object.receiveShadow=Boolean(this.environmentSettings);} });
  }
  applyMaterialStyle(scene) {applyStylizedMaterials(scene,effectiveStyle(this.renderSettings),this.characterSceneLighting,this.originalMaterialSettings);}
  applyOutline(scene){scene.traverse(object=>{for(const material of(Array.isArray(object.material)?object.material:[object.material]))if(material)material.userData.outlineParameters={visible:false};});}
  async setBackgroundLighting(){this.applyLighting(null);}
  applyLighting(){
    const mood=weatherMood(this.weatherSettings);
    if(this.environmentSettings){const env=this.environmentSettings;this.ambientLight.color.set('#ffffff');this.ambientLight.groundColor.set('#7181a2');this.ambientLight.intensity=environmentAmbient(env)*mood.brightness;this.keyLight.color.set(env.lighting.color);this.keyLight.intensity=env.lighting.intensity*mood.brightness;return;}
    this.ambientLight.intensity=1.2*mood.brightness;this.keyLight.color.set('#ffffff');this.keyLight.intensity=2.2*mood.brightness;
  }
  clear() {
    this.stylePipeline?.scenePass.clearMaterials();
    this.stopTalking();
    this.clearLivePortrait();
    this.requestNumber++;
    this.element.style.visibility = this.environmentRuntime.root || this.weather?.active ? 'visible' : 'hidden';
    this.cacheGeneration++;
    this.activeRecord?.mixer.stopAllAction();
    for (const record of this.visibleRecords.values()) record.mixer.stopAllAction();
    this.visibleRecords.clear();
    for (const task of this.modelCache.values()) task.then(record => {
      if (record) {
        this.scene.remove(record.anchor);
        record.vrm.dispose?.();VRMUtils.deepDispose(record.vrm.scene);
      }
    }).catch(() => {});
    for (const task of this.motionCache.values()) task.then(source => {
      if (source) if(source.scene||source.fbx)VRMUtils.deepDispose(source.scene || source.fbx);
    }).catch(() => {});
    this.characterProps.clear();
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
            // Preserve an initial crouch/sit height; only horizontal motion is
            // recentered at the first frame. Root ancestors retain their offset.
            const baseY = object === hips ? object.position.y : start[1];
            movement.add(new THREE.Vector3(current[0] - start[0], current[1] - baseY, current[2] - start[2]));
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

