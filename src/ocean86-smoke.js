import * as T from 'three';
import {createOceanWater} from './ocean-water.js';
export async function ocean86Smoke(review,assert){
 const {renderer,scene,camera}=review;review.water.geometry.dispose();review.water.material.waterNormal.dispose();review.water.material.dispose();scene.remove(review.water);
 const ocean=createOceanWater({}, {infinite:true});scene.add(ocean);review.water=ocean;scene.background=new T.Color('#a8c9e6');camera.far=150000;camera.updateProjectionMatrix();camera.position.set(160,55,190);camera.lookAt(0,0,0);
 let error='';renderer.debug.onShaderError=(_gl,_program,_vs,fs)=>{error=_gl.getShaderInfoLog(fs)||'Ocean shader failed';};const c=ocean.userData.ocean;
 for(let i=0;i<65;i++){c.setTime(i/30);c.follow(camera);renderer.render(scene,camera);await new Promise(r=>requestAnimationFrame(r));}
 assert(!error,error);assert(c.backend===(renderer.extensions.has('EXT_color_buffer_float')?'fft':'gerstner'),'Ocean backend selection failed');assert(c.backend!=='fft'||c.fftReady,'Async FFT height cache unavailable: '+c.error);
 assert(c.backend!=='fft'||Number.isFinite(c.fftRange)&&c.fftRange>.05&&c.fftRange<15,'FFT displacement invalid '+c.fftRange);
 const heights=Array.from({length:40},(_,i)=>c.height(i*11,i*7)),range=Math.max(...heights)-Math.min(...heights);assert(heights.every(Number.isFinite)&&range>.1&&range<15,'Invalid wave heights '+range);
 const gl=renderer.getContext();assert(gl.getError()===gl.NO_ERROR,'Ocean GL error');
 const fallback=createOceanWater({width:200,height:200},{forceFallback:true});scene.add(fallback);ocean.visible=false;renderer.render(scene,camera);assert(fallback.userData.ocean.backend==='gerstner','Fallback did not render');assert(!renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'Fallback shader failed');fallback.userData.disposeWater();fallback.geometry.dispose();fallback.material.dispose();scene.remove(fallback);ocean.visible=true;
 const rt=new T.WebGLRenderTarget(320,180);renderer.setRenderTarget(rt);c.setTime(2.8);renderer.render(scene,camera);const viewport=renderer.getCurrentViewport(new T.Vector4());assert(renderer.getRenderTarget()===rt&&viewport.z===320&&viewport.w===180,'FFT leaked render target or viewport');renderer.setRenderTarget(null);rt.dispose();
 const start=performance.now();for(let i=0;i<12;i++){c.setTime(3+i/30);renderer.render(scene,camera);}gl.finish();const renderMilliseconds=(performance.now()-start)/12;renderer.render(scene,camera);
 return{ok:true,source:'OceanThreejs',backend:c.backend,fftSize:c.fftSize,updates:c.updates,readbacks:c.readbacks,waveRange:range,fftRange:c.fftRange,fallback:true,renderTargetRestored:true,renderMilliseconds};
}
