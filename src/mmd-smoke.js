import * as THREE from 'three';
export async function runMmdSmoke(phase,c){
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='setup'){
  const p=c.blank();p.assets=window.__mmdImported;
  p.characters=p.assets.filter(a=>a.type==='mmdCharacter').map((a,i)=>({id:'mmd-'+i,name:['布洛妮娅','娜塔莎','遐蝶'][i],modelId:a.id,description:'MMD 模型，使用现有 Mixamo 动作，表情和口型实时播放。',stories:[{text:'角色故事也可以使用 MMD 模型。',unlockLines:0}],props:[],autoMouth:true}));
  const idle=p.assets.find(a=>a.type==='motion'&&a.name.includes('自然站立')),cast=c.cast();
  ['left','center','right'].forEach((slot,i)=>cast[slot]={characterId:p.characters[i].id,motionId:idle.id,motionOptions:{loop:true,placement:'inPlace',feet:'free'},size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0,expressionWeights:{},props:[]});
  const line={id:'mmd-line',speaker:p.characters[0].name,characterId:p.characters[0].id,text:'MMD 人物也能使用可动头像、表情和说话口型。',cast,choices:[],camera:{position:[0,1.25,4.7],target:[0,1,0],fov:38}};
  p.acts=[{id:'mmd-act',name:'MMD 人物与动作验证',cast:c.cast(),castSettings:{},steps:[line]}];p.title={actors:[],logoImageId:'__none__'};p.ui.gameTheme='astral';c.setProject(p);await c.start();await wait(250);c.stage().renderSuspended=true;
  const st=c.stage();assert(st.visibleRecords.size===3,'MMD cast missing');
  window.__mmd36Data={records:[...st.visibleRecords.values()],idle};
  const results=window.__mmd36Data.records.map(r=>{assert(r.vrm.isMmd,'Not MMD');assert(r.vrm.expressionManager.expressions.some(e=>e.expressionName==='aa'),'Missing vowel morph');return {bones:r.vrm.mesh.skeleton.bones.length,morphs:Object.keys(r.vrm.mesh.morphTargetDictionary).length,mapped:r.vrm.diagnostics.mappedBones,deformLeg:r.vrm.diagnostics.deformLegs};});
  paint(st);return {ok:true,threeModels:true,results};
 }
 const p=c.project(),st=c.stage(),d=window.__mmd36Data;
 const sample=(r,time)=>{r.talkingMouth?.restore();r.vrm.beforeAnimation?.();st.restoreFootPose(r);r.mixer.setTime(time);st.applyMotionPlacement(r);r.vrm.update(0);r.anchor.updateWorldMatrix(true,true);};
 if(phase==='mixamo'){
  const walking=p.assets.find(a=>a.type==='motion'&&a.name.includes('走路')),results=[];assert(walking,'Walking fixture missing');
  for(let i=0;i<d.records.length;i++){
   const r=d.records[i],role=p.characters[i],clip=await st.prepareClip(c.asset(role.modelId),walking,role.id);st.poseRecord(r,clip,walking,false,{loop:true,placement:'inPlace',feet:'free'});r.vrm.scene.visible=true;
   const leg=r.vrm.humanoid.getRawBoneNode('leftUpperLeg'),head=r.vrm.humanoid.getRawBoneNode('head'),samples=[];
   for(const t of [.1,.3,.5,.7]){sample(r,t);samples.push({leg:leg.quaternion.clone(),head:head.getWorldPosition(new THREE.Vector3()),bounds:new THREE.Box3().setFromObject(r.vrm.mesh,true).getSize(new THREE.Vector3()).toArray()});}
   const change=Math.max(...samples.map(s=>s.leg.angleTo(samples[0].leg)));assert(change>.05,'Visible leg skeleton not animated');assert(samples.every(s=>s.bounds.every(Number.isFinite)&&s.bounds[1]>.6&&s.bounds[1]<3),'Broken mesh size');results.push({role:role.name,tracks:clip.tracks.length,legAngle:change,bounds:samples[1].bounds});sample(r,.3);
  }
  paint(st);return {ok:true,existingMixamoWorks:true,results};
 }
 if(phase==='expressions'){
  const results=[];for(const r of d.records){const e=r.vrm.expressionManager,mesh=r.vrm.mesh;e.resetValues();e.setValue('happy',.8);e.setValue('aa',.65);r.vrm.update(0);const aa=mesh.morphTargetDictionary['あ'];assert(aa!==undefined&&mesh.morphTargetInfluences[aa]>.6,'Mouth not deformed');assert(mesh.morphTargetInfluences.filter(v=>v>0).length>=2,'Expression not deformed');results.push({aa:mesh.morphTargetInfluences[aa],active:mesh.morphTargetInfluences.filter(v=>v>0).length});e.resetValues();e.setValue('happy',.45);r.vrm.update(0);}paint(st);return {ok:true,mouthAndFaceMorphs:true,results};
 }
 if(phase==='portrait'){
  const r=d.records[0],node=document.querySelector('#speaker-portrait');await st.setLivePortrait(c.asset(p.characters[0].modelId),p.characters[0].id,node,{happy:.4});assert(st.livePortrait.record===r,'Duplicate portrait model');
  const head=r.vrm.humanoid.getNormalizedBoneNode('head'),q=head.quaternion.clone();r.mixer.stopAllAction();r.vrm.update(0);paint(st);const camera=st.livePortrait.camera.quaternion.clone(),before=head.getWorldQuaternion(new THREE.Quaternion());head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.25));r.vrm.update(0);paint(st);assert(st.livePortrait.camera.quaternion.angleTo(camera)<1e-5,'Portrait pins head');assert(head.getWorldQuaternion(new THREE.Quaternion()).angleTo(before)>.2,'Head animation missing');head.quaternion.copy(q);
  st.startTalking(p.characters[0].id,true);for(let i=0;i<10;i++){r.talkingMouth.update(.05);r.vrm.update(0);}assert(r.talkingMouth.diagnostics().names.length>=3,'No lip sync aliases');paint(st);const mouth=r.talkingMouth.diagnostics();st.stopTalking();return {ok:true,sameLiveModel:true,naturalHeadMotion:true,mouth};
 }
 if(phase==='vmd'){
  const a=p.assets.find(a=>a.path.endsWith('.vmd')),r=d.records[0],clip=await st.prepareClip(c.asset(p.characters[0].modelId),a,p.characters[0].id);st.poseRecord(r,clip,a,false,{loop:true,placement:'free',feet:'free'});
  const head=r.vrm.humanoid.getRawBoneNode('head'),poses=[];for(const t of [1,5,12,24]){sample(r,t);poses.push(head.getWorldQuaternion(new THREE.Quaternion()));}
  const range=Math.max(...poses.map(q=>q.angleTo(poses[0])));assert(range>.02,'VMD did not animate '+JSON.stringify({range,duration:clip.duration,tracks:clip.tracks.map(t=>t.name).slice(0,12),poses:poses.map(q=>q.toArray())}));assert(clip.tracks.some(t=>t.name.includes('morphTargetInfluences')),'VMD expressions omitted');sample(r,12);paint(st);
  const restore=await st.prepareClip(c.asset(p.characters[0].modelId),d.idle,p.characters[0].id);st.poseRecord(r,restore,d.idle,false,{loop:true,placement:'inPlace',feet:'free'});sample(r,.4);return {ok:true,vmdBonesAndMorphs:true,duration:clip.duration,tracks:clip.tracks.length,headAngle:range,mixamoAfterVmd:true};
 }
 if(phase==='weapons'){
  const props=p.assets.filter(a=>a.type==='sceneModel');assert(props.length===3,'Three weapon files missing');
  for(let i=0;i<3;i++){const r=d.records[i],b={id:'weapon-'+i,assetId:props[i].id,bone:'rightHand',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};p.characters[i].props=[b];await st.characterProps.sync(r,[b],[b.id],p.assets);assert(r.attachedProps.get(b.id)?.root.visible,'Weapon not attached');}
  paint(st);return {ok:true,separatePmxWeapons:true};
 }
 if(phase==='details'){await c.details();await wait(200);assert(c.roleDetails().roles.length===3,'MMD role details missing');assert(c.roleDetails().viewer.visibleRecords.size===3,'Details not rendering MMD');return {ok:true,fullBodyRoleDetails:true};}
 if(phase==='performance'){st.renderSuspended=false;const start=performance.now();let frames=0;await new Promise(resolve=>{const tick=()=>{frames++;if(performance.now()-start>3000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});const fps=frames*1000/(performance.now()-start);st.renderSuspended=true;return {ok:true,threeActors:true,framesPerSecond:fps,geometries:st.renderer.info.memory.geometries,textures:st.renderer.info.memory.textures,livePortraitFrames:st.livePortrait.frames};}
 if(phase==='save'){c.roleDetails().close();await c.editor();await c.save();return {ok:true,assets:p.assets.length,textures:p.assets.filter(a=>a.type==='modelDependency').length,textureMaps:p.assets.filter(a=>a.textureMap).length};}
 if(phase==='reopen'){assert(p.characters.length===3&&p.assets.filter(a=>a.textureMap).length===6,'Archive lost MMD metadata');await c.start();await wait(200);return {ok:true,archiveReloadWithTextures:true,livePortrait:!!c.stage().livePortrait.record?.vrm.isMmd};}
 throw Error('Unknown MMD smoke phase');
}
function paint(st){st.stylePipeline.render(0);st.livePortrait.render(st.renderer,st.scene,st.element);st.livePortrait.camera.updateMatrixWorld(true);}
