import * as THREE from 'three';
import {createGazeRig} from './gaze-rig.js';
import {createAutoGaze} from './auto-gaze.js';
import {createNaturalActivity} from './natural-activity.js';
export async function runGazeSmoke(phase,c){
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='models'){
  await c.start();const st=c.stage();st.renderSuspended=true;const results=[];
  for(const role of c.project().characters){
   const r=await st.loadModel(c.asset(role.modelId),role.id);assert(r.autoGaze,'没有眼球控制器：'+role.name);r.autoGaze.restore();r.autoBlink?.restore();r.vrm.beforeAnimation?.();r.vrm.update(0);
   const rig=createGazeRig(r.vrm),head=r.vrm.humanoid.getRawBoneNode('head'),q=head.quaternion.clone(),samples=[];
   r.vrm.scene.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight'),position=mesh.geometry.getAttribute('position');if(!indices)return;
    const eyeIndices=new Set(mesh.skeleton.bones.flatMap((b,i)=>/目|eye/i.test(b.name)?[i]:[]));let count=0;
    for(let i=0;i<indices.count&&count<12;i++)if([0,1,2,3].some(j=>eyeIndices.has(indices.getComponent(i,j))&&weights.getComponent(i,j)>.01)){
     const point=new THREE.Vector3().fromBufferAttribute(position,i);samples.push({mesh,index:i,point,before:mesh.applyBoneTransform(i,point.clone())});count++;
    }
   });
   rig.apply(8,3);const displacement=Math.max(0,...samples.map(s=>s.before.distanceTo(s.mesh.applyBoneTransform(s.index,s.point.clone()))));
   assert(displacement>1e-6,'瞳孔网格没有实际移动：'+role.name);assert(head.quaternion.toArray().every((value,i)=>Math.abs(value-q.toArray()[i])<1e-8),'头部动作被修改：'+role.name);
   const diagnostics=rig.diagnostics();rig.restore();r.vrm.scene.updateMatrixWorld(true);
   assert(samples.every(s=>s.before.distanceTo(s.mesh.applyBoneTransform(s.index,s.point.clone()))<1e-5),'眼球没有回到原位');
   results.push({name:role.name,...diagnostics,displacement});r.autoGaze=createAutoGaze(r.vrm);
  }
  return {ok:true,actualSkinnedEyeMovement:true,headPreserved:true,results};
 }
 const st=c.stage(),p=c.project();
 if(phase==='scene'){
  st.renderSuspended=true;st.stopTalking();const roles=p.characters.slice(0,3),entries=roles.map((role,i)=>({actorKey:role.id,modelAsset:c.asset(role.modelId),position:['left','center','right'][i],transform:{size:1,offsetX:0,offsetY:0,offsetZ:0},expressionWeights:{}}));
  await st.showCast(entries,{actorKey:roles[0].id,expressionWeights:{}},false);
  const cast=c.cast();['left','center','right'].forEach((slot,i)=>cast[slot]={characterId:roles[i].id,size:1,offsetX:0,offsetY:0,offsetZ:0,motionId:'',expressionWeights:{},props:[]});p.acts[0].steps[0].cast=cast;
  const records=[...st.visibleRecords.values()];records.forEach(r=>{r.autoGaze.restore();r.autoGaze=createAutoGaze(r.vrm,()=>.17);});st.naturalActivity=createNaturalActivity(()=>.53);
  let maxBlinking=0,maxGazing=0;const starts=[];const old=new Map(records.map(r=>[r,0]));
  for(let i=0;i<2400;i++){
   st.naturalActivity.tick(1/30);let blinking=0,gazing=0;
   for(const r of records){r.autoGaze.restore();r.autoBlink.restore();r.vrm.beforeAnimation?.();r.mixer.update(1/30);r.autoBlink.update(1/30,()=>st.naturalActivity.request('blink',r));r.vrm.update(0);r.autoGaze.update(1/30,{record:r,others:records,activity:st.naturalActivity});const d=r.autoGaze.diagnostics();if(d.phase!=='idle')gazing++;if(r.autoBlink.diagnostics().weight>0)blinking++;if(d.count!==old.get(r)){starts.push({time:i/30,actor:r.actorKey,kind:d.kind,target:d.target});old.set(r,d.count);}}
   maxBlinking=Math.max(maxBlinking,blinking);maxGazing=Math.max(maxGazing,gazing);
  }
  assert(maxBlinking<=1&&maxGazing<=2,'多人场景没有错开');assert(starts.some(e=>e.kind==='actor'&&e.target!==e.actor),'没有看向其他角色');assert(records.every(r=>r.autoGaze.diagnostics().count>0),'有人一直没有视线变化');
  records.forEach(r=>{r.autoGaze.restore();r.autoGaze=createAutoGaze(r.vrm);r.vrm.beforeAnimation?.();r.vrm.update(0);});st.renderSuspended=false;
  return {ok:true,threeActualActors:true,maxBlinking,maxGazing,attentionToOthers:true,starts};
 }
 if(phase==='natural'){
  st.renderSuspended=false;const r=st.activeRecord,start=performance.now(),count=r.autoGaze.diagnostics().count;let peak=0;
  while(performance.now()-start<25000&&r.autoGaze.diagnostics().count===count){await wait(15);peak=Math.max(peak,Math.abs(r.autoGaze.diagnostics().yaw));}
  await wait(250);peak=Math.max(peak,Math.abs(r.autoGaze.diagnostics().yaw));assert(r.autoGaze.diagnostics().count>count&&peak>1,'实时视线没有变化');
  assert(st.livePortrait.record===r&&st.livePortrait.frames>0,'头像没有共用人物视线');st.renderSuspended=true;const snapshot=JSON.stringify(r.autoGaze.diagnostics());await wait(350);assert(JSON.stringify(r.autoGaze.diagnostics())===snapshot,'暂停未暂停视线');
  return {ok:true,realFrameLoop:true,sharedPortrait:true,pausesWithGame:true,peak};
 }
 if(phase==='vmd'){
  const role=p.characters[0],r=await st.loadModel(c.asset(role.modelId),role.id),a=p.assets.find(a=>a.path.endsWith('.vmd')),clip=await st.prepareClip(c.asset(role.modelId),a,role.id);st.poseRecord(r,clip,a,false,{loop:true,placement:'free',feet:'free'});
  r.autoGaze.restore();const rig=createGazeRig(r.vrm),hasEyeMotion=rig.authored(r),count=r.autoGaze.diagnostics().count;
  for(let n=0;n<900;n++){r.autoGaze.restore();r.autoBlink.restore();r.vrm.beforeAnimation?.();r.mixer.update(1/30);r.vrm.update(0);const eyes=['leftEye','rightEye'].map(e=>r.vrm.humanoid.getRawBoneNode(e)),before=eyes.map(e=>e.quaternion.toArray());r.autoGaze.update(1/30,{record:r,others:[...st.visibleRecords.values()]});if(hasEyeMotion)assert(eyes.every((e,i)=>e.quaternion.toArray().every((value,j)=>Math.abs(value-before[i][j])<1e-8)),'原生 VMD 眼神被覆盖');}
  if(hasEyeMotion)assert(r.autoGaze.diagnostics().count===count,'原生眼神动作期间生成了自动视线');
  r.autoGaze.restore();st.poseRecord(r,null,null,false,{});r.vrm.beforeAnimation?.();r.vrm.update(0);
  return {ok:true,nativeVmdWorks:true,hasEyeMotion,autoSuppressed:hasEyeMotion?r.autoGaze.diagnostics().count===count:null};
 }
 if(phase==='save'){await c.save();return {ok:true,saved:true};}
 throw Error('Unknown gaze phase');
}
