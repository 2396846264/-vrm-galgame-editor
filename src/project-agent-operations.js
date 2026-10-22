import {modelTypes,collections,projectAgentFields,projectTextFields} from './agent/project-schema.js';
import {plain,own,keys,text,num,bool,array,ref,objectRef,audio,weights,playback,selection,settings,spatial,itemRows} from './agent/validation.js';

import {actor,cast,event} from './agent/value-validation.js';
export {projectAgentFields,projectTextFields} from './agent/project-schema.js';



import {validNameColor} from './character-name-color.js';
import {normalizeMotionFit} from './motion-fit.js';
import {normalizeLoading,normalizeUiLayout} from './game-ui-loading.js';

import {colorThemes,paletteKeys,normalizeColor,normalizeGamePalettes} from './game-ui-palette.js';
import {gameUiPresets} from './game-ui-themes.js';

import {createEnvironment} from './environment-schema.js';
import {editAgentEnvironment} from './environment-agent-operations.js';

import {presetSettings,renderSelection,deleteRenderPreset} from './render-presets.js';
import {emptyDialogueCast,dialogueSlots,setDialogueActor} from './dialogue-cast.js';
import {normalizeDialogueCamera} from './dialogue-camera.js';
import {normalizeWeather,weatherDefaults} from './weather.js';
import {newEvent} from "./events/schema.js";

import {newTitleActor} from './title-actors.js';

import {syncAssetOrganization,setAudioKind,copyCharacterMotions,motionsForCharacter,commonMotionFolderId,motionFolderId} from './asset-organization.js';
import {syncDialogueVoices} from './dialogue-voices.js';
import {cloneEditorObject} from './editor-copy.js';

import {validatePropBinding} from './character-props.js';






















