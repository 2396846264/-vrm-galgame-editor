import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildMovement} from '../src/vehicle-navigation.js';
import {racingFlight} from '../src/aircombat-controls.js';
import {createFlight,stepFlight} from '../src/aircombat-physics.js';
import {voxelPreset} from '../src/vehicle-documents.js';
import {waterNode} from '../src/water-surface.js';
import {createEnvironment,validateEnvironment} from '../src/environment-schema.js';
import {editAgentEnvironment} from '../src/environment-agent-operations.js';
import {EnvironmentRuntime} from '../src/environment-runtime.js';
const pitched=new THREE.Quaternion().setFromEuler(new THREE.Euler(.6,.4,0,'YXZ'));
assert(buildMovement(new Set(['KeyW']),pitched).y>.5);assert(buildMovement(new Set(['KeyS']),pitched).y<-.5);assert(Math.abs(buildMovement(new Set(['KeyW','KeyD','Space']),pitched).length()-1)<1e-9);
const reports=[];
for(const name of ['stuka','b25','bf109','shinden']){
 const bp=voxelPreset(name),f=createFlight(bp),neutral=new THREE.Vector2(),keys=new Set();
 for(let i=0;i<3600;i++){racingFlight(f,neutral,keys,1/60);stepFlight(f,1/60);}assert(f.alive&&f.position.y>100,name+' level flight');
 const turn=createFlight(bp);for(let i=0;i<900;i++){racingFlight(turn,neutral,new Set(['KeyD']),1/60);stepFlight(turn,1/60);assert(new THREE.Vector3(0,1,0).applyQuaternion(turn.rotation).y>.6,name+' inverted');}assert(new THREE.Vector3(1,0,0).applyQuaternion(turn.rotation).y<-.2,name+' D bank direction');
 for(let i=0;i<180;i++){racingFlight(turn,neutral,keys,1/60);stepFlight(turn,1/60);}assert(Math.abs(new THREE.Vector3(1,0,0).applyQuaternion(turn.rotation).y)<.03,name+' bank recovery');
 const right=createFlight(bp);for(let i=0;i<240;i++){racingFlight(right,new THREE.Vector2(.55,0),keys,1/60);stepFlight(right,1/60);}assert(right.velocity.x>0,name+' mouse right');
 const slow=createFlight(bp),coast=createFlight(bp);for(let i=0;i<180;i++){racingFlight(slow,neutral,new Set(['KeyS']),1/60);racingFlight(coast,neutral,keys,1/60);stepFlight(slow,1/60);stepFlight(coast,1/60);}assert(slow.throttle===0&&slow.airSpeed<coast.airSpeed-3,name+' S brake');
 const sea=createFlight(bp,[0,1,0]);sea.surface='water';sea.velocity.set(0,-2,0);stepFlight(sea,1/60);assert(!sea.alive&&!sea.grounded,'cannot land wheels on water');
 const takeoff=createFlight(bp);takeoff.position.set(0,takeoff.spec.contactHeight+4,0);takeoff.groundLevel=4;takeoff.velocity.set(0,0,0);takeoff.airSpeed=0;takeoff.grounded=true;takeoff.throttle=1;const climb=new THREE.Vector2(),takeoffKeys=new Set();let rolled=false;
 for(let i=0;i<2400;i++){if(takeoff.airSpeed>takeoff.spec.stallSpeed*1.2){climb.y=.3;if(takeoff.position.y<30)takeoffKeys.add('ArrowDown');else takeoffKeys.delete('ArrowDown');}racingFlight(takeoff,climb,takeoffKeys,1/60);stepFlight(takeoff,1/60);rolled ||= takeoff.grounded&&takeoff.airSpeed>5;}
 assert(rolled&&takeoff.alive&&takeoff.position.y>30,name+' rolling takeoff');assert(takeoff.spec.parts.filter(p=>p.type.includes('gear')).every(p=>p.gearDeployment<.01),name+' gear stays retracted after climb slows');
 reports.push({name,altitude:Math.round(f.position.y),speed:Math.round(f.airSpeed),braked:Math.round(slow.airSpeed),coast:Math.round(coast.airSpeed),takeoff:Math.round(takeoff.position.y),autoRetracted:true});
}
const env=createEnvironment();env.nodes=Object.keys({lake:1,river:1,waterfall:1}).map(waterNode);validateEnvironment(env,[]);
const bad=structuredClone(env);bad.nodes[0].flowSpeed=NaN;assert.throws(()=>validateEnvironment(bad,[]));
const result=editAgentEnvironment(env,[{op:'add',kind:'water',ref:'river',flowSpeed:2},{op:'update',nodeId:'river',patch:{flowAngle:90,opacity:.7}}],[]);assert(result.environment.nodes.at(-1).flowAngle===90);
const runtime=new EnvironmentRuntime(new THREE.Scene());await runtime.load(result.environment,[]);const mesh=runtime.objects.get(env.nodes[0].id).children[0];assert(mesh.material.waterNormal?.isTexture&&mesh.material.waterNormal.generateMipmaps);let textureDisposed=false;mesh.material.waterNormal.addEventListener('dispose',()=>textureDisposed=true);runtime.update(new THREE.PerspectiveCamera(),.05);assert(mesh.material.uniforms.time.value===.05);runtime.update(new THREE.PerspectiveCamera(),.05,true);assert(mesh.material.uniforms.time.value===.05);runtime.clear();assert(runtime.objects.size===0&&textureDisposed);
console.log(JSON.stringify({ok:true,reports,checks:'aim-directed build, independent direct controls, bank limits/recovery, braking, water collision, schema, agent, water pause/disposal'}));
