import * as THREE from 'three';
import {solveArmIK,normalizeMotionFit} from './motion-fit.js';
export async function motionFitSmoke(phase,c){
 const p=c.project(),assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='setup'){
  for(const a of window.__motion72Assets||[])if(!p.assets.some(b=>b.id===a.id))p.assets.push(a);
  const model=p.assets.find(a=>a.id==='motion72-fbx-model');assert(model,'Missing real FBX fixture');
  if(!p.characters.some(r=>r.modelId===model.id))p.characters.push({id:'motion72-fbx-role',name:'FBX 白模测试',modelId:model.id,stories:[],props:[],autoMouth:false});
  p.name='人物动作适配与白模_0.0.72';const types=['mmdCharacter','vrm','fbxCharacter'];
  const roles=types.map(type=>p.characters.find(r=>p.assets.find(a=>a.id===r.modelId)?.type===type));assert(roles.every(Boolean),'Missing three character formats');
  for(const role of roles){role.motionFit=normalizeMotionFit();role.motionFitOverrides={};role.fitPreviewMotionId='motion72-walk';}
  await c.normalize();return {ok:true,roles:roles.map(r=>({id:r.id,name:r.name,modelId:r.modelId}))};
 }
 if(phase==='save'){await c.save();return {ok:true,profiles:p.characters.filter(r=>r.fitPreviewMotionId==='motion72-walk').map(r=>({id:r.id,motionFit:r.motionFit,overrides:r.motionFitOverrides}))};}
 if(phase==='reopen'){
  const roles=p.characters.filter(r=>r.fitPreviewMotionId==='motion72-walk');assert(roles.length>=3,'Lost preview motion');assert(roles.every(r=>r.motionFit.strength===.57),'Lost role settings');assert(roles.every(r=>r.motionFitOverrides?.['motion72-walk']?.strength===.36),'Lost motion override');return {ok:true,roleAndMotionRoundtrip:true,count:roles.length};
 }
 if(phase==='main')return {ok:!document.querySelector('[data-motion-fit]')&&!document.querySelector('[data-action=export-mixamo-white]')&&!document.querySelector('[data-action=export-mixamo-obj]'),mainEditorClean:true};
 if(phase==='runtime'){
  const roles=['mmdCharacter','vrm','fbxCharacter'].map(type=>p.characters.find(r=>p.assets.find(a=>a.id===r.modelId)?.type===type));assert(roles.every(Boolean),'Missing runtime characters');
  await c.play(roles);await wait(900);const records=[...c.stage().visibleRecords.values()];assert(records.length===3,'Runtime cast missing');
  const result=records.map(r=>{const d=r.vrm.motionFit.diagnostics();assert(d.frames>0,'Runtime fitting not evaluated');assert(d.profile.strength===.36,'Runtime did not use saved override');return {key:r.actorKey,profile:d.profile,frames:d.frames,corrections:d.corrections};});
  assert(c.stage().livePortrait.record,'No live speaking portrait');return {ok:true,threeFormats:true,livePortrait:true,results:result};
 }
 const type=phase.replace('character-',''),role=p.characters.find(r=>p.assets.find(a=>a.id===r.modelId)?.type===type);assert(role,'Character missing');
 await c.select(role.id);await wait(250);
 const st=c.stage(),r=st.activeRecord;assert(r?.currentAction,'No preview animation');st.renderSuspended=true;r.vrm.setPhysicsEnabled?.(false);r.mixer.timeScale=0;
 assert(document.querySelector('[data-motion-fit]')&&document.querySelector('[data-action=export-mixamo-white]'),'Controls absent from character editor');
 const others=JSON.stringify(p.characters.filter(r=>r!==role).map(r=>r.motionFit));
 const input=(selector,value)=>{const n=document.querySelector(selector);assert(n,'Missing '+selector);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));};
 input('[data-motion-fit=strength]','57');assert(role.motionFit.strength===.57,'Role setting not applied');assert(JSON.stringify(p.characters.filter(r=>r!==role).map(r=>r.motionFit))===others,'Changed another character');
 document.querySelector('[data-action=fit-motion-own]').click();await wait(100);input('[data-motion-fit=strength]','36');assert(role.motionFitOverrides['motion72-walk'].strength===.36,'Motion setting not applied');assert(role.motionFit.strength===.57,'Override changed role default');
 const frame=document.querySelector('[data-fit-frame]');assert(Number(frame.max)>10,'Frame scrubber missing duration');input('[data-fit-frame]','10');assert(st.activeRecord.mixer.timeScale===0,'Scrubbing did not pause');
 // Stress the real rig with a hand target inside the chest, then evaluate the
 // same pose repeatedly to check correction and absence of paused-frame drift.
 const profile=role.motionFitOverrides['motion72-walk'];profile.enabled=false;
 r.vrm.beforeAnimation?.();r.mixer.setTime(.3);r.vrm.update(0);
 const get=n=>r.vrm.humanoid.getRawBoneNode?.(n)||r.vrm.humanoid.getNormalizedBoneNode(n),upper=get('leftUpperArm'),lower=get('leftLowerArm'),hand=get('leftHand'),hip=get('hips'),neck=get('neck')||get('head');
 const target=hip.getWorldPosition(new THREE.Vector3()).lerp(neck.getWorldPosition(new THREE.Vector3()),.65);target.x+=.01;
 solveArmIK(upper,lower,hand,target);const before=hand.getWorldPosition(new THREE.Vector3());profile.enabled=true;profile.strength=1;r.vrm.motionFit.apply();const after=hand.getWorldPosition(new THREE.Vector3());assert(after.distanceTo(before)>.002,'Hand correction not working on '+type);
 for(let i=0;i<12;i++){r.vrm.motionFit.apply();assert(hand.getWorldPosition(new THREE.Vector3()).distanceTo(after)<.001,'Correction accumulated');}
 const correction=after.distanceTo(before),d=r.vrm.motionFit.diagnostics().lastCorrection;assert(d&&d.requested<=d.height*.38+1e-5,'Correction exceeded safe displacement');assert(d.goalError<.005,'IK missed its target');profile.strength=.36;
 r.vrm.beforeAnimation?.();r.mixer.setTime(.3);r.vrm.update(0);
 let finite=true;r.vrm.scene.traverse(o=>{if(o.isBone)finite&&=o.quaternion.toArray().every(Number.isFinite);});assert(finite,'Invalid bone transform');
 const q=hand.quaternion.clone();window.__lastWhiteExport=null;document.querySelector('[data-action=export-mixamo-white]').click();
 for(let i=0;i<600&&!window.__lastWhiteExport;i++)await wait(50);const output=window.__lastWhiteExport;assert(output?.bytes>1000,'Native FBX save failed');const poseError=hand.quaternion.clone().normalize().angleTo(q.clone().normalize());assert(poseError<1e-4,'White export changed live pose: '+poseError);
 window.__lastWhiteExport=null;document.querySelector('[data-action=export-mixamo-obj]').click();
 for(let i=0;i<600&&!window.__lastWhiteExport;i++)await wait(50);const objOutput=window.__lastWhiteExport;assert(objOutput?.bytes>1000&&objOutput.path.endsWith('.obj'),'Native OBJ save failed');
 assert(hand.quaternion.clone().normalize().angleTo(q.clone().normalize())<1e-4,'OBJ export changed live pose');
 r.vrm.setPhysicsEnabled?.(true);st.renderSuspended=false;r.mixer.timeScale=1;await wait(700);
 document.querySelector('.motion-fit-editor')?.scrollIntoView({block:'start'});
 return {ok:true,type,correctionMetres:correction,independentProfiles:true,pausedPoseStable:true,livePosePreserved:true,finiteBones:true,clothPhysics:r.vrm.isMmd?r.vrm.physics?.diagnostics():r.vrm.secondaryMotionSafety?.diagnostics?.(),export:output,objExport:objOutput,fit:r.vrm.motionFit.diagnostics()};
}
