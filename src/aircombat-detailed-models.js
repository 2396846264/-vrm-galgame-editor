import * as THREE from 'three';
import {historicalParts,historicalSpecs} from './aircombat-historical-kit.js';
function hull(length,width,height,segments=32,stations=15){
 const positions=[],indices=[];for(let j=0;j<=stations;j++){const t=j/stations,z=(t-.5)*length;let radius=t<.12?.28+t/.12*.65:t<.55?.93:t<.9?.93-(t-.55)/.35*.78:.15-(t-.9)*1.3;radius=Math.max(.025,radius);for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2;positions.push(Math.cos(a)*width*.5*radius,Math.sin(a)*height*.5*radius+(t>.65?(t-.65)*.14:0),z);}}
 for(let j=0;j<stations;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));for(let i=0;i<indices.length;i+=3)[indices[i],indices[i+1]]=[indices[i+1],indices[i]];g.setIndex(indices);g.computeVertexNormals();return g;
}
function wing(span,chord,side=1,sweep=.2,gull=false,spanSteps=8,chordSteps=10){
 const positions=[],indices=[],row=chordSteps+1,layer=(spanSteps+1)*row;
 for(const upper of [true,false])for(let i=0;i<=spanSteps;i++){const u=i/spanSteps,c=chord*(1-.52*u),dihedral=gull?(u<.26?-u*1.7:-.442+(u-.26)*.68):u*.18;for(let j=0;j<=chordSteps;j++){const v=j/chordSteps,thickness=c*.12*Math.sin(Math.PI*v)**.75;positions.push(side*u*span,dihedral+(upper?1:-1)*thickness*.5,(v-.5)*c+u*sweep);}}
 for(let i=0;i<spanSteps;i++)for(let j=0;j<chordSteps;j++){const a=i*row+j,b=a+row;indices.push(a,b,a+1,b,b+1,a+1,a+layer,a+1+layer,b+layer,b+layer,a+1+layer,b+1+layer);}
 const stitch=(a,b)=>indices.push(a,a+layer,b,b,a+layer,b+layer);
 for(let i=0;i<spanSteps;i++){stitch(i*row,(i+1)*row);stitch(i*row+chordSteps,(i+1)*row+chordSteps);}for(let j=0;j<chordSteps;j++){stitch(j,j+1);stitch(spanSteps*row+j,spanSteps*row+j+1);}
 if(side<0)for(let i=0;i<indices.length;i+=3)[indices[i],indices[i+1]]=[indices[i+1],indices[i]];
 for(let i=0;i<indices.length;i+=3)[indices[i],indices[i+1]]=[indices[i+1],indices[i]];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function detailedPartModel(part){
 const d=historicalParts[part.type];if(!d)return null;const spec=historicalSpecs[d.kit],root=new THREE.Group();
 const paint=new THREE.MeshStandardMaterial({color:part.color||d.color,roughness:.6,metalness:.2}),dark=new THREE.MeshStandardMaterial({color:'#28363d',roughness:.32,metalness:.45}),rubber=new THREE.MeshStandardMaterial({color:'#202325',roughness:.95}),steel=new THREE.MeshStandardMaterial({color:'#697376',metalness:.7,roughness:.4}),glass=new THREE.MeshStandardMaterial({color:'#253b4b',roughness:.16,metalness:.45,transparent:false,opacity:1}),underside=new THREE.MeshStandardMaterial({color:'#afb6b3',roughness:.7});
 const mesh=(geometry,material=paint,position=[0,0,0],rotation=[0,0,0])=>{const m=new THREE.Mesh(geometry,material);m.position.fromArray(position);m.rotation.set(...rotation);root.add(m);return m;};
 const box=(size,pos,mat=paint)=>mesh(new THREE.BoxGeometry(...size),mat,pos);
 const cylinder=(radius,length,pos,mat=paint,axis='z',segments=16)=>mesh(new THREE.CylinderGeometry(radius,radius,length,segments,1),mat,pos,axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0]);
 if(d.shape==='body'){
  const body=mesh(hull(spec.length,spec.bodyWidth,spec.bodyHeight,32,16));
  // Distinct light underside, modeled as a lower inset surface rather than a texture.
  const belly=mesh(hull(spec.length*.76,spec.bodyWidth*.89,spec.bodyHeight*.35,16,8),underside,[0,-spec.bodyHeight*.35,spec.length*.03]);
  for(const side of [-1,1])for(let i=0;i<6;i++)cylinder(.055,.2,[side*spec.bodyWidth*.45,spec.bodyHeight*.14,-spec.length*.23+i*.12],dark,'x',8);
  if(spec.pusher)for(const side of [-1,1]){const intake=mesh(hull(1.6,.3,.6,16,6),paint,[side*.58,.04,1.1]);box([.08,.42,.52],[side*.74,.06,.48],dark);}
 }
 else if(d.shape==='cockpit'){
  const rings=[],positions=[],indices=[],sections=[[-.5,.55,.22],[-.32,1,.6],[.08,1,.64],[.35,.85,.48],[.5,.35,.08]];
  for(const [z,w,h]of sections){const radius=d.size[0]*.47*w;const ring=[[-radius,0],[-radius*.85,h*.72],[-radius*.46,h],[radius*.46,h],[radius*.85,h*.72],[radius,0]].map(([x,y])=>new THREE.Vector3(x,y,z*d.size[2]));rings.push(ring);for(const p of ring)positions.push(p.x,p.y,p.z);}
  for(let i=0;i<4;i++)for(let j=0;j<5;j++){const a=i*6+j,b=a+6;indices.push(a,a+1,b,b,a+1,b+1);}for(let i=1;i<5;i++){indices.push(0,i+1,i,24,24+i,24+i+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();const panes=glass.clone();panes.flatShading=true;panes.side=THREE.DoubleSide;mesh(geometry,panes);
  const rod=(a,b)=>{const delta=b.clone().sub(a),m=mesh(new THREE.CylinderGeometry(.024,.024,delta.length(),8),paint,a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());};
  for(const ring of rings)for(let i=0;i<5;i++)rod(ring[i],ring[i+1]);for(let j=0;j<6;j++)for(let i=0;i<4;i++)rod(rings[i][j],rings[i+1][j]);
 }
 else if(d.shape==='wing'){
  mesh(wing(spec.wingSpan,spec.chord,d.side,spec.sweep,spec.gull));
  // Aileron edge and flap hinge bands remain separate, visible geometry.
  const length=spec.wingSpan*.38,x=d.side*spec.wingSpan*.7,z=spec.chord*.22+spec.sweep*.7,y=spec.gull?.05:.13;
  const flap=box([length,.026,.035],[x,y,z],steel);flap.rotation.y=-d.side*Math.atan(spec.sweep/spec.wingSpan);
 }
 else if(d.shape==='tail'){
  for(const side of [-1,1])mesh(wing(spec.tailSpan,spec.tailChord,side,.25,false,5,8));
  if(!spec.pusher){const fins=spec.doubleTail?[-1,1]:[0];for(const side of fins){const fin=mesh(wing(spec.doubleTail?1.5:1.35,spec.tailChord,1,.32,false,5,8),paint,[side*spec.tailSpan*.83,0,.08],[0,0,Math.PI/2]);}}
 }
 else if(d.shape==='fin'){mesh(wing(1.45,1.3,1,.4,false,5,8),paint,[0,0,0],[0,0,Math.PI/2]);}
 else if(d.shape==='engine'){
  const radial=d.kit==='b25'||d.kit==='shinden',length=d.size[2],radius=d.size[0]*.5,sign=d.pusher?1:-1;
  if(radial){const cowl=mesh(new THREE.CylinderGeometry(radius*.9,radius,length,20,2),paint,[0,0,0],[Math.PI/2,0,0]);cylinder(radius*.84,.12,[0,0,sign*length*.49],dark);for(let i=0;i<9;i++){const a=i/9*Math.PI*2;cylinder(.08,.27,[Math.cos(a)*radius*.63,Math.sin(a)*radius*.63,sign*length*.53],steel,'z',8);}}
  else mesh(hull(length,d.size[0],d.size[1],24,8));
  const prop=new THREE.Group();prop.position.z=sign*(length*.56);root.add(prop);const hub=new THREE.Mesh(new THREE.ConeGeometry(radial?.32:.35,.58,20),paint);hub.rotation.x=sign<0?-Math.PI/2:Math.PI/2;hub.position.z=sign*.22;prop.add(hub);
  for(let i=0;i<d.blades;i++){const blade=new THREE.Mesh(wing(d.propRadius,.35,1,.12,false,6,4),dark);blade.rotation.z=i/d.blades*Math.PI*2;blade.rotation.y=.15;prop.add(blade);}
  root.userData.prop=prop;
 }
 else if(d.shape==='gear'){
  const points=d.kit==='b25'?[[-3.6,-1.2,-.7],[3.6,-1.2,-.7],[0,-1.35,-5.4]]:d.kit==='shinden'?[[-2.1,-2.0,1.9],[2.1,-2.0,1.9],[0,-2.1,-3.25]]:d.kit==='stuka'?[[-1.9,-1.0,-.6],[1.9,-1.0,-.6],[0,-.4,4.3]]:[[-1,-.85,-.5],[1,-.85,-.5],[0,-.35,3.3]];
  for(const [x,y,z]of points){const r=x===0?.23:d.kit==='b25'?.46:.35;cylinder(.055,Math.abs(y),[x,y*.5,z],steel,'y',8);cylinder(.03,Math.abs(y)*.7,[x*.93,y*.38,z+.1],steel,'y',8);const tire=mesh(new THREE.TorusGeometry(r,.12,6,16),rubber,[x,y,z],[0,Math.PI/2,0]);cylinder(r*.45,.23,[x,y,z],steel,'x');if(d.kit==='stuka'&&x!==0){const cover=mesh(hull(1.15,.42,.65,20,8),paint,[x,y+.1,z]);}else if(x!==0)box([.08,Math.abs(y)*.8,.65],[x+.08,y*.5,z],paint);}
 }
 else if(d.shape==='gun'){
  const length=d.size[2],radius=d.caliber>=37?.055:.025;
  if(d.caliber===37){mesh(hull(1.75,.46,.42,20,8),paint,[0,0,.48]);for(const x of [-.22,.22])box([.05,.3,1.15],[x,.22,.5],steel);}
  else box([.18,.17,.4],[0,0,.23],dark);
  cylinder(radius,length,[0,0,-length*.32],steel,'z',12);cylinder(radius*1.55,.18,[0,0,-length*.82],dark,'z',12);
  if(d.caliber>=37)for(const x of [-1,1])box([radius*1.2,radius*2.6,.1],[x*radius*1.5,0,-length*.8],dark);
 }
 else if(d.shape==='turret'){
  cylinder(d.size[0]*.48,.16,[0,0,0],paint);const pivot=new THREE.Group();root.add(pivot);root.userData.turret=pivot;const elevation=new THREE.Group();pivot.add(elevation);root.userData.turretPitch=elevation;
  if(d.kit==='b25'){const bubble=new THREE.Mesh(new THREE.SphereGeometry(.48,16,8,0,Math.PI*2,0,Math.PI/2),glass);bubble.position.y=.03;pivot.add(bubble);}
  for(let i=0;i<(d.barrels||2);i++){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,1.1,10),steel);barrel.rotation.x=Math.PI/2;barrel.position.set((i-.5)*.22,.21,-.6);elevation.add(barrel);const breech=new THREE.Mesh(new THREE.BoxGeometry(.12,.16,.3),dark);breech.position.set((i-.5)*.22,.18,0);elevation.add(breech);}
 }
 else if(d.shape==='gunnose'){mesh(hull(2.2,1.5,1.4,28,10));}
 else if(d.shape==='radiator'){box(d.size,[0,0,0]);box([d.size[0]*.86,d.size[1]*.76,.04],[0,0,-d.size[2]*.51],dark);for(let i=0;i<7;i++)box([.035,d.size[1]*.73,.055],[(i-3)*.08,0,-d.size[2]*.53],steel);}
 else if(d.shape==='tank'||d.shape==='bomb'){mesh(hull(d.size[2],d.size[0],d.size[1],20,10));if(d.shape==='bomb'){box([.7,.04,.3],[0,0,d.size[2]*.35]);box([.04,.7,.3],[0,0,d.size[2]*.35]);}}
 root.userData.partId=part.id;return root;
}
