import * as THREE from 'three';
import { loadMmdActor } from '../mmd-loader.js';
import { setShoulderPortraitCamera } from '../portrait-camera.js';
import { createFbxActor, retargetFbxClip } from '../fbx-character.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CompatibleFBXLoader as FBXLoader } from '../fbx-loader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

export async function captureCharacterPortrait(
  modelAsset,
  motionAsset = null,
  poseFrame = 1,
  legacySeconds = null,
  fileThumbnail = false,
) {
  if (!['vrm', 'fbxCharacter', 'mmdCharacter'].includes(modelAsset?.type))
    throw Error('自动头像需要人物模型');
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  const fbxBlobs = new Set(),
    fbxManager = new THREE.LoadingManager();
  fbxManager.addHandler(/\.tga$/i, new TGALoader());
  fbxManager.setURLModifier((url) => {
    if (url.startsWith('blob:')) fbxBlobs.add(url);
    return url;
  });
  let texturesReady = new Promise((resolve) => (fbxManager.onLoad = resolve)),
    gltf,
    vrm;
  let renderer;
  let motionScene;
  let mixer;
  let actualFrame = 1;
  try {
    if (modelAsset.type === 'fbxCharacter') {
      const root = await new FBXLoader(fbxManager).loadAsync(assetUrl(modelAsset));
      gltf = { scene: root };
      await texturesReady;
      vrm = createFbxActor(root);
    } else if (modelAsset.type === 'mmdCharacter') {
      vrm = await loadMmdActor(modelAsset, assetUrl, { physics: false });
      gltf = { scene: vrm.scene };
    } else {
      gltf = await loader.loadAsync(assetUrl(modelAsset));
      vrm = gltf.userData.vrm;
    }
    if (!vrm) throw Error('文件里没有找到人物模型');
    const scene = new THREE.Scene();
    scene.add(vrm.scene);
    if (vrm.isFbx) {
      mixer = new THREE.AnimationMixer(vrm.scene);
      mixer.clipAction(vrm.idleClip).play();
      mixer.update(0);
    }
    const bounds = new THREE.Box3().setFromObject(vrm.scene, vrm.isFbx === true);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.y > 0) vrm.scene.scale.multiplyScalar(1.8 / size.y);
    vrm.scene.updateMatrixWorld(true);
    vrm.scene.position.y -= new THREE.Box3().setFromObject(vrm.scene, vrm.isFbx === true).min.y;
    vrm.scene.updateMatrixWorld(true);
    if (motionAsset) {
      let clip;
      if (motionAsset.path.toLowerCase().endsWith('.vrma')) {
        if (vrm.isFbx) throw Error('FBX 人物头像请选 Mixamo FBX 动作或保持站立');
        const motion = await loader.loadAsync(assetUrl(motionAsset));
        motionScene = motion.scene;
        const animation = motion.userData.vrmAnimations?.[0];
        if (!animation) throw new Error('VRMA 文件里没有动作');
        clip = createVRMAnimationClip(animation, vrm);
      } else {
        motionScene = await new FBXLoader().loadAsync(assetUrl(motionAsset));
        clip = vrm.isFbx
          ? retargetFbxClip(motionScene, vrm)
          : VRMStage.loadMixamo(motionScene, vrm);
      }
      vrm.humanoid.resetNormalizedPose();
      mixer?.stopAllAction();
      mixer?.uncacheRoot(vrm.scene);
      mixer = new THREE.AnimationMixer(vrm.scene);
      mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
      const { fps, frames } = motionFrameInfo(clip);
      const requestedFrame =
        legacySeconds === null ? poseFrame : Math.round(legacySeconds * fps) + 1;
      actualFrame = Math.max(1, Math.min(frames, Math.floor(Number(requestedFrame) || 1)));
      mixer.setTime(Math.max(0, Math.min(clip.duration - 0.00001, (actualFrame - 1) / fps)));
    } else if (!vrm.isFbx) {
      const leftArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (leftArm) leftArm.rotation.z = -1.05;
      if (rightArm) rightArm.rotation.z = 1.05;
    }
    vrm.update(0);
    vrm.scene.updateMatrixWorld(true);
    const head = vrm.humanoid.getNormalizedBoneNode('head');
    const target = head?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3(0, 1.55, 0);
    const camera = new THREE.OrthographicCamera(-0.2, 0.2, 0.2, -0.2, 0.01, 20);
    setShoulderPortraitCamera(camera, target);
    if (fileThumbnail) {
      const top = new THREE.Box3().setFromObject(vrm.scene, true).max.y;
      camera.top = Math.min(0.55, Math.max(0.25, top - target.y + 0.07));
      camera.bottom = -0.24;
      const width = (camera.top - camera.bottom) / 2;
      camera.left = -width;
      camera.right = width;
      camera.updateProjectionMatrix();
    }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8497b0, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2, 4, 5);
    scene.add(key);
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(512, 512, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    return {
      dataUrl: renderer.domElement.toDataURL('image/png'),
      frame: actualFrame,
      framing: {
        cameraOffset: camera.position.clone().sub(target).toArray(),
        halfHeight: camera.top,
        size: 512,
      },
      staticImage: true,
    };
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
    mixer?.stopAllAction();
    if (vrm) mixer?.uncacheRoot(vrm.scene);
    if (motionScene) VRMUtils.deepDispose(motionScene);
    vrm?.dispose?.();
    if (gltf) VRMUtils.deepDispose(gltf.scene);
    for (const url of fbxBlobs) URL.revokeObjectURL(url);
  }
}
