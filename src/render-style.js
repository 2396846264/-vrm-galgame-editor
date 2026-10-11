export const renderPresets={zzz:'明彩动画',custom:'自定义风格',tno:'复古荧屏'};
export const colorAdjustments={brightness:100,contrast:100,saturation:100};
export const filterGroups={lighting:'光照与色块',depth:'景深',detail:'轮廓与细节',rim:'边缘亮光',atmosphere:'空气与雾气',color:'颜色与胶片',print:'像素与印刷',crt:'CRT 显示器'};
export const customFilterSpecs=[
 ['toon','色块光照',0,1,.01,0,'lighting'],
 ['toonSteps','明暗分层数',2,8,1,3,'lighting'],['toonThreshold','明暗分界偏移',-.5,.5,.01,0,'lighting'],['toonSoftness','明暗过渡柔和度',0,1,.01,0,'lighting'],['specular','材质反光倍率',0,2,.01,1,'lighting'],
 ['shadowTint','阴影染色',0,1,.01,0,'lighting'],['shadowColor','阴影颜色','color',null,null,'#6576ad','lighting'],['shadowRange','阴影染色范围',.05,.95,.01,.45,'lighting'],
 ['highlightTint','亮部染色',0,1,.01,0,'lighting'],['highlightColor','亮部颜色','color',null,null,'#ffdfb0','lighting'],
 ['rim','边缘亮光强度',0,2,.01,0,'rim'],['rimWidth','亮边宽度（像素）',1,16,.5,3,'rim'],['rimSoftness','亮边柔和度',0,1,.01,.3,'rim'],['rimColor','亮边颜色','color',null,null,'#cde9ff','rim'],['rimDirection','亮边方向（度）',-180,180,1,35,'rim'],['rimDirectional','单侧亮边',0,1,.01,0,'rim'],['rimCharacters','仅照亮角色',0,1,1,1,'rim'],
 ['fog','远景雾气强度',0,1,.01,0,'atmosphere'],['fogStart','雾气起点（米）',0,300,.5,5,'atmosphere'],['fogEnd','雾气最浓处（米）',.1,500,.5,50,'atmosphere'],['fogColor','雾气颜色','color',null,null,'#bbcddb','atmosphere'],['fogCharacters','雾气影响角色',0,1,.01,1,'atmosphere'],
['simplify','细节简化',0,1,.01,0,'lighting'],['posterize','色调分离级数（0 关闭）',0,32,1,0,'lighting'],
 ['ao','环境光遮蔽',0,1,.01,0,'lighting'],['aoRadius','遮蔽范围（米）',.05,2,.05,.35,'lighting'],['aoBias','遮蔽防脏偏移',0,.4,.01,.12,'lighting'],
 ['posterMix','色调分离混合',0,1,.01,1,'lighting'],
 ['dof','景深强度（0 关闭）',0,1,.01,0,'depth'],['dofFocus','对焦距离（米）',.1,300,.1,4.3,'depth'],['dofRange','清晰范围（米）',.1,30,.1,2,'depth'],['dofBlur','最大虚化',1,16,.5,8,'depth'],
 ['outline','描边粗细（0 关闭）',0,4,.1,0,'detail'],['outlineColor','描边颜色','color',null,null,'#111111','detail'],['outlineDetail','内部结构线',0,1,.01,.35,'detail'],
 ['outlineBackgroundAlpha','场景描边强度',0,1,.01,1,'detail'],
 ['sharpen','锐化',0,2,.05,0,'detail'],['blur','柔化',0,1,.01,0,'detail'],['emboss','浮雕',0,1,.01,0,'detail'],
 ['exposure','曝光',-2,2,.05,0,'color'],['gamma','伽马',.5,2,.05,1,'color'],['hue','色相',-180,180,1,0,'color'],['temperature','冷暖',-1,1,.01,0,'color'],['tint','绿紫偏色',-.5,.5,.01,0,'color'],['sepia','旧照片棕褐色',0,1,.01,0,'color'],['monochrome','黑白',0,1,.01,0,'color'],['invert','反相',0,1,.01,0,'color'],['vignette','暗角',0,1,.01,0,'color'],['bloom','亮部光晕',0,2,.01,0,'color'],['bloomThreshold','光晕亮度门槛',0,1,.01,.75,'color'],['bloomRadius','光晕扩散范围（像素）',1,32,.5,5,'color'],['bloomSoftness','光晕起亮柔和度',0,1,.01,0,'color'],['bloomColor','光晕颜色','color',null,null,'#ffffff','color'],
 ['tonemap','电影亮度压缩',0,1,.01,0,'color'],['whitePoint','压缩白点',.5,4,.05,1,'color'],['vibrance','自然鲜艳度',-1,1,.01,0,'color'],['lift','暗部抬升',-.25,.25,.01,0,'color'],['shadows','暗部明亮度',-1,1,.01,0,'color'],['highlights','亮部明亮度',-1,1,.01,0,'color'],['vignetteRadius','暗角起点',.05,1,.01,.25,'color'],['vignetteSoftness','暗角过渡宽度',.1,2,.01,1.15,'color'],['vignetteColor','暗角颜色','color',null,null,'#000000','color'],
 ['pixelSize','像素块大小',1,24,1,1,'print'],['halftone','半色调网点',0,1,.01,0,'print'],['hatch','阴影排线',0,1,.01,0,'print'],['dither','有序抖色',0,1,.01,0,'print'],
 ['grain','胶片颗粒',0,1,.01,0,'crt'],['scanlines','扫描线',0,1,.01,0,'crt'],['chromatic','色差偏移',0,4,.1,0,'crt'],['tear','随机画面撕裂',0,1,.01,0,'crt']
 ,['saturationBoost','滤镜色彩增益',0,2,.01,1,'color'],['contrastBoost','滤镜对比增益',0,2,.01,1,'color']
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
 return {...f};
}
export function mergeRender(base,override){const a=normalizeRender(base),b=override?.style&&!override.preset?{...override,preset:normalizeRender(override).preset}:override;return normalizeRender({...a,...b,filters:{...a.filters,...b?.filters}});}
