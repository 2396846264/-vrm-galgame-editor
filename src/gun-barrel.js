import * as T from 'three';
// Cylinder +Y is the breech; after X rotation the open -Y end points down -Z.
// Children recoil with the outer tube; only that tube registers a muzzle.
export function gunBarrel(caliber,length,material){
 const bore=Math.max(.004,caliber/2000),muzzle=bore*1.28,breech=muzzle*1.16,depth=Math.min(length*.12,bore*4,.48);
 const tube=new T.Mesh(new T.CylinderGeometry(breech,muzzle,length,16,1,true),material);
 tube.userData.weaponBarrel=true;tube.userData.boreRadius=bore;tube.userData.recessDepth=depth;
 const inner=new T.Mesh(new T.CylinderGeometry(bore,bore,depth,16,1,true),new T.MeshStandardMaterial({color:'#151d22',side:T.BackSide,roughness:.9}));
 inner.position.y=-length/2+depth/2;tube.add(inner);
 const lip=new T.Mesh(new T.RingGeometry(bore,muzzle,16),material);lip.rotation.x=Math.PI/2;lip.position.y=-length/2;tube.add(lip);
 const end=new T.Mesh(new T.CircleGeometry(bore,16),new T.MeshBasicMaterial({color:'#060a0c',side:T.DoubleSide}));end.rotation.x=Math.PI/2;end.position.y=-length/2+depth;tube.add(end);
 return tube;
}
