export const graphicsDefaults={aa:'fxaa',upscale:'off',renderScale:100,sharpness:40,shadows:'high',mmdPhysics:'balanced'};
export const aaOptions=[['off','关闭'],['fxaa','FXAA · 性能优先'],['msaa2','MSAA ×2 + FXAA'],['msaa4','MSAA ×4 + FXAA'],['msaa8','MSAA ×8 + FXAA'],['ssaa2','超采样 SSAA ×2'],['ssaa4','超采样 SSAA ×4'],['ssaa8','超采样 SSAA ×8'],['ssaa16','超采样 SSAA ×16']];
export const fsrModes={off:1,ultra:1/1.3,quality:1/1.5,balanced:1/1.7,performance:.5};
export const fsrOptions=[['off','关闭'],['ultra','FSR 1.0 · 超高质量'],['quality','FSR 1.0 · 质量'],['balanced','FSR 1.0 · 均衡'],['performance','FSR 1.0 · 性能']];
export function normalizeGraphics(value={}){
 const result={aa:aaOptions.some(([key])=>key===value.aa)?value.aa:'fxaa',upscale:Object.hasOwn(fsrModes,value.upscale)?value.upscale:'off',renderScale:Math.max(50,Math.min(100,Number(value.renderScale)||100)),sharpness:Math.max(0,Math.min(100,Number.isFinite(Number(value.sharpness))?Number(value.sharpness):40)),shadows:['off','low','medium','high'].includes(value.shadows)?value.shadows:'high'};
 if(result.aa.startsWith('ssaa')){result.upscale='off';result.renderScale=100;}else if(result.upscale!=='off'&&result.aa==='off')result.aa='fxaa';
 result.mmdPhysics=['off','full'].includes(value.mmdPhysics)?value.mmdPhysics:'balanced';
 return result;
}
export function graphicsLimits(renderer){
 const gl=renderer.getContext?.();let samples=[2,4];
 if(gl)try{samples=[...gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)].filter(n=>n>0);}catch{samples=[2];}
 return {maxDimension:Math.min(renderer.capabilities?.maxTextureSize||4096,gl?gl.getParameter(gl.MAX_RENDERBUFFER_SIZE):4096),maxPixels:16777216,maxBufferBytes:536870912,samples};
}
export function graphicsPlan(settings,width,height,limits={maxDimension:8192,maxPixels:16777216,samples:[2,4,8]}){
 const quality=normalizeGraphics(settings),outputWidth=Math.max(1,Math.floor(width)),outputHeight=Math.max(1,Math.floor(height)),superSamples=quality.aa.startsWith('ssaa')?Number(quality.aa.slice(4)):1,samples=quality.aa.startsWith('msaa')?Number(quality.aa.slice(4)):0;
 const scale=superSamples>1?Math.sqrt(superSamples):quality.upscale!=='off'?fsrModes[quality.upscale]:quality.renderScale/100;
 const inputWidth=Math.max(1,Math.floor(outputWidth*scale)),inputHeight=Math.max(1,Math.floor(outputHeight*scale));
 const estimatedBufferBytes=inputWidth*inputHeight*(32+24*samples)+(quality.upscale!=='off'?outputWidth*outputHeight*4:0);
 const supported=(!samples||limits.samples.includes(samples))&&Math.max(inputWidth,inputHeight,outputWidth,outputHeight)<=limits.maxDimension&&inputWidth*inputHeight<=limits.maxPixels&&outputWidth*outputHeight<=limits.maxPixels&&estimatedBufferBytes<=(limits.maxBufferBytes||536870912);
 return {quality,outputWidth,outputHeight,inputWidth,inputHeight,scale,superSamples,samples,fsr:quality.upscale!=='off',estimatedBufferBytes,supported,reason:samples&&!limits.samples.includes(samples)?'此设备不支持这个 MSAA 倍数':'当前画面尺寸或绘制缓冲超过安全上限，请降低窗口分辨率或倍数。'};
}
export const shadowMapSize=quality=>({off:0,low:512,medium:1024,high:2048}[quality]??2048);
