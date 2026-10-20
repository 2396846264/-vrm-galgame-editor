import * as THREE from 'three';
import {setShoulderPortraitCamera} from './portrait-camera.js';
import {portraitBodyFrame} from './portrait-body-frame.js';
import {normalizePortraitFraming,framePortraitCamera} from './portrait-framing.js';

// A second camera views the existing actor. No second VRM, mixer or WebGL context.
export class LivePortrait {
  constructor(){this.camera=new THREE.OrthographicCamera(-.2,.2,.2,-.2,.01,300);this.record=null;this.node=null;this.frames=0;}
  overlay(renderer,element){
    if(typeof document==='undefined')return;
    if(!this.overlayScene){
      this.overlayScene=new THREE.Scene();this.overlayCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);this.overlayCamera.position.z=1;
      this.overlayTextures=[{soft:false},{soft:true},{soft:false,dark:true},{soft:true,dark:true}].map(({soft,dark})=>{
        const canvas=document.createElement('canvas');canvas.width=1;canvas.height=128;const context=canvas.getContext('2d'),gradient=context.createLinearGradient(0,0,0,128);
        const stops=dark?[[0,'#00000000'],[.5,'#00000000'],[.7,'#10182a22'],[.85,'#10182a99'],[1,soft?'#080c19cc':'#080c19ee']]:[[0,'#00000000'],[.49,'#00000000'],[.63,`rgba(219,232,239,${soft?.05:.07})`],[.8,`rgba(230,239,244,${soft?.18:.34})`],[1,`rgba(249,251,253,${soft?.48:.86})`]];
        for(const [at,color]of stops)gradient.addColorStop(at,color);
        context.fillStyle=gradient;context.fillRect(0,0,1,128);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
      });
      this.overlayMaterial=new THREE.MeshBasicMaterial({map:this.overlayTextures[0],transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
      this.overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.overlayMaterial));
    }
    const frame=element.closest('.stage-frame'),dark=frame?.closest('.player')?.dataset.gameUi==='astral';
    this.overlayMaterial.map=this.overlayTextures[(dark?2:0)+(frame?.classList.contains('shadows-on')?1:0)];
    renderer.render(this.overlayScene,this.overlayCamera);
  }
  setSettings(value){this.settings=normalizePortraitFraming(value);}
  set(record,node){this.record=record;this.node=node;}
  clear(){this.node?.querySelector?.('.live-portrait-canvas')?.remove();this.record=null;this.node=null;}
  // In the game the portrait must be above the frosted dialogue surface. Render
  // the SAME animated actor to a small target using the existing WebGL context,
  // then transfer pixels asynchronously to a clipped DOM canvas. Editor framing
  // and its original direct viewport path remain unchanged.
  renderGlassPortrait(renderer,scene,node,rect){
    if(this.readingPortrait)return;
    const ratio=Math.min(renderer.getPixelRatio(),2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
    if(!this.portraitTarget){this.portraitTarget=new THREE.WebGLRenderTarget(width,height);this.portraitTarget.texture.colorSpace=THREE.SRGBColorSpace;}
    if(this.portraitTarget.width!==width||this.portraitTarget.height!==height)this.portraitTarget.setSize(width,height);
    let canvas=node.querySelector('.live-portrait-canvas');
    if(!canvas){canvas=document.createElement('canvas');canvas.className='live-portrait-canvas';canvas.setAttribute('aria-hidden','true');node.append(canvas);}
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const target=renderer.getRenderTarget(),clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
    try{
      renderer.setRenderTarget(this.portraitTarget);renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,this.camera);
      this.readingPortrait=true;
      renderer.readRenderTargetPixelsAsync(this.portraitTarget,0,0,width,height,new Uint8Array(width*height*4)).then(bytes=>{
        if(!canvas.isConnected||canvas.width!==width||canvas.height!==height)return;
        const pixels=new Uint8ClampedArray(bytes.length),stride=width*4;
        for(let y=0;y<height;y++)pixels.set(bytes.subarray((height-1-y)*stride,(height-y)*stride),y*stride);
        canvas.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);this.frames++;
      }).catch(error=>{if(!this.disposed)console.warn('Portrait transfer unavailable',error.message);}).finally(()=>{this.readingPortrait=false;});
    }finally{renderer.setRenderTarget(target);renderer.setClearColor(clearColor,clearAlpha);}
  }
  render(renderer,scene,element){
    const {record,node,camera}=this;
    if(!record||!node?.isConnected||node.classList.contains('hidden'))return;
    const area=element.getBoundingClientRect(),rect=node.getBoundingClientRect();
    if(!area.width||!area.height||!rect.width||!rect.height)return;
    const head=record.vrm.humanoid.getNormalizedBoneNode('head');if(!head)return;
    record.anchor.updateWorldMatrix(true,true);
    const {target,orientation,scale}=portraitBodyFrame(record);
    setShoulderPortraitCamera(camera,target,scale,orientation,rect.height/rect.width);
    if(node.closest?.('.player')){
      // Extend the drawing area to the stage edge without shifting or resizing
      // the actor: retain the projection of the previous 4% / 50% viewport.
      const viewWidth=2/1.1*scale,unitsPerPixel=viewWidth/(area.width*.5);
      // The existing target viewport scales with the renderer's pixel ratio.
      // Compensate only the added strip so high-DPI displays keep the same pose.
      const viewportScale=renderer.getPixelRatio?.()||1;
      camera.left=-.25*scale-(area.left+area.width*.04-rect.left)*unitsPerPixel/viewportScale;
      camera.right=camera.left+rect.width*unitsPerPixel;
      camera.bottom=-.24*scale;camera.top=camera.bottom+rect.height*unitsPerPixel;
      camera.position.copy(target).add(new THREE.Vector3(-.85,.05,1.7).multiplyScalar(scale).applyQuaternion(orientation));
      camera.lookAt(target.clone().add(new THREE.Vector3(0,.03,0).multiplyScalar(scale).applyQuaternion(orientation)));camera.updateProjectionMatrix();

    }
    framePortraitCamera(camera,this.settings);
    camera.layers.set(31);
    const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
    const state={background:scene.background,autoClear:renderer.autoClear,scissor:renderer.getScissorTest(),shadow:renderer.shadowMap.autoUpdate,visible:record.vrm.scene.visible};
    const layers=[];record.vrm.scene.traverse(o=>{layers.push([o,o.layers.mask]);o.layers.enable(31);});
    scene.traverse(o=>{if(o.isLight){layers.push([o,o.layers.mask]);o.layers.enable(31);}});
    try{
      record.vrm.scene.visible=true;scene.background=null;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;
      if(node.closest?.('.player')){this.renderGlassPortrait(renderer,scene,node,rect);return;}
      this.overlay(renderer,element);
      // Preserve shoulder size and angle, but extend the view upward for hair/headroom.
      const x=rect.left-area.left,y=area.bottom-rect.bottom;
      renderer.setViewport(x,y,rect.width,rect.height);renderer.setScissor(x,y,rect.width,rect.height);renderer.setScissorTest(true);
      renderer.clearDepth();renderer.render(scene,camera);this.frames++;
    }finally{
      for(const [object,mask]of layers)object.layers.mask=mask;
      record.vrm.scene.visible=state.visible;scene.background=state.background;renderer.autoClear=state.autoClear;renderer.shadowMap.autoUpdate=state.shadow;
      renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(state.scissor);
    }
  }
  dispose(){this.disposed=true;this.clear();this.portraitTarget?.dispose();this.overlayTextures?.forEach(t=>t.dispose());this.overlayMaterial?.dispose();this.overlayScene?.children[0]?.geometry.dispose();}
}
