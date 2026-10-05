import * as THREE from 'three';

// A second camera views the existing actor. No second VRM, mixer or WebGL context.
export class LivePortrait {
  constructor(){this.camera=new THREE.PerspectiveCamera(30,1,.01,300);this.record=null;this.node=null;this.frames=0;}
  overlay(renderer,element){
    if(typeof document==='undefined')return;
    if(!this.overlayScene){
      this.overlayScene=new THREE.Scene();this.overlayCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);this.overlayCamera.position.z=1;
      this.overlayTextures=[false,true].map(soft=>{
        const canvas=document.createElement('canvas');canvas.width=1;canvas.height=128;const context=canvas.getContext('2d'),gradient=context.createLinearGradient(0,0,0,128);
        for(const [at,color]of [[0,'#00000000'],[.49,'#00000000'],[.63,`rgba(219,232,239,${soft?.05:.07})`],[.8,`rgba(230,239,244,${soft?.18:.34})`],[1,`rgba(249,251,253,${soft?.48:.86})`]])gradient.addColorStop(at,color);
        context.fillStyle=gradient;context.fillRect(0,0,1,128);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
      });
      this.overlayMaterial=new THREE.MeshBasicMaterial({map:this.overlayTextures[0],transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
      this.overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.overlayMaterial));
    }
    this.overlayMaterial.map=this.overlayTextures[element.closest('.stage-frame')?.classList.contains('shadows-on')?1:0];
    renderer.render(this.overlayScene,this.overlayCamera);
  }
  set(record,node){this.record=record;this.node=node;}
  clear(){this.record=null;this.node=null;}
  render(renderer,scene,element){
    const {record,node,camera}=this;
    if(!record||!node?.isConnected||node.classList.contains('hidden'))return;
    const area=element.getBoundingClientRect(),rect=node.getBoundingClientRect();
    if(!area.width||!area.height||!rect.width||!rect.height)return;
    const head=record.vrm.humanoid.getNormalizedBoneNode('head');if(!head)return;
    record.anchor.updateWorldMatrix(true,true);
    const scale=record.anchor.getWorldScale(new THREE.Vector3()).y;
    const center=head.getWorldPosition(new THREE.Vector3());center.y-=.16*scale;
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(record.anchor.getWorldQuaternion(new THREE.Quaternion()));
    camera.position.copy(center).addScaledVector(forward,1.25*scale);camera.position.y+=.03*scale;
    camera.aspect=rect.width/rect.height;camera.lookAt(center);camera.updateProjectionMatrix();camera.layers.set(31);
    const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
    const state={background:scene.background,autoClear:renderer.autoClear,scissor:renderer.getScissorTest(),shadow:renderer.shadowMap.autoUpdate,visible:record.vrm.scene.visible};
    const layers=[];record.vrm.scene.traverse(o=>{layers.push([o,o.layers.mask]);o.layers.enable(31);});
    scene.traverse(o=>{if(o.isLight){layers.push([o,o.layers.mask]);o.layers.enable(31);}});
    try{
      record.vrm.scene.visible=true;scene.background=null;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;
      this.overlay(renderer,element);
      const x=rect.left-area.left,y=area.bottom-rect.bottom;
      renderer.setViewport(x,y,rect.width,rect.height);renderer.setScissor(x,y,rect.width,rect.height);renderer.setScissorTest(true);
      renderer.clearDepth();renderer.render(scene,camera);this.frames++;
    }finally{
      for(const [object,mask]of layers)object.layers.mask=mask;
      record.vrm.scene.visible=state.visible;scene.background=state.background;renderer.autoClear=state.autoClear;renderer.shadowMap.autoUpdate=state.shadow;
      renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(state.scissor);
    }
  }
  dispose(){this.clear();this.overlayTextures?.forEach(t=>t.dispose());this.overlayMaterial?.dispose();this.overlayScene?.children[0]?.geometry.dispose();}
}
