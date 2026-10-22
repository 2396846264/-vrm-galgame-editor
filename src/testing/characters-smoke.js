import {partFamily} from '../aircombat-schema.js';
import {ensureVehicleLibrary} from '../vehicle-documents.js';
import {snapshotCamera} from '../dialogue-camera.js';
import * as THREE from 'three';
import {newTitleActor} from '../title-actors.js';
import {emptyDialogueCast} from '../dialogue-cast.js';
import {availablePropBones,propBone} from '../character-props.js';
import {renderSelection,newRenderPreset} from '../render-presets.js';
import {captureSaveThumbnail,validSaveThumbnail} from '../save-thumbnail.js';
import {rememberGameSkin} from '../game-ui-skin.js';
import {portraitBodyFrame} from '../portrait-body-frame.js';
import {isEvent,normalizeEvent,newEvent} from '../events.js';
import {assetUrl,captureCharacterPortrait} from '../renderer.js';
import {createEnvironment} from '../environment-schema.js';
import {verifyImageAlpha} from '../editor-fix-smoke.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeFbxPortrait=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const fbx=host.project.characters.find(c=>host.asset(c.modelId)?.type==='fbxCharacter'),png=host.asset('portrait-mu');assert(fbx&&png,'缺少 FBX 或测试 PNG');
 const line=host.project.acts[0].steps[0];
 async function show(){if(host.mode==='player'){host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();}else{host.playing=false;host.activePanel='story';host.selectedAct=0;host.selectedStep=0;line.characterId=fbx.id;line.text='FBX 自动生成的是一张静态头像，角度和大小与 VRM 一样。';host.renderSidebar();host.renderInspector();await host.updatePreview();}await host.updateSpeakerPortrait(fbx.id,true);}
 async function staticCheck(){await show();const node=document.querySelector('#speaker-portrait'),image=node.querySelector('img'),url=image.src;assert(url===assetUrl(host.asset(fbx.portraitId))&&!node.classList.contains('live-portrait')&&!host.stage.livePortrait.record,'FBX 不是静态 PNG');const bytes=await fetch(url).then(r=>r.arrayBuffer()),bitmap=await createImageBitmap(new Blob([bytes]));assert(bitmap.width===512&&bitmap.height===512,'PNG 尺寸不正确');bitmap.close();await wait(750);assert(image.src===url&&!host.stage.livePortrait.record,'FBX 头像跟着动了');return {ok:true,staticPng:true,pixels:[512,512],source:fbx.portraitSource,bytes:bytes.byteLength};}
 if(phase==='auto'){
  await Promise.all([...host.portraitJobs.values()]);assert(host.asset(fbx.portraitId)?.generatedPortrait&&fbx.portraitSource==='auto','打开缺头像的 FBX 未自动生成');
  const result=await staticCheck();host.activePanel='characters';host.selectedCharacter=host.project.characters.indexOf(fbx);host.renderInspector();assert(document.querySelector('[data-action="capture-character-portrait"]'),'缺少重新生成按钮');assert(!document.querySelector('[data-field="character.autoMouth"]'),'FBX 出现嘴型选项');
  const capture=await captureCharacterPortrait(host.asset(fbx.modelId));assert(Math.abs(capture.framing.halfHeight-.2)<1e-9&&capture.framing.cameraOffset.every((x,i)=>Math.abs(x-[-.85,.05,1.7][i])<1e-8),'没有使用 VRM 相同镜头');
  return {...result,sameVrmFraming:true,automaticOnOpen:true,manualButton:true};
 }
 if(phase==='manual'){
  fbx.portraitId=png.id;fbx.portraitSource='manual';const count=host.project.assets.length;await host.ensureCharacterPortrait(fbx,true);assert(fbx.portraitId===png.id&&host.project.assets.length===count,'自动生成覆盖了手动 PNG');await show();return {ok:true,manualPngPreserved:true};
 }
 if(phase==='reshoot'){
  host.editorHistory.seal();host.editorHistory.begin();await host.ensureCharacterPortrait(fbx,true,true);assert(fbx.portraitSource==='auto'&&fbx.portraitId!==png.id,'明确重新生成没有生效');const id=fbx.portraitId;await host.ensureCharacterPortrait(fbx,true,true);assert(fbx.portraitId===id,'重拍新增了重复头像');return {...await staticCheck(),reusesAsset:true,explicitReshoot:true};
 }
 if(phase==='export'){await show();host.markDirty();await host.save();await host.bridge('saveProjectAs',{project:structuredClone(host.project),name:'FBX静态头像验证'});await host.bridge('exportGame',{folderName:'FBX静态头像试玩'});return {ok:true,exported:true};}
 if(phase==='player'||phase==='reopen')return staticCheck();
 throw Error('未知 FBX 头像检查');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeShoulderPortrait=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const vrm=host.project.characters.find(c=>c.id==='mu'&&host.asset(c.modelId)?.type==='vrm')||host.project.characters.find(c=>host.asset(c.modelId)?.type==='vrm'),fbx=host.project.characters.find(c=>host.asset(c.modelId)?.type==='fbxCharacter'),png=host.asset('portrait-mu');
 assert(vrm&&fbx&&png,'缺少 VRM、FBX 或 PNG 测试素材');
 const currentAct=host.project.acts[0],line=currentAct.steps[0];
 if(phase==='vrm'||phase==='player'){
  if(host.mode==='editor'){host.activePanel='story';host.selectedAct=0;host.selectedStep=0;line.characterId=vrm.id;line.cast.center={...line.cast.center,characterId:vrm.id,expressionWeights:{},props:[]};line.text='实时头像现在和原来的肩部照片一样：稍微侧一点，显示头部和肩膀。';host.renderSidebar();host.renderInspector();await host.updatePreview();}
  else {host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;host.textSpeed=5;await host.showPlayStep();}
  await host.updateSpeakerPortrait(vrm.id,true);await wait(250);
  const record=host.stage.livePortrait.record,camera=host.stage.livePortrait.camera,head=record.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3());
  const scale=record.anchor.getWorldScale(new THREE.Vector3()).y,orientation=record.anchor.getWorldQuaternion(new THREE.Quaternion()),offset=camera.position.clone().sub(head).applyQuaternion(orientation.clone().invert()).divideScalar(scale);
  assert(camera.isOrthographicCamera,'没有使用原照片镜头');assert(offset.distanceTo(new THREE.Vector3(-.85,.05,1.7))<.01,'头像拍摄方向没有对齐');const portraitRect=host.stage.livePortrait.node.getBoundingClientRect();assert(Math.abs(camera.top/scale-(-.2+.4*Math.max(1,portraitRect.height/portraitRect.width)))<1e-8,'头像上方空间没有扩展');
  assert(host.stage.livePortrait.record===host.stage.visibleRecords.get(vrm.id),'没有复用场上 VRM');
  host.stage.startTalking(vrm.id,true);host.stage.talkingLetter('你');let mouth=false;
  for(let i=0;i<15;i++){await wait(50);if(['aa','ih','ou','ee','oh'].some(k=>record.vrm.expressionManager.getValue(k)>.05))mouth=true;}
  assert(mouth,'实时头像嘴型没有变化');host.stage.stopTalking();host.clearTyping();
  return {ok:true,samePhotoAngle:true,samePhotoScale:true,orthographic:true,cameraOffset:offset.toArray(),halfHeight:camera.top/scale,liveMouth:true,vrmOnly:true};
 }
 if(phase==='fbx'){
  host.playing=false;fbx.portraitId=png.id;fbx.portraitSource='manual';line.characterId=fbx.id;line.text='FBX 人物继续使用我上传的 PNG 头像。';await host.updatePreview();await wait(150);
  assert(!host.stage.livePortrait.record,'FBX 使用了实时头像');assert(document.querySelector('#speaker-portrait img').src===assetUrl(png),'FBX PNG 被替换');
  host.activePanel='characters';host.selectedCharacter=host.project.characters.indexOf(fbx);host.renderInspector();assert(document.querySelector('[data-action="capture-character-portrait"]'),'FBX 缺少重新生成头像按钮');host.activePanel='story';host.renderInspector();
  const count=host.project.assets.length;await host.ensureCharacterPortrait(fbx,true);assert(host.project.assets.length===count,'FBX 被自动生成头像');
  return {ok:true,fbxManualPng:true,manualPngPreserved:true,staticPng:true};
 }
 if(phase==='png'){
  const role={id:'photo-only-test',name:'图片角色',modelId:'',portraitId:png.id,portraitSource:'manual',autoMouth:true};host.project.characters.push(role);line.characterId=role.id;line.text='没有模型的角色，也继续显示上传的 PNG。';await host.updatePreview();await wait(150);
  assert(!host.stage.livePortrait.record&&document.querySelector('#speaker-portrait img').src===assetUrl(png),'图片角色头像被替换');
  return {ok:true,pngOnlyRole:true,noModelRequired:true};
 }
 if(phase==='export'){
  line.characterId=vrm.id;line.text='实时头像使用原来的肩部照片角度，嘴型和表情仍然同步。';await host.updatePreview();host.markDirty();await host.save();await host.bridge('exportGame',{folderName:'肩部头像试玩'});return {ok:true,exported:true};
 }
 throw Error('未知检查 '+phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeMixamo=async phase=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const actor=host.project.characters.find(c=>phase==='vrm'?host.asset(c.modelId)?.type==='vrm':host.isFbxModel(c.modelId));
 const motion=host.asset('mixamo-aim-test');assert(actor&&motion,'Missing Mixamo test fixture');
 actor.galleryMotionId=motion.id;actor.galleryPoseFrame=1;
 host.selectedCharacter=host.project.characters.indexOf(actor);host.activePanel='characters';
 host.renderSidebar();host.renderInspector();await host.updatePreview();
 const record=host.stage.visibleRecords.get(`gallery:${actor.id}`);assert(record?.currentAction,'Animation did not load');
 host.stage.setMotionPoseFrame(1);host.stage.restoreFootPose(record);record.footLock=null;
 for(const prop of record.attachedProps.values())prop.root.visible=phase==='binding';
 document.querySelector('[data-action=binding-view-open]').click();
 for(let i=0;i<100&&!host.stage.bindingView.enabled;i++)await new Promise(resolve=>setTimeout(resolve,50));
 host.stage.setMotionPoseFrame(1);host.stage.bindingView.focusModel(record);
 const center=host.stage.bindingView.controls.target.clone(),distance=host.stage.camera.position.distanceTo(center);
 center.y+=.12;
 host.stage.bindingView.look(center,distance*1.4,new THREE.Vector3(-.6,.12,1));
 document.querySelector('.inspector').scrollTop=0;
 const source=await host.stage.fbxLoader.loadAsync(assetUrl(motion));
 const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),sourceHips=source.getObjectByName('mixamorigHips')||source.getObjectByName('mixamorig:Hips');
 const hipTrack=source.animations[0].tracks.find(t=>t.name===sourceHips.name+'.position');
 const sourceFirstY=hipTrack.values[1],targetRestY=record.vrm.isFbx?record.vrm.rest.get(hips).position.y:record.vrm.humanoid.normalizedRestPose.hips.position[1];
 const expectedHipY=sourceFirstY*targetRestY/sourceHips.position.y,hipError=Math.abs(hips.position.y-expectedHipY);
 let maximumErrorDegrees=0;
 if(record.vrm.isFbx){
   for(const name of ['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand']){
     const src=source.getObjectByName('mixamorig'+name)||source.getObjectByName('mixamorig:'+name);
     const track=source.animations[0].tracks.find(t=>t.name===src.name+'.quaternion');
     const error=record.vrm.bones.get(name).quaternion.clone().normalize().angleTo(new THREE.Quaternion().fromArray(track.values).normalize())*180/Math.PI;
     maximumErrorDegrees=Math.max(maximumErrorDegrees,error);
   }
 }
 const props=[...record.attachedProps.values()];
 const result={ok:phase==='before'||(hipError<.0001&&maximumErrorDegrees<.01),phase,modelType:host.asset(actor.modelId).type,motion:motion.name,hipY:hips.position.y,expectedHipY,hipError,maximumErrorDegrees,props:props.length,attachedToHand:props.every(p=>p.root.parent===p.bone),frame:1};
 if(phase!=='before'){assert(result.ok,'Mixamo body pose differs from source: '+JSON.stringify(result));assert(result.attachedToHand,'Attachment no longer follows its joint');}
 const size=host.stage.renderer.getSize(new THREE.Vector2()),oldAspect=host.stage.camera.aspect;
 host.stage.renderer.setSize(1280,720,false);host.stage.camera.aspect=16/9;host.stage.camera.updateProjectionMatrix();
 host.stage.renderer.render(host.stage.scene,host.stage.camera);
 window.__mixamoPng=host.stage.renderer.domElement.toDataURL('image/png').split(',')[1];
 host.stage.renderer.setSize(size.x,size.y,false);host.stage.camera.aspect=oldAspect;host.stage.camera.updateProjectionMatrix();
 return result;
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeProps=async phase=>{
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const fbx=host.project.characters.find(c=>host.isFbxModel(c.modelId)),vrm=host.project.characters.find(c=>host.asset(c.modelId)?.type==='vrm');
 const gun=host.asset('test-gun');assert(fbx&&vrm&&gun,'Missing prop fixture');
 const make=(character)=>({id:'held-'+character.id,name:'测试冲锋枪',assetId:gun.id,bone:'rightHand',position:[0,0,0],rotation:[0,90,0],scale:[1,1,1]});
 const display=async()=>{host.renderSidebar();host.renderInspector();await host.updatePreview();};
 if(phase==='fbx-binding'||phase==='vrm-binding'){
   const actor=phase==='fbx-binding'?fbx:vrm;actor.props=[make(actor)];host.selectedCharacter=host.project.characters.indexOf(actor);host.activePanel='characters';await display();
   const base=`[data-prop-transform="${actor.props[0].id}"][data-vector=position][data-axis="0"]`;
   const coarse=document.querySelector(base+'[data-mode=coarse]'),fine=document.querySelector(base+'[data-mode=fine]');
   assert(coarse&&fine,'Missing coarse/fine controls');coarse.value='.2';coarse.dispatchEvent(new Event('input',{bubbles:true}));
   fine.value='1';fine.dispatchEvent(new Event('input',{bubbles:true}));fine.dispatchEvent(new Event('change',{bubbles:true}));
   assert(Math.abs(actor.props[0].position[0]-.201)<1e-8 && fine.value==='0','Fine position increment failed');
   for(const [kind,axis,base,expected]of [['rotation',0,0,.1],['scale',2,1,1.001]]){
     const selector=`[data-prop-transform="${actor.props[0].id}"][data-vector="${kind}"][data-axis="${axis}"]`;
     const c=document.querySelector(selector+'[data-mode=coarse]'),f=document.querySelector(selector+'[data-mode=fine]');
     c.value=String(base);c.dispatchEvent(new Event('input',{bubbles:true}));f.value='1';f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));
     assert(Math.abs(actor.props[0][kind][axis]-expected)<1e-8,kind+' fine adjustment failed');
   }

   await host.updatePreview();document.querySelector('.prop-editor').scrollIntoView({block:'start'});const record=host.stage.visibleRecords.get(`gallery:${actor.id}`),prop=record.attachedProps.get(actor.props[0].id);
   assert(prop.root.parent===prop.bone && prop.bone.isBone,'Prop not attached to a bone');
   for(const select of document.querySelectorAll('[data-prop-field=bone]')){
     const value=select.value;select.innerHTML=availablePropBones(record).map(b=>`<option value="${host.escape(b.value)}">${host.escape(b.label)}</option>`).join('');select.value=value;
   }
   return {ok:true,actor:host.asset(actor.modelId).type,position:actor.props[0].position,coarseFineControls:true,bone:prop.bone.name,attachmentParent:true,worldPosition:prop.root.getWorldPosition(new THREE.Vector3()).toArray()};
 }
 if(phase==='model-switch'){
   const original=fbx.modelId;host.selectedCharacter=host.project.characters.indexOf(fbx);host.activePanel='characters';fbx.modelId=vrm.modelId;await display();
   assert(!host.stage.visibleRecords.get(`gallery:${fbx.id}`).vrm.isFbx,'Switch to VRM kept the FBX rig');
   fbx.modelId=original;await display();assert(host.stage.visibleRecords.get(`gallery:${fbx.id}`).vrm.isFbx,'Switch back to FBX kept the VRM rig');
   assert(host.stage.visibleRecords.get(`gallery:${fbx.id}`).attachedProps.size===1,'Binding lost after model replacement');return {ok:true,modelReplacement:true};
 }
 if(phase==='dialogue-visible'){
   host.activePanel='story';host.selectedAct=0;host.selectedStep=0;
   const cast=emptyDialogueCast();cast.left={characterId:fbx.id,size:1.15,motionId:'walk-test',props:[fbx.props[0].id]};cast.center={characterId:vrm.id,size:1.15,motionId:'',props:[vrm.props[0].id]};
   host.act().steps=[{id:'prop-one',characterId:fbx.id,text:'我现在拿着冲锋枪。物品会跟着手上的动作移动。',speaker:'',cast,choices:[],voiceId:''}];
   await display();assert(!document.querySelector('[data-field="step.position"]')&&!document.querySelector('[data-field="step.motionId"]')&&!document.querySelector('[data-adjust]'),'Duplicate dialogue controls remain');
   const record=host.stage.visibleRecords.get(fbx.id),prop=record.attachedProps.get(fbx.props[0].id),before=prop.root.getWorldPosition(new THREE.Vector3());
   await new Promise(resolve=>setTimeout(resolve,750));const after=prop.root.getWorldPosition(new THREE.Vector3());
   assert(prop.root.parent===prop.bone,'Animated prop parent changed');assert(before.distanceTo(after)>.001,'Prop did not move with body animation');
   const first=JSON.stringify(host.step().cast),second=structuredClone(host.step());second.id='prop-two';second.characterId=vrm.id;second.text='这一句可以收起枪，也可以更换同一幕中的人物。';host.act().steps.push(second);
   return {ok:true,actors:host.stage.visibleRecords.size,animatedMovement:before.distanceTo(after),gunVisibleOnFbx:record.attachedProps.size,gunVisibleOnVrm:host.stage.visibleRecords.get(vrm.id).attachedProps.size,first};
 }
 if(phase==='one-shot'){
   host.selectedStep=0;host.activePanel='story';host.step().cast.left.motionOptions={loop:false,startFrame:1,endFrame:2,after:'idle'};await display();
   await new Promise(resolve=>setTimeout(resolve,450));assert(host.stage.visibleRecords.get(fbx.id).currentMotionId===null,'Single action did not return to idle');
   host.step().cast.left.motionOptions={};await host.updatePreview();return {ok:true,afterActionIdle:true};
 }
 if(phase==='dialogue-hidden'){
   host.selectedStep=1;host.activePanel='story';await display();const first=JSON.stringify(host.act().steps[0].cast);
   const toggle=document.querySelector(`[data-cast-prop=left][data-prop-id="${fbx.props[0].id}"]`);toggle.checked=false;toggle.dispatchEvent(new Event('input',{bubbles:true}));
   const offset=document.querySelector('[data-cast-adjust="left.offsetZ"][type=number]');offset.value='.03';offset.dispatchEvent(new Event('input',{bubbles:true}));
   await host.updatePreview();assert(JSON.stringify(host.act().steps[0].cast)===first,'Second dialogue changed first dialogue');
   assert(host.stage.visibleRecords.get(fbx.id).attachedProps.size===0,'Hidden gun is still visible');assert(host.stage.visibleRecords.get(vrm.id).attachedProps.size===1,'Other character gun was hidden');
   return {ok:true,dialoguesIndependent:true,hiddenOnFbx:true,visibleOnVrm:true,secondDepth:host.step().cast.left.offsetZ};
 }
 if(phase==='dialogue-roster'){
   const extra=host.project.characters.find(c=>c.modelId && c!==fbx && c!==vrm);assert(extra,'Missing third actor');
   const line={id:'prop-three',characterId:fbx.id,text:'同一幕的下一句换了在场人物。',cast:emptyDialogueCast(),choices:[],voiceId:''};line.cast.left.characterId=extra.id;line.cast.center.characterId=fbx.id;
   host.act().steps.push(line);host.selectedStep=2;await display();assert(host.stage.visibleRecords.has(extra.id)&&host.stage.visibleRecords.has(fbx.id)&&!host.stage.visibleRecords.has(vrm.id),'Previous roster leaked into new dialogue');
   assert(host.stage.visibleRecords.get(fbx.id).attachedProps.size===0,'Previous gun visibility leaked');
   const empty={id:'prop-four',characterId:fbx.id,text:'人物可以在场外说话，这一句的舞台没有人物。',cast:emptyDialogueCast(),choices:[],voiceId:''};host.act().steps.push(empty);host.selectedStep=3;await display();assert(host.stage.visibleRecords.size===0,'Empty stage has a ghost actor');
   await host.save();return {ok:true,rosterReplacement:true,noGhostActor:true,saved:true,stepCount:host.act().steps.length};
 }
 if(phase==='title-multi'){
   const extra=host.project.characters.find(c=>c.modelId&&c!==fbx&&c!==vrm);assert(extra,'Missing third title model');
   host.project.title.actors=[fbx,vrm,extra,fbx].map((role,index)=>({...newTitleActor('title-test-'+index,role.modelId,index),characterId:role.id,offsetX:[-1.1,-.4,.4,1.1][index],offsetY:0,offsetZ:index===3?-.4:0,size:1.05,motionId:'idle',props:role===fbx||role===vrm?[role.props[0].id]:[]}));
   host.project.title.cameraAngle=0;host.activePanel='title';await display();
   const dropdown=document.querySelector('[data-title-field=logoImageId]');assert(dropdown.querySelector('[value="__none__"]'),'Missing blank logo choice');
   dropdown.value='__none__';dropdown.dispatchEvent(new Event('input',{bubbles:true}));await host.updatePreview();
   assert(!document.querySelector('.title-logo-region')&&!document.querySelector('#project-name'),'Blank title panel remains');
   assert(host.stage.visibleRecords.size===4,'Title did not load four actors');
   const a=host.stage.visibleRecords.get('title:title-test-0'),b=host.stage.visibleRecords.get('title:title-test-3');assert(a.vrm.scene!==b.vrm.scene&&a.anchor!==b.anchor,'Repeated FBX model shares its transform');
   const before=JSON.stringify(host.project.title.actors[0]);const z=document.querySelector('[data-title-actor-id="title-test-1"][data-title-actor-adjust=offsetZ][type=number]');z.value='.03';z.dispatchEvent(new Event('input',{bubbles:true}));await host.updatePreview();
   assert(JSON.stringify(host.project.title.actors[0])===before&&host.project.title.actors[1].offsetZ===.03,'Title transforms are not independent');
   const toggle=document.querySelector('[data-title-actor-id="title-test-0"][data-title-actor-prop]');toggle.checked=false;toggle.dispatchEvent(new Event('input',{bubbles:true}));await host.updatePreview();
   assert(host.stage.visibleRecords.get('title:title-test-0').attachedProps.size===0&&host.stage.visibleRecords.get('title:title-test-3').attachedProps.size===1,'Repeated actors share prop visibility');
   toggle.checked=true;toggle.dispatchEvent(new Event('input',{bubbles:true}));await host.updatePreview();
   document.querySelector('[data-action=add-title-actor]').click();await host.updatePreview();assert(host.project.title.actors.length===5&&host.stage.visibleRecords.size===5,'Adding title actor failed');
   const last=host.project.title.actors.at(-1);document.querySelector(`[data-action=delete-title-actor][data-id="${last.id}"]`).click();await host.updatePreview();assert(host.project.title.actors.length===4&&host.stage.visibleRecords.size===4,'Removing title actor failed');
   assert(document.querySelectorAll('#title-preview .title-bottom-menu span').length===7,'Title buttons disappeared');
   await host.save();document.querySelector('.inspector').scrollTop=0;
   return {ok:true,actors:4,blankLogo:true,independentTransforms:true,repeatedModelIndependent:true,independentProps:true,addRemove:true,menuButtons:7};
 }
 if(phase==='finger-bindings'){
   const results=[];
   for(const actor of [fbx,vrm]){
     host.selectedCharacter=host.project.characters.indexOf(actor);host.activePanel='characters';await display();
     const record=host.stage.visibleRecords.get(`gallery:${actor.id}`),original=actor.props[0].bone;
     const fingers=availablePropBones(record).filter(b=>/^(left|right)(Thumb|Index|Middle|Ring|Little)/.test(b.value));
     assert(fingers.some(b=>b.value==='rightIndexDistal')&&fingers.some(b=>b.value==='leftThumbProximal'),'Test model finger bones missing');
     for(const name of ['rightHand','leftHand','rightIndexDistal','leftThumbProximal']){
       const select=document.querySelector(`[data-prop-field=bone][data-prop-id="${actor.props[0].id}"]`);
       assert(select.querySelector(`[value="${name}"]`),'Missing bone in picker');select.value=name;select.dispatchEvent(new Event('input',{bubbles:true}));await host.updatePreview();
       const prop=record.attachedProps.get(actor.props[0].id),bone=propBone(record,name);assert(prop.root.parent===bone,'Prop attached to wrong hand/finger');
       const moving=record.vrm.humanoid.getNormalizedBoneNode(name),saved=moving.quaternion.clone(),before=prop.root.getWorldQuaternion(new THREE.Quaternion());
       moving.rotateZ(.2);record.vrm.update(0);host.stage.characterProps.update(record);const after=prop.root.getWorldQuaternion(new THREE.Quaternion());
       assert(before.angleTo(after)>.05,'Prop did not follow finger rotation');moving.quaternion.copy(saved);record.vrm.update(0);host.stage.characterProps.update(record);
     }
     actor.props[0].bone=original;await host.updatePreview();results.push({modelType:host.asset(actor.modelId).type,fingerChoices:fingers.length,handAndFingerAttachment:true,followJointRotation:true});
   }
   return {ok:true,models:results};
 }
 if(phase==='binding-view'){
   host.selectedCharacter=host.project.characters.indexOf(fbx);host.activePanel='characters';await display();
   const before=JSON.stringify(host.project);document.querySelector('[data-action=binding-view-open]').click();
   for(let i=0;i<100&&!host.stage.bindingView.enabled;i++)await new Promise(resolve=>setTimeout(resolve,50));
   assert(host.stage.bindingView.enabled&&document.querySelector('.binding-view-mode'),'Binding camera not enabled');
   const canvas=host.stage.renderer.domElement,camera=host.stage.camera,rect=canvas.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
   assert(document.elementFromPoint(x,y)===canvas,'Binding overlay intercepts the canvas');
   const set=canvas.setPointerCapture,release=canvas.releasePointerCapture;canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
   const drag=(shift=false)=>{canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:100,pointerType:'mouse',button:0,clientX:x,clientY:y,shiftKey:shift,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:100,pointerType:'mouse',button:0,buttons:1,clientX:x+40,clientY:y+20,shiftKey:shift,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:100,pointerType:'mouse',button:0,clientX:x+40,clientY:y+20,shiftKey:shift,bubbles:true}));};
   const start=camera.position.clone();drag();assert(camera.position.distanceTo(start)>.01,'Dragging did not rotate view');
   const target=host.stage.bindingView.controls.target.clone();drag(true);assert(host.stage.bindingView.controls.target.distanceTo(target)>.01,'Shift drag did not pan');
   const distance=camera.position.distanceTo(host.stage.bindingView.controls.target);canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:x,clientY:y,bubbles:true,cancelable:true}));assert(camera.position.distanceTo(host.stage.bindingView.controls.target)<distance,'Wheel did not zoom');
   canvas.setPointerCapture=set;canvas.releasePointerCapture=release;
   document.querySelector('[data-action=binding-view-bone]').click();await host.updatePreview();await new Promise(resolve=>setTimeout(resolve,200));
   const record=host.stage.visibleRecords.get(`gallery:${fbx.id}`),bone=propBone(record,fbx.props[0].bone);assert(host.stage.bindingView.controls.target.distanceTo(bone.getWorldPosition(new THREE.Vector3()))<.001,'Focus missed binding joint');
   const position=camera.position.clone(),aim=host.stage.bindingView.controls.target.clone();
   const fine=document.querySelector(`[data-prop-transform="${fbx.props[0].id}"][data-vector=position][data-axis="0"][data-mode=fine]`);fine.value='1';fine.dispatchEvent(new Event('input',{bubbles:true}));fine.dispatchEvent(new Event('change',{bubbles:true}));await host.updatePreview();
   assert(camera.position.distanceTo(position)<1e-8&&host.stage.bindingView.controls.target.distanceTo(aim)<1e-8,'Fine adjustment reset the camera');
   fbx.props[0].position[0]-=.001;await host.updatePreview();assert(JSON.stringify(host.project)===before,'Camera inspection changed saved actor transforms');
   host.stage.setRenderSettings({...host.project.render,antialias:'off'});await host.updatePreview();
   assert(host.stage.bindingView.enabled&&host.stage.bindingView.canvas===host.stage.renderer.domElement,'Changing render quality detached view controls');
   host.stage.bindingView.focusBone(propBone(record,fbx.props[0].bone));
   assert(document.querySelector('#title-preview').classList.contains('hidden'),'Title menu covers binding view');
   host.renderInspector();document.querySelector('.prop-editor').scrollIntoView({block:'start'});await host.save();
   return {ok:true,fullViewport:true,rotate:true,pan:true,zoom:true,focusBone:true,adjustmentPreservesView:true,actorUnchanged:true,renderQualityCompatible:true};
 }
 if(phase==='binding-view-exit'){
   host.activePanel='story';host.selectedStep=0;await display();assert(!host.stage.bindingView.enabled&&!document.querySelector('.binding-view-mode'),'Inspection camera leaked into game scene');
   const env=host.project.environments.find(e=>e.id===host.act().environmentId);assert(host.stage.camera.position.distanceTo(new THREE.Vector3(...env.camera.position))<1e-8,'Game camera was changed by inspection');
   return {ok:true,gameCameraRestored:true};
 }
 if(phase==='player-props'){
   assert(host.mode==='player','Not a standalone player');await host.showTitleScene(true);
   assert(host.stage.visibleRecords.size===4&&!document.querySelector('#player-start .title-logo-region'),'Exported title actors or blank logo lost');
   assert(document.querySelectorAll('#player-start .title-bottom-menu button').length===7,'Exported title menu lost');
   document.querySelector('#player-start [data-action=play]').click();
   for(let i=0;i<200&&(host.stage.visibleRecords.get(fbx.id)?.attachedProps?.size!==1||host.stage.visibleRecords.get(vrm.id)?.attachedProps?.size!==1||host.transitioning);i++)await new Promise(resolve=>setTimeout(resolve,100));
   assert(host.stage.visibleRecords.get(fbx.id)?.attachedProps?.size===1&&host.stage.visibleRecords.get(vrm.id)?.attachedProps?.size===1,'Exported dialogue prop not visible');
   return {ok:true,standaloneTitleActors:4,blankLogo:true,menuButtons:7,standaloneDialogueProps:true};
 }
 if(phase==='archive-export'){
   host.project.name='物品绑定与逐句登场示例';await host.save();
   const archive=await host.bridge('saveProjectAs',{project:structuredClone(host.project),name:'物品绑定与逐句登场示例'});
   const game=await host.bridge('exportGame',{folderName:'直接试玩'});return {ok:true,archive,game};
 }
 if(phase==='reopen'){
   assert(host.project.dialogueCastVersion===1 && host.act().steps.length===4 && !host.act().cast,'Dialogue structure was not saved');
   assert(Math.abs(host.act().steps[1].cast.left.offsetZ-.03)<1e-8 && host.act().steps[0].cast.left.offsetZ!==.03,'Dialogue transforms were not preserved');
   assert(host.project.title.actors.length===4&&host.project.title.logoImageId==='__none__'&&host.project.title.actors[1].offsetZ===.03,'Title settings were not saved');
   host.selectedStep=0;host.activePanel='story';await display();assert(host.stage.visibleRecords.get(fbx.id).attachedProps.size===1 && host.stage.visibleRecords.get(vrm.id).attachedProps.size===1,'Saved attachments were not restored');
   return {ok:true,reopened:true,propsSaved:true,dialogueCastSaved:true,titleActorsSaved:true};
 }
 throw Error('Unknown prop smoke phase');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeV024=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 if(phase==='alpha')return verifyImageAlpha();
 if(phase==='names'){await host.bridge('openEditorModule',{module:'render',project:structuredClone(host.project),revision:host.changeRevision,view:{selectedAct: host.selectedAct,selectedStep: host.selectedStep}});return {ok:true};}
 if(phase==='feet'){
  host.stage.running=false;cancelAnimationFrame(host.stage.frame);const results=[];
  try{
   for(const type of ['vrm','fbxCharacter']){
    const role=host.project.characters.find(c=>host.asset(c.modelId)?.type===type);assert(role,'没有 '+type+' 测试角色');
    const record=await host.stage.loadModel(host.asset(role.modelId),'foot-check-'+type);record.vrm.scene.visible=true;
    const hips=record.vrm.humanoid.getNormalizedBoneNode('hips'),rest=hips.position.clone(),scale=hips.parent.getWorldScale(new THREE.Vector3()).y,amplitude=.025/scale;
    const clip=new THREE.AnimationClip('待机脚漂移检查',1,[new THREE.VectorKeyframeTrack(hips.uuid+'.position',[0,.25,.5,.75,1],[...rest.toArray(),rest.x+amplitude,rest.y+amplitude,rest.z,...rest.toArray(),rest.x-amplitude,rest.y-amplitude,rest.z,...rest.toArray()])]);
    const motion={id:'foot-check-'+type,name:'待机脚漂移检查'},measure=()=>{let first,maxDrift=0,rawDrift=0;const raw=record.vrm.humanoid.getRawBoneNode?.('leftFoot')||record.vrm.humanoid.getNormalizedBoneNode('leftFoot');let firstRaw;
     for(let i=0;i<180;i++){host.stage.restoreFootPose(record);record.mixer.update(1/60);host.stage.applyMotionPlacement(record);host.stage.applyFootLock(record);record.vrm.update(1/60);host.stage.applyRawFootLock(record);record.anchor.updateMatrixWorld(true);const points=['leftFoot','rightFoot'].map(name=>record.vrm.humanoid.getNormalizedBoneNode(name).getWorldPosition(new THREE.Vector3()));first||=points.map(p=>p.clone());points.forEach((p,j)=>maxDrift=Math.max(maxDrift,p.distanceTo(first[j])));const point=raw.getWorldPosition(new THREE.Vector3());firstRaw||=point.clone();rawDrift=Math.max(rawDrift,point.distanceTo(firstRaw));}return {maxDrift,rawDrift};};
    host.stage.poseRecord(record,clip,motion,false,{feet:'lock',placement:'inPlace'});assert(record.footLock,'固定开关没有生效');const locked=measure();assert(locked.maxDrift<.001&&locked.rawDrift<.003,type+' 固定后脚仍在漂：'+JSON.stringify(locked));
    host.stage.poseRecord(record,clip,motion,false,{feet:'free',placement:'inPlace'});assert(!record.footLock,'关闭固定后仍锁定');const free=measure();assert(free.maxDrift>.005,'跟随动作被固定了');results.push({type,locked,free});record.vrm.scene.visible=false;
   }
   const first=host.act().steps[0];first.cast||=emptyDialogueCast();const slot=Object.keys(first.cast).find(slot=>first.cast[slot]?.characterId)||'center';first.cast[slot].motionOptions={...(first.cast[slot].motionOptions||{}),feet:'lock'};host.selectedStep=0;host.renderInspector();const feetControl=document.querySelector('[data-motion-setting=feet]');assert(feetControl,'脚掌选项没显示');for(let parent=feetControl.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;feetControl.scrollIntoView({block:'center'});host.markDirty();return {ok:true,realVRMAndFBX:true,optional:true,results};
  }finally{host.stage.running=true;host.stage.animate();}
 }
 if(phase==='save-start'){
  host.markDirty();window.__v024SaveDone=null;window.__v024SaveFrames=0;const tick=()=>{if(window.__v024SaveDone!==null)return;window.__v024SaveFrames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  host.save().then(()=>window.__v024SaveDone={ok:true}).catch(error=>window.__v024SaveDone={error:error.message});await wait(80);
  assert(host.editorSaveNotice.active&&!document.querySelector('#editor-save-notice').hidden,'没有保存动画');assert(document.querySelector('[data-action=play]').disabled,'保存时试玩按钮仍可点击');return {ok:true,animationVisible:true,playDisabled:true};
 }
 if(phase==='save-finish'){
  for(let i=0;i<3600&&window.__v024SaveDone===null;i++)await wait(50);assert(window.__v024SaveDone?.ok,'保存失败');await wait(80);assert(!host.editorSaveNotice.active&&document.querySelector('#editor-save-notice').hidden,'保存结束动画没有消失');assert(!document.querySelector('[data-action=play]').disabled,'保存后试玩按钮没有恢复');assert(window.__v024SaveFrames>2,'保存时界面卡死');return {ok:true,completed:true,frames:window.__v024SaveFrames,playRestored:true,feetPersisted:host.project.acts[0].steps[0].cast};
 }
 if(phase==='save-failure'){
  let failed=false;try{await host.bridge('saveProject',{project:null});}catch{failed=true;}await wait(80);assert(failed&&!host.editorSaveNotice.active&&document.querySelector('#editor-save-notice').hidden,'保存失败后提示没有解除');return {ok:true,failureClearsBusy:true};
 }
 if(phase==='environment'){
  const portrait=host.project.assets.find(a=>a.generatedPortrait&&a.characterId===host.project.characters.find(c=>host.isFbxModel(c.modelId))?.id)||host.project.assets.find(a=>a.generatedPortrait);assert(portrait,'没有透明人物头像');
  const env=createEnvironment('透明图片修复检查');env.nodes=env.nodes.slice(0,1);env.nodes.push({id:host.uid(),kind:'imagePlane',name:portrait.name,assetId:portrait.id,parentId:null,position:[0,1.5,0],rotation:[0,0,0],scale:[1,1,1],width:2.5,height:2.5,unlit:true,alphaCutoff:0});env.camera={position:[0,1.6,5.5],target:[0,1.5,0],fov:32};
  await host.bridge('openEnvironment',{projectId:host.project.id,environment:env,environments:[env],assets:host.project.assets,referenceSettings:{},environmentLibrary:{folders:[],assignments:{}}});return {ok:true};
 }
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeDialogueCamera=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 if(phase==='editor'){
  host.activePanel='story';host.selectedAct=0;host.selectedStep=0;host.renderSidebar();host.renderInspector();await host.updatePreview();const before=snapshotCamera(host.stage.camera);
  document.querySelector('[data-action=edit-dialogue-camera]').click();for(let i=0;i<200&&!host.dialogueCamera.editing;i++)await wait(20);assert(host.dialogueCamera.editing,'没有进入镜头编辑');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));host.dialogueCamera.moveKeys(.5);document.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW',bubbles:true}));
  const viewport=document.querySelector('.stage-frame');viewport.dispatchEvent(new MouseEvent('mousemove',{clientX:200,clientY:250,bubbles:true}));viewport.dispatchEvent(new MouseEvent('mousemove',{clientX:230,clientY:265,bubbles:true}));viewport.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
  assert(!host.dialogueCamera.editing&&host.step().camera,'左键没有确认镜头');assert(new THREE.Vector3().fromArray(before.position).distanceTo(new THREE.Vector3().fromArray(host.step().camera.position))>1,'WASD 没有移动');assert(document.querySelector('#toast').textContent.includes('视角已应用当前对白'),'没有应用提示');
  const first=structuredClone(host.step().camera);host.act().steps[1].camera={...structuredClone(first),position:[first.position[0]+6,first.position[1],first.position[2]]};host.markDirty();await host.save();return {ok:true,wasd:true,leftConfirm:true,perDialogue:true};
 }
 if(phase==='export'){await host.bridge('exportGame',{folderName:'对白镜头试玩'});return {ok:true,exported:true};}
 if(phase==='player'){
  host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;host.cameraActId='';await host.showPlayStep();host.finishTyping();assert(host.stage.camera.position.distanceTo(new THREE.Vector3().fromArray(host.project.acts[0].steps[0].camera.position))<.001,'初始对白镜头丢失');
  host.playStep=1;const pending=host.showPlayStep();for(let i=0;i<200&&!host.dialogueCamera.moving;i++)await wait(20);assert(host.dialogueCamera.moving,'没有平滑移动');document.querySelector('.stage-frame').click();await pending;assert(host.stage.camera.position.distanceTo(new THREE.Vector3().fromArray(host.project.acts[0].steps[1].camera.position))<.001,'点击没有瞬移');
  host.playStep=0;const begin=performance.now();await host.showPlayStep();assert(performance.now()-begin>500,'自然过渡过快');host.finishTyping();host.renderSettingsModal();const slider=document.querySelector('[data-camera-speed]');assert(slider,'没有玩家镜头速度设置');slider.value='115';slider.dispatchEvent(new Event('input',{bubbles:true}));assert(host.cameraSpeed===1.15,'速度滑动条无效');host.closePlayerModal();return {ok:true,savedCamera:true,smoothTravel:true,clickSkip:true,playerSpeed:true};
 }
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokePortrait35=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='setup'){
  await Promise.all([...host.portraitJobs.values()]);const pool=host.project.characters.filter(c=>host.asset(c.modelId)?.type==='vrm'),role=pool[2]||pool[0];assert(role,'Need VRM');
  const source=host.project.acts.find(a=>!isEvent(a)&&a.environmentId),cast=emptyDialogueCast();cast.center={characterId:role.id,motionId:'',motionOptions:{loop:true,placement:'inPlace',feet:'lock'},size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0,expressionWeights:{},props:[]};
  const line={id:host.uid(),speaker:role.name,characterId:role.id,text:'头像保留自然的点头和歪头，整个人转身时仍从正面拍摄。',cast,choices:[],camera:{position:[0,1.35,4.3],target:[0,1.05,0],fov:32}};
  host.project.acts=[{...structuredClone(source||{}),id:host.uid(),name:'头像自然动作测试',cast:emptyDialogueCast(),castSettings:{},steps:[line]}];host.project.title={actors:[],logoImageId:'__none__'};host.project.ui.gameTheme='pop';host.project.ui.dialogueImageId='';host.project.id='portrait35-'+host.uid();host.lifetimeProgress=null;host.mode='player';host.playing=false;host.renderPlayer();host.audioSettings.master=0;host.applyAudioSettings();await wait(300);host.playing=true;host.titleRequest++;host.playAct=host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();await wait(300);host.stage.renderSuspended=true;
  const record=host.stage.livePortrait.record,head=record?.vrm.humanoid.getNormalizedBoneNode('head'),neck=record?.vrm.humanoid.getNormalizedBoneNode('neck'),hips=record?.vrm.humanoid.getNormalizedBoneNode('hips');assert(record&&head&&hips,'Live portrait missing');
  window.__portrait35Data={record,head,neck,hips,headRest:head.quaternion.clone(),neckRest:neck?.quaternion.clone(),hipsRest:hips.quaternion.clone()};
  host.paintPortrait35();window.__portrait35Data.cameraPosition=host.stage.livePortrait.camera.position.clone();window.__portrait35Data.cameraRotation=host.stage.livePortrait.camera.quaternion.clone();window.__portrait35Data.tip=new THREE.Vector3(0,.12,.06).applyMatrix4(head.matrixWorld).project(host.stage.livePortrait.camera);
  assert(record===host.stage.visibleRecords.get(role.id),'Extra actor instance');return{ok:true,role:role.name,sameModel:true,bodyFraming:true};
 }
 const data=window.__portrait35Data,{record,head,neck,hips}=data;
 function stableCamera(){assert(host.stage.livePortrait.camera.position.distanceTo(data.cameraPosition)<1e-6,'Camera followed head position');assert(host.stage.livePortrait.camera.quaternion.angleTo(data.cameraRotation)<1e-6,'Camera cancelled head rotation');}
 if(phase==='nod'){
  head.quaternion.copy(data.headRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.42));const pose=head.quaternion.toArray();host.paintPortrait35();stableCamera();const tip=new THREE.Vector3(0,.12,.06).applyMatrix4(head.matrixWorld).project(host.stage.livePortrait.camera);assert(tip.distanceTo(data.tip)>.02,'Nod not visible');assert(head.quaternion.toArray().every((v,i)=>Math.abs(v-pose[i])<1e-10),'Portrait changed bones');return{ok:true,nodVisible:true,cameraDoesNotCancelNod:true,projectedMotion:tip.distanceTo(data.tip)};
 }
 if(phase==='tilt'){
  head.quaternion.copy(data.headRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.3));if(neck)neck.quaternion.copy(data.neckRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.18));host.paintPortrait35();stableCamera();const tip=new THREE.Vector3(0,.12,.06).applyMatrix4(head.matrixWorld).project(host.stage.livePortrait.camera);assert(tip.distanceTo(data.tip)>.05,'Tilt not visible');return{ok:true,tiltAndNeckMotionVisible:true,cameraDoesNotPinHead:true,projectedMotion:tip.distanceTo(data.tip)};
 }
 if(phase==='body-turn'){
  head.quaternion.copy(data.headRest);if(neck)neck.quaternion.copy(data.neckRest);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){hips.quaternion.copy(data.hipsRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle));const before=hips.quaternion.toArray();host.paintPortrait35();const frame=portraitBodyFrame(record),direction=host.stage.livePortrait.camera.position.clone().sub(frame.target).normalize();assert(direction.dot(new THREE.Vector3(0,0,1).applyQuaternion(frame.orientation))>.85,'Back-facing portrait');assert(hips.quaternion.toArray().every((v,i)=>Math.abs(v-before[i])<1e-10),'Changed body motion');}
  hips.quaternion.copy(data.hipsRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));host.paintPortrait35();return{ok:true,fourBodyDirections:true,bodyTurnsRemainFrontFacing:true,scenePoseUnchanged:true};
 }
 if(phase==='animation'){
  hips.quaternion.copy(data.hipsRest);head.quaternion.copy(data.headRest);if(neck)neck.quaternion.copy(data.neckRest);record.vrm.update(0);
  const rest=data.headRest.toArray(),nod=data.headRest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.42)).toArray(),tracks=record.idleClip.tracks.filter(t=>![head.name+'.quaternion',head.uuid+'.quaternion'].includes(t.name)).map(t=>t.clone());tracks.push(new THREE.QuaternionKeyframeTrack(head.name+'.quaternion',[0,.5,1],[...rest,...nod,...rest]));
  host.stage.poseRecord(record,new THREE.AnimationClip('点头动作验证',1,tracks),{id:'test-portrait35',name:'点头'},false,{loop:true,placement:'inPlace',feet:'free'});const samples=[];
  for(const time of [0,.2,.4,.6,.8]){host.stage.restoreFootPose(record);record.mixer.setTime(time);host.stage.applyMotionPlacement(record);host.paintPortrait35();samples.push({camera:host.stage.livePortrait.camera.quaternion.clone(),relative:host.stage.livePortrait.camera.quaternion.clone().invert().multiply(head.getWorldQuaternion(new THREE.Quaternion()))});}
  const range=Math.max(...samples.map(s=>s.relative.angleTo(samples[0].relative))),cameraRange=Math.max(...samples.map(s=>s.camera.angleTo(samples[0].camera)));assert(range>.2&&cameraRange<1e-5,'Mixer motion cancelled by camera');return{ok:true,realMixerMotionVisible:true,headAngleRange:range,cameraAngleRange:cameraRange};
 }
 throw Error('Unknown portrait phase');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeBlink49=async phase=>{
 const {runBlinkSmoke}=await import('../blink-smoke.js');return runBlinkSmoke(phase,{
  blank:()=>host.defaultProject('自动眨眼验证'),cast:emptyDialogueCast,asset: host.asset,project:()=>host.project,stage:()=>host.stage,
  setProject:p=>{host.project=p;host.normalize();host.lifetimeProgress=null;},
  start:async()=>{host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,400));host.audioSettings.master=0;host.applyAudioSettings();host.playing=true;host.titleRequest++;host.playAct=host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();},
  save:()=>host.bridge('saveProject',{project:structuredClone(host.project)})
 });
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeGaze50=async phase=>{
 const {runGazeSmoke}=await import('../gaze-smoke.js');return runGazeSmoke(phase,{
  cast:emptyDialogueCast,asset: host.asset,project:()=>host.project,stage:()=>host.stage,
  start:async()=>{host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,400));host.audioSettings.master=0;host.applyAudioSettings();host.playing=true;host.titleRequest++;host.playAct=host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();},
  save:()=>host.bridge('saveProject',{project:structuredClone(host.project)})
 });
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeSecondary53=async phase=>{const{secondarySmoke}=await import('../secondary-smoke.js');return secondarySmoke(phase,{blank:()=>host.defaultProject('衣发物理验证'),cast:emptyDialogueCast,project:()=>host.project,asset: host.asset,stage:()=>host.stage,inspect:async()=>{host.mode='editor';host.modulePanel='characters';host.activePanel='characters';host.selectedCharacter=0;host.renderEditor();host.renderInspector();const node=document.querySelector('[data-secondary-collision]');if(!node)throw Error('Missing automatic collision setting');const role=host.project.characters[0];const defaultOn=node.value==='on';node.value='off';node.dispatchEvent(new Event('input',{bubbles:true}));if(role.secondaryCollision!==false)throw Error('Disable setting not saved');node.value='on';node.dispatchEvent(new Event('input',{bubbles:true}));if(role.secondaryCollision!==true)throw Error('Enable setting not saved');return{ok:true,defaultOn,disableAndEnable:true,serialized:JSON.parse(JSON.stringify(role)).secondaryCollision};},setProject:p=>{host.project=p;host.normalize();host.lifetimeProgress=null;},start:async()=>{host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,400));host.audioSettings.master=0;host.applyAudioSettings();host.playing=true;host.titleRequest++;host.playAct=host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();}});};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeMmd36=async phase=>{
 const {runMmdSmoke}=await import('../mmd-smoke.js');return runMmdSmoke(phase,{
  blank:()=>host.defaultProject('MMD 模型测试'),cast:emptyDialogueCast,asset: host.asset,project:()=>host.project,stage:()=>host.stage,roleDetails:()=>host.roleDetails,
  setProject:p=>{host.project=p;host.normalize();host.lifetimeProgress=null;},
  start:async()=>{host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,400));host.audioSettings.master=0;host.applyAudioSettings();host.playing=true;host.titleRequest++;host.playAct=host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();},
  details:async()=>{for(const role of host.project.characters)host.rememberDiscovery('character',role.id);return host.openRoleDetails();},
  editor:async()=>{host.playing=false;host.mode='editor';host.activePanel='characters';host.selectedCharacter=0;host.renderEditor();host.markDirty();},save: host.save
 });
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeThumbnail37=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='tiles'){
  host.playing=false;host.mode='editor';host.project.assets.push(...window.__thumbnail37Imported);const models=host.project.assets.filter(a=>a.type==='mmdCharacter');assert(models.length===3,'Need three MMD models');for(const model of models)host.project.characters.push({id:host.uid(),name:model.name,modelId:model.id,props:[],stories:[]});host.normalize();host.activePanel='characters';host.selectedCharacter=host.project.characters.findIndex(c=>c.modelId===models[0].id);host.activeAssetType='mmdCharacter';host.renderEditor();
  host.modelThumbnails.refresh(host.project.assets.filter(a=>['mmdCharacter','fbxCharacter'].includes(a.type)));await host.modelThumbnails.ready;host.renderAssetDock();await wait(300);const generated=host.project.assets.filter(a=>['mmdCharacter','fbxCharacter'].includes(a.type));assert(generated.every(a=>a.thumbnailPath),'MMD or FBX thumbnail missing');assert(document.querySelectorAll('.model-thumbnail').length===3,'MMD tile does not use image');for(const image of document.querySelectorAll('.model-thumbnail')){await image.decode();assert(image.naturalWidth===512,'Wrong thumbnail dimensions');}window.__thumbnail37Path=models[0].thumbnailPath;return {ok:true,models:generated.map(a=>({type:a.type,path:a.thumbnailPath})),mmdTileImages:3};
 }
 if(phase==='folder'){
  host.project.assets.push(...window.__thumbnail37Folder);const model=window.__thumbnail37Folder.find(a=>a.type==='mmdCharacter');assert(model.thumbnailSource==='folder'&&model.thumbnailPath,'Existing avatar ignored');const before=model.thumbnailPath;host.modelThumbnails.refresh([model]);await host.modelThumbnails.ready;assert(model.thumbnailPath===before&&model.thumbnailSource==='folder','Existing avatar replaced');host.renderAssetDock();await wait(200);return {ok:true,existingFolderAvatarCopied:true,notRephotographed:true};
 }
 if(phase==='mouth'){
  const role=host.project.characters.find(c=>host.asset(c.modelId)?.type==='mmdCharacter'),record=await host.stage.loadModel(host.asset(role.modelId),role.id),manager=record.vrm.expressionManager,mesh=record.vrm.mesh;host.stage.renderSuspended=true;
  manager.setValue('aa',.8);manager.setValue('あ',.95);manager.setValue('口横広げ',.8);manager.setValue('happy',.6);record.vrm.update(0);const aa=mesh.morphTargetDictionary['あ'],corner=mesh.morphTargetDictionary['口角上げ'];assert(mesh.morphTargetInfluences[aa]>.9,'Authored mouth absent');
  host.stage.visibleRecords.set(role.id,record);host.stage.startTalking(role.id,true);for(let i=0;i<12;i++){record.talkingMouth.restore();record.talkingMouth.update(.05);record.vrm.update(0);assert(mesh.morphTargetInfluences[aa]<.7,'Authored mouth stacked');if(corner!==undefined)assert(mesh.morphTargetInfluences[corner]===0,'Smile mouth stacked');}
  host.stage.stopTalking();assert(mesh.morphTargetInfluences[aa]>.9,'Authored mouth not restored');if(corner!==undefined)assert(Math.abs(mesh.morphTargetInfluences[corner]-.6)<1e-6,'Mouth corner not restored');manager.resetValues();record.vrm.update(0);return {ok:true,rawAndPresetMouthReplacedDuringSpeech:true,immediateRestoration:true};
 }
 if(phase==='save'){host.stage.renderSuspended=false;host.markDirty();await host.save();return {ok:true,thumbnailDependencies:host.project.assets.filter(a=>a.modelThumbnail).length};}
 if(phase==='reopen'){host.playing=false;host.mode='editor';host.activeAssetType='mmdCharacter';host.renderEditor();const models=host.project.assets.filter(a=>['mmdCharacter','fbxCharacter'].includes(a.type));assert(models.length>=5&&models.every(a=>a.thumbnailPath),'Reopened thumbnails missing');assert(host.project.assets.filter(a=>a.modelThumbnail).length>=5,'Thumbnail files not saved');host.renderAssetDock();for(const image of document.querySelectorAll('.model-thumbnail'))await image.decode();return {ok:true,persistedThumbnails:true,images:document.querySelectorAll('.model-thumbnail').length};}
 throw Error('Unknown thumbnail smoke');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokePhysics38=async phase=>{const {physicsSmoke}=await import('../physics-smoke.js');return physicsSmoke(phase,{project:()=>host.project,asset: host.asset,stage:()=>host.stage,clear:async()=>{host.stage.clearLivePortrait();host.stage.clear();},save:()=>host.bridge('saveProject',{project:structuredClone(host.project)}),start:async()=>{host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,400));host.playing=true;host.titleRequest++;host.playAct=host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();await new Promise(r=>setTimeout(r,200));}});};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeJitter39=async phase=>{const {jitterProbe}=await import('../jitter-smoke.js');return jitterProbe(phase,{project:()=>host.project,stage:()=>host.stage});};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeUi34=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='picker'){
  await Promise.all([...host.portraitJobs.values()]);host.renderGameUiPicker();assert(document.querySelectorAll('#game-ui-picker .game-ui-options input[type=radio]').length===4,'Four presets missing');document.querySelector('#game-ui-picker input[value="astral"]').checked=true;document.querySelector('[data-action="apply-game-ui"]').click();assert(host.project.ui.gameTheme==='astral','Fourth preset not applied');host.renderGameUiPicker();return{ok:true,fourPresets:true,oneCombinedNewStyle:true};
 }
 if(phase==='reopen'){
  assert(host.project.ui.gameTheme==='astral','New style lost on save/export');host.mode='player';host.playing=false;host.renderPlayer();await wait(900);assert(document.querySelector('.player').dataset.gameUi==='astral','Player did not apply style');return{ok:true,persistedStyle:'astral'};
 }
 if(phase==='title'){
  document.querySelector('#game-ui-picker')?.remove();host.project.id='ui34-test-'+host.uid();host.lifetimeProgress=null;host.project.ui.dialogueImageId='';host.mode='player';host.playing=false;host.renderPlayer();host.audioSettings.master=0;host.applyAudioSettings();for(let i=0;i<400&&(document.querySelectorAll('.title-bottom-menu button').length!==8||document.querySelector('#act-loading:not(.hidden)'));i++)await wait(50);
  assert(document.querySelectorAll('.title-bottom-menu button').length===8&&document.querySelector('.title-bottom-menu [data-action="role-details"]'),'Role details title entry missing');await host.openRoleDetails();assert(host.roleDetails.roles.length===0&&host.roleDetails.viewer.modelCache.size===0&&document.querySelector('.role-details-empty').textContent.includes('还没有解锁'),'Title decorations unlocked roles');host.closePlayerModal();await wait(250);return{ok:true,originalButtonsPreserved:true,roleDetailsTitleEntry:true,lockedPageLoadsNoModels:true};
 }
 if(phase==='portrait-turn'){
  host.playAct=host.project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);host.playStep=0;host.project.acts[host.playAct].steps[0].itemGrants=[];host.playing=true;host.titleRequest++;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();await wait(400);host.stage.renderSuspended=true;
  const record=host.stage.livePortrait.record,head=record?.vrm.humanoid.getNormalizedBoneNode('head'),hips=record?.vrm.humanoid.getNormalizedBoneNode('hips');assert(head&&hips,'Live VRM missing');const initialHips=hips.quaternion.clone(),initialAnchor=record.anchor.quaternion.clone();
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   hips.quaternion.copy(initialHips).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle));record.vrm.update(0);record.anchor.updateMatrixWorld(true);
   const before=hips.quaternion.clone(),orientation=head.getWorldQuaternion(new THREE.Quaternion()).multiply(record.portraitRestHeadQuaternion.clone().invert());
   host.stage.stylePipeline.render(0);host.stage.livePortrait.render(host.stage.renderer,host.stage.scene,host.stage.element);
   const relative=host.stage.livePortrait.camera.position.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize();assert(relative.dot(new THREE.Vector3(0,0,1).applyQuaternion(orientation))>.85,'Avatar turned its back');assert(hips.quaternion.toArray().every((n,i)=>Math.abs(n-before.toArray()[i])<1e-10)&&record.anchor.quaternion.toArray().every((n,i)=>Math.abs(n-initialAnchor.toArray()[i])<1e-10),'Portrait moved the scene actor');
  }
  hips.quaternion.copy(initialHips).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));record.vrm.update(0);record.anchor.updateMatrixWorld(true);host.stage.stylePipeline.render(0);host.stage.livePortrait.render(host.stage.renderer,host.stage.scene,host.stage.element);
  assert(host.stage.livePortrait.record===record&&host.stage.visibleRecords.has(record.vrm===host.stage.vrm?host.stage.portraitActorKey:host.stage.portraitActorKey),'Did not reuse actor');return{ok:true,animatedTurnsTested:4,portraitFacesPlayer:true,sceneActorUnchanged:true,sameModelAndExpressions:true};
 }
 if(phase==='dialogue'){
  host.showDialogue('角色 · 星曜剧场','这是一套融合后的游戏界面。\n金色姓名、白色对白，场景保持清晰。',true,host.project.acts[host.playAct].steps[host.playStep].characterId);host.finishTyping();await wait(500);assert(getComputedStyle(document.querySelector('#dialogue-speaker')).color==='rgb(244, 210, 116)','Name is not gold');assert(document.querySelectorAll('#play-controls button').length===8,'Game controls changed');return{ok:true,goldenName:true,framelessDialogue:true,existingControls:true};
 }
 if(phase==='settings'){
  host.renderSettingsModal();await wait(350);assert(document.querySelector('[data-graphics]')&&document.querySelector('[data-volume]')&&document.querySelector('[data-camera-speed]'),'Settings missing');return{ok:true,existingSettings:true};
 }
 if(phase==='save'){
  host.closePlayerModal();await wait(250);host.stage.renderSuspended=true;const baseline=await captureSaveThumbnail(document.querySelector('.player .stage-frame'),payload=>host.bridge('captureGameThumbnail',payload));assert(validSaveThumbnail(baseline),'Native screenshot failed');host.renderSaveModal('save');const probe=document.querySelector('.modal-box');probe.style.background='#00ff5a';probe.style.boxShadow='0 0 0 30px #00ff5a';await host.saveSlot(1);const slot=host.readSaveSlots()[1];assert(validSaveThumbnail(slot?.thumbnail),'Manual save image missing');await host.saveAutoSlot();assert(validSaveThumbnail(host.readSaveSlots()[0]?.thumbnail),'Auto save image missing');assert(document.querySelectorAll('.save-thumb img').length===2,'Thumbnails not shown');
  const bitmap=await createImageBitmap(await fetch(slot.thumbnail).then(r=>r.blob()));assert(bitmap.width===320&&bitmap.height===180,'Screenshot is not 16:9');const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,320,180).data;assert(Math.max(...pixels.filter((_,i)=>i%4===0))-Math.min(...pixels.filter((_,i)=>i%4===0))>30,'Screenshot is blank');let green=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<40&&pixels[i+1]>200&&pixels[i+2]>45&&pixels[i+2]<140)green++;assert(green<288,'Save menu color probe leaked into screenshot');bitmap.close();window.__ui34Thumbnail=slot.thumbnail;
  host.renderSaveModal('load');assert(document.querySelector('[data-action="load-slot"][data-index="1"] img'),'Read screen lost thumbnail');await wait(350);return{ok:true,manualAndAutoImages:true,gameScreenshotWithoutMenus:true,jpegDimensions:[320,180],storedBytes:slot.thumbnail.length,readScreenThumbnail:true};
 }
 if(phase==='gallery'){
  host.closePlayerModal();await wait(220);const originals=host.project.characters.filter(c=>host.asset(c.modelId)),base=originals.find(c=>host.asset(c.modelId).type==='vrm');assert(originals.length>=3,'Need three roles');
  for(const role of originals){role.detailsIdleId='';host.rememberDiscovery('character',role.id);}
  while(host.project.characters.length<14){const copy={...structuredClone(base),id:host.uid(),name:'队列测试 '+host.project.characters.length,detailsIdleId:''};host.project.characters.push(copy);host.rememberDiscovery('character',copy.id);}
  const locked={...structuredClone(base),id:host.uid(),name:'绝不能显示的角色'};host.project.characters.push(locked);await host.openRoleDetails();const viewer=host.roleDetails.viewer,renderer=viewer.renderer;
  assert(!document.querySelector('#role-details').textContent.includes(locked.name)&&!viewer.modelCache.has('details:'+locked.id),'Locked role was exposed');assert(host.roleDetails.roles.length===14,'Locked role not filtered');assert(!document.querySelector('#role-details [data-action="gallery-character"]'),'Role-name buttons remain');
  await host.roleDetails.select(6);assert(viewer.modelCache.size===11&&viewer.visibleRecords.size<=5,'Neighbour cache is not bounded');assert(host.roleDetails.viewer.renderer===renderer,'Selection recreated renderer');const centre=viewer.visibleRecords.get('details:'+host.roleDetails.roles[6].id);assert(centre&&Math.abs(centre.anchor.rotation.y)<.001&&Math.abs(centre.anchor.position.x)<.001,'Current role not front-centred');
  const time=centre.currentAction.time;await wait(400);assert(Math.abs(centre.currentAction.time-time)>.01&&centre.mixer.timeScale===1,'Role froze on a frame');
  const canvas=document.querySelector('.role-details-canvas');canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:60,bubbles:true,cancelable:true}));await host.roleDetails.ready;assert(host.roleDetails.index===7,'Mouse wheel did not switch');canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:500,clientY:300,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,button:0,clientX:580,clientY:300,bubbles:true}));await host.roleDetails.ready;assert(host.roleDetails.index===6,'Swipe did not switch');assert(viewer.modelCache.size<=11&&!viewer.modelCache.has('details:'+locked.id),'Cache window leaked');
  host.closePlayerModal();assert(!viewer.running&&!host.roleDetails.isOpen,'Details close leaked renderer');host.project.characters=originals;
  originals[0].description='角色简介显示在左侧。切换角色时，介绍会一起更新。';originals[0].stories=[{text:'这是角色故事的展示位置。作者可以在角色编辑器里填写每个人的经历。',unlockLines:0},{text:'未解锁的故事内容不应显示',unlockLines:1000}];await host.openRoleDetails();await host.roleDetails.select(0);assert(document.querySelector('.role-story-locked')&&!document.querySelector('.role-details-stories').textContent.includes('未解锁的故事内容不应显示'),'Story unlock rule lost');const middle=Math.min(2,originals.length-1);originals[middle].description=originals[0].description;originals[middle].stories=structuredClone(originals[0].stories);await host.roleDetails.select(middle);await wait(500);
  return{ok:true,lockedRolesCompletelyHidden:true,upToElevenCached:true,onlyOnscreenRolesDrawn:true,singleRendererForSwitches:true,liveIdle:true,frontCentre:true,wheelAndSwipe:true,closeDisposes:true,storyUnlockPreserved:true};
 }
 if(phase==='progress'){
  host.closePlayerModal();await wait(220);host.renderProgressModal();await wait(350);assert(document.querySelectorAll('.chapter-card').length,'Chapter cards missing');return{ok:true,chapterCardsPreserved:true};
 }
 if(phase==='export'){
  host.playing=false;host.mode='editor';host.closePlayerModal();host.project.assets=[];host.project.characters=[];host.project.assetFolders=[];host.project.environments=[];host.project.items=[];host.project.books=[];host.project.acts=[{id:host.uid(),name:'截图验证',steps:[{id:host.uid(),speaker:'旁白',text:'星曜剧场导出检查。',cast:emptyDialogueCast(),characterId:'',choices:[]}]}];host.project.title={actors:[],logoImageId:'__none__'};host.selectedAct=0;host.selectedStep=0;host.activePanel='story';host.normalize();host.renderEditor();host.markDirty();await host.save();return{ok:true,theme:host.project.ui.gameTheme,exported:await host.bridge('exportGame',{folderName:'UI34导出验证'})};
 }
 throw Error('Unknown UI34 phase');
};

