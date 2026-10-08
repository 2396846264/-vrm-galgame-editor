import {dialogueSlots} from './dialogue-cast.js';
export function actResourceEntries(project,act){
 const roles=new Map((project.characters||[]).map(c=>[c.id,c])),assets=new Map((project.assets||[]).map(a=>[a.id,a])),entries=[];
 for(const line of act.steps||[]){
  for(const slot of dialogueSlots){const setting=line.cast?.[slot],role=roles.get(setting?.characterId),model=assets.get(role?.modelId);if(model)entries.push({actorKey:role.id,modelAsset:model,motionAsset:assets.get(setting.motionId),props:role.props||[],assets:project.assets,visiblePropIds:setting.props||[],position:slot,transform:setting});}
  const role=roles.get(line.characterId),model=assets.get(role?.modelId);if(model&&!entries.some(e=>e.actorKey===role.id))entries.push({actorKey:role.id,modelAsset:model,props:role.props||[],assets:project.assets,visiblePropIds:[],portraitOnly:true});
 }
 return entries;
}
export function actMediaAssets(project,act){
 const ids=new Set([act.bgmId,act.weather?.soundId,act.coverImageId,project.ui?.dialogueImageId,project.ui?.clickSoundId]);const roles=new Map((project.characters||[]).map(c=>[c.id,c]));
 if(act.kind==='event'){for(const key of ['bgmId','seId','voiceId','imageId','videoId','flagAId','flagBId'])ids.add(act.event?.[key]);for(const row of act.event?.declarations||[]){ids.add(row.flagAId);ids.add(row.flagBId);}}
 const items=new Map((project.items||[]).map(item=>[item.id,item]));
 for(const line of act.steps||[]){ids.add(line.voiceId);ids.add(line.seId);for(const cue of line.sceneAnimations||[])ids.add(cue.soundId);const roleIds=new Set([line.characterId,...Object.values(line.cast||{}).map(c=>c.characterId)]);for(const id of roleIds)ids.add(roles.get(id)?.portraitId);for(const grant of line.itemGrants||[])ids.add(items.get(grant.itemId)?.imageId);for(const choice of line.choices||[])for(const need of choice.requirements||[])ids.add(items.get(need.itemId)?.imageId);}
 return(project.assets||[]).filter(a=>ids.has(a.id)&&['image','audio','voice','video'].includes(a.type));
}
