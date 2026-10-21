import * as T from 'three';
import {config as defaults} from './vendor/ocean-threejs/config.js';
import {OceanMaterial} from './vendor/ocean-threejs/Ocean/OceanMaterial.js';
import {OceanSimulation} from './vendor/ocean-threejs/Ocean/OceanSimulation.js';
import {buildGerstnerWaves} from './vendor/ocean-threejs/Ocean/Gerstner.js';
import {oceanSampler} from './ocean-sampling.js';

// One 128² FFT per sea, capped at 30 Hz; no HDR downloads, GUI or extra scene
// captures. Small enclosed water bodies use water-surface.js instead.
export function createOceanWater(node={}, {infinite=false,forceFallback=false}={}){
 const config=structuredClone(defaults);Object.assign(config.ocean,{fftSize:128,meshResolution:256,oceanSize:100000,windSpeed:node.flowSpeed??10,patchSize:Math.max(12,(node.waveScale??35)*6.285714),waveAmplitude:node.waveHeight??.65,swell:.38,secondarySwell:.18,choppiness:1,windDirection:node.flowAngle??25});
 config.ocean.swellDirection=config.ocean.windDirection;config.ocean.secondarySwellDirection=config.ocean.windDirection+90;config.water.roughness=.09;config.water.microDetail=.32;config.water.chromaticOffset=0;config.water.refractionStrength=0;config.color.deepColor='#'+new T.Color(node.color||'#00a6d0').multiplyScalar(.34).getHexString();config.color.scatterColor=node.color||'#009fbc';config.color.exposure=1;config.fog.density=.000025;config.fog.color='#a8c9e6';config.lighting.sunIntensity=2.5;config.foam.intensity=.6;
 const oceanMaterial=new OceanMaterial(config),u=oceanMaterial.uniforms,zero=new T.DataTexture(new Float32Array(4),1,1,T.RGBAFormat,T.FloatType);zero.needsUpdate=true;oceanMaterial.setFFTTextures(zero,zero);oceanMaterial.setGerstner(...(()=>{const w=buildGerstnerWaves(config.ocean);return [w.directions,w.params];})());
 // The host owns tone mapping and output color space, including post effects.
 oceanMaterial.material.toneMapped=true;oceanMaterial.material.userData.oceanSurface=true;
 u.time=u.uTime;u.surfaceOffset=u.uModelOffset;u.uSandLevel.value=-80;
 const geometry=new T.PlaneGeometry(node.width||100000,node.height||100000,256,256);geometry.rotateX(-Math.PI/2);
 if(infinite){const a=geometry.attributes.position,extent=50000,near=1300,split=.82;const warp=v=>{const t=Math.abs(v)/extent;return Math.sign(v)*(t<=split?t/split*near:near+((t-split)/(1-split))**2*(extent-near));};for(let i=0;i<a.count;i++){a.setX(i,warp(a.getX(i)));a.setZ(i,warp(a.getZ(i)));}a.needsUpdate=true;}
 const mesh=new T.Mesh(geometry,oceanMaterial.material);mesh.frustumCulled=false;mesh.userData.water=true;mesh.material.userData.outlineParameters={visible:false};
 const sample=oceanSampler(buildGerstnerWaves(config.ocean),config.ocean);let simulation=null,disposed=false,initialized=false,last=-1,pending=false,lastRead=-1,clock=0;
 const controller={backend:'pending',fftSize:128,updates:0,readbacks:0,fftRange:0,error:null,setTime(t){if(Number.isFinite(t))clock=Math.max(0,t);u.uTime.value=clock;},advance(dt){this.setTime(clock+Math.max(0,Math.min(.1,dt||0)));},follow(camera){if(!infinite||!camera)return;const cell=2600/210;u.uModelOffset.value.set(Math.round(camera.position.x/cell)*cell,Math.round(camera.position.z/cell)*cell);},height:(x,z)=>sample.height(x,z,clock),normal:(x,z,target)=>sample.normal(x,z,clock,target),get time(){return clock;},get fftReady(){return sample.fftReady;},dispose(){disposed=true;simulation?.dispose();zero.dispose();}};
 mesh.userData.ocean=controller;mesh.userData.disposeWater=()=>controller.dispose();
 let sunlight=null;const lightPosition=new T.Vector3(),lightTarget=new T.Vector3();
 mesh.onBeforeRender=(renderer,scene)=>{
  if(disposed)return;
  if(!sunlight)scene.traverse(o=>{if(o.isDirectionalLight&&!sunlight)sunlight=o;});
  if(!initialized){initialized=true;controller.backend='gerstner';if(!forceFallback&&renderer.extensions.has('EXT_color_buffer_float')){simulation=new OceanSimulation(renderer,config,oceanMaterial);controller.backend='fft';}}
  if(!simulation||Math.abs(clock-last)<1/30)return;
  // Compute passes must not inherit a postprocess viewport, scissor or XR view.
  const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),xr=renderer.xr.enabled;
  try{renderer.xr.enabled=false;renderer.setScissorTest(false);simulation.time=clock;simulation.update(0);if(sunlight){u.uSunDirection.value.copy(sunlight.getWorldPosition(lightPosition)).sub(sunlight.target.getWorldPosition(lightTarget)).normalize();u.uSunColor.value.copy(sunlight.color);u.uSunIntensity.value=sunlight.intensity;}last=clock;controller.updates++;
   if(!pending&&clock-lastRead>=.1&&renderer.readRenderTargetPixelsAsync){pending=true;lastRead=clock;const bytes=new Uint16Array(128*128*4);const gl=renderer.getContext(),pack=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),read=renderer.readRenderTargetPixelsAsync(simulation.fft.displacementTarget,0,0,128,128,bytes);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);read.then(()=>{if(!disposed){const floats=new Float32Array(bytes.length);let low=Infinity,high=-Infinity;for(let i=0;i<bytes.length;i++){floats[i]=T.DataUtils.fromHalfFloat(bytes[i]);if(i%4===0){low=Math.min(low,floats[i]);high=Math.max(high,floats[i]);}}controller.fftRange=high-low;sample.setFFT(floats,128);controller.readbacks++;}}).catch(e=>{controller.error=String(e.message||e);}).finally(()=>{pending=false;});}
  }finally{renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setRenderTarget(target);renderer.xr.enabled=xr;}
 };
 return mesh;
}
