import * as THREE from 'three';
export async function secondarySmoke(phase,c){
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=()=>new Promise(r=>setTimeout(r,0));
 if(phase.startsWith('setup-')){
  const type=phase.includes('mmd')?'mmdCharacter':'vrm',offset=phase.includes('tail')?3:0,source=c.project(),models=source.assets.filter(a=>a.type===type).slice(offset,offset+3);assert(models.length>0,'No real '+type+' assets');
  const p=c.blank();p.assets=source.assets;p.renderPresets=source.renderPresets;p.environments=source.environments;
  p.characters=models.map((a,i)=>({id:'secondary-'+i,name:source.characters.find(r=>r.modelId===a.id)?.name||a.name,modelId:a.id,props:[],stories:[],autoMouth:true}));
  const idle=p.assets.find(a=>a.type==='motion'&&/自然站立/i.test(a.name))||p.assets.find(a=>a.type==='motion'&&/站立|standing|idle|待机/i.test(a.name)&&!/坐|sit|\.vmd$/i.test(a.name+' '+a.path)),cast=c.cast();
  models.forEach((a,i)=>cast[['left','center','right'][i]]={characterId:p.characters[i].id,motionId:idle?.id||'',motionOptions:{loop:true,placement:'inPlace',feet:'free'},size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0,expressionWeights:{},props:[]});
  const original=source.acts.find(a=>a.kind!=='event');p.acts=[{id:'secondary-test',name:'衣发限位与移动验证',backgroundId:original?.backgroundId||'',steps:[{id:'secondary-line',speaker:'',characterId:'',text:'连续换位、转身、走路与低帧率下的衣发稳定性验证。',cast,choices:[],camera:{position:[0,1.3,4.7],target:[0,1,0],fov:38}}]}];p.title={actors:[],logoImageId:'__none__'};p.ui.gameTheme='astral';c.setProject(p);await c.start();const st=c.stage();st.renderSuspended=true;const records=[...st.visibleRecords.values()];assert(records.length===models.length,'Missing cast');window.__secondary53={records,type,idle,origins:records.map(r=>({p:r.anchor.position.clone(),q:r.anchor.quaternion.clone(),s:r.anchor.scale.clone()}))};return{ok:true,type,roles:p.characters.map(r=>r.name),safety:records.map(r=>(r.vrm.physics||r.vrm.secondaryMotionSafety)?.diagnostics())};
 }
 const st=c.stage(),data=window.__secondary53,results=[];assert(data,'Setup missing');
 const tick=(r,dt)=>{r.autoGaze?.restore();r.vrm.beforeAnimation?.();st.restoreFootPose(r);r.mixer.update(dt);st.updateTransitions(r,dt);st.applyMotionPlacement(r);st.applyFootLock(r);r.vrm.update(dt);st.applyRawFootLock(r);r.anchor.updateWorldMatrix(true,true);};
 if(phase==='walk'||phase==='vmd'){
  const motion=c.project().assets.find(a=>a.type==='motion'&&(phase==='vmd'?/\.vmd$/i.test(a.path):/走路|walking|walk/i.test(a.name)&&!a.path.endsWith('.vmd')));if(!motion)return{ok:true,skipped:true,reason:'No '+phase+' motion in this project'};
  for(const [i,r]of data.records.entries()){const clip=await st.prepareClip(c.asset(c.project().characters[i].modelId),motion,r.actorKey);st.poseRecord(r,clip,motion,false,{loop:true,placement:'inPlace',feet:'free'});}
 }
 for(let i=0;i<data.records.length;i++){
  const r=data.records[i],safety=r.vrm.physics||r.vrm.secondaryMotionSafety;assert(safety,'Secondary safety unavailable');let local=0,chain=0,stretch=0;const o=data.origins[i];if(phase==='full')r.vrm.setPhysicsQuality?.('full');
  for(let frame=0;frame<180;frame++){
   if(phase==='translation'){r.anchor.position.copy(o.p).add(new THREE.Vector3(Math.sin(frame*.09)*.35,0,0));}
   if(phase==='teleport'&&frame%60===0)st.transformRecord(r,['left','center','right'][i],{size:o.s.x,offsetX:frame===60?2.4:0,yaw:frame===120?40:0},false);
   if(phase==='turn-scale'){r.anchor.position.copy(o.p);r.anchor.rotation.y=Math.sin(frame*.07)*.65;r.anchor.scale.copy(o.s).multiplyScalar(1+.06*Math.sin(frame*.05));}
   tick(r,frame%27===0?.1:1/60);const m=safety.measure();local=Math.max(local,m.localRatio);chain=Math.max(chain,m.chainRatio);stretch=Math.max(stretch,m.translation);
   if(frame%20===0)await wait();
  }
  assert(local<=1.0001,'Local swing outside limit: '+local);assert(chain<=1.0001,'Chain swing outside limit: '+chain);assert(stretch<1e-6,'Cloth bone stretched: '+stretch);
  const bones=r.vrm.mesh?.skeleton.bones||[...r.vrm.springBoneManager.joints].map(j=>j.bone);assert(bones.every(b=>b.position.toArray().concat(b.quaternion.toArray()).every(Number.isFinite)),'Non-finite bone');
  results.push({role:c.project().characters[i].name,localRatio:local,chainRatio:chain,maxStretch:stretch,physics:safety.diagnostics()});r.anchor.position.copy(o.p);r.anchor.quaternion.copy(o.q);r.anchor.scale.copy(o.s);tick(r,1/60);
 }
 st.renderScene(0);return{ok:true,phase,results};
}
