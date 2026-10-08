export const commonMotionFolderId='common-motion';
export const motionFolderId=roleId=>'character-motion-'+roleId;
export function assetsOfType(project,type){return(project.assets||[]).filter(a=>type==='music'||type==='effect'?a.type==='audio'&&a.audioKind===type:a.type===type);}
export function motionsForCharacter(project,roleId){return(project.assets||[]).filter(a=>a.type==='motion'&&(a.folderId===commonMotionFolderId||roleId&&a.folderId===motionFolderId(roleId)));}
function soundReferences(project){const refs=[],add=(holder,key,kind)=>{if(holder)refs.push({holder,key,kind});};add(project.title,'bgmId','music');add(project.ui,'clickSoundId','effect');for(const act of project.acts||[]){add(act,'bgmId','music');add(act.weather,'soundId','effect');add(act.event,'bgmId','music');for(const key of ['seId','voiceId'])add(act.event,key,'effect');for(const line of act.steps||[]){add(line,'seId','effect');for(const cue of line.sceneAnimations||[])add(cue,'soundId','effect');}}return refs;}
export function syncAssetOrganization(project,uid=()=>crypto.randomUUID()){
 project.assets||=[];project.assetFolders||=[];project.characters||=[];
 const refs=soundReferences(project),folders=project.assetFolders;
 for(const folder of folders)if(folder.type==='audio'&&!['music','effect'].includes(folder.audioKind))folder.audioKind=/音效|效果|sfx|effect/i.test(folder.name)?'effect':'music';
 for(const item of project.assets.filter(a=>a.type==='audio')){
  if(!['music','effect'].includes(item.audioKind)){const folder=folders.find(f=>f.id===item.folderId),uses=refs.filter(r=>r.holder[r.key]===item.id);item.audioKind=folder?.audioKind|| (uses.some(r=>r.kind==='music')?'music':uses.some(r=>r.kind==='effect')?'effect':/音效|点击|开场|枪声|爆炸|sfx|effect|click/i.test(item.name)?'effect':'music');}
  if(!project.audioCategoryVersion){for(const kind of ['music','effect']){const other=refs.filter(r=>r.holder[r.key]===item.id&&r.kind===kind&&kind!==item.audioKind);if(other.length){const alias={...structuredClone(item),id:uid(),name:item.name+'（'+(kind==='music'?'音乐':'音效')+'）',audioKind:kind,folderId:''};project.assets.push(alias);for(const r of other)r.holder[r.key]=alias.id;}}}
  const folder=folders.find(f=>f.id===item.folderId);if(folder?.type==='audio'&&folder.audioKind!==item.audioKind)item.folderId='';
 }
 project.audioCategoryVersion=1;
 let common=folders.find(f=>f.id===commonMotionFolderId);if(!common){common={id:commonMotionFolderId};folders.push(common);}Object.assign(common,{type:'motion',name:'通用动作',locked:true,motionScope:'common'});
 for(const role of project.characters){let folder=folders.find(f=>f.id===motionFolderId(role.id));if(!folder){folder={id:motionFolderId(role.id)};folders.push(folder);}Object.assign(folder,{type:'motion',name:role.name+' · 动作',characterId:role.id,locked:true,motionScope:'character',characterDeleted:false});}
 for(const folder of folders.filter(f=>f.motionScope==='character'))if(!project.characters.some(c=>c.id===folder.characterId)){folder.locked=true;folder.characterDeleted=true;}
 const valid=new Set(folders.filter(f=>f.type==='motion'&&(f.id===commonMotionFolderId||f.motionScope==='character'&&f.id===motionFolderId(f.characterId))).map(f=>f.id));
 for(const item of project.assets.filter(a=>a.type==='motion'))if(!valid.has(item.folderId)||!project.motionFolderVersion&&item.id.startsWith('preset-'))item.folderId=commonMotionFolderId;
 const allowed=(roleId,id)=>!id||motionsForCharacter(project,roleId).some(a=>a.id===id);
 for(const role of project.characters)if(!allowed(role.id,role.galleryMotionId))role.galleryMotionId='';
 for(const act of project.acts||[])for(const line of act.steps||[])for(const cast of Object.values(line.cast||{}))if(!allowed(cast.characterId,cast.motionId))cast.motionId='';
 for(const actor of project.title?.actors||[])if(!allowed(actor.characterId,actor.motionId))actor.motionId='';
 project.motionFolderVersion=1;
}
export function setAudioKind(project,item,kind){if(!['music','effect'].includes(kind))throw Error('声音分类无效');item.audioKind=kind;item.folderId='';for(const r of soundReferences(project))if(r.holder[r.key]===item.id&&r.kind!==kind)r.holder[r.key]='';}
export function copyCharacterMotions(project,original,copy,uid){const map=new Map();for(const asset of project.assets.filter(a=>a.type==='motion'&&a.folderId===motionFolderId(original.id))){const duplicate={...structuredClone(asset),id:uid(),folderId:motionFolderId(copy.id)};map.set(asset.id,duplicate.id);project.assets.push(duplicate);}if(map.has(copy.galleryMotionId))copy.galleryMotionId=map.get(copy.galleryMotionId);}
