import * as T from 'three';
export const seaMaps={open:{name:'开阔大洋',seed:108,count:0},blue:{name:'碧海 · 单岛',seed:271,count:1},twins:{name:'远岸 · 双岛',seed:637,count:2},scattered:{name:'疏岛海域',seed:942,count:4},outer:{name:'外海礁群',seed:1523,count:6}};
export const normalizeSeaMap=id=>seaMaps[id]?id:'open';
export function seaMapData(id){const preset=seaMaps[normalizeSeaMap(id)];let seed=preset.seed;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const islands=[];for(let i=0;i<preset.count;i++)islands.push({x:(i%2?-1:1)*(14000+random()*13000),z:(random()-.5)*44000,radius:700+random()*1000,height:100+random()*240,phase:random()*Math.PI*2});
 return{id:normalizeSeaMap(id),size:70000,islands};
}
// Same analytic footprint drives the render mesh, aircraft terrain and naval collision.
export function islandHeight(island,x,z){const dx=x-island.x,dz=z-island.z,angle=Math.atan2(dz,dx),edge=island.radius*(1+.10*Math.sin(angle*3+island.phase)+.06*Math.cos(angle*5-island.phase)),r=Math.hypot(dx,dz)/edge;return r>=1?-8:Math.pow(1-r*r,1.7)*island.height;}
export function seaGroundHeight(map,x,z){return Math.max(-8,...map.islands.map(i=>islandHeight(i,x,z)));}
export function seaTerrain(map){const root=new T.Group();root.name='sea-map-'+map.id;
 for(const island of map.islands){const n=24,g=new T.PlaneGeometry(island.radius*2.5,island.radius*2.5,n,n);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i)+island.x,z=p.getZ(i)+island.z,y=islandHeight(island,x,z);p.setXYZ(i,x,y,z);const c=new T.Color(y<12?'#c9b78c':y<island.height*.58?'#587952':'#68736d');colors.push(c.r,c.g,c.b);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));mesh.userData.seaIsland=island;root.add(mesh);
 }return root;
}
export function seaMapPreview(id){const m=seaMapData(id);return `<svg viewBox="0 0 160 160" role="img" aria-label="海图预览" style="width:100%;max-width:220px;border-radius:12px;background:#246477"><path d="M80 0V160M0 80H160" stroke="#a6d4d4" stroke-opacity=".25"/>${m.islands.map(i=>`<circle cx="${80+i.x/70000*160}" cy="${80+i.z/70000*160}" r="${Math.max(3,i.radius/70000*160)}" fill="#b4b682"/>`).join('')}<path d="M72 40h16M72 120h16" stroke="#fff" stroke-width="3"/><text x="7" y="151" fill="#fff" font-size="9">70 × 70 km · 北 ↑</text></svg>`;}
// Reject island crossings without teleporting ships through land; resume when their heading clears it.
export function constrainSeaFleets(fleets,map,previous,dt){for(const fleet of fleets){const blocked=fleet.members.some(u=>u.flight.alive&&map.islands.some(i=>Math.hypot(u.flight.position.x-i.x,u.flight.position.z-i.z)<i.radius*1.2+u.flight.spec.radius));if(!blocked)continue;const old=previous.get(fleet);if(!old)continue;const delta=old.clone().sub(fleet.anchor);fleet.anchor.copy(old);fleet.heading+=dt*.025;for(const u of fleet.members){u.flight.position.add(delta);u.flight.velocity.set(0,0,0);u.flight.airSpeed=0;}}}
export function enforceSeaBoundary(flight,map,carriers=[]){const h=map.size/2;if(Math.max(Math.abs(flight.position.x),Math.abs(flight.position.z))<=h)return false;
 // Existing carriers can operate 45 km behind the gun line: retain a supply corridor to them.
 if(carriers.some(u=>{if(!u.flight.alive)return false;const end=u.flight.position.clone();end.y=0;const p=flight.position.clone();p.y=0;const t=T.MathUtils.clamp(p.dot(end)/Math.max(1,end.lengthSq()),0,1);return p.distanceTo(end.multiplyScalar(t))<10000;}))return false;
 const x=T.MathUtils.clamp(flight.position.x,-h,h),z=T.MathUtils.clamp(flight.position.z,-h,h);flight.position.x=x;flight.position.z=z;const center=new T.Vector3(-x,0,-z).normalize(),speed=Math.max(40,flight.velocity.length());flight.velocity.x=center.x*speed;flight.velocity.z=center.z*speed;flight.rotation.setFromAxisAngle(new T.Vector3(0,1,0),Math.atan2(-center.x,-center.z));return true;}