function patch(p,kind,target,data){keys(data,projectAgentFields[kind]||[],'对象设置');if(kind==='environment'){const result=editAgentEnvironment(target,[{op:'settings',...data}],p.assets);Object.assign(target,result.environment);return;}const d=structuredClone(data);
 for(const[k,v]of Object.entries(d)){
  if(['name','title','subtitle','description','text','speaker','authorNote'].includes(k))text(v,k,k==='name'?200:100000);
  if(k==='render'||k==='roleDetailsRender')d[k]=selection(p,{...target[k],...v});
  if(k==='settings'){keys(v,['brightness','contrast','saturation','filters'],'预设');d[k]=settings({...target.settings,...v,filters:{...target.settings?.filters,...v.filters}});}
  if(k==='spatialCamera')d[k]=spatial({...target[k],...v});
  if(k==='modelId')ref(p,v,modelTypes,'人物');if(['portraitId','imageId','coverId','coverImageId','dialogueImageId'].includes(k))ref(p,v,['image'],'图片');if(k==='logoImageId'&&v!=='__none__')ref(p,v,['image'],'Logo');if(k==='backgroundId')ref(p,v,['image','video'],'背景');if(k==='pdfId')ref(p,v,['pdf'],'PDF');
  if(k==='environmentId')objectRef(p.environments||[],v,'环境');if(k==='actId'||k==='unlockActId')objectRef(p.acts,v,'幕');if(k==='characterId')objectRef(p.characters,v,'角色');if(k==='bgmId')audio(p,v,'music');if(k==='seId'||k==='clickSoundId')audio(p,v,'effect');if(k==='voiceId'){ref(p,v,['voice'],'配音');if(v&&p.assets.find(a=>a.id===v).characterId!==(d.characterId??target.characterId))throw Error('配音不属于这个角色');}
  if(['detailsIdleId','galleryMotionId'].includes(k)){ref(p,v,['motion'],'动作');if(v&&!motionsForCharacter(p,target.id).some(a=>a.id===v))throw Error('动作不在该角色或通用文件夹');}
  if(k==='camera'){if(v===null)d.camera=null;else{keys(v,['position','rotation','target','fov'],'镜头');const c=normalizeDialogueCamera(v);if(!c)throw Error('镜头需要 position 和 target 或 rotation');if(v.fov!==undefined)num(v.fov,20,100,'视角');d.camera=c;}}
  if(k==='offstage'){keys(v,['motionId','motionOptions','expressionWeights'],'场外头像动作');ref(p,v.motionId,['motion'],'动作');if(v.motionId&&!motionsForCharacter(p,d.characterId??target.characterId).some(a=>a.id===v.motionId))throw Error('动作不属于当前角色');d.offstage={motionId:v.motionId||'',motionOptions:playback(v.motionOptions||{}),expressionWeights:weights(v.expressionWeights||{})};}
  if(k==='cast')d.cast=cast(p,v,target.cast);
  if(k==='event'){if(target.kind!=='event')throw Error('只有事件幕可以设置 event');d.event=event(p,{...target.event,...v});}
  if(k==='weather'){keys(v,Object.keys(weatherDefaults),'天气');const w={...target.weather,...v};if(v.type!==undefined&&!['none','sunny','cloudy','rain','snow','wind'].includes(v.type))throw Error('天气类型无效');for(const field of ['intensity','wind','ground','sunX','volume'])if(v[field]!==undefined)num(v[field],field==='ground'?.2:0,1,field);for(const field of ['splashes','atmosphere','autoMood','windMotion'])if(v[field]!==undefined)bool(v[field],field);if(v.direction!==undefined&&![1,-1].includes(v.direction))throw Error('风向应为 1 或 -1');if(v.soundId!==undefined&&v.soundId!=='auto')audio(p,v.soundId,'effect');d.weather=normalizeWeather(w);}
  if(['autoMouth','consumeRequired','galleryImage','galleryMusic'].includes(k))bool(v,k);
  if(k==='nameColor'&&!validNameColor(v))throw Error('姓名颜色应为 #RRGGBB');
  if(k==='motionFit'){keys(v,['enabled','strength','clearance','bodyScale'],'动作适配');if(v.enabled!==undefined)bool(v.enabled,'enabled');for(const [key,min,max]of [['strength',0,1],['clearance',0,.08],['bodyScale',.65,1.5]])if(v[key]!==undefined)num(v[key],min,max,key);d.motionFit=normalizeMotionFit(v);}
  if(k==='motionFitOverrides'){d.motionFitOverrides={};for(const [id,value]of Object.entries(v||{})){ref(p,id,['motion'],'动作');if(!motionsForCharacter(p,target.id).some(a=>a.id===id))throw Error('动作不属于当前角色');keys(value,['enabled','strength','clearance','bodyScale'],'动作适配');d.motionFitOverrides[id]=normalizeMotionFit(value);}}
  if(k==='portraitSource'&&!['auto','manual'].includes(v))throw Error('头像来源无效');if(k==='gameTheme'&&!gameUiPresets.some(preset=>preset.id===v))throw Error('游戏 UI 风格无效');
  if(k==='layout'){if(normalizeUiLayout(v)!==v)throw Error('菜单布局无效');}
  if(k==='loading'){keys(v,['style','color','speed','position'],'加载动画');const n=normalizeLoading(v);for(const key of Object.keys(v))if(n[key]!==v[key])throw Error('加载动画设置无效');d.loading=n;}
  if(k==='gamePalettes'){keys(v,colorThemes,'游戏配色');for(const colors of Object.values(v)){keys(colors,paletteKeys,'配色项');for(const color of Object.values(colors))if(!normalizeColor(color))throw Error('颜色应为 #RRGGBB 或 #RRGGBBAA');}d.gamePalettes=normalizeGamePalettes(v);}
  if(k==='authoring'){keys(v,['mode','instructions'],'编排要求');if(v.mode!==undefined&&!['faithful','adapt','outline'].includes(v.mode))throw Error('改编方式无效');if(v.instructions!==undefined)text(v.instructions,'作者要求',12000);d.authoring={...target.authoring,...v};}
  if(k==='stories')d.stories=array(v,3,'角色故事').map(story=>{keys(story,['title','text','unlockLines'],'角色故事');text(story.text||'','故事');if(story.title!==undefined)text(story.title,'标题',200);num(story.unlockLines??0,0,1e9,'解锁句数');return structuredClone(story);});
  if(k==='requirements'||k==='itemGrants')d[k]=itemRows(p,v);
  if(k==='sceneAnimations')d[k]=array(v,200,'场景动作').map(cue=>{keys(cue,['nodeId','assetId','clipIndex','clipName','enabled','delaySeconds','soundId'],'场景动作');const env=p.environments.find(e=>e.id===p.acts.find(a=>a.steps.includes(target))?.environmentId);if(!env?.nodes.some(n=>n.id===cue.nodeId&&n.assetId===cue.assetId&&n.kind==='model'))throw Error('场景动作物体不在当前幕的环境');ref(p,cue.assetId,['sceneModel'],'场景模型');num(cue.clipIndex,0,10000,'动作序号');text(cue.clipName,'动作名',300);bool(cue.enabled,'enabled');num(cue.delaySeconds||0,0,600,'动作延迟');audio(p,cue.soundId||'','effect');return structuredClone(cue);});
  if(k==='tags')array(v,30,'标签').forEach(t=>text(t,'标签',80));if(k==='folderId'){objectRef(p.assetFolders,v,'素材文件夹');if(v){const f=p.assetFolders.find(f=>f.id===v);if(f.type!==target.type||target.type==='audio'&&f.audioKind!==(d.audioKind??target.audioKind))throw Error('素材与文件夹类型不匹配');}}
  if(k==='audioKind'&&!['music','effect'].includes(v))throw Error('声音分类无效');if(k==='type'&&!['image','vrm','fbxCharacter','mmdCharacter','sceneModel','audio','video','pdf'].includes(v))throw Error('动作及配音文件夹自动创建');
 }
 if(kind==='titleActor')Object.assign(d,actor(p,d,target));if(kind==='prop'){validatePropBinding({...target,...d},p.assets);if(d.rotation){delete target.rotationQuaternion;delete target.rotationQuaternionAngles;}}
 if(kind==='asset'&&d.audioKind!==undefined){if(target.type!=='audio')throw Error('只有声音能更改分类');setAudioKind(p,target,d.audioKind);}if(kind==='folder'&&target.locked)throw Error('固定文件夹不可修改');Object.assign(target,d);
}
function list(p,kind,ownerId){if(collections[kind])return p[collections[kind]]||=[];if(kind==='titleActor')return p.title.actors||=[];if(kind==='dialogue'){const a=p.acts.find(a=>a.id===ownerId&&a.kind!=='event');if(!a)throw Error('对白需要普通幕 ownerId');return a.steps;}if(kind==='choice'){const l=p.acts.flatMap(a=>a.steps||[]).find(s=>s.id===ownerId);if(!l)throw Error('选项需要对白 ownerId');return l.choices||=[];}if(kind==='prop'){const r=p.characters.find(r=>r.id===ownerId);if(!r)throw Error('绑定需要角色 ownerId');return r.props||=[];}throw Error('对象类型无效');}
export function getProjectObject(p,kind,id,ownerId){if(['project','ui','title'].includes(kind))return kind==='project'?{id:p.id,name:p.name,authoring:p.authoring?{mode:p.authoring.mode,instructions:p.authoring.instructions}:undefined}:p[kind];const rows=kind==='dialogue'&&!ownerId?p.acts.flatMap(a=>a.steps||[]):kind==='choice'&&!ownerId?p.acts.flatMap(a=>(a.steps||[]).flatMap(s=>s.choices||[])):kind==='prop'&&!ownerId?p.characters.flatMap(r=>r.props||[]):list(p,kind,ownerId);const o=rows.find(o=>o.id===id);if(!o)throw Error('对象不存在');return o;}
export function getProjectObjects(p,kind,{ownerId,offset=0,limit=100}={}){const rows=['ui','title','project'].includes(kind)?[getProjectObject(p,kind)]:kind==='dialogue'&&!ownerId?p.acts.flatMap(a=>(a.steps||[]).map(s=>({...s,ownerId:a.id}))):list(p,kind,ownerId);const start=Math.max(0,Math.floor(offset)),count=Math.min(200,Math.max(1,Math.floor(limit)));return{total:rows.length,offset:start,nextOffset:Math.min(rows.length,start+count),objects:structuredClone(rows.slice(start,start+count))};}
function defaults(p,kind,id,data){if(kind==='environment')return{...createEnvironment(),id};if(kind==='act')return data.kind==='event'?newEvent(id,crypto.randomUUID()):{id,name:'新幕',backgroundId:'',bgmId:'',steps:[],weather:normalizeWeather()};if(kind==='dialogue')return{id,text:'',speaker:'',characterId:'',voiceId:'',choices:[],cast:emptyDialogueCast(),render:renderSelection(p.render)};if(kind==='character')return{id,name:'新角色',title:'',description:'',modelId:'',portraitId:'',props:[],stories:[],autoMouth:true};if(kind==='titleActor')return newTitleActor(id);if(kind==='choice')return{id,text:'新选项',actId:'',requirements:[],consumeRequired:false};if(kind==='prop')return{id,name:'绑定物品',assetId:'',bone:'rightHand',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};if(kind==='renderPreset')return{id,name:'新预设',settings:presetSettings()};if(kind==='item')return{id,name:'新物品',imageId:'',description:''};if(kind==='book')return{id,name:'新书本',pdfId:'',coverId:'',description:'',unlockActId:''};if(kind==='folder')return{id,name:'新文件夹',type:'image'};throw Error('素材请从文件导入');}
function refsTo(v,id,path='',result=[]){if(!v||typeof v!=='object')return result;for(const[k,x]of Object.entries(v)){if(k.endsWith('Id')&&x===id||k==='props'&&Array.isArray(x)&&x.includes(id))result.push(path+'.'+k);if(typeof x==='object')refsTo(x,id,path+'.'+k,result);}return result;}
function remove(p,kind,target,rows){if(kind==='environment'){for(const a of p.acts)if(a.environmentId===target.id){a.environmentId='';for(const l of a.steps||[])l.sceneAnimations=[];}if(p.title.environmentId===target.id)p.title.environmentId='';}if(kind==='folder'){if(target.locked)throw Error('固定文件夹不可删除');for(const a of p.assets)if(a.folderId===target.id)a.folderId='';}if(kind==='renderPreset'){deleteRenderPreset(p,target.id);return;}if(kind==='asset'){const refs=refsTo({characters:p.characters,acts:p.acts,title:p.title,ui:p.ui,items:p.items,books:p.knowledgeBooks,environments:p.environments},target.id);if(refs.length)throw Error('素材仍被使用：'+refs.slice(0,8).join('、'));}if(kind==='act'){for(const a of p.acts){const c=a.event?.combat;if(c){if(c.winActId===target.id)c.winActId='';if(c.loseActId===target.id)c.loseActId='';}}if(p.acts.length<=1)throw Error('至少保留一幕');for(const a of p.acts)for(const l of a.steps||[])for(const c of l.choices||[])if(c.actId===target.id)c.actId='';for(const b of p.knowledgeBooks||[])if(b.unlockActId===target.id)b.unlockActId='';}if(kind==='character'){for(const a of p.acts)for(const l of a.steps||[]){if(l.characterId===target.id){l.characterId='';l.voiceId='';}for(const row of Object.values(l.cast||{}))if(row.characterId===target.id)Object.assign(row,{characterId:'',motionId:'',props:[],expressionWeights:{}});}for(const a of p.title.actors||[])if(a.characterId===target.id){a.characterId='';a.props=[];}}if(kind==='item')for(const a of p.acts)for(const l of a.steps||[]){l.itemGrants=(l.itemGrants||[]).filter(r=>r.itemId!==target.id);for(const c of l.choices||[])c.requirements=(c.requirements||[]).filter(r=>r.itemId!==target.id);}if(kind==='prop'){for(const a of p.acts)for(const l of a.steps||[])for(const c of Object.values(l.cast||{}))c.props=(c.props||[]).filter(id=>id!==target.id);for(const a of p.title.actors||[])a.props=(a.props||[]).filter(id=>id!==target.id);}rows.splice(rows.indexOf(target),1);}

