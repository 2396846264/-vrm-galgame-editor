import * as T from 'three';
export function shipFlag(){
 const root=new T.Group(),metal=new T.MeshStandardMaterial({color:'#697c85',metalness:.5,roughness:.45});
 const pole=new T.Mesh(new T.CylinderGeometry(.055,.095,9,8),metal);root.add(pole);
 const finial=new T.Mesh(new T.SphereGeometry(.13,8,6),metal);finial.position.y=4.5;root.add(finial);
 const geometry=new T.PlaneGeometry(3.6,2.1,16,6);geometry.translate(1.84,3.25,0);
 const material=new T.MeshStandardMaterial({color:'#f0e6ce',side:T.DoubleSide,roughness:.9});
 const cloth=new T.Mesh(geometry,material);root.add(cloth);
 root.userData.flag=cloth;root.userData.flagRest=Float32Array.from(geometry.attributes.position.array);
 root.userData.animateFlag=time=>{const pos=geometry.attributes.position,rest=root.userData.flagRest;for(let i=0;i<pos.count;i++){const x=rest[i*3],y=rest[i*3+1],u=(x-.04)/3.6;pos.setXYZ(i,x,y-Math.pow(u,1.3)*.16+Math.sin(time*3.2-x*2.6+y)*u*.06,Math.sin(time*4.1-x*2.2+y*.8)*u*.27+Math.sin(time*2.3-x*4)*u*.08);}pos.needsUpdate=true;geometry.computeVertexNormals();};
 return root;
}
export function configureShipFlags(model,assets,url){
 model.traverse(o=>{if(!o.userData.flag)return;const id=o.userData.flagImageId,asset=assets?.find(a=>a.id===id&&a.type==='image');if(!asset)return;
  let disposed=false,texture;const material=o.userData.flag.material;
  o.userData.disposeFlag=()=>{disposed=true;texture?.dispose();};
  new T.TextureLoader().load(url(asset),t=>{if(disposed){t.dispose();return;}texture=t;t.colorSpace=T.SRGBColorSpace;material.map=t;material.color.set('#ffffff');material.needsUpdate=true;},undefined,()=>{o.userData.flagLoadError=true;});
 });
}
export function animateShipFlags(model,time){model.traverse(o=>o.userData.animateFlag?.(time));}
