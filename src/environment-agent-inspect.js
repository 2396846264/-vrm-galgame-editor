import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeTree} from './environment-runtime.js';

export async function inspectSceneAsset(asset,url){
  if(asset?.type==='image'){
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('图片无法读取'));image.src=url;});
    return {assetId:asset.id,type:asset.type,name:asset.name,pixels:[image.naturalWidth,image.naturalHeight],aspect:image.naturalWidth/image.naturalHeight};
  }
  if(asset?.type!=='sceneModel')throw Error('请选择 GLB 场景模型或图片素材');
  const gltf=await new GLTFLoader().loadAsync(url);
  try{
    gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene,true);let meshes=0,triangles=0;const materials=new Set();
    gltf.scene.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry?.index?.count||o.geometry?.attributes.position?.count||0)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m.name||m.type);});
    return {assetId:asset.id,type:asset.type,name:asset.name,units:'meters (as authored in the GLB)',bounds:bounds.isEmpty()?null:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray(),center:bounds.getCenter(new THREE.Vector3()).toArray()},meshes,triangles:Math.floor(triangles),materials:[...materials],animations:gltf.animations.map((a,index)=>({index,name:a.name,duration:a.duration}))};
  }finally{disposeTree(gltf.scene);}
}
