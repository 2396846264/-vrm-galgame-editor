import * as THREE from 'three';
import {GraphicsPresenter} from './graphics-presenter.js';
import {graphicsPlan} from './player-graphics.js';
export function verifyFsrGPU(){
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(64,64);const presenter=new GraphicsPresenter(),values=new Uint8Array(16*16*4),texture=new THREE.DataTexture(values,16,16);texture.minFilter=texture.magFilter=THREE.LinearFilter;
 const render=(fsr,sharpness=0)=>{presenter.configure(graphicsPlan(fsr?{upscale:'performance',sharpness}:{renderScale:50},32,32));presenter.plan.outputWidth=64;presenter.plan.outputHeight=64;presenter.plan.inputWidth=16;presenter.plan.inputHeight=16;presenter.configure(presenter.plan);presenter.render(renderer,texture);const pixels=new Uint8Array(64*64*4);renderer.getContext().readPixels(0,0,64,64,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);return pixels;};
 const diff=(a,b)=>a.reduce((sum,v,i)=>sum+(i%4<3?Math.abs(v-b[i]):0),0)/(64*64*3);
 try{
  for(let i=0;i<values.length;i+=4)values.set([80,140,190,255],i);texture.needsUpdate=true;const flat=render(true,100);for(let i=0;i<flat.length;i+=4)for(let j=0;j<3;j++)if(Math.abs(flat[i+j]-[80,140,190][j])>2)throw Error('FSR 改变了纯色画面');
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const shade=Math.abs(x-y)<1?230:(x+y)%5===0?150:45;values.set([shade,shade,shade,255],(y*16+x)*4);}texture.needsUpdate=true;
  const ordinary=render(false),easu=render(true,0),rcas=render(true,100),reconstruction=diff(ordinary,easu),sharpening=diff(easu,rcas);if(reconstruction<.5||sharpening<.1)throw Error('FSR 没有执行重建或锐化');
  const gl=renderer.getContext();if(gl.getError()!==gl.NO_ERROR)throw Error('FSR GPU 绘制错误');return {ok:true,flatColorPreserved:true,easuDifference:reconstruction,rcasDifference:sharpening};
 }finally{texture.dispose();presenter.dispose();renderer.dispose();}
}
