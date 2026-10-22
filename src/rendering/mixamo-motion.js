import * as THREE from 'three';

const boneNames = {
  Hips: 'hips',
  Spine: 'spine',
  Spine1: 'chest',
  Spine2: 'upperChest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftUpperArm',
  LeftForeArm: 'leftLowerArm',
  LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder',
  RightArm: 'rightUpperArm',
  RightForeArm: 'rightLowerArm',
  RightHand: 'rightHand',
  LeftUpLeg: 'leftUpperLeg',
  LeftLeg: 'leftLowerLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg',
  RightLeg: 'rightLowerLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightToes',
};

for (const side of ['Left', 'Right']) {
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    for (let index = 1; index <= 3; index++) {
      const suffix =
        finger === 'Thumb'
          ? ['Metacarpal', 'Proximal', 'Distal'][index - 1]
          : ['Proximal', 'Intermediate', 'Distal'][index - 1];
      boneNames[`${side}Hand${finger}${index}`] =
        `${side.toLowerCase()}${finger === 'Pinky' ? 'Little' : finger}${suffix}`;
    }
  }
}

export function retargetMixamoMotion(asset, vrm) {
  const clip = asset.animations[0];
  if (!clip) throw new Error('FBX 文件里没有动作');
  asset.updateMatrixWorld(true);
  const hips = asset.getObjectByName('mixamorigHips') || asset.getObjectByName('mixamorig:Hips');
  if (!hips) throw new Error('不是标准 Mixamo 骨骼。请导入从 Mixamo 直接下载的 FBX 动作。');
  const modelHips = vrm.humanoid.normalizedRestPose.hips.position[1];
  const scale = Math.abs(hips.position.y) > 0.001 ? modelHips / hips.position.y : 1;
  const tracks = [];
  const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
  const sourceTracks = new Map(clip.tracks.map((track) => [track.name, track]));
  const sourceAncestors = [];
  for (let parent = hips.parent; parent && parent !== asset; parent = parent.parent)
    sourceAncestors.unshift(parent);
  const movingNodes = [...sourceAncestors, hips].map((object) => ({
    object,
    rotation: sourceTracks.get(`${object.name}.quaternion`),
    position: sourceTracks.get(`${object.name}.position`),
  }));
  const sample = (track, time, fallback) =>
    track ? track.createInterpolant().evaluate(time) : fallback;
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
      tracks.push(
        new THREE.QuaternionKeyframeTrack(`${node.name}.${property}`, track.times, values),
      );
    }
  }
  if (hipsNode) {
    const keyTimes = [
      ...new Set([
        0,
        clip.duration,
        ...movingNodes.flatMap(({ rotation, position }) => [
          ...(rotation?.times || []),
          ...(position?.times || []),
        ]),
      ]),
    ].sort((a, b) => a - b);
    const sourceRestInverse = hips.getWorldQuaternion(new THREE.Quaternion()).invert();
    const rootRotation = asset.getWorldQuaternion(new THREE.Quaternion());
    const restPosition = vrm.humanoid.normalizedRestPose.hips.position;
    const quaternionValues = [];
    const positionValues = [];
    for (const time of keyTimes) {
      const worldRotation = rootRotation.clone();
      const movement = new THREE.Vector3();
      for (const { object, rotation, position } of movingNodes) {
        worldRotation.multiply(
          new THREE.Quaternion().fromArray(sample(rotation, time, object.quaternion.toArray())),
        );
        if (position) {
          const current = sample(position, time, object.position.toArray());
          const start = sample(position, 0, object.position.toArray());
          // Preserve an initial crouch/sit height; only horizontal motion is
          // recentered at the first frame. Root ancestors retain their offset.
          const baseY = object === hips ? object.position.y : start[1];
          movement.add(
            new THREE.Vector3(current[0] - start[0], current[1] - baseY, current[2] - start[2]),
          );
        }
      }
      const targetRotation = worldRotation.multiply(sourceRestInverse);
      const q = targetRotation.toArray();
      const p = [
        restPosition[0] + movement.x * scale,
        restPosition[1] + movement.y * scale,
        restPosition[2] + movement.z * scale,
      ];
      if (vrm.meta?.metaVersion === '0') {
        q[0] *= -1;
        q[2] *= -1;
        p[0] *= -1;
        p[2] *= -1;
      }
      quaternionValues.push(...q);
      positionValues.push(...p);
    }
    tracks.push(
      new THREE.QuaternionKeyframeTrack(`${hipsNode.name}.quaternion`, keyTimes, quaternionValues),
    );
    tracks.push(
      new THREE.VectorKeyframeTrack(`${hipsNode.name}.position`, keyTimes, positionValues),
    );
  }
  if (!tracks.length) throw new Error('没有找到可用于此 VRM 的 Mixamo 骨骼动作');
  return new THREE.AnimationClip(clip.name || 'Mixamo', clip.duration, tracks);
}
