import * as THREE from 'three';
export async function spatialSmoke(phase,c){
 const assert=(value,message)=>{if(!value)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 let st=c.stage();const p=c.project();
 const input=(selector,value)=>{const n=document.querySelector(selector);assert(n,'Missing '+selector);n.value=String(value);n.dispatchEvent(new Event('input',{bubbles:true}));};
 const shaders=()=>assert(!st.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'GPU shader compilation failed');
 const pixels=()=>{const gl=st.renderer.getContext(),w=st.renderer.domElement.width,h=st.renderer.domElement.height,bytes=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return{w,h,bytes};};
 const variance=(image,x)=>{let sum=0,squared=0,count=0;for(let row=Math.floor(image.h*.46);row<image.h*.54;row++)for(let col=Math.floor(image.w*(x-.035));col<image.w*(x+.035);col++){const v=image.bytes[(row*image.w+col)*4]/255;sum+=v;squared+=v*v;count++;}return squared/count-(sum/count)**2;};
 const cleanup=()=>{const d=window.__spatialTest;if(!d)return;for(const mesh of d.planes){st.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}d.texture.dispose();st.camera.position.fromArray(d.camera.position);st.camera.quaternion.fromArray(d.camera.rotation);st.camera.fov=d.camera.fov;st.camera.updateProjectionMatrix();st.scene.background=d.background;for(const r of st.visibleRecords.values())r.vrm.scene.visible=true;window.__spatialTest=null;};
 if(phase==='dof-off'){
  st.renderSuspended=true;st.clearLivePortrait();for(const r of st.visibleRecords.values())r.vrm.scene.visible=false;
  const camera={position:st.camera.position.toArray(),rotation:st.camera.quaternion.toArray(),fov:st.camera.fov},background=st.scene.background;
  st.camera.position.set(0,0,6);st.camera.lookAt(0,0,0);st.camera.fov=44;st.camera.updateProjectionMatrix();st.scene.background=new THREE.Color('#303a4e');
  const data=new Uint8Array(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const off=(y*256+x)*4,v=((x>>2)+(y>>2))%2?240:30;data.set([v,v,v,255],off);}
  const texture=new THREE.DataTexture(data,256,256,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.needsUpdate=true;
  const planes=[[-1.15,2,1.05,1.9],[2.3,-2,2.1,3.8]].map(([x,z,w,h])=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(x,0,z);st.scene.add(mesh);return mesh;});
  window.__spatialTest={camera,background,planes,texture};st.setRenderSettings({preset:'custom'});st.renderScene(0);shaders();const image=pixels();window.__spatialOff={near:variance(image,.30),far:variance(image,.70)};
  assert(window.__spatialOff.near>.03&&window.__spatialOff.far>.03,'Focus targets not visible');return{ok:true,...window.__spatialOff,dofDisabled:!st.stylePipeline.dofPass.enabled};
 }
 if(phase==='dof-on'){
  st.setRenderSettings({preset:'custom',filters:{dof:1,dofFocus:4,dofRange:.5,dofBlur:12}});st.renderScene(0);shaders();const image=pixels(),near=variance(image,.30),far=variance(image,.70),before=window.__spatialOff;
  assert(near>before.near*.8,'In-focus object became blurred');assert(far<before.far*.65,'Distant object did not blur');assert(st.stylePipeline.dofPass.uniforms.tDepth.value===st.stylePipeline.scenePass.normalTarget.depthTexture,'Depth attachment copied');return{ok:true,near,far,before,realDepth:true,sharedGeometryPass:true};
 }
 if(phase==='pointer-dialogue'||phase==='pointer-title'){
  cleanup();p.ui.spatialCamera={enabled:true,strength:.6};p.title.spatialCamera={enabled:true,strength:.4};
  if(phase==='pointer-title'){const idle=p.assets.find(a=>a.type==='motion'&&a.name.includes('自然站立'));p.title.actors=p.characters.map((r,i)=>({id:'spatial-title-'+i,characterId:r.id,modelId:r.modelId,motionId:idle.id,size:1,offsetX:(i-1)*1.2,offsetY:0,offsetZ:0,yaw:0,expressionWeights:{}}));p.title.render={preset:'custom',filters:{dof:.55,dofFocus:4.3,dofRange:1.5,dofBlur:8}};await c.title();st=c.stage();}
  else{st.spatialCamera.setSettings(p.ui.spatialCamera);st.setRenderSettings(p.acts[0].render||p.render);await c.portrait();}
  st.renderSuspended=true;st.spatialCamera.reset();const viewport=st.spatialCamera.viewport,r=viewport.getBoundingClientRect(),position=st.camera.position.clone(),rotation=st.camera.quaternion.clone(),authored=JSON.stringify(p.acts[0].steps[0].camera);
  viewport.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:r.right-1,clientY:r.top+1,bubbles:true}));for(let i=0;i<90;i++)st.spatialCamera.update(1/60);
  const text=document.querySelector('#dialogue')?.getBoundingClientRect(),portraitCamera=st.livePortrait.camera?.quaternion.clone();
  let offset=0,angle=0;st.spatialCamera.render(()=>{offset=st.camera.position.distanceTo(position);angle=st.camera.quaternion.angleTo(rotation);});assert(offset>.005&&offset<.05&&angle>.002&&angle<.03,'Pointer camera not following');st.renderScene(0);shaders();assert(st.camera.position.equals(position)&&st.camera.quaternion.equals(rotation),'Author camera drifted');assert(authored===JSON.stringify(p.acts[0].steps[0].camera),'Mouse pose persisted into dialogue');
  const after=document.querySelector('#dialogue')?.getBoundingClientRect();assert(!text||text.x===after.x&&text.y===after.y,'Dialogue UI moved with camera');assert(!portraitCamera||portraitCamera.angleTo(st.livePortrait.camera.quaternion)<1e-7,'Portrait camera moved with scene camera');
  viewport.dispatchEvent(new PointerEvent('pointerleave'));for(let i=0;i<120;i++)st.spatialCamera.update(1/60);assert(st.spatialCamera.current.length()<1e-6,'Mouse leave did not return');
  st.spatialCamera.reset();viewport.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:r.right,clientY:r.top}));st.spatialCamera.update(.1);assert(st.spatialCamera.current.length()===0,'Touch moved the camera');
  c.pause(true);st.spatialCamera.update(.1);assert(st.spatialCamera.current.length()===0,'Menu did not pause pointer camera');c.pause(false);
  return{ok:true,offsetMetres:offset,angleDegrees:angle*180/Math.PI,authoredPosePreserved:true,returnToCentre:true,touchIgnored:true,menuPause:true};
 }
 if(phase==='ui'){
  await c.edit();st=c.stage();await wait(1200);input('[data-render="preset"][data-render-scope="act"]','custom');for(const key of ['dof','dofFocus','dofRange','dofBlur'])assert(document.querySelector(`[data-npr-filter="${key}"]`),'Depth control missing');
  input('[data-spatial-camera="enabled"][data-spatial-scope="dialogue"]','on');input('[data-spatial-camera="strength"][data-spatial-scope="dialogue"]',60);
  input('[data-npr-filter="dof"]',.5);input('[data-npr-filter="dofFocus"]',4.7);assert(p.ui.spatialCamera.enabled&&p.ui.spatialCamera.strength===.6,'Dialogue setting failed');assert(p.acts[0].render.filters.dof===.5,'Depth setting failed');
  document.querySelector('[data-action="dof-focus"]').click();await wait(100);assert(p.acts[0].render.filters.dofFocus>0,'Character focus button failed');
  await c.titleEditor();assert(document.querySelector('[data-spatial-scope="title"]'),'Independent title control missing');input('[data-spatial-camera="enabled"][data-spatial-scope="title"]','on');input('[data-spatial-camera="strength"][data-spatial-scope="title"]',40);
  assert(p.title.spatialCamera.strength===.4&&p.ui.spatialCamera.strength===.6,'Title and dialogue settings mixed');return{ok:true,depthControls:true,characterFocus:true,independentControls:true};
 }
 if(phase==='save'){await c.save();return{ok:true,dialogue:p.ui.spatialCamera,title:p.title.spatialCamera,depth:p.acts[0].render.filters,titleDepth:p.title.render};}
 if(phase==='user-gpu'){
  p.id='spatial-user-probe-'+Date.now();const first=p.acts.find(a=>a.kind!=='event'&&a.steps?.length);first.steps[0].itemGrants=[];p.ui.spatialCamera={enabled:true,strength:.5};await c.play();st=c.stage();await wait(500);st.renderSuspended=true;
  const visible=[...st.visibleRecords.values()].filter(r=>r.vrm.scene.visible),r=visible.find(r=>r===st.livePortrait.record)||visible[0];assert(r,'User character not loaded');st.camera.updateMatrixWorld(true);const head=r.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3()),focus=-head.applyMatrix4(st.camera.matrixWorldInverse).z;
  st.setRenderSettings({preset:'custom',filters:{dof:.7,dofFocus:focus,dofRange:1.2,dofBlur:8,toon:.5,outline:.3}});st.renderScene(.016);st.livePortrait.render(st.renderer,st.scene,st.element);shaders();const image=pixels();assert(image.bytes.some((n,i)=>i%4!==3&&n>30),'User scene rendered black');return{ok:true,actualProject:true,actors:visible.length,focusMetres:focus,depthEnabled:true,livePortrait:Boolean(st.livePortrait.record)};
 }
 if(phase==='reopen'){await c.title();st=c.stage();await wait(700);assert(p.ui.spatialCamera.enabled&&p.title.spatialCamera.enabled,'Settings lost on reopen');assert(st.stylePipeline.dofPass.enabled&&st.spatialCamera.settings.enabled,'Exported title effects unavailable');shaders();return{ok:true,settingsPersisted:true,titleDepth:true,titlePointer:true};}
 throw Error('Unknown spatial phase');
}
