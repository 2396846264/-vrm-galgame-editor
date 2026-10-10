import * as THREE from 'three';
// A real looping breathing/attention idle, even without a bundled motion file.
// It is installed only in character details, leaving story animation intact.
export function createDetailIdle(record){
 const times=[0,.8,1.6,2.4,3.2],tracks=[];
 const head=record.vrm.humanoid.getNormalizedBoneNode('head'),chest=record.vrm.humanoid.getNormalizedBoneNode('chest'),hips=record.vrm.humanoid.getNormalizedBoneNode('hips');
 for(const source of record.idleClip.tracks){
  const size=source.getValueSize(),first=Array.from(source.createInterpolant().evaluate(0)),values=[];
  const isBone=(bone,property)=>bone&&[bone.name+'.'+property,bone.uuid+'.'+property].includes(source.name);
  for(let i=0;i<times.length;i++){
   const wave=Math.sin(i*Math.PI/2),value=first.slice();
   if(size===4&&(isBone(head,'quaternion')||isBone(chest,'quaternion'))){
    new THREE.Quaternion().fromArray(first).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(isBone(chest,'quaternion')?wave*.012:0,isBone(head,'quaternion')?wave*.012:0,0))).normalize().toArray(value);
   }
   if(size===3&&isBone(hips,'position'))value[1]+=wave*Math.max(.004,Math.abs(first[1])*.004);
   values.push(...value);
  }
  tracks.push(new source.constructor(source.name,times,values));
 }
 return new THREE.AnimationClip('角色详情 · 自然待机',3.2,tracks);
}
