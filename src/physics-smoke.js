import * as THREE from 'three';
import {mmdPhysicsStats} from './mmd-physics.js';
export async function physicsSmoke(phase,ctx){
 const assert=(v,m)=>{if(!v)throw Error(m);};
 if(phase==='reopen'){await ctx.start();const stage=ctx.stage(),records=[...stage.visibleRecords.values()];assert(records.length===3&&records.every(r=>r.vrm.physics?.diagnostics().enabled),'Exported MMD physics unavailable');return{ok:true,offlinePhysics:true,sharedAvatar:stage.livePortrait.record===records[0],physics:records.map(r=>r.vrm.physics.diagnostics())};}
 const data=window.__mmd36Data,st=ctx.stage(),records=data.records,project=ctx.project();
 const tick=(r,dt)=>{r.vrm.beforeAnimation();st.restoreFootPose(r);r.mixer.update(dt);st.applyMotionPlacement(r);r.vrm.update(dt);r.anchor.updateMatrixWorld(true);};
 if(phase==='swing'){
  const result=[];for(let i=0;i<records.length;i++){
   const r=records[i],a=project.assets.find(a=>a.name.includes('女性走路')),role=project.characters[i];const clip=await st.prepareClip(ctx.asset(role.modelId),a,role.id);st.poseRecord(r,clip,a,false,{loop:true,placement:'inPlace',feet:'free'});
   const sample=r.vrm.mesh.skeleton.bones.filter(b=>/hair|髪|劉海|裙|スカート|飄|飘|ribbon/i.test(b.name)).slice(0,60);assert(sample.length,'Missing hair/ribbon bones');const before=sample.map(b=>b.quaternion.clone());let range=0;
   for(let frame=0;frame<120;frame++){tick(r,1/60);range=Math.max(range,...sample.map((b,j)=>b.quaternion.angleTo(before[j])));}
   assert(range>.01,'Hair does not simulate');assert(r.vrm.mesh.skeleton.bones.every(b=>b.position.toArray().concat(b.quaternion.toArray()).every(Number.isFinite)),'Nonfinite physics');const bounds=new THREE.Box3().setFromObject(r.vrm.mesh,true).getSize(new THREE.Vector3()).toArray();assert(bounds.every(n=>n<4),'Exploding cloth '+JSON.stringify(bounds));result.push({role:role.name,range,bounds,physics:r.vrm.physics.diagnostics()});
  }
  st.stylePipeline.render(0);st.livePortrait.render(st.renderer,st.scene,st.element);assert(st.livePortrait.record===records[0],'Separate avatar actor');return{ok:true,results:result,sharedAvatar:true,stats:mmdPhysicsStats()};
 }
 if(phase==='vmd'){
  const r=records[0],a=project.assets.find(a=>a.path.endsWith('.vmd')),role=project.characters[0],clip=await st.prepareClip(ctx.asset(role.modelId),a,role.id);st.poseRecord(r,clip,a,false,{loop:true,placement:'inPlace',feet:'free'});for(let frame=0;frame<180;frame++)tick(r,1/60);const bounds=new THREE.Box3().setFromObject(r.vrm.mesh,true).getSize(new THREE.Vector3()).toArray();assert(bounds.every(n=>Number.isFinite(n)&&n<4),'VMD physics explosion');return{ok:true,bounds,physics:r.vrm.physics.diagnostics()};
 }
 if(phase==='reset'){
  const target=records[1];st.poseRecord(target,null,null,false,{loop:true,placement:'inPlace',feet:'free'});tick(target,1/65);target.vrm.beforeAnimation();const input=target.vrm.mesh.skeleton.bones.map(b=>({b,p:b.position.clone(),q:b.quaternion.clone()}));target.vrm.update(1/65);for(let i=0;i<3;i++)target.vrm.update(0);target.vrm.beforeAnimation();assert(input.every(({b,p,q})=>b.position.distanceTo(p)<1e-7&&b.quaternion.angleTo(q)<1e-7),'Zero-time avatar update fed physics output into animation');
  const r=records[0],p=r.vrm.physics,before=p.diagnostics().resets;for(const x of [20,-25,60]){r.anchor.position.x=x;tick(r,1/60);}assert(p.diagnostics().resets>=before+3,'Teleport not reset');r.anchor.position.x=-1.2;tick(r,1/60);r.vrm.setPhysicsEnabled(false);const steps=p.diagnostics().steps;for(let i=0;i<5;i++)tick(r,1/60);assert(p.diagnostics().steps===steps,'Disabled physics runs');r.vrm.setPhysicsEnabled(true);tick(r,1/60);const matrices=r.vrm.mesh.matrixWorld.toArray(),parent=r.vrm.mesh.parent;assert(parent&&matrices.every(Number.isFinite),'Lost mesh transform');return{ok:true,teleportReset:true,disableStopsSimulation:true,physics:p.diagnostics()};
 }
 if(phase==='performance'){
  const motion=project.assets.find(a=>a.name.includes('自然站立'));for(let i=0;i<records.length;i++){const role=project.characters[i],clip=await st.prepareClip(ctx.asset(role.modelId),motion,role.id);st.poseRecord(records[i],clip,motion,false,{loop:true,placement:'inPlace',feet:'free'});}
  const results=[],all=st.visibleRecords;for(const count of [3,1]){st.visibleRecords=new Map([...all].slice(0,count));records.forEach((r,i)=>r.vrm.scene.visible=i<count);for(const quality of ['balanced','full','off']){for(const r of records){r.vrm.setPhysicsQuality(quality);r.vrm.setPhysicsEnabled(quality!=='off');}st.renderSuspended=false;let frames=0;const start=performance.now();await new Promise(resolve=>{const next=()=>{frames++;if(performance.now()-start>=2000)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});st.renderSuspended=true;results.push({actors:count,quality,fps:frames*1000/(performance.now()-start)});}}st.visibleRecords=all;for(const r of records){r.vrm.scene.visible=true;r.vrm.setPhysicsEnabled(true);r.vrm.setPhysicsQuality('balanced');}return{ok:true,results,threeActors:true,stats:mmdPhysicsStats()};
 }
 if(phase==='dispose'){await ctx.clear();await new Promise(r=>setTimeout(r,300));assert(mmdPhysicsStats().worlds===0&&mmdPhysicsStats().allocations===0,'Leaked Bullet objects '+JSON.stringify(mmdPhysicsStats()));const pending=st.loadModel(ctx.asset(project.characters[0].modelId),'cancel-physics');await new Promise(r=>setTimeout(r,20));await ctx.clear();await pending;assert(mmdPhysicsStats().worlds===0&&mmdPhysicsStats().allocations===0,'Cancelled warmup leaked');await ctx.save();return{ok:true,cancelledLoadingClean:true,stats:mmdPhysicsStats()};}
 throw Error('Unknown physics phase');
}
