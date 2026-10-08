import {dialogueSlots,dialogueSlotPosition} from './dialogue-cast.js';
import * as THREE from 'three';
import {disposeTree} from './environment-runtime.js';
export function addReferencePeople(references,referenceSettings={},referenceMultiple=false){
 disposeTree(references);references.clear();
 for(const [number,slot] of dialogueSlots.entries()){
  if(number>=3&&!referenceSettings[slot]?.characterId)continue;const index=number%3;
  const setting=referenceSettings[slot]||{},person=new THREE.Group();
  const material=new THREE.MeshBasicMaterial({color:[0x65aaff,0x57cdb2,0xffbd67][index],transparent:true,opacity:.38,depthWrite:false});
  function part(geometry,x,y,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);person.add(m);return m;}
  part(new THREE.SphereGeometry(.115,16,12),0,1.685);
  part(new THREE.CylinderGeometry(.18,.13,.57,16),0,1.23);
  part(new THREE.SphereGeometry(.16,16,12),0,.91).scale.set(1,.7,.7);
  for(const side of [-1,1]){part(new THREE.CapsuleGeometry(.065,.56,6,12),side*.09,.45);part(new THREE.BoxGeometry(.13,.08,.26),side*.09,.04,.06);const arm=part(new THREE.CapsuleGeometry(.052,.47,6,12),side*.245,1.17);arm.rotation.z=side*.12;}
  const size=Math.max(.5,Math.min(5,Number(setting.size)||1.15));person.scale.setScalar(size);
  const base=dialogueSlotPosition(slot,referenceMultiple);
  person.position.set(base.x+(Number(setting.offsetX)||0),Number(setting.offsetY)||0,base.z+(Number(setting.offsetZ)||0));person.rotation.y=THREE.MathUtils.degToRad(Number(setting.yaw)||0);
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');ctx.font='bold 32px Microsoft YaHei';ctx.textAlign='center';ctx.fillStyle='white';ctx.strokeStyle='#213348';ctx.lineWidth=5;const label=(number<3?'':(Math.floor(number/3)+1)+'排')+['左','中','右'][index];ctx.strokeText(label,64,44);ctx.fillText(label,64,44);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.position.set(0,1.98,0);sprite.scale.set(.4,.2,1);person.add(sprite);references.add(person);
 }
}
