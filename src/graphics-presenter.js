import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {fullscreenVertex,easuFragment,rcasFragment,resolveFragment} from './fsr1-shaders.js';
export class GraphicsPresenter{
 constructor(){
  const make=fragmentShader=>new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null},inputSize:{value:new THREE.Vector2()},outputSize:{value:new THREE.Vector2()},sharpness:{value:.4},superSamples:{value:1}},vertexShader:fullscreenVertex,fragmentShader,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
  this.easu=make(easuFragment);this.rcas=make(rcasFragment);this.resolve=make(resolveFragment);this.quad=new FullScreenQuad(this.resolve);this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType,depthBuffer:false});
 }
 configure(plan){this.plan=plan;if(!plan.fsr&&this.target.width>1)this.target.setSize(1,1);for(const material of [this.easu,this.rcas,this.resolve]){material.uniforms.inputSize.value.set(plan.inputWidth,plan.inputHeight);material.uniforms.outputSize.value.set(plan.outputWidth,plan.outputHeight);material.uniforms.superSamples.value=plan.superSamples;}this.rcas.uniforms.sharpness.value=plan.quality.sharpness/100;}
 render(renderer,texture){
  const plan=this.plan;if(!plan)return;const old=renderer.getRenderTarget(),autoClear=renderer.autoClear;
  try{renderer.autoClear=true;
   if(plan.fsr){if(this.target.width!==plan.outputWidth||this.target.height!==plan.outputHeight)this.target.setSize(plan.outputWidth,plan.outputHeight);this.easu.uniforms.tDiffuse.value=texture;this.quad.material=this.easu;renderer.setRenderTarget(this.target);this.quad.render(renderer);this.rcas.uniforms.tDiffuse.value=this.target.texture;this.quad.material=this.rcas;}
   else {this.resolve.uniforms.tDiffuse.value=texture;this.quad.material=this.resolve;}
   renderer.setRenderTarget(null);this.quad.render(renderer);
  }finally{renderer.setRenderTarget(old);renderer.autoClear=autoClear;}
 }
 dispose(){this.easu.dispose();this.rcas.dispose();this.resolve.dispose();this.target.dispose();this.quad.dispose();}
}
