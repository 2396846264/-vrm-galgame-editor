export const renderPresets={zzz:'明彩动画',custom:'自定义风格',tno:'复古荧屏'};
export const colorAdjustments={brightness:100,contrast:100,saturation:100};
export const filterGroups={lighting:'光照与色块',detail:'轮廓与细节',color:'颜色与胶片',print:'像素与印刷',crt:'CRT 显示器'};
export const customFilterSpecs=[
 ['toon','色块光照',0,1,.01,0,'lighting'],['simplify','细节简化',0,1,.01,0,'lighting'],['posterize','色调分离级数（0 关闭）',0,32,1,0,'lighting'],
 ['ao','环境光遮蔽',0,1,.01,0,'lighting'],['aoRadius','遮蔽范围（米）',.05,2,.05,.35,'lighting'],
 ['outline','描边粗细（0 关闭）',0,4,.1,0,'detail'],['outlineColor','描边颜色','color',null,null,'#111111','detail'],['outlineDetail','内部结构线',0,1,.01,.35,'detail'],
 ['sharpen','锐化',0,2,.05,0,'detail'],['blur','柔化',0,1,.01,0,'detail'],['emboss','浮雕',0,1,.01,0,'detail'],
 ['exposure','曝光',-2,2,.05,0,'color'],['gamma','伽马',.5,2,.05,1,'color'],['hue','色相',-180,180,1,0,'color'],['temperature','冷暖',-1,1,.01,0,'color'],['tint','绿紫偏色',-.5,.5,.01,0,'color'],['sepia','旧照片棕褐色',0,1,.01,0,'color'],['monochrome','黑白',0,1,.01,0,'color'],['invert','反相',0,1,.01,0,'color'],['vignette','暗角',0,1,.01,0,'color'],['bloom','亮部光晕',0,1,.01,0,'color'],
 ['pixelSize','像素块大小',1,24,1,1,'print'],['halftone','半色调网点',0,1,.01,0,'print'],['hatch','阴影排线',0,1,.01,0,'print'],['dither','有序抖色',0,1,.01,0,'print'],
 ['grain','胶片颗粒',0,1,.01,0,'crt'],['scanlines','扫描线',0,1,.01,0,'crt'],['chromatic','色差偏移',0,4,.1,0,'crt'],['tear','随机画面撕裂',0,1,.01,0,'crt']
];
export const customFilterDefaults=Object.fromEntries(customFilterSpecs.map(([key,,, , ,value])=>[key,value]));
const finite=(v,fallback,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function normalizeRender(value={}){
 const preset=Object.hasOwn(renderPresets,value?.preset)?value.preset:value?.style&&value.style!=='anime'?'custom':'zzz';
 const filters={};for(const[key,,min,max,,fallback]of customFilterSpecs)filters[key]=min==='color'?/^#[0-9a-f]{6}$/i.test(value?.filters?.[key]||'')?value.filters[key]:fallback:finite(value?.filters?.[key],fallback,min,max);
 return {schemaVersion:2,preset,strength:finite(value?.strength,.75,0,1),brightness:finite(value?.brightness,100,0,200),contrast:finite(value?.contrast,100,0,200),saturation:finite(value?.saturation,100,0,200),filters};
}
export function effectiveStyle(value){
 const settings=normalizeRender(value),f={...settings.filters};
 if(settings.preset==='zzz'){const s=settings.strength;Object.assign(f,customFilterDefaults,{toon:s,simplify:.8*s,posterize:s>.001?Math.round(32-16*s):0,outline:s>.001?.35+.15*s:0,outlineColor:'#253445',outlineDetail:.06,sharpen:.06*s,ao:.10*s,exposure:.06*s});return {...f,outlineBackgroundAlpha:.35,posterMix:.4*s,saturationBoost:1+.28*s,contrastBoost:1+.05*s};}
 if(settings.preset==='tno')return {...customFilterDefaults,outline:1.25,outlineBackgroundAlpha:1,outlineColor:'#64f5ed',outlineDetail:.45,posterize:18,posterMix:.35,simplify:.18,grain:.24,scanlines:.28,chromatic:.9,tear:.55,sepia:.18,vignette:.22,saturationBoost:.48,contrastBoost:1.08};
 return {...f,outlineBackgroundAlpha:1,posterMix:1,saturationBoost:1,contrastBoost:1};
}
export function mergeRender(base,override){const a=normalizeRender(base),b=override?.style&&!override.preset?{...override,preset:normalizeRender(override).preset}:override;return normalizeRender({...a,...b,filters:{...a.filters,...b?.filters}});}
