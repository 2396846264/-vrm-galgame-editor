import * as THREE from 'three';
import {isEvent} from '../events.js';
import {normalizeRender,customFilterSpecs} from '../render-style.js';
import {normalizeGraphics,aaOptions} from '../player-graphics.js';
import {verifyFsrGPU} from '../graphics-smoke.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
window.__vrmSmokeNpr=async function(phase){
 if(!new URLSearchParams(location.search).has('smoke'))throw Error('Smoke only');
 const assert=(test,message)=>{if(!test)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const index=host.project.acts.findIndex(a=>a.id==='act-school');assert(index>=0,'没有校园测试场景');
 async function show(settings,lineSettings){host.playing=false;host.selectedAct=index;host.selectedStep=0;host.activePanel='render';host.project.acts[index].render=normalizeRender(settings);host.project.acts[index].steps[0].render=lineSettings;host.renderSidebar();host.renderInspector();await host.updatePreview();await wait(650);host.stage.stylePipeline.render(.016);}
 function pixels(){host.stage.stylePipeline.render(.016);const gl=host.stage.renderer.getContext(),w=host.stage.renderer.domElement.width,h=host.stage.renderer.domElement.height;const sample=new Uint8Array(4),values=[];for(let y=1;y<8;y++)for(let x=1;x<12;x++){gl.readPixels(Math.floor(w*x/12),Math.floor(h*y/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,sample);values.push(...sample.slice(0,3));}const brightness=values.reduce((a,b)=>a+b,0)/values.length;assert(brightness>8,'渲染画面黑屏');const bad=host.stage.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable);assert(!bad.length,'着色器编译失败：'+JSON.stringify(bad.map(p=>p.diagnostics)));return {values,brightness};}
 function difference(a,b){return a.reduce((total,v,i)=>total+Math.abs(v-b[i]),0)/a.length;}
 if(phase==='neutral'){await show({preset:'custom'});window.__nprNeutral=pixels();return {ok:true,brightness:window.__nprNeutral.brightness};}
 if(phase==='zzz-low'||phase==='zzz-high'){
   await show({preset:'zzz',strength:phase==='zzz-high'?1:.25});const result=pixels();assert(document.querySelector('[data-render="strength"]'),'没有风格浓度');assert(!document.querySelector('[data-npr-filter]'),'预设出现自定义滤镜');assert(!document.querySelector('[data-render="style"]')&&!document.querySelector('[data-render="paintEffect"]'),'旧风格仍显示');for(const key of ['brightness','contrast','saturation'])assert(document.querySelector('[data-render="'+key+'"]'),'缺少微调');const diff=difference(window.__nprNeutral.values,result.values);assert(diff>1,'预设没有改变画面');if(phase==='zzz-low')window.__nprLow=result;else assert(difference(window.__nprLow.values,result.values)>1,'浓度滑块没有效果');return {ok:true,brightness:result.brightness,difference:diff,sceneAndCharacters:true};
 }
 if(phase==='custom'){
   await show({preset:'custom',filters:{ao:.65,aoRadius:.5,outline:1.4,outlineColor:'#351415',posterize:8,sharpen:.4,pixelSize:3,hatch:.15,grain:.08}});for(const[key]of customFilterSpecs)assert(document.querySelector('[data-npr-filter="'+key+'"]'),'缺少滤镜 '+key);return {ok:true,filters:customFilterSpecs.length,difference:difference(window.__nprNeutral.values,pixels().values),aoGeometry:host.stage.stylePipeline.needsGeometry};
 }
 if(phase==='tno'){
   await show({preset:'tno'});assert(!document.querySelector('[data-render="strength"]'),'TNO 出现风格浓度');const first=pixels();await wait(500);const second=pixels();assert(difference(first.values,second.values)>.02,'CRT没有动态颗粒');assert(host.stage.stylePipeline.style.outlineColor==='#64f5ed','描边不是青色');return {ok:true,fixedPreset:true,cyanOutline:true,temporalDifference:difference(first.values,second.values),brightness:first.brightness};
 }
 if(phase==='dialogue'){
   await show({preset:'zzz'},{preset:'tno',brightness:125,contrast:115,saturation:120});host.activePanel='story';host.renderInspector();await host.updatePreview();assert(document.querySelector('[data-render="preset"][data-render-scope="step"]'),'对白不能选择风格');assert(!document.querySelector('[data-render="strength"]'),'对白TNO出现浓度');for(const key of ['brightness','contrast','saturation'])assert(document.querySelector('[data-render="'+key+'"][data-render-scope="step"]'),'对白缺少微调');assert(host.stage.renderSettings.preset==='tno'&&host.stage.renderSettings.brightness===125,'对白覆盖未应用');return {ok:true,dialoguePreset:true,calibrationAlwaysAvailable:true};
 }
 if(phase==='fbx'){
   host.playing=false;host.selectedAct=host.project.acts.findIndex(a=>a.id==='act-shadow-test');host.selectedStep=0;host.activePanel='render';host.project.acts[host.selectedAct].render=normalizeRender({preset:'zzz',strength:.85});delete host.project.acts[host.selectedAct].steps[0].render;host.renderSidebar();host.renderInspector();await host.updatePreview();await wait(650);pixels();assert([...host.stage.visibleRecords.values()].some(record=>record.vrm.isFbx),'FBX 不在场');return {ok:true,fbxPreset:true,vrmTogether:true,noShaderErrors:true};
 }
 if(phase==='export'){
   await show({preset:'zzz',strength:.85});for(const line of host.project.acts[index].steps)delete line.render;host.project.acts[index].steps[1].render={preset:'tno',brightness:110,contrast:105,saturation:115};host.project.acts[index].steps[2].render={preset:'custom',filters:{outline:1,posterize:10,pixelSize:2,ao:.35}};host.markDirty();await host.save();await host.bridge('saveProjectAs',{project:structuredClone(host.project),name:'新渲染三种风格验证'});await host.bridge('exportGame',{folderName:'新渲染试玩'});return {ok:true,exported:true};
 }
 if(phase==='player'||phase==='reopen'){
   host.playing=true;host.playAct=index;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();await wait(700);assert(host.stage.renderSettings.preset==='zzz','保存后缺少预设');pixels();host.playStep=1;await host.showPlayStep();await wait(300);assert(host.stage.renderSettings.preset==='tno'&&host.stage.renderSettings.brightness===110,'对白TNO未保存');pixels();host.playStep=2;await host.showPlayStep();await wait(300);assert(host.stage.renderSettings.preset==='custom'&&host.stage.renderSettings.filters.ao===.35,'自定义未保存');pixels();host.playStep=0;await host.showPlayStep();await wait(500);return {ok:true,threePresets:true,dialogueOverrides:true,noShaderErrors:true};
 }
 throw Error('Unknown phase');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeRenderRegression=async phase=>{
  const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
  const hua=host.project.characters.find(c=>host.asset(c.modelId)?.type==='vrm'),fbx=host.project.characters.find(c=>host.asset(c.modelId)?.type==='fbxCharacter');
  assert(hua&&fbx,'需要 VRM 与 FBX 测试人物');
  const currentAct=host.project.acts[0],current=currentAct.steps[0];
  const setting=id=>({characterId:id,motionId:'',motionOptions:{},expressionWeights:{happy:.75},props:[],size:1,offsetX:0,offsetY:0,offsetZ:0,yaw:0,pitch:0});
  if(phase==='reopen'){
    const environment=host.project.environments.find(e=>e.id===currentAct.environmentId);assert(environment?.name==='自动保存验证环境'&&environment.revision>0,'工程包没有保留自动保存的场景');
    await host.updatePreview();assert(host.stage.livePortrait.record===host.stage.visibleRecords.get(hua.id),'重新打开后头像未同步');
    return {ok:true,autosaveArchiveReopened:true,revision:environment.revision,ambient:environment.lighting.ambientIntensity};
  }
  if(phase==='texture-sky'){
    const sky=host.stage.environmentRuntime.objects.get('regression-sky').children[0],canvas=document.createElement('canvas');canvas.width=64;canvas.height=32;
    const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,32);gradient.addColorStop(0,'#527faa');gradient.addColorStop(1,'#b8d8ed');c.fillStyle=gradient;c.fillRect(0,0,64,32);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const oldMap=sky.material.map;sky.material.map=map;sky.material.needsUpdate=true;const pixels=[];
    try{for(const width of [0,1,2,3]){
      host.stage.setRenderSettings({outline:width});await wait(100);if(width)host.stage.outlineEffect.render(host.stage.scene,host.stage.camera);else host.stage.renderer.render(host.stage.scene,host.stage.camera);
      const surface=host.stage.renderer.domElement,check=document.createElement('canvas');check.width=surface.width;check.height=surface.height;const context=check.getContext('2d');context.drawImage(surface,0,0);
      const pixel=[...context.getImageData(Math.floor(surface.width*.94),Math.floor(surface.height*.12),1,1).data];pixels.push(pixel);
      assert(pixel.every((v,i)=>Math.abs(v-pixels[0][i])<=1),'带贴图天空在描边时改变颜色');
    }}finally{sky.material.map=oldMap;sky.material.needsUpdate=true;map.dispose();}
    return {ok:true,texturedSkyWidths:[0,1,2,3],pixels};
  }
  if(phase==='prepare'){
    const environment=host.project.environments.find(e=>e.id===currentAct.environmentId);
    assert(environment,'缺少环境');environment.name='天空与实时头像验证';environment.background='#86b8df';
    environment.camera={position:[0,1.3,4.3],target:[0,1.05,0],fov:32};environment.lighting={color:'#ffffff',intensity:2.2,ambientIntensity:.35};
    environment.nodes=[{id:'regression-ground',kind:'ground',name:'地面',position:[0,0,0],rotation:[-Math.PI/2,0,0],scale:[1,1,1],width:30,height:30,color:'#888888'},
      {id:'regression-sky',kind:'sky',name:'蓝色天空球',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#86b8df',assetId:''}];
    current.characterId=hua.id;current.text='天空球不会再被描边涂黑。这个实时头像和场上的我，使用同一个人物模型。';
    current.cast={left:setting(fbx.id),center:setting(hua.id),right:setting('')};
    host.project.render.outline=0;host.project.render.style='original';host.activePanel='story';host.selectedAct=0;host.selectedStep=0;host.renderSidebar();host.renderInspector();await host.updatePreview();
    host.markDirty();await host.save();await host.bridge('saveProjectAs',{project: host.project,name:'天空头像与自动保存验证'});return {ok:true,fixturePrepared:true};
  }
  if(phase.startsWith('outline-')){
    const width=Number(phase.split('-')[1]);host.project.render.outline=width;currentAct.render=null;
    host.stage.setRenderSettings(host.chapterRender(currentAct,host.project.render));await wait(400);
    const sky=host.stage.environmentRuntime.objects.get('regression-sky').children[0];
    assert(sky.material.userData.outlineParameters.visible===false,'天空仍参与描边');
    if(host.stage.outlineEffect.enabled)host.stage.outlineEffect.render(host.stage.scene,host.stage.camera);else host.stage.renderer.render(host.stage.scene,host.stage.camera);
    const canvas=host.stage.renderer.domElement,ctx=document.createElement('canvas');ctx.width=canvas.width;ctx.height=canvas.height;
    const c=ctx.getContext('2d');c.drawImage(canvas,0,0);const pixel=[...c.getImageData(Math.floor(canvas.width*.94),Math.floor(canvas.height*.12),1,1).data];
    assert(pixel[0]>75&&pixel[1]>100&&pixel[2]>120,'天空像素变黑 '+pixel);
    return {ok:true,width,skyPixel:pixel,skyOutlineExcluded:true};
  }
  if(phase==='dark'){
    const environment=host.project.environments.find(e=>e.id===currentAct.environmentId);environment.lighting.intensity=.08;environment.lighting.ambientIntensity=.015;
    await host.stage.setEnvironment(environment,host.project.assets);await wait(400);
    const materials=[...host.stage.visibleRecords.values()].flatMap(r=>[...r.materials.keys()]);assert(host.stage.ambientLight.intensity===.015,'补光没有随环境变化');
    assert(materials.every(m=>m.emissiveIntensity===undefined||m.emissiveIntensity===0),'人物仍有自发光');
    const mtoon=materials.filter(m=>m.isMToonMaterial);assert(mtoon.length>0&&mtoon.every(m=>m.matcapFactor.r===0&&m.parametricRimColorFactor.r===0),'VRM 固定高光仍亮');
    return {ok:true,ambient:host.stage.ambientLight.intensity,key:host.stage.keyLight.intensity,emissionOff:true,rimOff:true,matcapOff:true};
  }
  if(phase==='mouth'){
    const environment=host.project.environments.find(e=>e.id===currentAct.environmentId);environment.lighting={color:'#ffffff',intensity:2.2,ambientIntensity:.35};
    host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;host.textSpeed=4;await host.showPlayStep();if(host.mode==='editor')host.startTyping(current.text,hua.id);await wait(450);
    const record=host.stage.visibleRecords.get(hua.id);assert(host.stage.livePortrait.record===record,'头像用了另一份模型');
    assert(host.stage.livePortrait.frames>0&&record.talkingMouth?.diagnostics().running,'头像没有实时渲染或嘴型没有启动');
    assert(record.vrm.expressionManager.getValue('happy')>.5,'表情未应用');
    let mouth=false;for(let n=0;n<15;n++){await wait(70);if(['aa','ih','ou','ee','oh'].some(k=>record.vrm.expressionManager.getValue(k)>.05))mouth=true;}
    assert(mouth,'没有实际嘴型变化');host.clearTyping();
    return {ok:true,sameModel:true,frames:host.stage.livePortrait.frames,actualMouthChanges:true,happy:record.vrm.expressionManager.getValue('happy'),castCount:host.stage.visibleRecords.size};
  }
  if(phase==='offstage'){
    current.cast={left:setting(fbx.id),center:setting(''),right:setting('')};await host.displayActStep(currentAct,current);await host.updateSpeakerPortrait(hua.id,true);await wait(250);
    const record=host.stage.livePortrait.record;assert(record&&!host.stage.visibleRecords.has(hua.id),'头像占用了场上位置');assert(record.vrm.scene.visible===false,'头像人物漏到主场景');
    host.stage.startTalking(hua.id,true);host.stage.talkingLetter('你');await wait(200);assert(record.talkingMouth?.diagnostics().running,'场外人物嘴型未启用');host.stage.stopTalking();
    return {ok:true,offstagePortrait:true,castCount:host.stage.visibleRecords.size,modelCount:host.stage.modelCache.size,noDuplicateModel:true};
  }
  if(phase==='fbx'){
    await host.updateSpeakerPortrait(fbx.id,true);await wait(200);assert(host.stage.livePortrait.record===null,'FBX 被替换成实时头像');
    const node=document.querySelector('#speaker-portrait');assert(!node.classList.contains('live-portrait'),'FBX 实时头像标记未清理');
    return {ok:true,fbxStaticPortrait:true,faceControlsUnchanged:true};
  }
  if(phase==='export'){
    host.playing=false;current.cast={left:setting(fbx.id),center:setting(hua.id),right:setting('')};await host.updatePreview();host.markDirty();await host.save();await host.bridge('exportGame',{folderName:'实时头像试玩'});
    return {ok:true,saved:true,exported:true};
  }
  if(phase==='player'){
    host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;host.textSpeed=5;await host.showPlayStep();await wait(300);
    assert(host.stage.livePortrait.record===host.stage.visibleRecords.get(hua.id),'独立游戏头像没有同步');
    assert(host.stage.livePortrait.frames>0,'独立游戏头像未渲染');host.clearTyping();return {ok:true,standaloneLivePortrait:true,skyOutlineExcluded:true};
  }
  if(phase==='environment'){host.playing=false;host.activePanel='story';await host.updatePreview();await host.editEnvironment(currentAct);return {ok:true,opened:true};}
  throw Error('未知检查 '+phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeGraphics=async phase=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(ok,message)=>{if(!ok)throw Error(message);};
 if(phase==='kernel')return verifyFsrGPU();
 if(phase==='export'){await host.save();await host.bridge('exportGame',{folderName:'画面设置试玩'});return {ok:true,exported:true};}
 if(phase==='settings'){
  host.playing=true;host.playAct=0;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();for(const record of host.stage.visibleRecords.values())record.mixer.timeScale=0;host.renderSettingsModal();document.querySelector('#player-graphics-controls').scrollIntoView({block:'start'});window.__graphicsCases=[];return {ok:true,default:host.graphicsPreferences,capabilities:aaOptions.map(([aa])=>({aa,supported:host.stage.graphicsPlan({aa}).supported}))};
 }
 if(typeof phase==='object'){
  const quality=normalizeGraphics(phase);if(!host.stage.graphicsPlan(quality).supported)return {ok:true,skipped:true,reason:host.stage.graphicsPlan(quality).reason};
  const set=(key,value)=>{const input=document.querySelector('[data-graphics='+key+']');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));};set('aa','fxaa');set('upscale','off');for(const [key,value]of Object.entries(quality))set(key,value);
  document.querySelector('[data-action=apply-graphics]').click();for(let i=0;i<300&&JSON.stringify(host.graphicsPreferences)!==JSON.stringify(quality);i++)await wait(20);assert(JSON.stringify(host.graphicsPreferences)===JSON.stringify(quality),'画面设置没有应用：'+document.querySelector('#toast').textContent);
  host.stage.stylePipeline.render(.016);const plan=host.stage.stylePipeline.plan;assert(host.stage.stylePipeline.composer.readBuffer.width===plan.inputWidth,'实际绘制尺寸没有改变');assert(host.stage.stylePipeline.composer.renderTarget1.samples===plan.samples,'MSAA 没有作用于真实缓冲');assert(host.stage.stylePipeline.fxaaPass.enabled===(quality.aa==='fxaa'||quality.aa.startsWith('msaa')),'FXAA 开关未生效');if(plan.fsr)assert(host.stage.stylePipeline.presenter.target.width===plan.outputWidth,'FSR 没有重建到显示尺寸');
  const gl=host.stage.renderer.getContext(),pixel=new Uint8Array(4),colors=[];for(let y=1;y<8;y++)for(let x=1;x<12;x++){gl.readPixels(Math.floor(plan.outputWidth*x/12),Math.floor(plan.outputHeight*y/8),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);colors.push(...pixel.slice(0,3));}const brightness=colors.reduce((a,b)=>a+b,0)/colors.length;assert(brightness>8,'画面黑屏');assert(gl.getError()===gl.NO_ERROR,'GPU 绘制错误');assert(!host.stage.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'着色器无法编译');
  const stored=JSON.parse(localStorage.getItem('vrm-player-graphics-'+host.project.id));assert(stored.aa===quality.aa&&stored.upscale===quality.upscale,'画面设置没有保存');const currentTarget=host.stage.renderer.getRenderTarget();host.stage.renderer.setRenderTarget(host.stage.stylePipeline.composer.renderTarget1);const actualSamples=gl.getParameter(gl.SAMPLES);host.stage.renderer.setRenderTarget(currentTarget);if(plan.samples)assert(actualSamples>=plan.samples,'实际 GPU 缓冲没有使用 MSAA');host.stage.stylePipeline.render(0);const image=host.stage.renderer.domElement.toDataURL('image/png');const result={ok:true,quality,input:[plan.inputWidth,plan.inputHeight],output:[plan.outputWidth,plan.outputHeight],samples:plan.samples,actualSamples,brightness,image};window.__graphicsCases.push(result);return result;
 }
 if(phase==='styles'){await host.applyPlayerGraphics({aa:'fxaa',upscale:'quality'});const results=[];for(const preset of ['zzz','custom','tno']){host.stage.setRenderSettings({...host.project.render,preset});await wait(100);host.stage.stylePipeline.render(.016);const gl=host.stage.renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(40,40,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const code=gl.getError();assert(code===gl.NO_ERROR,'风格与FSR混合错误 '+preset+' code='+code+' programs='+JSON.stringify(host.stage.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).map(p=>p.diagnostics)));assert(!host.stage.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'风格着色器错误');results.push(preset);}await host.applyPlayerGraphics(normalizeGraphics());return {ok:true,presets:results};}
 if(phase==='restart'){const saved=JSON.stringify(host.graphicsPreferences);host.graphicsPreferences=normalizeGraphics();host.loadAudioSettings();host.setupPlayerGraphics();assert(JSON.stringify(host.graphicsPreferences)===saved,'重开没有恢复画质');return {ok:true,reloaded:true};}
 if(phase==='inherit'){
  const before=JSON.stringify(host.graphicsPreferences);host.closePlayerModal();host.playStep=1;await host.showPlayStep();assert(JSON.stringify(host.stage.graphicsSettings)===before,'切对白覆盖玩家画质');host.renderSettingsModal();return {ok:true,dialoguePreserved:true,persisted:host.graphicsPreferences,cases:window.__graphicsCases.length};
 }
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeRender41=async phase=>{const{render41Smoke}=await import('../render41-smoke.js');return render41Smoke(phase,{
 project:()=>host.project,stage:()=>host.stage,selected:()=>host.editedRenderPreset(),reference:()=>({selectedAct: host.selectedAct,selectedStep: host.selectedStep}),undo:()=>host.restoreEditorHistory(-1),save:()=>host.bridge('saveProject',{project:structuredClone(host.project)}),
 editor:async(panel='render')=>{host.playing=false;host.mode='editor';host.closePlayerModal();host.modulePanel=panel==='story'?null:panel;host.moduleBaseline=structuredClone(host.project);host.activePanel=panel;host.selectedAct=Math.max(0,host.project.acts.findIndex(a=>!isEvent(a)&&a.steps?.length));host.selectedStep=0;host.renderEditor();await host.updatePreview();},
 play:async()=>{host.modulePanel=null;host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,250));host.playing=true;host.titleRequest++;host.playAct=Math.max(0,host.project.acts.findIndex(a=>!isEvent(a)&&a.steps?.length));host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();},
 title:async()=>{host.modulePanel=null;host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,250));await host.showTitleScene(true);},
 theme:value=>{host.project.ui.gameTheme=value;document.querySelector('.player').dataset.gameUi=value;}, resetHistory:()=>host.editorHistory.reset()
});};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeRender42=async phase=>{const{render42Smoke}=await import('../render42-smoke.js');return render42Smoke(phase,{project:()=>host.project,stage:()=>host.stage,editor:async()=>{host.playing=false;host.mode='editor';host.modulePanel='render';host.moduleBaseline=structuredClone(host.project);host.activePanel='render';host.selectedAct=0;host.selectedStep=0;host.renderEditor();await host.updatePreview();},play:async()=>{host.modulePanel=null;host.mode='player';host.playing=false;host.renderPlayer();await new Promise(r=>setTimeout(r,250));host.playing=true;host.titleRequest++;host.playAct=0;host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();},theme:value=>{host.project.ui.gameTheme=value;document.querySelector('.player').dataset.gameUi=value;}});};
}
