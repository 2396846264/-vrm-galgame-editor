import assert from 'node:assert/strict';
import * as THREE from 'three';
import {facingShapeRotation} from '../src/vehicle-placement.js';
import {normalizeStructure,setBlock,expandedBlocks} from '../src/vehicle-structure.js';
import {normalizeCombat,aircraftPreset} from '../src/aircombat-schema.js';
import {actResourceEntries,actMediaAssets} from '../src/act-resources.js';
import {editAgentProject} from '../src/project-agent-operations.js';
import {mergeEditorProject} from '../src/editor-project-merge.js';
import {airDialogueAction,airDialogueInput,airDialogueEditor} from '../src/aircombat-dialogue-editor.js';
for(const shape of ['cone','pyramid','wedge'])for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
 const camera=new THREE.PerspectiveCamera();camera.position.fromArray(direction);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const rotation=facingShapeRotation(shape,camera.quaternion),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(v=>v*Math.PI/180)));
 const tip=new THREE.Vector3(...(shape==='wedge'?[0,0,-1]:[0,1,0])).applyQuaternion(q);assert(tip.dot(camera.position)>.999);
 const v={blocks:[]};setBlock(v,[2,1,0],'hull','#ff3377',shape,rotation);const saved=normalizeStructure(JSON.parse(JSON.stringify(v)));assert.deepEqual(saved.blocks[0].shapeRotation,rotation);
 const mirror=expandedBlocks(saved)[1],mq=new THREE.Quaternion().setFromEuler(new THREE.Euler(...mirror.shapeRotation.map(v=>v*Math.PI/180))),mt=new THREE.Vector3(...(shape==='wedge'?[0,0,-1]:[0,1,0])).applyQuaternion(mq);assert(Math.abs(mt.x+tip.x)<1e-6&&Math.abs(mt.y-tip.y)<1e-6&&Math.abs(mt.z-tip.z)<1e-6);
}
const project={id:'air67',name:'air67',assets:[{id:'model',type:'mmdCharacter',path:'role.pmx'},{id:'motion',type:'motion',folderId:'character-motion-role',path:'nod.vmd'},{id:'voice',type:'voice',characterId:'role',path:'line.wav'}],characters:[{id:'role',name:'角色',modelId:'model',props:[]}],ui:{},title:{actors:[]},environments:[],items:[],knowledgeBooks:[],assetFolders:[],renderPresets:[],acts:[{id:'story',steps:[{id:'l',characterId:'role',text:'文字',choices:[],cast:{},offstage:{motionId:'motion',motionOptions:{loop:true}}}]}]};
const entries=actResourceEntries(project,project.acts[0]);assert.equal(entries[0].motionAsset.id,'motion');assert(entries[0].portraitOnly);
const c=normalizeCombat({aircraft:aircraftPreset()});airDialogueAction(c,'event-air-dialogue-add',{});airDialogueInput(c,{dataset:{index:'0',airDialogue:'characterId'},value:'role'});airDialogueInput(c,{dataset:{index:'0',airDialogue:'text'},value:'云中通讯'});airDialogueInput(c,{dataset:{index:'0',airDialogue:'motionId'},value:'motion'});c.dialogues[0].voiceId='voice';
const event={id:'air',kind:'event',name:'空战',event:{type:'aircombat',combat:normalizeCombat(c)},steps:[{id:'event-step'}]};project.acts.push(event);
assert.equal(actResourceEntries(project,event)[0].motionAsset.id,'motion');assert(actMediaAssets(project,event).some(a=>a.id==='voice'));
assert(airDialogueEditor(event,{project:()=>project,escape:String}).includes('场外头像动作'));
const next=editAgentProject(project,[{action:'update',kind:'dialogue',ownerId:'story',id:'l',data:{offstage:{motionId:'motion',motionOptions:{loop:true}}}}]).project;assert.equal(next.acts[0].steps[0].offstage.motionId,'motion');
const base=structuredClone(project),parent=structuredClone(project),child=structuredClone(project);parent.name='主窗口';child.acts[0].steps[0].offstage.motionOptions.loop=false;const merged=mergeEditorProject(base,parent,child);assert.equal(merged.name,'主窗口');assert.equal(merged.acts[0].steps[0].offstage.motionOptions.loop,false);
assert.deepEqual(normalizeCombat(JSON.parse(JSON.stringify(c))).dialogues,c.dialogues);
console.log('PASS: 18 camera-facing shapes, symmetry and persistence, offstage motion preload, air dialogue authoring/media, Agent edits and merge.');