export function editAgentProject(current,operations,uid=()=>crypto.randomUUID().replaceAll('-','')){array(operations,200,'编辑操作');if(!operations.length)throw Error('编辑操作不能为空');const p=structuredClone(current),aliases=Object.create(null),results=[];const resolve=v=>typeof v==='string'&&v.startsWith('$')?(aliases[v.slice(1)]||(()=>{throw Error('ref 尚未创建：'+v);})()):v;const dataRefs=(v,key='')=>Array.isArray(v)?v.map(x=>typeof x==='string'&&key==='props'?resolve(x):dataRefs(x,key)):plain(v)?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k.endsWith('Id')?resolve(x):dataRefs(x,k)])):v;
 for(const[index,op]of operations.entries())try{keys(op,['action','kind','id','ownerId','afterId','index','ref','data','slot','query','replacement'],'操作');const kind=op.kind,id=resolve(op.id),ownerId=resolve(op.ownerId),data=dataRefs(op.data||{});let result={index,action:op.action,kind};
  if(op.action==='replace_text'){text(op.query,'查找',1000);if(!op.query)throw Error('查找不能为空');text(op.replacement,'替换',10000);let count=0;for(const f of projectTextFields(p)){count+=f.object[f.key].split(op.query).length-1;f.object[f.key]=f.object[f.key].split(op.query).join(op.replacement);}result.replaced=count;}
  else if(op.action==='set_actor'){const l=getProjectObject(p,'dialogue',id,ownerId);if(!dialogueSlots.includes(op.slot))throw Error('无效的 30 人位置');if(data.characterId!==undefined){objectRef(p.characters,data.characterId,'角色');l.cast||=emptyDialogueCast();setDialogueActor(l,op.slot,data.characterId);}l.cast=cast(p,{[op.slot]:data},l.cast);result.id=l.id;}
  else if(op.action==='set_motion_scope'){const a=getProjectObject(p,'asset',id);if(a.type!=='motion')throw Error('请选择动作');objectRef(p.characters,ownerId||'','角色');a.folderId=ownerId?motionFolderId(ownerId):commonMotionFolderId;result.id=a.id;}
  else if(op.action==='update'&&['project','ui','title'].includes(kind))patch(p,kind,kind==='project'?p:p[kind],data);
  else{if(!projectAgentFields[kind])throw Error('对象类型不支持');const rows=list(p,kind,ownerId),source=rows.find(v=>v.id===id);let target;if(op.action==='create'){if(kind==='asset')throw Error('素材必须导入');if(kind==='act'){keys(data,[...projectAgentFields.act,'kind'],'幕');if(data.kind!==undefined&&!['act','event'].includes(data.kind))throw Error('幕类型无效');}target=defaults(p,kind,uid(),data);const d={...data};delete d.kind;patch(p,kind,target,d);const after=resolve(op.afterId),at=after?rows.findIndex(v=>v.id===after):-1;if(after&&at<0)throw Error('afterId 不存在');rows.splice(at<0?rows.length:at+1,0,target);}else{if(!source)throw Error('对象 ID 不存在');if(op.action==='update'){patch(p,kind,source,data);target=source;}else if(op.action==='duplicate'){if(kind==='folder'&&source.locked)throw Error('固定文件夹不能复制');target=cloneEditorObject(kind==='dialogue'?'step':kind,source,uid);if(kind==='character')copyCharacterMotions(p,source,target,uid);if(Object.keys(data).length)patch(p,kind,target,data);rows.splice(rows.indexOf(source)+1,0,target);}else if(op.action==='delete'){remove(p,kind,source,rows);result.id=source.id;}else if(op.action==='move'){num(op.index,0,rows.length-1,'位置');if(!Number.isInteger(op.index))throw Error('位置应为整数');rows.splice(rows.indexOf(source),1);rows.splice(op.index,0,source);target=source;}else throw Error('编辑动作不支持');}if(target){result.id=target.id;if(op.ref){if(typeof op.ref!=='string'||!/^[a-zA-Z][\w-]{0,63}$/.test(op.ref)||own(aliases,op.ref))throw Error('ref 需要唯一短名称');aliases[op.ref]=target.id;}}}
  syncAssetOrganization(p,uid);syncDialogueVoices(p);results.push(result);
 }catch(error){throw Error('第 '+(index+1)+' 个操作失败：'+error.message);}return{project:p,refs:aliases,results,changed:JSON.stringify(p)!==JSON.stringify(current)};
}
