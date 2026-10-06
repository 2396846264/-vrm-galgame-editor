import * as THREE from 'three';
import {EnvironmentRuntime} from './environment-runtime.js';
import {createEnvironment} from './environment-schema.js';
export async function verifyImageAlpha(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#87b5d9');
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(128,128);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const camera=new THREE.OrthographicCamera(-1.5,1.5,1.5,-1.5,.1,10);camera.position.z=3;
 const target=new THREE.WebGLRenderTarget(128,128);target.texture.colorSpace=THREE.SRGBColorSpace;
 const runtime=new EnvironmentRuntime(scene),env=createEnvironment('透明通道检查');env.nodes=[{id:'alpha-board',name:'透明图片',kind:'imagePlane',assetId:'alpha-fixture',parentId:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],width:2,height:2,unlit:true,alphaCutoff:0}];
 const assets=[{id:'alpha-fixture',type:'image',path:'assets/images/alpha-check.png'}],samples=[];
 const render=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);return [32,64,96].map(x=>{const pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,x,64,1,1,pixel);return [...pixel];});};
 const baseline=render()[0];const same=(a,b)=>a.slice(0,3).every((v,i)=>Math.abs(v-b[i])<=2);
 try{
  scene.add(new THREE.AmbientLight(0xffffff,2));
  for(const lit of [false,true]){env.nodes[0].unlit=!lit;await runtime.load(env,assets);const result=render();if(!same(result[0],baseline))throw Error('透明部分没有显示后面的场景');if(result[1][0]<=baseline[0]+15||result[1][0]>=result[2][0]-15)throw Error('半透明边缘没有正确混合');samples.push({lit,transparent:result[0],softEdge:result[1],opaque:result[2]});}
  env.nodes[0].alphaCutoff=.75;await runtime.load(env,assets);const cut=render();if(!same(cut[1],baseline))throw Error('透明裁切设置失效');
  return {ok:true,realTexture:true,litAndUnlit:true,softAlpha:true,transparentBackground:true,cutoffPreserved:true,samples};
 }finally{runtime.clear();target.dispose();renderer.dispose();}
}
