import {createAutoBlink} from './auto-blink.js';
export async function runBlinkSmoke(phase,c){
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='setup'){
  const p=c.blank();p.assets=window.__blinkImported;
  p.characters=p.assets.filter(a=>['vrm','mmdCharacter'].includes(a.type)).map((a,i)=>({id:'blink-'+i,name:a.name,modelId:a.id,props:[],stories:[],autoMouth:true}));
  p.acts=[{id:'blink-act',name:'自动眨眼验证',cast:c.cast(),castSettings:{},steps:p.characters.map(role=>{
   const cast=c.cast();cast.center={characterId:role.id,motionId:'',expressionWeights:{},props:[],size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0};
   return {id:role.id,speaker:role.name,characterId:role.id,text:'VRM 与 MMD 人物默认自动眨眼，随机间隔六至十二秒。',cast,choices:[]};
  })}];p.title={actors:[],logoImageId:'__none__'};c.setProject(p);
 }
 if(phase==='setup'||phase==='player'||phase==='reopen'){
  await c.start();const st=c.stage();st.renderSuspended=true;const results=[];
  for(const role of c.project().characters){
   const r=await st.loadModel(c.asset(role.modelId),role.id),manager=r.vrm.expressionManager;
   assert(r.autoBlink,'模型缺少眨眼形态键：'+role.name);
   r.autoBlink.restore();manager.resetValues();r.vrm.beforeAnimation?.();r.vrm.update(0);
   r.autoBlink=createAutoBlink(manager,()=>0);let peak=0,physicalPeak=0;
   for(let n=0;n<390;n++){
    r.autoBlink.restore();r.vrm.beforeAnimation?.();r.mixer.update(1/60);r.autoBlink.update(1/60);r.vrm.update(0);
    peak=Math.max(peak,r.autoBlink.diagnostics().weight);
    r.vrm.scene.traverse(o=>{if(o.morphTargetInfluences)physicalPeak=Math.max(physicalPeak,...o.morphTargetInfluences);});
   }
   assert(peak>.95&&physicalPeak>.95,'眼睑没有实际闭合：'+role.name);
   r.autoBlink.restore();r.vrm.beforeAnimation?.();r.vrm.update(0);
   r.autoBlink=createAutoBlink(manager);
   results.push({name:role.name,type:r.vrm.isMmd?'MMD':'VRM',names:r.autoBlink.diagnostics().names,peak,physicalPeak});
  }
  assert(results.filter(r=>r.type==='MMD').length===3&&results.filter(r=>r.type==='VRM').length===2,'测试模型数量不符');
  st.renderSuspended=false;return {ok:true,actualEyeMorphs:true,forcedOn:true,results};
 }
 const st=c.stage(),r=st.activeRecord;
 if(phase==='natural'){
  st.renderSuspended=false;let peak=0;const first=r.autoBlink.diagnostics().count,start=performance.now();
  while(performance.now()-start<14000&&r.autoBlink.diagnostics().count===first){await wait(10);peak=Math.max(peak,r.autoBlink.diagnostics().weight);}
  await wait(70);peak=Math.max(peak,r.autoBlink.diagnostics().weight);
  assert(r.autoBlink.diagnostics().count>first,'实时循环没有眨眼');assert(peak>.5,'实时眨眼权重未改变');
  assert(st.livePortrait.record===r&&st.livePortrait.frames>0,'可动头像未共用眨眼模型');
  const count=r.autoBlink.diagnostics().count;st.renderSuspended=true;const before=JSON.stringify(r.autoBlink.diagnostics());await wait(500);assert(JSON.stringify(r.autoBlink.diagnostics())===before,'暂停时眨眼时钟仍运行');
  return {ok:true,realFrameLoop:true,livePortrait:true,pausesWithGame:true,peak,count};
 }
 if(phase==='closed'){
  st.renderSuspended=true;r.autoBlink.restore();st.expressRecord(r,{blink:.8});
  for(let i=0;i<800;i++){r.autoBlink.restore();r.vrm.beforeAnimation?.();r.mixer.update(1/60);r.autoBlink.update(1/60);r.vrm.update(0);assert(Math.abs(r.vrm.expressionManager.getValue('blink')-.8)<1e-6,'手动闭眼被覆盖');assert(r.autoBlink.diagnostics().weight===0,'手动闭眼叠加了眨眼');}
  st.expressRecord(r,{});return {ok:true,authoredClosedEyesPreserved:true};
 }
 if(phase==='vmd'){
  const a=c.project().assets.find(a=>a.path.endsWith('.vmd')),role=c.project().characters[0],actor=await st.loadModel(c.asset(role.modelId),role.id);
  assert(actor.vrm.isMmd&&a,'VMD fixture missing');const clip=await st.prepareClip(c.asset(role.modelId),a,role.id);st.poseRecord(actor,clip,a,false,{loop:true,placement:'free',feet:'free'});
  const e=actor.vrm.expressionManager,mesh=actor.vrm.mesh,index=mesh.morphTargetDictionary['まばたき']??mesh.morphTargetDictionary['瞬き'];let activeFrames=0;
  for(let i=0;i<900;i++){actor.autoBlink.restore();actor.vrm.beforeAnimation();actor.mixer.update(1/30);const original=mesh.morphTargetInfluences[index]||0;actor.autoBlink.update(1/30);actor.vrm.update(0);if(original>.02){activeFrames++;assert(Math.abs(mesh.morphTargetInfluences[index]-original)<1e-6,'VMD 眨眼被叠加');}}
  assert(clip.tracks.some(t=>t.name.includes('morphTargetInfluences')),'VMD 没有表情轨道');
  actor.autoBlink.restore();st.poseRecord(actor,null,null,false,{});actor.vrm.beforeAnimation?.();e.resetValues();actor.vrm.update(0);return {ok:true,nativeVmdMorphsPreserved:true,activeFrames,tracks:clip.tracks.length};
 }
 if(phase==='save'){await c.save();return {ok:true,characters:c.project().characters.length,noDisableField:!c.project().characters.some(role=>'autoBlink' in role)};}
 throw Error('Unknown blink phase');
}
