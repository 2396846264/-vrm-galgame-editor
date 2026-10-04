
export const newId = () => crypto.randomUUID();
export function createEnvironment(name = '新场景') {
  return {id:newId(),name,revision:0,nodes:[{id:newId(),name:'地面',kind:'ground',parentId:null,position:[0,-.03,0],rotation:[-Math.PI/2,0,0],scale:[1,1,1],width:20,height:20,color:'#b7bfae'}],camera:{position:[0,1.3,4.3],target:[0,1.05,0],fov:32},lighting:{color:'#ffffff',intensity:2.2},background:'#a8c9e6'};
}
export function validateEnvironment(env, assets) {
  if (!env || typeof env.id !== 'string' || !env.id || typeof env.name !== 'string' || env.name.length > 200 || !Array.isArray(env.nodes) || env.nodes.length > 2000) throw Error('场景内容无效');
  const ids=new Set(), assetIds=new Set(assets.map(a=>a.id));
  const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<1e6);
  if(!env.camera || !vector(env.camera.position,3)||!vector(env.camera.target,3)||!Number.isFinite(env.camera.fov)||env.camera.fov<10||env.camera.fov>120) throw Error('摄像机参数无效');
  if(!/^#[0-9a-f]{6}$/i.test(env.background)||!/^#[0-9a-f]{6}$/i.test(env.lighting?.color)||!Number.isFinite(env.lighting.intensity)||env.lighting.intensity<0||env.lighting.intensity>10) throw Error('灯光参数无效');
  for(const n of env.nodes) {
    if(!n.id||ids.has(n.id)||!['model','imagePlane','group','ground','light','sky'].includes(n.kind)) throw Error('场景物体无效'); ids.add(n.id);
    if(!['group','ground','light','sky'].includes(n.kind)&&!assetIds.has(n.assetId)) throw Error('场景素材已丢失');
    const asset=assets.find(a=>a.id===n.assetId);
    if(n.kind==='model'&&asset?.type!=='sceneModel'||n.kind==='imagePlane'&&asset?.type!=='image') throw Error('场景素材类型不匹配');
    if(n.kind==='light'&&(!/^#[0-9a-f]{6}$/i.test(n.color)||!Number.isFinite(n.intensity)||n.intensity<0||n.intensity>1000||!Number.isFinite(n.distance)||n.distance<0||n.distance>10000))throw Error('灯光参数无效');
    if(n.kind==='sky'&&(!/^#[0-9a-f]{6}$/i.test(n.color)||n.assetId&&!assets.some(a=>a.id===n.assetId&&a.type==='image')))throw Error('天空球图片或颜色无效');
    if(!vector(n.position,3)||!vector(n.rotation,3)||!vector(n.scale,3)||n.scale.some(x=>x<=0)) throw Error('物体位置或大小无效');
    if(['imagePlane','ground'].includes(n.kind)&&(!Number.isFinite(n.width)||!Number.isFinite(n.height)||n.width<=0||n.height<=0)) throw Error('图片尺寸无效');
  }
  if(env.nodes.filter(n=>n.kind==='sky').length>1)throw Error('每个环境只需要一个天空球');
  if(env.nodes.filter(n=>n.kind==='light'&&n.castShadow).length>2)throw Error('最多两盏附加灯开启阴影');
  const map=new Map(env.nodes.map(n=>[n.id,n]));
  for(const n of env.nodes) { const seen=new Set([n.id]); for(let p=n.parentId;p;p=map.get(p)?.parentId){if(!map.has(p)||seen.has(p))throw Error('层级不能循环或引用已删除物体');seen.add(p);} }
  return env;
}
export function migrateEnvironments(project) {
  project.assets ||= [];project.acts ||= [];project.environments ||= []; project.environmentSchemaVersion=1;
  for(const owner of [project.title,...project.acts.filter(a=>a.kind!=='event')]) {
    if(!owner||owner.environmentId||!owner.backgroundId)continue;
    const image=project.assets.find(a=>a.id===owner.backgroundId&&a.type==='image'); if(!image)continue;
    const env=createEnvironment((owner.name||'标题')+'场景');
    env.nodes=[];
    // Match the old 16:9 production frame at the existing 32-degree camera.
    env.nodes.push({id:newId(),name:image.name,kind:'imagePlane',assetId:image.id,parentId:null,position:[0,1.05,-12],rotation:[0,0,0],scale:[1,1,1],width:16.62,height:9.35,unlit:true,alphaCutoff:0});
    project.environments.push(env);owner.environmentId=env.id;
  }
}
