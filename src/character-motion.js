import * as THREE from 'three';

export function motionPlayback(value={}){
 return {loop:value?.loop!==false,startFrame:Math.max(1,Math.floor(Number(value?.startFrame)||1)),endFrame:Number(value?.endFrame)>0?Math.floor(Number(value.endFrame)):null,after:value?.after==='idle'?'idle':'hold',placement:['inPlace','bounded'].includes(value?.placement)?'inPlace':'free',feet:['auto','lock','free'].includes(value?.feet)?value.feet:'free'};
}
export function motionFeetLocked(settings,motion){
 if(settings.feet==='lock')return true;
 if(settings.feet!=='auto')return false;
 if(!motion)return true;
 const name=`${motion.id||''} ${motion.name||''} ${motion.path||''}`;
 if(/walk|run|jump|dance|crouch|sit|crawl|roll|走|跑|跳|舞|蹲|坐|躺|爬|翻滚/i.test(name))return false;
 return /idle|standing|待机|静立|站立|呼吸|说话|说笑|闲聊|交谈|低头发消息|\btalk(?:ing)?\b|\bchat(?:ting)?\b|\bconversation\b/i.test(name);
}
// Close only the loop seam. Keep the original clip and a one-shot animation
// untouched, including crouches, jumps, fingers and root travel.
export function loopMotionClip(clip,hips,cache){
 const key='loop:'+clip.uuid;if(cache.has(key))return cache.get(key);
 const rootNames=new Set([hips?.name+'.position',hips?.uuid+'.position']);
 const duration=clip.duration,blend=Math.min(.1,duration*.15),begin=duration-blend;
 if(duration<=1/30)return clip;
 const tracks=clip.tracks.map(source=>{
  if(source.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline||(!source.name.endsWith('.quaternion')&&!rootNames.has(source.name)))return source.clone();
  const track=source.clone(),sample=source.createInterpolant(),first=Array.from(sample.evaluate(0));
  const size=source.getValueSize(),times=Array.from(source.times),values=Array.from(source.values);
  if(!times.some(t=>Math.abs(t-begin)<1e-6)){
   const index=times.findIndex(t=>t>begin),at=index<0?times.length:index;
   times.splice(at,0,begin);values.splice(at*size,0,...Array.from(sample.evaluate(begin)));
  }
  if(times.at(-1)<duration-1e-6){times.push(duration);values.push(...Array.from(sample.evaluate(duration)));}
  for(let i=0;i<times.length;i++){
   const weight=THREE.MathUtils.smoothstep(times[i],begin,duration);if(!weight)continue;
   if(size===4)new THREE.Quaternion().fromArray(values,i*4).slerp(new THREE.Quaternion().fromArray(first),weight).normalize().toArray(values,i*4);
   else values[i*size+1]=THREE.MathUtils.lerp(values[i*size+1],first[1],weight);
  }
  track.times=new source.times.constructor(times);track.values=new source.values.constructor(values);return track;
 });
 const result=new THREE.AnimationClip(clip.name+' · 连续循环',duration,tracks);cache.set(key,result);return result;
}
export function rootTravel(clip,hips){
 const track=clip.tracks.find(t=>t.name===hips?.name+'.position'||t.name===hips?.uuid+'.position');
 if(!track)return new THREE.Vector3();
 const sample=track.createInterpolant(),start=Array.from(sample.evaluate(0)),end=Array.from(sample.evaluate(clip.duration));
 return new THREE.Vector3(end[0]-start[0],0,end[2]-start[2]);
}
export function updateMotionRoot(record){
 const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),root=record.motionRoot;if(!hips)return;
 record.anchor.updateMatrixWorld(true);
 const matrix=root.matrixWorld.clone().invert().multiply(hips.parent.matrixWorld),zero=new THREE.Vector3().applyMatrix4(matrix);
 if(record.finishWorldTarget&&record.fadeOutActions?.length){
  const local=root.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));root.position.set(record.finishWorldTarget.x-local.x,0,record.finishWorldTarget.z-local.z);
 }else if(record.currentMotionOptions?.placement==='inPlace'){
  const local=root.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
  const origin=record.motionOrigin||record.referenceHips,carry=record.motionCarry||new THREE.Vector3();root.position.set(origin.x-local.x+carry.x,0,origin.z-local.z+carry.z);
 }else{
  const raw=(record.rootLoopTravel||new THREE.Vector3()).clone().multiplyScalar(record.motionLoops||0);
  root.position.copy(raw.applyMatrix4(matrix).sub(zero).add(record.motionCarry||new THREE.Vector3()));
 }
 root.updateMatrixWorld(true);
}
export function motionFinishTarget(record){
 const hips=record.vrm.humanoid.getNormalizedBoneNode('hips');if(!hips)return null;
 record.anchor.updateMatrixWorld(true);
 if(record.currentMotionOptions?.placement==='inPlace')return record.anchor.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
 const track=record.currentAction?.getClip().tracks.find(t=>t.name===hips.name+'.position'||t.name===hips.uuid+'.position');
 const matrix=record.motionRoot.matrixWorld.clone().invert().multiply(hips.parent.matrixWorld);
 const point=track?new THREE.Vector3().fromArray(track.createInterpolant().evaluate(record.currentAction.getClip().duration)):hips.position.clone();
 return point.applyMatrix4(matrix).add(record.motionRoot.position);
}