window.__vrmSmokeVrmPortrait28=async()=>{
 const assert=(value,label)=>{if(!value)throw Error(label);},role=host.project.characters.find(c=>host.asset(c.modelId)?.type==='vrm');assert(role,'Missing VRM fixture');
 role.portraitSource='manual';role.portraitId=host.byType('image')[0]?.id||'';host.activePanel='characters';host.selectedCharacter=host.project.characters.indexOf(role);host.renderInspector();assert(!document.querySelector('[data-action=upload-character-portrait]')&&!document.querySelector('[data-action=capture-character-portrait]'),'VRM has photo controls');
 host.activePanel='story';host.selectedAct=0;host.selectedStep=0;host.step().characterId=role.id;host.renderSidebar();host.renderInspector();await host.updatePreview();await host.updateSpeakerPortrait(role.id,true);await new Promise(r=>setTimeout(r,500));
 const node=document.querySelector('#speaker-portrait'),record=host.stage.livePortrait.record;assert(record&&node.classList.contains('live-portrait')&&!node.querySelector('img').getAttribute('src'),'Legacy PNG replaced VRM');const rect=node.getBoundingClientRect(),frame=node.closest('.stage-frame').getBoundingClientRect();assert(rect.height/frame.height>.67,'Portrait height too low');assert(host.stage.livePortrait.camera.top>0.4*record.anchor.getWorldScale(new THREE.Vector3()).y,'Headroom not extended');
 return {ok:true,vrmPhotoControlsRemoved:true,legacyPngIgnored:true,liveModel:true,heightRatio:rect.height/frame.height,headroom:true};
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeCommercial55=async phase=>{
  const {commercialSmoke}=await import('../commercial-smoke.js');
  return commercialSmoke({project:()=>host.project,library:()=>host.library,dirty:()=>host.markDirty(),save: host.save},phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeSpatial40=async phase=>{const{spatialSmoke}=await import('../spatial-smoke.js');return spatialSmoke(phase,{project:()=>host.project,stage:()=>host.stage,save:()=>host.bridge('saveProject',{project:structuredClone(host.project)}),pause:value=>{host.saveModalMode=value?'spatial-test':'';},portrait:()=>host.updateSpeakerPortrait(host.project.acts[0].steps[0].characterId,true),play:async()=>{host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,200));host.playing=true;host.titleRequest++;host.playAct=host.project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();},title:async()=>{if(host.mode!=='player'){host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,200));}host.playing=false;await host.showTitleScene(true);},edit:async()=>{host.playing=false;host.mode='editor';host.closePlayerModal();host.activePanel='story';host.selectedAct=0;host.selectedStep=0;host.renderEditor();host.activePanel='render';host.renderInspector();await host.updatePreview();},titleEditor:async()=>{host.activePanel='title';host.renderInspector();await host.updatePreview();}});};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeDetails43=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);};
 if(phase==='setup'){host.project.id='details43-test-'+host.uid();host.lifetimeProgress=null;host.project.renderPresets=host.project.renderPresets.filter(p=>p.id!=='details43');host.project.renderPresets.push(newRenderPreset('details43','角色详情测试预设',{brightness:120,contrast:105,saturation:110,filters:{rim:.4,posterize:12}}));host.modulePanel=null;host.mode='editor';host.activePanel='story';host.selectedAct=0;host.selectedStep=0;host.renderEditor();await host.updatePreview();await host.bridge('saveProject',{project:structuredClone(host.project)});return{ok:true};}
 if(phase==='details'){
  assert(host.project.ui.roleDetailsRender.presetId==='details43','选择未保存');assert(host.project.ui.roleDetailsRender.brightness===90,'微调未保存');host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,250));for(const role of host.project.characters)host.rememberDiscovery('character',role.id);await host.openRoleDetails();await host.roleDetails.ready;
  const viewer=host.roleDetails.viewer;assert(viewer.renderSettings.filters.rim===.4,'角色详情没用选定预设');assert(document.querySelector('.role-details-canvas').style.filter==='brightness(108%) contrast(115.5%) saturate(88%)','微调未应用到人物');assert(!viewer.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'着色器编译错误');const before=JSON.stringify(host.project.title.render),choice=structuredClone(host.project.ui.roleDetailsRender);host.project.ui.roleDetailsRender=renderSelection();host.roleDetails.applyRender();assert(viewer.renderSettings.filters.rim===0&&viewer.renderSettings.filters.posterize===0,'原始画面没有取消滤镜');host.project.ui.roleDetailsRender=choice;host.roleDetails.applyRender();assert(JSON.stringify(host.project.title.render)===before,'角色详情影响标题');return{ok:true,detailsOwnPreset:true,threeCalibrationApplied:true,rawChoiceWorks:true,titleUnchanged:true,roles:host.roleDetails.roles.length};
 }
 if(phase==='save'){await host.bridge('saveProject',{project:structuredClone(host.project)});return{ok:true,selection:host.project.ui.roleDetailsRender};}throw Error('Unknown details phase');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeAirCombat=async phase=>{
 const {airCombatSmoke}=await import('../aircombat-smoke.js');
 return airCombatSmoke(phase,{
  project:()=>host.project,diagnostics:()=>host.events.diagnostics(),currentId:()=>host.project.acts[host.playAct]?.id,
  setup:async()=>{host.playing=false;host.mode='editor';host.modulePanel=null;host.activePanel='story';host.project.id='aircombat-smoke-'+host.uid();host.project.name='螺旋桨空战示例';host.project.vehicles=[];host.project.assets=[];host.project.characters=[];host.project.items=[];host.project.knowledgeBooks=[];host.project.environments=[];host.project.title={actors:[],logoImageId:'__none__'};const line=(id,text)=>({id,text,speaker:'旁白',characterId:'',choices:[],cast:emptyDialogueCast()});host.project.acts=[{id:'air-intro',name:'出击前',steps:[line('intro-line','一套低面数组件，可以组装单发战斗机或双发轰炸机。请选择空战幕进入拼装和试飞。')]},{id:'air-win',name:'任务成功',steps:[line('win-line','任务完成。友军安全返航。')]},{id:'air-lose',name:'任务失败',steps:[line('lose-line','任务失败。你可以回到空战幕重新挑战。')]}];host.normalize();host.selectedAct=0;host.selectedStep=0;host.editorHistory.reset();host.renderEditor();await host.updatePreview();},
  add:async()=>{await host.handleEventAction('event-add-aircombat',{dataset:{}});await host.bridge('saveProject',{project:structuredClone(host.project)});},action:host.handleEventAction,undo:host.restoreEditorHistory,
  test:node=>host.events.testAir(node),snapshot:()=>host.snapshotSlot(),openSave:()=>host.renderSaveModal('save'),store:snapshot=>host.storeGameSnapshot(19,snapshot),saved:()=>host.readSaveSlots()[19],
  play:async id=>{host.events.cancel();host.closePlayerModal();host.saveModalMode='';host.playing=true;host.playAct=host.project.acts.findIndex(a=>a.id===id);host.playStep=0;host.preparedAct=-1;await host.showPlayStep();},
  load:async snapshot=>{host.playing=false;const slots=Array(20).fill(null);slots[19]=snapshot;localStorage.setItem(host.saveKey(),JSON.stringify(slots));host.loadSlot(19);},
  saveExport:async()=>{host.stopPlay();const a=host.project.acts.find(a=>a.event?.type==='aircombat');a.event.combat.aircraft.name='双发自卫轰炸机';host.project.acts[0].steps[0].choices=[{id:host.uid(),text:'驾驶双发轰炸机出击',actId:a.id,requirements:[],consumeRequired:false}];for(const id of ['air-win','air-lose']){const result=host.project.acts.find(n=>n.id===id);result.steps[0].choices=[{id:host.uid(),text:'返回出击前',actId:'air-intro',requirements:[],consumeRequired:false}];}host.selectedAct=host.project.acts.indexOf(a);host.selectedStep=0;await host.updatePreview();const {voxelPreset,createVehicle}=await import('../vehicle-documents.js');host.project.vehicles=[];const prototypes=Object.fromEntries(['stuka','b25','bf109','shinden'].map(k=>{const bp=voxelPreset(k);return[k,createVehicle(host.project,bp.name,bp)];}));const historicalPreset=k=>structuredClone(prototypes[k].blueprint);const intro=host.project.acts[0],win=host.project.acts.find(n=>n.id==='air-win'),lose=host.project.acts.find(n=>n.id==='air-lose');const samples=['stuka','b25','bf109','shinden'].map(k=>{const n=newEvent(host.uid(),host.uid());n.name=historicalPreset(k).name;n.event=normalizeEvent({type:'aircombat',combat:{aircraft:historicalPreset(k),enemyAircraft:historicalPreset('bf109'),allyAircraft:historicalPreset('b25'),enemies:1,allies:1,mission:'survive',duration:60,difficulty:.4,winActId:'air-win',loseActId:'air-lose'}});return n;});host.project.acts=[intro,...samples,win,lose];intro.steps[0].text='选择一架飞机试飞。鼠标指向控制航向，A/D 辅助转弯，松手自动回正。通过载具编辑器打开单独文件，逐块建造机体并安装活动附件。';intro.steps[0].choices=samples.map(n=>({id:host.uid(),text:n.name,actId:n.id,requirements:[],consumeRequired:false}));host.project.name='方块载具样机_0.0.48';ensureVehicleLibrary(host.project);host.selectedAct=1;host.renderSidebar();host.renderInspector();await host.updatePreview();await host.bridge('saveProject',{project:structuredClone(host.project)});await host.bridge('exportGame',{folderName:'方块载具试玩_0.0.48_'+host.uid().slice(0,6)});}
 });
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmoke51=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='setup'){await window.__vrmSmokeAirCombat('setup');host.selectedAct=0;host.selectedStep=0;host.renderSidebar();host.renderInspector();await host.updatePreview();return{ok:true,openedOldProject:true};}
 if(phase.startsWith('picker-')){host.editorSettings.theme=phase.slice(7);host.applyEditorTheme();document.querySelector('[data-action=choose-editor]').click();await wait(200);const cards=[...document.querySelectorAll('.module-card')];assert(cards.length===7,'编辑器卡片不齐');assert(cards.every(c=>c.getBoundingClientRect().width>100),'卡片挤压');assert(document.documentElement.scrollWidth<=innerWidth+1,'横向溢出');const accent=getComputedStyle(document.body).getPropertyValue('--ui-accent').trim();assert(accent==='#007aff'||accent==='#409cff','主题不是蓝色');return{ok:true,cards:cards.length,theme:document.body.dataset.editorTheme,accent};}
 if(phase==='environment-open'){document.querySelector('[data-picker-close]')?.click();host.editorSettings.theme='system';host.applyEditorTheme();document.querySelector('[data-action=choose-editor]').click();document.querySelector('[data-picker-module=environment]').click();await wait(500);return{ok:true,actualPickerOpenedEnvironment:true};}
 if(phase==='environment-verify'){const e=host.project.environments.find(e=>e.id===host.project.acts[0].environmentId);assert(e?.nodes.filter(n=>n.kind==='water').length===3,'保存水面丢失');assert(e.nodes.some(n=>n.kind==='water'&&n.flowSpeed===2),'水面参数未保存');return{ok:true,savedWater:3,revision:e.revision};}
 if(phase==='vehicle-open'){document.querySelector('[data-action=choose-editor]').click();document.querySelector('[data-picker-module=aircraft]').click();await wait(500);return{ok:true,actualPickerOpenedVehicle:true};}
 if(phase==='export'){await host.save();const result=await host.bridge('exportGame',{folderName:'海上空战验证_0.0.51'});return{ok:true,saved:true,exported:result};}throw Error(phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeSkin63=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='editor'){host.mode='editor';host.playing=false;host.modulePanel=null;host.activePanel='story';host.selectedAct=host.selectedStep=0;host.renderEditor();await host.updatePreview();await wait(350);assert(document.querySelector('.editor-preview-player .dialogue-copy'),'主预览缺少游戏 UI');assert(document.querySelectorAll('[data-preview-resize]').length===1&&document.querySelector('[data-preview-resize=corner]'),'缩放按钮没有精简');return{ok:true,livePreview:true,oneCornerHandle:true};}
 if(phase==='pink'){host.renderGameUiPicker();const radio=document.querySelector('[name=game-ui-skin][value=pink-pop]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));assert(document.querySelector('.ui-live-preview .player').dataset.gameUi==='pink-pop','切换没有实时预览');document.querySelector('[data-action=apply-game-ui]').click();assert(host.project.ui.gameTheme==='pink-pop','工程皮肤未应用');await wait(100);assert(document.querySelector('.editor-preview-player').dataset.gameUi==='pink-pop','主预览皮肤未同步');return{ok:true,immediatePreview:true};}
 if(phase==='preview'){await host.updatePreview();await wait(350);return{ok:true,skin:document.querySelector('.editor-preview-player').dataset.gameUi};}
 if(phase==='save'){await host.save();return{ok:true,skin:host.project.ui.gameTheme};}
 if(phase==='reopen'){assert(host.project.ui.gameTheme==='pink-pop','工程皮肤重开丢失');host.mode='editor';host.playing=false;host.modulePanel=null;host.activePanel='story';host.renderEditor();await host.updatePreview();await wait(350);return{ok:true,skin:host.project.ui.gameTheme};}
 if(phase==='classic-runtime'||phase==='pink-runtime'){const skin=phase==='classic-runtime'?'classic':'pink-pop';host.renderSettingsModal();const node=document.querySelector('[data-game-skin]');node.value=skin;node.dispatchEvent(new Event('change',{bubbles:true}));assert(document.querySelector('.player').dataset.gameUi===skin,'玩家切换没有反馈');assert(host.project.ui.gameTheme==='pink-pop','玩家偏好改变了作者工程');host.closePlayerModal();await wait(350);return{ok:true,skin,authorDefault:host.project.ui.gameTheme};}
 throw Error(phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeSkin64=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(['editor','preview','save'].includes(phase))return window.__vrmSmokeSkin63(phase);
 if(phase==='green'){host.renderGameUiPicker();const radio=document.querySelector('[name=game-ui-skin][value=wechat-green]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));assert(document.querySelector('.ui-live-preview .player').dataset.gameUi==='wechat-green','微信皮肤没有实时反馈');document.querySelector('[data-action=apply-game-ui]').click();assert(host.project.ui.gameTheme==='wechat-green','默认皮肤没有应用');rememberGameSkin(host.project,'wechat-green',localStorage);return{ok:true,skin:host.project.ui.gameTheme};}
 if(phase==='reopen'){assert(host.project.ui.gameTheme==='wechat-green','默认微信皮肤重开丢失');if(host.mode!=='player'){host.modulePanel=null;host.activePanel='story';host.renderEditor();await host.updatePreview();}return{ok:true,skin:host.project.ui.gameTheme};}
 if(['dark-runtime','light-runtime'].includes(phase)){const skin=phase==='dark-runtime'?'wechat-dark':'wechat-green';host.renderSettingsModal();const select=document.querySelector('[data-game-skin]');select.value=skin;select.dispatchEvent(new Event('change',{bubbles:true}));assert(document.querySelector('.player').dataset.gameUi===skin,'玩家切换没有反馈');assert(host.project.ui.gameTheme==='wechat-green','玩家切换改变了作者默认皮肤');host.closePlayerModal();await wait(350);return{ok:true,skin};}
 if(['light-settings','dark-settings'].includes(phase)){host.renderSettingsModal();return{ok:true};}
 throw Error(phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeIntro66=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m);};
 const state=window.__intro66||=( {phases:[],pending:null} );
 const watch=()=>{state.observer?.disconnect();state.phases=[];state.observer=new MutationObserver(()=>{const n=document.querySelector('.act-intro');if(n&&state.phases.at(-1)?.phase!==n.dataset.phase)state.phases.push({phase:n.dataset.phase,time:performance.now()});});state.observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase']});};
 const hold=async()=>{for(let i=0;i<600&&document.querySelector('.act-intro')?.dataset.phase!=='hold';i++)await wait(25);const n=document.querySelector('.act-intro');assert(n?.dataset.phase==='hold','幕名没有进入停留阶段');return n;};
 const finish=async()=>{await state.pending;host.finishTyping();assert(!host.actIntro.active&&!document.querySelector('.act-intro'),'幕名残留');assert(document.querySelector('#dialogue').classList.contains('visible'),'幕名退出后没有显示对白');assert(host.playViewedStepIds.has(host.project.acts[host.playAct].steps[host.playStep].id),'对白没有按时记录');const [enter,held,exit]=state.phases;assert(enter?.phase==='enter'&&held?.phase==='hold'&&exit?.phase==='exit','幕名动画顺序不正确');assert(Math.abs(state.holdDuration-800)<.001,'幕名时间轴未固定停留 0.8 秒');return{ok:true,phases:state.phases,holdMs:state.holdDuration,callbackHoldMs:exit.time-held.time,firstDialogueAfterExit:true};};
 if(phase.startsWith('hold-')){
  if(host.mode!=='player'){host.mode='player';host.playing=false;host.renderPlayer();await wait(400);}
  const skin=phase.slice(5);document.querySelector('.player').dataset.gameUi=skin;
  host.playing=true;host.titleRequest++;host.playAct=host.project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);host.playStep=0;host.cameraActId='';host.playViewedStepIds=new Set();
  watch();state.pending=host.showPlayStep();const node=await hold();const effect=node.getAnimations()[0].effect,frames=effect.getKeyframes();state.holdDuration=(frames[2].offset-frames[1].offset)*effect.getTiming().duration;
  assert(node.textContent===host.project.acts[host.playAct].name,'幕名不是当前幕名称');assert(!document.querySelector('#dialogue').classList.contains('visible'),'幕名期间对白提前显示');assert(!host.typingTimer&&host.voice.paused,'幕名期间文字或语音提前播放');assert(!host.playViewedStepIds.size,'幕名期间提前记录对白');host.next();host.next();assert(host.playStep===0,'连点跳过幕名');
  return{ok:true,skin,name:node.textContent,phase:node.dataset.phase,typingBlocked:true,inputBlocked:true};
 }
 if(phase==='finish')return finish();
 if(phase==='sequence'){
  const originalActs=host.project.acts.slice(),originalAct=host.playAct,key=host.saveKey(),oldSlots=localStorage.getItem(key);
  try{
   watch();if(host.project.acts[host.playAct].steps[1]){host.playStep=1;await host.showPlayStep();host.finishTyping();assert(!state.phases.length,'普通下一句重复弹出幕名');}
   const branch=structuredClone(host.project.acts[originalAct]);branch.id='intro66-branch';branch.name='回家路上 · 写给明天的信';branch.steps=[{...structuredClone(branch.steps[0]),id:'intro66-branch-line',choices:[]}];host.project.acts.push(branch);host.playAct=host.project.acts.length-1;host.playStep=0;
   watch();state.pending=host.showPlayStep();await hold();await finish();
   const slots=Array(20).fill(null);slots[1]=host.snapshotSlot();localStorage.setItem(key,JSON.stringify(slots));host.playing=false;watch();await host.loadSlot(1);host.finishTyping();assert(!state.phases.length,'读档重复播放幕名');assert(host.project.acts[host.playAct].id===branch.id,'读档位置变化');
   host.preparedAct=-1;host.cameraActId='';watch();state.pending=host.showPlayStep();await hold();host.stopPlay();await state.pending;await wait(100);assert(!host.actIntro.active&&!document.querySelector('.act-intro')&&!host.playing&&!host.typingTimer,'返回标题后幕名或对白泄漏');
   return{ok:true,nextLineDoesNotRepeat:true,nextActIntroduced:true,resumeDoesNotRepeat:true,cancelledOnTitle:true};
  }finally{host.project.acts=originalActs;host.playAct=originalAct;host.playStep=0;if(oldSlots===null)localStorage.removeItem(key);else localStorage.setItem(key,oldSlots);state.observer?.disconnect();}
 }
 throw Error(phase);
};

if(new URLSearchParams(location.search).has('smoke')){
 window.__vrmSmokeAir68Import=async rows=>{for(const item of rows){item.audioKind='effect';host.project.assets.push(item);}host.markDirty();return{ok:true,imported:rows.length};};
 window.__vrmSmokeAir68=async phase=>{
  const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms)),node=()=>host.project.acts.find(a=>a.id==='air67-fixture');
  if(phase==='setup'){
   const prior=await window.__vrmSmokeAir67('setup');
   if(host.mode==='player'){assert(Object.values(node().event.combat.fireSounds).length>=2,'Weapon sounds missing from export');return{ok:true,exportedIndependentSounds:true};}
   const first=host.project.assets.find(a=>a.name.includes('机枪验证')),second=host.project.assets.find(a=>a.name.includes('机炮验证'));assert(first&&second,'Need two real sound imports');
   const c=node().event.combat;c.enemies=8;c.allies=4;c.duration=900;const types=[...new Set(['aircraft','allyAircraft','enemyAircraft'].flatMap(role=>c[role].parts.filter(p=>['gun','turret'].includes(partFamily(p.type))).map(p=>p.type)))];assert(types.length>=2,'Need distinct weapons');c.fireSounds=Object.fromEntries(types.map((type,i)=>[type,i%2?second.id:first.id]));host.selectedStep=c.dialogues.length;host.renderSidebar();host.renderInspector();host.markDirty();await host.save();return{ok:true,...prior,weaponTypes:types,independentSounds:true};
  }
  if(phase==='layout'){
   const right=document.querySelector('#dialogue-list-body'),pick=async i=>{right.querySelector(`[data-action=event-air-dialogue-select][data-index="${i}"]`).click();await wait(350);};
   await pick(0);assert(document.querySelectorAll('[data-air-dialogue=text]').length===1,'Dialogue inspector must show one line');assert(!document.querySelector('[data-air-vehicle]'),'Dialogue inspector contains plane placement');
   const count=node().event.combat.dialogues.length;document.querySelector('#dialogue-list-body [data-action=add-step]').click();await wait(350);assert(node().event.combat.dialogues.length===count+1&&host.selectedStep===count,'Add dialogue does not select new line');
   document.querySelector(`[data-action=event-air-dialogue-remove][data-index="${count}"]`).click();await wait(350);assert(node().event.combat.dialogues.length===count,'Remove dialogue failed');
   document.querySelector('[data-action=event-air-settings]').click();await wait(350);assert(right.querySelector('.step-list').lastElementChild.dataset.action==='event-air-settings','Settings is not fixed last');
   const fields=[...document.querySelectorAll('[data-air-fire-type]')];assert(fields.length>=2,'Per-weapon sound selectors missing');const [a,b]=fields,old=a.value,other=b.value;a.value=other;a.dispatchEvent(new Event('input',{bubbles:true}));assert(node().event.combat.fireSounds[b.dataset.airFireType]===other,'Changing one weapon changed another');a.value=old;a.dispatchEvent(new Event('input',{bubbles:true}));
   await pick(1);assert(document.querySelector('[data-air-dialogue=text]').dataset.index==='1','Second dialogue did not select');await pick(0);for(let i=0;i<2400&&(!document.querySelector('.stage-frame.air-dialogue-active')||host.stage.livePortrait.record?.actorKey!==node().event.combat.dialogues[0].characterId||!document.querySelector('#dialogue-text').textContent.startsWith(node().event.combat.dialogues[0].text.slice(0,4)));i++)await wait(25);assert(document.querySelector('.stage-frame.air-dialogue-active')&&host.stage.livePortrait.record?.actorKey===node().event.combat.dialogues[0].characterId&&document.querySelector('#dialogue-text').textContent.startsWith(node().event.combat.dialogues[0].text.slice(0,4)),'Selected dialogue preview is stale');return{ok:true,selectedDialogueActuallyPreviewed:true,individualDialogueInspector:true,addDelete:true,settingsFixedLast:true,independentSoundSelectors:fields.length};
  }
  if(phase==='tracers'){
   const state=window.__airSmokeRuntime;assert(state&&!state.dialogueActive,'Need active combat');
   const points=state.initialSpawns.map(r=>new THREE.Vector3(...r.position));let min=Infinity,cross=Infinity;
   for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const d=points[i].distanceTo(points[j]);min=Math.min(min,d);if((state.initialSpawns[i].team==='enemy')!==(state.initialSpawns[j].team==='enemy'))cross=Math.min(cross,d);}
   assert(min>=2000&&cross>=10000&&points.length===13,'Runtime spawn spacing wrong');
   state.paused=false;state.fire=true;for(let i=0;i<5;i++)state.step(1/60);state.fire=false;state.paused=true;state.tracers.update(state.bullets);
   assert(state.bullets.length&&state.bullets.every(b=>b.trail?.length),'A fired bullet has no trail');assert(state.tracers.lines.geometry.drawRange.count>0&&state.tracers.lines.material.color.getHex()===0xffffff,'White trajectory is missing');await wait(700);
   const types=[...new Set(state.units[0].flight.spec.parts.filter(p=>partFamily(p.type)==='gun').map(p=>p.type))];assert(types.length>=2&&types.every(type=>state.shotAudioPlaysByType[type]>0),'Independent weapon sounds did not play: '+JSON.stringify(state.shotAudioPlaysByType));
   return{ok:true,aircraft:points.length,minAircraftSpacing:min,minTeamSpacing:cross,everyBulletWhiteTrail:true,actualAudioPlaysByWeapon:state.shotAudioPlaysByType};
  }
  if(phase==='range'){
   const state=window.__airSmokeRuntime,player=state.units[0];for(const u of state.units.slice(1))u.flight.ammo=0;state.config.mission='survive';state.config.duration=900;
   state.paused=false;for(let i=0;i<1200;i++)state.step(1/60);state.paused=true;assert(state.rangeExpirations>0&&state.lastProjectileRange===7000,'Shots did not expire at 7 km');assert(!state.bullets.some(b=>!b.bomb),'Projectile exceeded 7 km');
   state.paused=false;state.fire=true;state.step(1/60);state.fire=false;const bullet=state.bullets.find(b=>!b.bomb),victim=state.units.find(u=>u.team==='enemy'&&u.flight.alive);assert(bullet&&victim,'Need a projectile and target');
   const old=victim.flight.position.clone(),part=victim.flight.spec.parts.find(p=>partFamily(p.type)==='fuselage'),f=victim.flight;f.position.set(0,1000,-200);f.velocity.set(0,0,0);f.throttle=0;
   const center=(part.type.startsWith('voxel_')?part.position:part.center).clone().sub(f.spec.com).applyQuaternion(f.rotation).add(f.position);bullet.position.copy(center).add(new THREE.Vector3(0,0,3));bullet.velocity.set(0,0,-1200);bullet.trail=[bullet.position.clone()];const hits=state.hits;state.step(1/60);state.paused=true;assert(state.hits>hits&&state.hitText==='命中','Hit text is not exactly 命中');f.position.copy(old);await wait(150);
   assert([...state.root.querySelectorAll('.air-tag.enemy')].every(tag=>/^\d+\.\d km$/.test(tag.textContent)),'Enemy labels contain extra words');return{ok:true,expiredAtMetres:state.lastProjectileRange,rangeExpirations:state.rangeExpirations,actualCollisionHit:true,hitText:state.hitText,distanceOnlyLabels:true};
  }
  return window.__vrmSmokeAir67(phase);
 };
}

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeMotion72=async phase=>{
 const {motionFitSmoke}=await import('../motion-fit-smoke.js');
 return motionFitSmoke(phase,{project:()=>host.project,stage:()=>host.stage,normalize:async()=>{host.normalize();host.renderEditor();},select:async id=>{host.selectedCharacter=host.project.characters.findIndex(r=>r.id===id);host.activePanel='characters';host.renderSidebar();host.renderInspector();await host.updatePreview();},save:()=>host.save(),play:async roles=>{host.modulePanel=null;const a=host.project.acts.find(a=>!isEvent(a)&&a.steps.length);const line=a.steps[0];line.cast=emptyDialogueCast();roles.forEach((r,i)=>line.cast[['left','center','right'][i]]={characterId:r.id,motionId:'motion72-walk',size:1,props:[],expressionWeights:{},motionOptions:{loop:true,placement:'inPlace',feet:'free'}});line.characterId=roles[0].id;line.text='人物动作适配、说话头像和衣物物理正在同时运行。';line.offstage={motionId:'motion72-walk',motionOptions:{loop:true,placement:'inPlace'}};host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,300));host.playing=true;host.titleRequest++;host.playAct=host.project.acts.indexOf(a);host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();}});
};
}
