import * as THREE from 'three';
export async function jitterProbe(phase,ctx){
 const st=ctx.stage(),records=window.__mmd36Data.records,results=[];
 const legacy=phase.startsWith('baseline'),idle=phase.endsWith('idle'),step=legacy?1/60:1/65;
 if(!['baseline','settled','baseline-idle','idle'].includes(phase))throw Error('Unknown jitter phase');
 const project=ctx.project(),motion=idle?project.assets.find(a=>a.name.includes('自然站立')):null;
 for(let role=0;role<records.length;role++){
  const r=records[role],character=project.characters[role];
  const clip=motion?await st.prepareClip(project.assets.find(a=>a.id===character.modelId),motion,character.id):null;
  st.poseRecord(r,clip,motion,false,{loop:true,placement:'inPlace',feet:'free'});
  r.vrm.physics.configureProbe({legacy});r.vrm.setPhysicsQuality('full');
  const bones=r.vrm.mesh.skeleton.bones,previous=bones.map(b=>b.getWorldQuaternion(new THREE.Quaternion())),positions=bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
  const stats=bones.map(()=>({peak:0,sum:0,count:0,move:0,range:0,first:null}));
  const settle=Math.ceil(4/step),end=settle+Math.ceil(3/step);
  for(let i=0;i<end;i++){
   r.vrm.beforeAnimation();st.restoreFootPose(r);r.mixer.update(step);st.applyMotionPlacement(r);r.vrm.update(step);
   for(let j=0;j<bones.length;j++){
    const q=bones[j].getWorldQuaternion(new THREE.Quaternion()),p=bones[j].getWorldPosition(new THREE.Vector3()),angle=q.angleTo(previous[j]),s=stats[j];
    if(i>=settle){s.first||=q.clone();s.peak=Math.max(s.peak,angle);s.sum+=angle;s.count++;s.move=Math.max(s.move,p.distanceTo(positions[j]));s.range=Math.max(s.range,q.angleTo(s.first));}
    previous[j].copy(q);positions[j].copy(p);
   }
  }
  const all=stats.map(({first,...s},j)=>({...s,name:bones[j].name,mean:s.sum/Math.max(1,s.count)})).sort((a,b)=>b.peak-a.peak);
  if(!legacy&&!idle&&all.some(s=>s.peak>.16||s.mean>.04))throw Error('Static jitter regression '+character.name+' '+JSON.stringify(all.slice(0,3)));
  if(idle&&!all.some(s=>/髪|Hair|劉海|裙|qzss/.test(s.name)&&s.range>.015))throw Error('Idle secondary motion has frozen');
  results.push({role:character.name,physics:r.vrm.physics.diagnostics(),worst:all.slice(0,16),targets:all.filter(s=>/YaoHu|Fluid|Xiangian|劉海|側髪|qzss|髪蝴蝶/.test(s.name))});
 }
 st.stylePipeline.render(0);st.livePortrait.render(st.renderer,st.scene,st.element);
 return{ok:true,phase,results};
}
