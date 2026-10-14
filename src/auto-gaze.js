import * as THREE from 'three';
import {createGazeRig} from './gaze-rig.js';
const clamp=THREE.MathUtils.clamp,deg=THREE.MathUtils.radToDeg;
export function createAutoGaze(vrm,random=Math.random,rig=createGazeRig(vrm)){
 if(!rig)return null;
 const interval=()=>8+random()*8,attentionInterval=()=>45+random()*30;
 let remaining=interval(),attention=attentionInterval(),elapsed=0,hold=0,phase='idle',kind='none',target=null,yaw=0,pitch=0,count=0,actorCount=0;
 let aim={yaw:0,pitch:0};const owner={};
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 function candidates(record,others){
  const {position,rotation}=rig.frame();
  return others.filter(other=>other!==record&&other.vrm.scene.visible).filter(other=>{
   const head=other.vrm.humanoid.getRawBoneNode('head');if(!head)return false;
   const direction=head.getWorldPosition(new THREE.Vector3()).sub(position),distance=direction.length();
   direction.applyQuaternion(rotation.clone().invert());
   return distance>.15&&distance<25&&direction.z/distance>-.15;
  });
 }
 return {
  restore:rig.restore,
  reset(activity){rig.restore();activity?.release(owner);phase='idle';kind='none';target=null;yaw=pitch=0;remaining=interval();attention=attentionInterval();},
  update(delta,{record,others=[],activity}={}){
   const dt=Number.isFinite(delta)?clamp(delta,0,.1):0;attention-=dt;
   if(rig.authored(record)){
    activity?.release(owner);phase='idle';target=null;kind='none';yaw=pitch=0;remaining=interval();return;
   }
   if(phase==='idle'){
    remaining-=dt;if(remaining>0)return;
    const available=attention<=0?candidates(record,others):[];
    const watch=available.length&&random()<.25;
    hold=watch?1+random()*.8:.45+random()*.75;
    if(activity&&!activity.request('gaze',owner,hold+.6)){remaining=.3+random()*1.4;return;}
    target=watch?available[Math.min(available.length-1,Math.floor(random()*available.length))]:null;
    kind=target?'actor':'glance';if(target){attention=attentionInterval();actorCount++;}
    aim={yaw:(random()<.5?-1:1)*(4+random()*4),pitch:(random()-.5)*5};
    elapsed=0;phase='active';count++;
   }
   if(target){
    if(!others.includes(target)||!target.vrm.scene.visible){target=null;phase='return';elapsed=0;aim={yaw,pitch};}
    else{
     const head=target.vrm.humanoid.getRawBoneNode('head'),frame=rig.frame(),v=head.getWorldPosition(new THREE.Vector3()).sub(frame.position).applyQuaternion(frame.rotation.clone().invert());
     aim={yaw:clamp(deg(Math.atan2(v.x,v.z)),-13,13),pitch:clamp(deg(Math.atan2(v.y,Math.hypot(v.x,v.z))),-6,6)};
    }
   }
   elapsed+=dt;
   const amount=phase==='return'?1-smooth(elapsed/.35):smooth(elapsed/.2)*(1-smooth((elapsed-.2-hold)/.35));
   yaw=aim.yaw*amount;pitch=aim.pitch*amount;rig.apply(yaw,pitch);
   if(elapsed>=(phase==='return'?.35:hold+.55)){activity?.release(owner);phase='idle';kind='none';target=null;yaw=pitch=0;remaining=interval();}
  },
  diagnostics(){return {phase,kind,yaw,pitch,count,actorCount,remaining,attention,target:target?.actorKey||target?.vrm.scene.uuid||null,rig:rig.diagnostics()};}
 };
}
