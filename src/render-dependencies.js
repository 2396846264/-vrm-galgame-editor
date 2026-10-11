export const renderDependencies={
 toonSteps:['toon','色块光照'],toonThreshold:['toon','色块光照'],toonSoftness:['toon','色块光照'],
 shadowColor:['shadowTint','阴影染色'],shadowRange:['shadowTint','阴影染色'],highlightColor:['highlightTint','亮部染色'],
 aoRadius:['ao','环境光遮蔽'],aoBias:['ao','环境光遮蔽'],posterMix:['posterize','色调分离',2],dither:['posterize','色调分离',2],
 dofFocus:['dof','景深'],dofRange:['dof','景深'],dofBlur:['dof','景深'],
 outlineColor:['outline','描边'],outlineDetail:['outline','描边'],outlineBackgroundAlpha:['outline','描边'],
 rimWidth:['rim','边缘亮光'],rimSoftness:['rim','边缘亮光'],rimColor:['rim','边缘亮光'],rimDirection:['rimDirectional','单侧亮边'],rimDirectional:['rim','边缘亮光'],rimCharacters:['rim','边缘亮光'],
 fogStart:['fog','远景雾气'],fogEnd:['fog','远景雾气'],fogColor:['fog','远景雾气'],fogCharacters:['fog','远景雾气'],
 bloomThreshold:['bloom','亮部光晕'],bloomRadius:['bloom','亮部光晕'],bloomSoftness:['bloom','亮部光晕'],bloomColor:['bloom','亮部光晕'],
 whitePoint:['tonemap','电影亮度压缩'],vignetteRadius:['vignette','暗角'],vignetteSoftness:['vignette','暗角'],vignetteColor:['vignette','暗角']
};
export function renderDependency(key,filters){const dependency=renderDependencies[key];if(!dependency)return'';const[master,label,min]=dependency;const active=min===undefined?Number(filters[master])>0:Number(filters[master])>=min;if(!active)return '先开启“'+label+'”';return renderDependency(master,filters);}
export function updateRenderDependencies(filters,root=document){for(const [key]of Object.entries(renderDependencies)){const reason=renderDependency(key,filters);for(const control of root.querySelectorAll(`[data-preset-filter="${key}"]`)){control.disabled=Boolean(reason);control.setAttribute('aria-disabled',String(Boolean(reason)));const field=control.closest('.field');let hint=field?.querySelector('.render-dependency');if(!hint&&field){hint=document.createElement('small');hint.className='render-dependency';field.append(hint);}if(hint){hint.textContent=reason;hint.hidden=!reason;}}}}
export function updateRenderReferenceHints(stage,filters,root=document){
 const records=[...(stage?.visibleRecords?.values()||[])].filter(r=>r.vrm.scene.visible),vrmOnly=records.length>0&&records.every(r=>!r.vrm.isMmd&&!r.vrm.isFbx)&&!stage.environmentRuntime?.objects.size;
 const hint=(key,text,disabled)=>{for(const node of root.querySelectorAll(`[data-preset-filter="${key}"]`)){if(disabled!==undefined){node.disabled=disabled;node.setAttribute('aria-disabled',String(disabled));}const field=node.closest('.field');let label=field?.querySelector('.render-reference-hint');if(!label&&field){label=document.createElement('small');label.className='render-reference-hint';field.append(label);}if(label){label.textContent=text;label.hidden=!text;}}};
 hint('specular',vrmOnly?'当前参考只有 VRM 人物，这项反光倍率不适用。可切换到 FBX、MMD 或三维场景参考镜头。':'',vrmOnly);
 stage?.camera.updateMatrixWorld(true);const distances=records.map(r=>{const node=r.vrm.humanoid.getNormalizedBoneNode('head');return node?-node.getWorldPosition(stage.camera.position.clone()).applyMatrix4(stage.camera.matrixWorldInverse).z:NaN;}).filter(n=>n>0);
 if(distances.length){const d=Math.min(...distances);hint('fog',filters.fog>0&&d<=filters.fogStart?`前方人物离镜头约 ${d.toFixed(1)} 米，雾气从 ${filters.fogStart} 米开始。这个人物还在雾气外。`:'');}
 else hint('fog','');
 for(const button of root.querySelectorAll('[data-action="dof-focus"]'))button.disabled=filters.dof<=0;
}
