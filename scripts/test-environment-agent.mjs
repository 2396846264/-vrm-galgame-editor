import assert from 'node:assert/strict';
import {newAgentEnvironment,editAgentEnvironment,describeEnvironment,environmentOwner} from '../src/environment-agent-operations.js';
import {createEnvironmentAgent} from '../src/environment-agent.js';
const assets=[{id:'house',type:'sceneModel'},{id:'board',type:'image'},{id:'actor',type:'vrm'}],env=newAgentEnvironment('学校',assets),before=JSON.stringify(env);
const result=editAgentEnvironment(env,[
 {op:'add',kind:'model',ref:'house',assetId:'house',name:'楼',position:[3,0,-10],rotationDegrees:[0,90,0],scale:[.5,.5,.5]},
 {op:'add',kind:'imagePlane',ref:'board',assetId:'board',position:[0,3,-20],width:16,height:9},
 {op:'group',nodeIds:['house','board'],ref:'school',name:'学校物品'},
 {op:'add',kind:'light',ref:'lamp',position:[0,3,0],color:'#ffffff',intensity:8,distance:30,castShadow:true},
 {op:'add',kind:'sky',color:'#97b9e8'},
 {op:'settings',camera:{position:[0,2,8],target:[0,1,-4],fov:40},lighting:{ambientIntensity:.2}}
],assets);
assert.equal(JSON.stringify(env),before);assert.equal(result.environment.revision,1);assert.equal(result.results.length,6);
const measured=describeEnvironment(result.environment);assert.deepEqual(measured.nodes.find(n=>n.id===result.refs.house).worldPosition,[3,0,-10]);assert.equal(measured.nodes.find(n=>n.id===result.refs.house).rotationDegrees[1],90);
let changed=editAgentEnvironment(result.environment,[{op:'reparent',nodeId:result.refs.house,parentId:''},{op:'update',nodeId:result.refs.house,patch:{position:[3.14,0,-10.02],visible:false}},{op:'snap',nodeIds:[result.refs.house],gridSize:.1},{op:'duplicate',nodeIds:[result.refs.house],ref:'copy'}],assets);
assert.equal(changed.environment.nodes.find(n=>n.id===result.refs.house).visible,false);assert.equal(changed.environment.nodes.find(n=>n.id===changed.refs.copy).position[0],3.45);
const snapshot=JSON.stringify(result.environment);
for(const ops of [
 [{op:'update',nodeId:result.refs.house,patch:{position:[9,0,0]}},{op:'add',kind:'model',assetId:'missing'}],
 [{op:'add',kind:'model',assetId:'actor'}],
 [{op:'add',kind:'sky',color:'#fff000'}],
 [{op:'reparent',nodeId:result.refs.school,parentId:result.refs.school}],
 [{op:'update',nodeId:result.refs.house,patch:{scale:[0,1,1]}}],
 [{op:'update',nodeId:result.refs.house,patch:{path:'outside.glb'}}],
 [{op:'settings',lighting:{intensity:99}}],
 [{op:'settings',camera:{position:[0,0,0],target:[0,0,0]}}],
 [{op:'add',kind:'light',castShadow:true},{op:'add',kind:'light',castShadow:true}],
 [{op:'add',kind:'group',ref:'same'},{op:'add',kind:'group',ref:'same'}],
 [{op:'remove',nodeIds:['constructor']}]
]){assert.throws(()=>editAgentEnvironment(result.environment,ops,assets));assert.equal(JSON.stringify(result.environment),snapshot);}
changed=editAgentEnvironment(result.environment,[{op:'ungroup',nodeIds:[result.refs.school]}],assets);assert.deepEqual(describeEnvironment(changed.environment).nodes.find(n=>n.id===result.refs.house).worldPosition,[3,0,-10]);
changed=editAgentEnvironment(result.environment,[{op:'remove',nodeIds:[result.refs.school]}],assets);assert.ok(!changed.environment.nodes.some(n=>[result.refs.house,result.refs.board,result.refs.school].includes(n.id)));
assert.equal(editAgentEnvironment(env,[{op:'settings',name:'学校'}],assets).changed,false);
const mainScene={...structuredClone(env),name:'主窗口撤销后的当前场景'},windowScene={...structuredClone(env),name:'窗口旧画面'};
let pending=false;const reader=createEnvironmentAgent({project:()=>({environments:[mainScene]}),revision:()=>9,control:async()=>({opened:true,dirty:pending,environment:windowScene})});
assert.equal((await reader.call('get_environment',{environmentId:env.id})).environment.name,mainScene.name);pending=true;
assert.equal((await reader.call('get_environment',{environmentId:env.id})).environment.name,windowScene.name);
const project={title:{},acts:[{id:'one',kind:'act',steps:[{text:'保留对白'}]},{id:'event',kind:'event'}]};assert.equal(environmentOwner(project,{target:'act',actId:'one'}),project.acts[0]);assert.throws(()=>environmentOwner(project,{target:'act',actId:'event'}));assert.equal(project.acts[0].steps[0].text,'保留对白');
console.log('Environment MCP: atomic batches, world-space hierarchy, clone refs, snap, revisions, invalid assets/fields, shadow budget and story preservation passed');
