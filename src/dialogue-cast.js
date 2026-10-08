export const dialogueSlots = ['left','center','right',...Array.from({length:9},(_,i)=>['left','center','right'].map(column=>`row${i+2}-${column}`)).flat()];
export function dialogueSlotLabel(slot){const index=dialogueSlots.indexOf(slot),column=['左侧','中间','右侧'][index%3];return index<3?column:`第 ${Math.floor(index/3)+1} 排 · ${column}`;}
export function dialogueSlotPosition(slot,multiple=true){const index=dialogueSlots.indexOf(slot);if(index<0)return{x:0,z:0};const row=Math.floor(index/3),column=index%3;return{x:(column-1)*(row||multiple?1.22:.7),z:row?-row*2:0};}
const defaultSize = 1.15;
const number = (n, fallback = 0) => n == null || n === '' ? fallback : Number.isFinite(Number(n)) ? Number(n) : fallback;
export const emptyDialogueCast = () => Object.fromEntries(dialogueSlots.map(slot => [slot, {characterId:'', size:defaultSize, motionId:'', props:[]}])) ;
export function legacyDialogueCast(act, line) {
  const result = emptyDialogueCast(), occupied = new Set();
  const actors = dialogueSlots.filter(slot => act.cast?.[slot]).map(base => ({base,id:act.cast[base]}));
  for (const actor of actors) {
    const wanted = line.castPositions?.[actor.id];
    actor.slot = dialogueSlots.includes(wanted) && !occupied.has(wanted) ? wanted : null;
    if(actor.slot) occupied.add(actor.slot);
  }
  for (const actor of actors) {
    if(!actor.slot){actor.slot=!occupied.has(actor.base)?actor.base:dialogueSlots.find(slot=>!occupied.has(slot));occupied.add(actor.slot);}
    if(!actor.slot)continue;
    const value = structuredClone(act.castSettings?.[actor.base] || {});
    value.characterId=actor.id; value.size=number(value.size,defaultSize); value.props ||= [];
    if(actor.id===line.characterId){
      value.size*=number(line.size,defaultSize)/defaultSize;
      for(const key of ['offsetX','offsetY','offsetZ','yaw','pitch'])value[key]=number(value[key])+number(line[key]);
      value.expressionWeights={...(value.expressionWeights||{}),...(line.expressionWeights||{})};
      if(line.expression)value.expressionWeights[line.expression]=number(line.expressionWeight,1);
      if(line.motionId){value.motionId=line.motionId;value.motionOptions=structuredClone(line.motionOptions||{});}
    }
    result[actor.slot]=value;
  }
  return result;
}
export function migrateDialogueCast(project) {
  for(const character of project.characters||[]) character.props ||= [];
  for(const act of project.acts||[]) {
    if(act.kind==='event')continue;
    for(const line of act.steps||[]) {
      if(!line.cast)line.cast=legacyDialogueCast(act,line);
      const seen=new Set();
      for(const slot of dialogueSlots){
        const value=line.cast[slot] ||= {characterId:'',size:defaultSize,motionId:'',props:[]};
        value.props ||= [];value.expressionWeights ||= {};
        if(value.characterId && seen.has(value.characterId))value.characterId='';
        if(value.characterId)seen.add(value.characterId);
      }
      for(const key of ['castPositions','position','size','offsetX','offsetY','offsetZ','yaw','pitch','motionId','motionOptions','expressionWeights','expression','expressionWeight'])delete line[key];
    }
    delete act.cast;delete act.castSettings;
  }
  project.dialogueCastVersion=2;
}
export function setDialogueActor(line,slot,characterId) {
  if(!dialogueSlots.includes(slot))throw Error('人物位置无效');
  const old=line.cast[slot];
  const other=dialogueSlots.find(s=>s!==slot && characterId && line.cast[s]?.characterId===characterId);
  if(other){line.cast[slot]=line.cast[other];line.cast[other]=old;}
  else if(old.characterId!==characterId)line.cast[slot]={characterId,size:defaultSize,motionId:'',expressionWeights:{},props:[]};
}
export function copyDialogueCast(line) {return structuredClone(line?.cast || emptyDialogueCast());}
