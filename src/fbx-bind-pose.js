import * as THREE from 'three';

// A Mixamo motion-only export can store a T pose in Lcl Rotation while its
// keyframes already include the original skeleton's PreRotation. Subtracting
// that T pose from an FBX character's bind pose applies a second arm correction.
// Prefer skin bind matrices; motion-only files expose the bind axes as pre/post
// rotations. Never modify the source scene while deriving this reference.
export function fbxBindPose(scene) {
  const bindWorld = new Map();
  scene.traverse(object => {
    if (!object.isSkinnedMesh || !object.skeleton) return;
    object.skeleton.bones.forEach((bone, index) => {
      const inverse = object.skeleton.boneInverses[index];
      if (inverse) bindWorld.set(bone, inverse.clone().invert());
    });
  });
  const local = new Map(), world = new Map();
  const degrees = THREE.MathUtils.DEG2RAD;
  const rotation = (values = [0, 0, 0], order = 'ZYX') =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...values.map(v => v * degrees), order));
  scene.traverse(object => {
    let quaternion = object.quaternion.clone();
    const bind = bindWorld.get(object), parentBind = bindWorld.get(object.parent);
    if (bind && (parentBind || !object.parent?.isBone)) {
      bind.decompose(new THREE.Vector3(), quaternion, new THREE.Vector3());
      const parentRotation = parentBind
        ? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(parentBind))
        : (world.get(object.parent) || new THREE.Quaternion()).clone();
      quaternion.premultiply(parentRotation.invert());
    } else if (object.isBone && object.userData.transformData &&
      (object.userData.transformData.preRotation || object.userData.transformData.postRotation)) {
      const data = object.userData.transformData;
      quaternion = rotation(data.preRotation, data.eulerOrder)
        .multiply(rotation(data.postRotation, data.eulerOrder).invert());
    }
    local.set(object, quaternion);
    // Work inside the imported asset. Editor placement/yaw must not become a
    // part of the skeleton reference, including when clips are loaded later.
    world.set(object, (world.get(object.parent) || new THREE.Quaternion()).clone().multiply(quaternion));
  });
  return { local, world };
}
