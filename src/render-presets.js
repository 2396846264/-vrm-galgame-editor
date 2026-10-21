import {normalizeRender,effectiveStyle,mergeRender,colorAdjustments} from './render-style.js';
const number=(v,f=100)=>Number.isFinite(Number(v))?Math.max(0,Math.min(200,Number(v))):f;
export const neutralRender=()=>normalizeRender({preset:'custom'});
export function renderSelection(value={}){return{presetId:typeof value?.presetId==='string'?value.presetId:'',...Object.fromEntries(Object.entries(colorAdjustments).map(([k,f])=>[k,number(value?.[k],f)]))};}
export function presetSettings(value={}){return normalizeRender({...value,preset:'custom'});}
export function resolveRender(project,selection=project?.render){
 const choice=renderSelection(selection),preset=project?.renderPresets?.find(p=>p.id===choice.presetId),base=preset?presetSettings(preset.settings):neutralRender();
 return{...base,...Object.fromEntries(Object.keys(colorAdjustments).map(k=>[k,number(base[k]*choice[k]/100)]))};
}
export const resolveDialogueRender=(project,act,line)=>resolveRender(project,line?.render||project.render);
export const resolveEventRender=(project,node)=>resolveRender(project,node?.event?.render||project?.render);
export const resolveTitleRender=project=>resolveRender(project,project.title?.render||project.render);
export const resolveRoleDetailsRender=project=>resolveRender(project,project.ui?.roleDetailsRender||project.render);
export function newRenderPreset(id,name='新预设',settings){return{id,name,settings:presetSettings(settings||neutralRender())};}
function hash(text){let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return(n>>>0).toString(16);}
export function migrateRenderPresets(project){
 project.renderPresets ||= [];
 for(const entry of project.renderPresets){entry.name=String(entry.name||'未命名预设').slice(0,100);entry.settings=presetSettings(entry.settings);}
 if(project.renderPresetSchema===1){project.render=renderSelection(project.render);if(project.title?.render)project.title.render=renderSelection(project.title.render);project.ui||={};project.ui.roleDetailsRender=renderSelection(project.ui.roleDetailsRender||project.render);for(const act of project.acts||[]){delete act.render;if(act.event?.type==='aircombat'&&act.event.render)act.event.render=renderSelection(act.event.render);for(const line of act.steps||[])line.render=renderSelection(line.render||project.render);}return;}
 const inherited=project.render||neutralRender(),oldTitle=project.title?.render;
 const bake=value=>{
  const legacy=normalizeRender(value),filters=effectiveStyle(legacy),settings=presetSettings({filters}),key=JSON.stringify(settings);
  const neutral=JSON.stringify(neutralRender());let id='';
  if(key!==neutral){let entry=project.renderPresets.find(p=>JSON.stringify(p.settings)===key);if(!entry){let proposed='render-migrated-'+hash(key),n=1;while(project.renderPresets.some(p=>p.id===proposed))proposed='render-migrated-'+hash(key)+'-'+n++;entry=newRenderPreset(proposed,'旧画面 '+(project.renderPresets.length+1),settings);project.renderPresets.push(entry);}id=entry.id;}
  return renderSelection({presetId:id,brightness:legacy.brightness,contrast:legacy.contrast,saturation:legacy.saturation});
 };
 for(const act of project.acts||[]){const base=mergeRender(inherited,act.render);if(act.event?.type==='aircombat')act.event.render=bake(mergeRender(base,act.event.render));for(const line of act.steps||[])line.render=bake(mergeRender(base,line.render));delete act.render;}
 project.render=bake(inherited);if(project.title)project.title.render=bake(oldTitle?mergeRender(inherited,oldTitle):inherited);project.ui||={};project.ui.roleDetailsRender=renderSelection(project.render);project.renderPresetSchema=1;
}
export function deleteRenderPreset(project,id){
 project.renderPresets=(project.renderPresets||[]).filter(p=>p.id!==id);
 for(const choice of [project.render,project.title?.render,project.ui?.roleDetailsRender,...(project.acts||[]).map(a=>a.event?.render),...(project.acts||[]).flatMap(a=>(a.steps||[]).map(l=>l.render))])if(choice?.presetId===id)choice.presetId='';
}
