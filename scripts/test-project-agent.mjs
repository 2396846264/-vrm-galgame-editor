import assert from 'node:assert/strict';
import {editAgentProject,getProjectObjects,getProjectObject} from '../src/project-agent-operations.js';
import {emptyDialogueCast} from '../src/dialogue-cast.js';
import {syncAssetOrganization} from '../src/asset-organization.js';
const p={id:'p',name:'old',assets:[{id:'vrm',type:'vrm',path:'private.vrm'},{id:'motion',type:'motion',folderId:'common-motion'},{id:'object',type:'sceneModel'},{id:'image',type:'image'},{id:'music',type:'audio',audioKind:'music'},{id:'effect',type:'audio',audioKind:'effect'},{id:'video',type:'video',path:'a.mp4'},{id:'pdf',type:'pdf'}],characters:[],acts:[{id:'old',name:'旧幕',steps:[{id:'old-line',text:'旧故事',cast:emptyDialogueCast(),choices:[]}]}],ui:{},title:{actors:[]},items:[],knowledgeBooks:[],renderPresets:[],environments:[],assetFolders:[],render:{presetId:'',brightness:100,contrast:100,saturation:100}};syncAssetOrganization(p);const before=JSON.stringify(p);let serial=0;
const ops=[
 {action:'create',kind:'character',ref:'role',data:{name:'小雪',modelId:'vrm',autoMouth:true,stories:[{text:'故事',unlockLines:2}]}},
 {action:'create',kind:'prop',ownerId:'$role',ref:'prop',data:{assetId:'object',bone:'rightHand',position:[0,0,0],rotation:[0,90,0],scale:[1,1,1]}},
 {action:'create',kind:'act',ref:'chapter',data:{name:'新幕',bgmId:'music',weather:{type:'rain',intensity:.4}}},
 {action:'create',kind:'dialogue',ownerId:'$chapter',ref:'line',data:{characterId:'$role',speaker:'小雪',text:'你好',camera:{position:[0,1,4],target:[0,1,0],fov:40}}},
 {action:'set_actor',id:'$line',slot:'row10-right',data:{characterId:'$role',motionId:'motion',props:['$prop'],offsetX:100,yaw:360,expressionWeights:{happy:.7},motionOptions:{loop:true,startFrame:3,endFrame:40,feet:'lock',placement:'inPlace'}}},
 {action:'create',kind:'renderPreset',ref:'look',data:{name:'冷色',settings:{filters:{rim:.4,fog:.5,dof:.5}}}},
 {action:'update',kind:'ui',data:{gameTheme:'classic',spatialCamera:{enabled:true,strength:.4},roleDetailsRender:{presetId:'$look',brightness:80}}},
 {action:'update',kind:'title',data:{bgmId:'music',render:{presetId:'$look'}}},
 {action:'update',kind:'dialogue',ownerId:'$chapter',id:'$line',data:{render:{presetId:'$look',saturation:130}}},
 {action:'create',kind:'item',ref:'item',data:{name:'信件',imageId:'image',description:'重要的信件'}},
 {action:'update',kind:'dialogue',ownerId:'$chapter',id:'$line',data:{itemGrants:[{itemId:'$item',quantity:2}]}},
 {action:'create',kind:'choice',ownerId:'$line',ref:'choice',data:{text:'前进',actId:'$chapter',requirements:[{itemId:'$item',quantity:1}],consumeRequired:true}},
 {action:'create',kind:'act',ref:'movie',data:{kind:'event',name:'过场',event:{type:'cutscene',videoId:'video'}}},
 {action:'create',kind:'book',data:{name:'手册',pdfId:'pdf',coverId:'image',unlockActId:'$chapter'}},
 {action:'duplicate',kind:'character',id:'$role',ref:'copy'},
 {action:'replace_text',query:'你好',replacement:'欢迎'}
];
const r=editAgentProject(p,ops,()=>`id${++serial}`);assert.equal(JSON.stringify(p),before,'Atomic editing changed input');assert.equal(r.project.acts.length,3);assert.equal(r.project.ui.roleDetailsRender.presetId,r.refs.look);const l=getProjectObject(r.project,'dialogue',r.refs.line);assert.equal(l.text,'欢迎');assert.equal(l.cast['row10-right'].yaw,360);assert.equal(l.cast['row10-right'].offsetX,100);assert.equal(getProjectObject(r.project,'prop',r.refs.prop).rotation[1],90);assert.equal(r.project.title.render.presetId,r.refs.look);assert.equal(getProjectObjects(r.project,'dialogue').total,3);assert(r.project.assetFolders.some(f=>f.id==='character-motion-'+r.refs.role&&f.locked));assert(r.project.assetFolders.some(f=>f.id==='character-voice-'+r.refs.role&&f.locked));
const saved=JSON.stringify(r.project);for(const operation of [{action:'update',kind:'asset',id:'vrm',data:{path:'C:/secret'}},{action:'update',kind:'title',data:{bgmId:'effect'}},{action:'update',kind:'dialogue',ownerId:r.refs.chapter,id:r.refs.line,data:{cast:{center:{characterId:r.refs.role}}}},{action:'delete',kind:'asset',id:'vrm'},{action:'delete',kind:'folder',id:'common-motion'},{action:'update',kind:'renderPreset',id:r.refs.look,data:{settings:{filters:{fake:1}}}},{action:'set_actor',id:r.refs.line,slot:'row10-right',data:{offsetZ:101}}]){assert.throws(()=>editAgentProject(r.project,[{action:'update',kind:'project',data:{name:'must not persist'}},operation]));assert.equal(JSON.stringify(r.project),saved);}
const deleted=editAgentProject(r.project,[{action:'delete',kind:'renderPreset',id:r.refs.look},{action:'delete',kind:'character',id:r.refs.role},{action:'delete',kind:'item',id:r.refs.item},{action:'delete',kind:'act',id:r.refs.chapter}]);assert.equal(deleted.project.ui.roleDetailsRender.presetId,'');assert.equal(deleted.project.knowledgeBooks[0].unlockActId,'');assert(deleted.project.assetFolders.find(f=>f.characterId===r.refs.role&&f.type==='motion').characterDeleted);
console.log('PASS: atomic CRUD/copy/reorder, symbolic references, 30 actors, 100m/360deg transforms, motion/expression/props, event MP4, render/title/details/UI, inventory/book, text-only replace, locked folders, stale refs and rollback.');
