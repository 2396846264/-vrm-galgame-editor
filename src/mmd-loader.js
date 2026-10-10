import * as THREE from 'three';
import {DDSLoader} from 'three/addons/loaders/DDSLoader.js';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import {createMmdActor} from './mmd-actor.js';

export async function loadMmdMesh(modelAsset,urlOf){
 const {MMDLoader}=await import('@moeru/three-mmd');
 const base=urlOf(modelAsset),manager=new THREE.LoadingManager(),map=new Map();
 for(const [original,path]of Object.entries(modelAsset.textureMap||{}))map.set(new URL(original.replace(/\\/g,'/'),base).href,urlOf({path}));
 manager.setURLModifier(url=>map.get(new URL(url.replace(/\\/g,'/'),base).href)||url);
 manager.addHandler(/\.tga$/i,new TGALoader(manager));manager.addHandler(/\.dds$/i,new DDSLoader(manager));
 let finish,error;const complete=new Promise((resolve,reject)=>{finish=resolve;error=reject;});manager.onLoad=()=>finish();manager.onError=url=>error(Error('MMD 贴图无法加载：'+decodeURI(url)));
 const loader=new MMDLoader(manager),build=loader.meshBuilder.build.bind(loader.meshBuilder);
 loader.meshBuilder.build=(data,...args)=>{const mesh=build(data,...args);mesh.userData.mmdMouthMorphs=(data.morphs||[]).filter(m=>m.panel===3).map(m=>m.name);return mesh;};
 let mesh;const loading=loader.loadAsync(base).then(value=>(mesh=value));
 try{const results=await Promise.all([loading,complete]);return results[0];}
 catch(error){if(mesh)disposeMmdMesh(mesh);else loading.then(value=>disposeMmdMesh(value)).catch(()=>{});throw error;}
}
function disposeMmdMesh(mesh){const textures=new Set();for(const m of [].concat(mesh.material||[])){for(const value of [...Object.values(m),...Object.values(m.uniforms||{}).map(u=>u.value)])if(value?.isTexture)textures.add(value);m.dispose();}textures.forEach(t=>t.dispose());mesh.geometry.dispose();mesh.skeleton?.dispose();}
export async function loadMmdActor(asset,urlOf,options={}){const mesh=await loadMmdMesh(asset,urlOf);try{return await createMmdActor(mesh,options);}catch(error){disposeMmdMesh(mesh);throw error;}}
export async function loadVmdMotion(asset,urlOf){const {VMDLoader}=await import('@moeru/three-mmd');return new VMDLoader().loadAsync(urlOf(asset));}
export async function createVmdMotion(vmd,actor){
 const {createMMDAnimationClip}=await import('@moeru/three-mmd');
 const positions=actor.mesh.skeleton.bones.map(b=>b.position.clone());let clip;
 try{for(const b of actor.mesh.skeleton.bones)b.position.copy(actor.getRestPosition(b));clip=createMMDAnimationClip(vmd,actor.mesh);}
 finally{actor.mesh.skeleton.bones.forEach((b,i)=>b.position.copy(positions[i]));}
 const byName=new Map(actor.mesh.skeleton.bones.map(b=>[b.name,b]));
 // Evaluate the component's VMD curves at their native 30 fps. Ordinary tracks
 // keep those curves safe when the editor cuts frames or closes a loop seam.
 const count=Math.ceil(clip.duration*30)+1,times=Array.from({length:count},(_,i)=>Math.min(clip.duration,i/30));
 const tracks=clip.tracks.flatMap(source=>{let name=source.name;const match=name.match(/^\.bones\[([^\]]+)\]\.(.+)$/);if(match){const bone=byName.get(match[1]);if(!bone)return [];name=bone.uuid+'.'+match[2];}else if(name.startsWith('.morphTargetInfluences'))name=actor.mesh.uuid+name;
  const sampler=source.createInterpolant(),values=times.flatMap(t=>Array.from(sampler.evaluate(t)));if(!values.every(Number.isFinite))throw Error('VMD 动作曲线无效：'+source.name);return[new source.constructor(name,times,values)];});
 if(!tracks.length)throw Error('这份 VMD 没有与当前 MMD 模型对应的骨骼或表情。');const result=new THREE.AnimationClip(clip.name,clip.duration,tracks);result.userData={mmdVmd:true};return result;
}
