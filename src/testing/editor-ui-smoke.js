import {defaultNameColor} from '../character-name-color.js';
import {snapshotCamera} from '../dialogue-camera.js';
import {emptyDialogueCast} from '../dialogue-cast.js';
import {gameUiPresets} from '../game-ui.js';
import {isEvent} from '../events.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
window.__vrmSmokePreviewResize=async(mode)=>{
 const frame=document.querySelector('.center .stage-frame'),assert=(test,message)=>{if(!test)throw Error(message);};
 const wait=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(mode==='reset'){host.previewResizer.reset();window.__previewResizeEvents=[];await wait();}
 if(mode==='persist'){const width=frame.getBoundingClientRect().width,revision=host.changeRevision;host.renderEditor();await wait();assert(Math.abs(document.querySelector('.center .stage-frame').getBoundingClientRect().width-width)<2,'重开编辑界面丢失大小');assert(host.changeRevision===revision,'调整预览修改了工程');}
 const current=document.querySelector('.center .stage-frame'),rect=current.getBoundingClientRect(),corner=current.querySelector('[data-preview-resize="corner"]').getBoundingClientRect(),body=document.querySelector('.asset-dock-body');assert(Math.abs(rect.width/rect.height-16/9)<.01,'拖动改变比例');assert(body.clientHeight>=140,'拖动挤压素材卡片');return {ok:true,width:rect.width,height:rect.height,ratio:rect.width/rect.height,assetBodyHeight:body.clientHeight,preferredWidth:host.previewResizer.preferredWidth,hit:document.elementFromPoint(corner.left+corner.width/2,corner.top+corner.height/2)?.outerHTML.slice(0,250),pointer:window.__resizePointer,events:window.__previewResizeEvents,corner:{x:corner.left+corner.width/2,y:corner.top+corner.height/2}};
};

window.__vrmSmokeEditorLayout=async()=>{
 if(!new URLSearchParams(location.search).has('smoke'))throw Error('Smoke only');
 if(!window.__newDialogueVerified){
  const previous=structuredClone(host.act().steps.at(-1));document.querySelector('[data-action=add-step]').click();
  const created=host.step();if(!previous||created.id===previous.id||created.text!=='')throw Error('新增对白没有独立编号或台词没留空');
  const expected={...previous,id:created.id,text:''};if(JSON.stringify(created)!==JSON.stringify(expected))throw Error('新增对白没有完整继承上一句');
  host.act().steps.pop();host.selectedStep=0;window.__newDialogueVerified=true;
 }
 const assert=(test,message)=>{if(!test)throw Error(message);};host.playing=false;host.activePanel='story';host.selectedAct=Math.max(0,host.project.acts.findIndex(a=>a.id==='act-school'));host.selectedStep=0;host.activeAssetType='vrm';host.renderSidebar();host.renderInspector();await host.updatePreview();host.renderAssetDock();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 host.previewResizer.reset();await document.fonts.ready;await Promise.allSettled([...document.querySelectorAll('.asset-dock img')].map(img=>img.decode()));await new Promise(resolve=>setTimeout(resolve,120));
 const center=document.querySelector('.center'),preview=center.querySelector('.stage-frame'),dock=document.querySelector('.asset-dock'),body=document.querySelector('.asset-dock-body'),p=preview.getBoundingClientRect(),d=dock.getBoundingClientRect(),c=center.getBoundingClientRect(),tile=document.querySelector('.asset-file-tile')?.getBoundingClientRect();
 assert(Math.abs(p.width/p.height-16/9)<.03,'预览比例改变');assert(p.width<=961,'预览没有限制最大宽度');assert(d.bottom<=c.bottom+1,'素材库超出可见范围');assert(body.clientHeight>=140,'素材区仍不能显示完整卡片：'+body.clientHeight);if(tile)assert(tile.bottom<=body.getBoundingClientRect().bottom+4,'素材卡片被挤出窗口：'+JSON.stringify({tile:tile.bottom,body:body.getBoundingClientRect().bottom,height:body.clientHeight,scroll:body.scrollTop}));assert(!document.querySelector('.player'),'编辑状态错误');
 const nav=document.querySelector('.topbar nav'),rows=new Set([...nav.querySelectorAll('button')].map(button=>Math.round(button.getBoundingClientRect().top))),feedback=document.querySelector('.editor-feedback');
 assert(rows.size===1,'顶部按钮换行了');const current=document.querySelector('#story-current'),currentRect=current.getBoundingClientRect(),firstButton=nav.querySelector('button').getBoundingClientRect();assert(Boolean(current.closest('.editor-tools-row')),'正在编辑提示不在顶部');assert(Math.abs((currentRect.top+currentRect.height/2)-(firstButton.top+firstButton.height/2))<6,'绿色提示和按钮不在同一排');assert(!center.querySelector('.stage-toolbar,.stage-hint,#story-current,#stage-caption'),'预览旁仍有文字栏');assert(document.querySelector('[data-action=restart-character-preview]').closest('.topbar'),'重播按钮没有搬到顶部');assert(document.querySelector('#stage-caption').closest('.dialogue-column'),'幕名没有搬到对白栏');assert(Boolean(feedback?.closest('footer.status')),'QQ 群号没有在底部');assert(!nav.querySelector('.editor-feedback'),'顶部仍占用群号空间');
 return {ok:true,viewport:[innerWidth,innerHeight],preview:[p.width,p.height],assetDockHeight:d.height,assetBodyHeight:body.clientHeight,previewRatio:p.width/p.height,centerScroll:Math.max(0,center.scrollHeight-center.clientHeight),toolbarRows:rows.size,headerHeight:document.querySelector('.topbar').getBoundingClientRect().height,feedbackInFooter:true,newDialogueInherited:true,statusInToolbar:true,previewTextRowsRemoved:true,captionInDialogueColumn:true};
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeUi33=async phase=>{
 const assert=(value,message)=>{if(!value)throw Error(message);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const controls=()=>[...document.querySelectorAll('#play-controls button')].map(b=>b.dataset.action).sort().join(',');
 if(phase==='picker'){
  await Promise.all([...host.portraitJobs.values()]);const theme=host.editorSettings.theme,revision=host.changeRevision;
  document.querySelector('[data-action="game-ui"]').click();assert(document.querySelectorAll('#game-ui-picker input[type="radio"]').length===gameUiPresets.length,'Game presets missing');assert(!document.querySelector('#game-ui-picker input[type="color"]'),'Classic glass must remain unchanged');
  document.querySelector('#game-ui-picker input[value="terminal"]').checked=true;document.querySelector('[data-action="close-game-ui"]').click();assert(host.changeRevision===revision,'Cancel changed project');
  host.renderGameUiPicker();document.querySelector('#game-ui-picker input[value="pop"]').checked=true;document.querySelector('[data-action="apply-game-ui"]').click();assert(host.project.ui.gameTheme==='pop'&&host.dirty,'Choice not applied');assert(host.editorSettings.theme===theme,'Changed editor skin');host.renderGameUiPicker();return{ok:true,threePresets:true,cancelPreservesProject:true,editorUnaffected:true};
 }
 if(phase==='reopen'){
  assert(host.project.ui.gameTheme==='terminal','Saved/exported game lost its skin');host.mode='player';host.playing=false;host.renderPlayer();await wait(900);assert(document.querySelector('.player')?.dataset.gameUi==='terminal','Player skin missing');return{ok:true,theme:host.project.ui.gameTheme,savedAndExported:true};
 }
 if(phase==='pop-title'){
  document.querySelector('#game-ui-picker')?.remove();host.project.id='ui33-'+host.uid();host.lifetimeProgress=null;host.project.ui.dialogueImageId='';host.mode='player';host.playing=false;host.renderPlayer();host.audioSettings.master=0;host.applyAudioSettings();await wait(1500);
  for(let i=0;i<200&&document.querySelector('#act-loading:not(.hidden)');i++)await wait(50);
  window.__ui33controls=controls();window.__ui33title=[...document.querySelectorAll('.title-bottom-menu button')].map(b=>b.dataset.action).sort().join(',');assert(document.querySelector('.player')?.dataset.gameUi==='pop','Missing pop skin');return{ok:true,titleButtons:window.__ui33title};
 }
 if(phase==='pop-dialogue'){
  host.playing=true;host.titleRequest++;host.playAct=host.project.acts.findIndex(a=>!isEvent(a)&&a.steps.length);host.playStep=0;host.preparedAct=-1;host.cameraActId='';await host.showPlayStep();host.showDialogue('角色 · 粉白舞台','这是你选择的粉白舞台界面。\n原来的按钮和功能全部保留。',true,host.project.acts[host.playAct].steps[0].characterId);host.finishTyping();host.playerInventory.pending=[];document.querySelector('#inventory-reward')?.remove();host.saveModalMode='';await wait(500);assert(!document.querySelector('#inventory-reward'),'Reward obscures UI screenshot');
  assert(getComputedStyle(document.querySelector('#dialogue')).backgroundColor!=='rgba(0, 0, 0, 0)','Dialogue box is transparent');assert(controls()===window.__ui33controls,'Game buttons changed');return{ok:true,gameButtonsUnchanged:true,dialogueBackground:getComputedStyle(document.querySelector('#dialogue')).backgroundColor};
 }
 if(phase.endsWith('-settings')){
  host.renderSettingsModal();assert(document.querySelector('[data-camera-speed]')&&document.querySelector('[data-graphics]')&&document.querySelector('[data-volume]'),'Lost existing game settings');await wait(450);return{ok:true,settingsPreserved:true,background:getComputedStyle(document.querySelector('.settings-box')).backgroundColor};
 }
 if(phase==='terminal-dialogue'){
  host.closePlayerModal();await wait(220);host.project.ui.gameTheme='terminal';document.querySelector('.player').dataset.gameUi='terminal';host.showDialogue('记录员 · 青绿终端','记录已更新。\n镜头正在移动时，画面保持干净。',true,host.project.acts[host.playAct].steps[0].characterId);host.finishTyping();assert(controls()===window.__ui33controls,'Game buttons changed');await wait(400);return{ok:true,gameButtonsUnchanged:true,ink:getComputedStyle(document.querySelector('#dialogue-text')).color};
 }
 if(phase==='classic'){
  host.closePlayerModal();await wait(220);host.project.ui.gameTheme='classic';document.querySelector('.player').dataset.gameUi='classic';host.showDialogue('角色 · 经典玻璃','原来的透明玻璃界面也可以继续使用。',true,host.project.acts[host.playAct].steps[0].characterId);host.finishTyping();assert(controls()===window.__ui33controls,'Classic buttons changed');assert(getComputedStyle(document.querySelector('#dialogue')).backgroundColor==='rgba(0, 0, 0, 0)','Classic appearance changed');return{ok:true,classicPreserved:true};
 }
 if(phase==='camera-empty'){
  host.project.ui.gameTheme='terminal';document.querySelector('.player').dataset.gameUi='terminal';const pose=snapshotCamera(host.stage.camera),target={...pose,position:[pose.position[0]+12,pose.position[1],pose.position[2]]};
  const blank={id:host.uid(),name:'空场景镜头测试',cast:emptyDialogueCast(),castSettings:{},steps:[{id:host.uid(),text:'没有人物也能正常显示旁白。',speaker:'旁白',characterId:'',cast:emptyDialogueCast(),choices:[],camera:pose},{id:host.uid(),text:'切镜头时没有转圈。',speaker:'旁白',characterId:'',cast:emptyDialogueCast(),choices:[],camera:target}]};host.project.acts.push(blank);host.playAct=host.project.acts.length-1;host.playStep=0;host.preparedAct=-1;
  const opening=host.showPlayStep();await wait(10);assert(!document.querySelector('#act-loading').classList.contains('hidden'),'Act loading was removed');await opening;host.finishTyping();assert(document.querySelector('#stage-placeholder').style.display==='none'&&!document.querySelector('.player').textContent.includes('此句没有 VRM'),'Empty scene prompt still shown');
  host.playStep=1;const flight=host.showPlayStep();for(let i=0;i<100&&!host.dialogueCamera.moving;i++)await wait(30);assert(host.dialogueCamera.moving,'Camera did not move');assert(document.querySelector('#act-loading').classList.contains('hidden'),'Camera travel shows act spinner');assert(!document.querySelector('#stage-placeholder .loading-spinner')&&document.querySelector('#stage-placeholder').style.display==='none','Camera placeholder spinner');host.dialogueCamera.finish();await flight;host.finishTyping();return{ok:true,cameraMovesWithoutSpinner:true,emptySceneWithoutWarning:true,realActLoadingRetained:true};
 }
 if(phase==='save-export'){
  host.playing=false;host.mode='editor';host.closePlayerModal();host.project.ui.gameTheme='terminal';host.project.assets=[];host.project.characters=[];host.project.assetFolders=[];host.project.environments=[];host.project.items=[];host.project.books=[];host.project.acts=[host.project.acts.at(-1)];host.project.title={actors:[],logoImageId:'__none__'};host.selectedAct=0;host.selectedStep=0;host.activePanel='story';host.normalize();host.renderEditor();host.markDirty();await host.save();const exported=await host.bridge('exportGame',{folderName:'UI33导出验证'});return{ok:true,theme:host.project.ui.gameTheme,exported};
 }
 throw Error('Unknown UI smoke phase');
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeReference59=async phase=>{
 const assert=(v,m)=>{if(!v)throw Error(m);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 if(phase==='prepare'){
  assert(host.project.characters.length>=2,'需要两个验证角色');
  const story=JSON.stringify(host.project.acts),previousModule=host.modulePanel;host.activePanel='characters';host.modulePanel='characters';host.selectedCharacter=0;host.renderEditor();
  for(const[index,color]of [[0,'#6bc9ff'],[1,'#e6a1d5']]){host.selectedCharacter=index;host.renderInspector();const input=document.querySelector('[data-field="character.nameColor"]');input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));}
  assert(host.project.characters[0].nameColor==='#6bc9ff'&&host.project.characters[1].nameColor==='#e6a1d5','姓名配色串联');assert(JSON.stringify(host.project.acts)===story,'修改颜色改变对白');host.modulePanel=previousModule;await host.save();return{ok:true,independentNameColors:true,storyUnchanged:true};
 }
 if(phase==='reopen'){assert(host.project.characters[0].nameColor==='#6bc9ff'&&host.project.characters[1].nameColor==='#e6a1d5','重开颜色丢失');assert(host.project.ui.gameTheme==='classic','旧风格没有迁移');return{ok:true,nameColorsRoundtrip:true,legacyThemeMigrated:true};}
 if(phase==='editor'){host.mode='editor';host.modulePanel='characters';host.activePanel='characters';host.selectedCharacter=0;host.renderEditor();return{ok:true};}
 if(phase==='title'){host.mode='player';host.modulePanel=null;host.playing=false;host.renderPlayer();for(let n=0;n<120&&!document.querySelector('#player-start button');n++)await wait(50);await wait(350);assert(document.querySelectorAll('#player-start .title-bottom-menu button').length===9,'标题菜单数量错误');assert(!document.querySelector('.knowledge-title-button'),'左上图标残留');return{ok:true,libraryInBottomMenu:true};}
 if(phase==='story'){host.playing=true;host.titleRequest++;host.playAct=Math.max(0,host.project.acts.findIndex(a=>!isEvent(a)&&a.steps?.length));host.playStep=0;host.preparedAct=-1;await host.showPlayStep();host.finishTyping();return{ok:true};}
 if(phase==='name0'||phase==='name1'||phase==='name2'){
  const role=host.project.characters[Number(phase.slice(-1))];host.showDialogue(role.name,'我知道！可是你一盯着我，我就只记得你在盯着我了。',true,role.id);host.finishTyping();await host.updateSpeakerPortrait(role.id,true);
  if(host.isLiveModel(role.modelId)){for(let i=0;i<180&&(!document.querySelector('.live-portrait-canvas')||!host.stage.livePortrait.frames);i++)await wait(50);assert(document.querySelector('.live-portrait-canvas')&&host.stage.livePortrait.frames>0,'可动头像没有显示在玻璃前');}
  await wait(300);let portraitPixels=null;const canvas=document.querySelector('.live-portrait-canvas');if(canvas){const image=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),data=image.data;let minY=canvas.height,maxY=0,minX=canvas.width,maxX=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>80){minY=Math.min(minY,y);maxY=Math.max(maxY,y);minX=Math.min(minX,x);maxX=Math.max(maxX,x);}assert(minY>2&&minY<canvas.height,'头像头顶被画布裁切或未显示');portraitPixels={canvas:[canvas.width,canvas.height],bounds:[minX,minY,maxX,maxY],topMargin:minY};}const dialogueBox=document.querySelector('.dialogue').getBoundingClientRect(),stageBox=document.querySelector('.stage-frame').getBoundingClientRect();assert(!document.querySelector('.portrait-glass-frame'),'头像垫底未删除');assert(Math.abs(dialogueBox.left-stageBox.left)<1&&Math.abs(dialogueBox.width-stageBox.width)<2,'对白框未延伸至屏幕左侧');assert(Math.abs(dialogueBox.height/stageBox.height-.26)<.002,'对白框高度不正确');const portraitBox=document.querySelector('.speaker-portrait').getBoundingClientRect();const portraitLayout={left:(portraitBox.left-stageBox.left)/stageBox.width,bottom:(stageBox.bottom-portraitBox.bottom)/stageBox.height,width:portraitBox.width/stageBox.width,height:portraitBox.height/stageBox.height};const livePortrait=document.querySelector('.speaker-portrait').classList.contains('live-portrait');assert(!portraitBox.width||(Math.abs(portraitLayout.left-(livePortrait?0:.04))<.002&&Math.abs(portraitLayout.width-(livePortrait?.54:.5))<.002),'头像绘制范围未贴齐屏幕左缘');const edgeStyle=getComputedStyle(document.querySelector('.dialogue'));const bottomEdge={border:edgeStyle.borderBottomWidth,leftRadius:edgeStyle.borderBottomLeftRadius,rightRadius:edgeStyle.borderBottomRightRadius,bottom:stageBox.bottom-dialogueBox.bottom};assert(bottomEdge.border==='0px'&&bottomEdge.leftRadius==='0px'&&bottomEdge.rightRadius==='0px'&&Math.abs(bottomEdge.bottom)<1,'对白框底部未无边线贴齐屏幕');const dialogueLayout={left:dialogueBox.left-stageBox.left,width:dialogueBox.width/stageBox.width,height:dialogueBox.height/stageBox.height,bottomEdge};assert(!document.querySelector('.dialogue-glints,.scene-top-actions [data-action=save-game]'),'装饰线或重复存档未移除');assert(document.querySelectorAll('.scene-quick-actions [data-action=save-game]').length===1,'底部存档按钮缺失');const color=getComputedStyle(document.querySelector('#dialogue-speaker')).color;assert(color===(phase==='name0'?'rgb(107, 201, 255)':phase==='name1'?'rgb(230, 161, 213)':'rgb(255, 191, 220)'),'姓名颜色未跟随角色');return{ok:true,role:role.name,color,livePortrait:host.stage.livePortrait.frames,portraitCanvas:Boolean(document.querySelector('.live-portrait-canvas')),portraitPixels,portraitLayout,dialogueLayout,portraitProjection:{zoom:host.stage.livePortrait.camera.zoom,left:host.stage.livePortrait.camera.left,right:host.stage.livePortrait.camera.right,area:host.stage.element.getBoundingClientRect().toJSON(),node:portraitBox.toJSON()}};
 }
 if(phase==='settings'){host.renderSettingsModal();return{ok:true};}
 if(phase==='saves'){host.renderSaveModal('save');return{ok:true};}
 if(phase==='library'){
  await host.library.click('knowledge-open',document.createElement('button'));await wait(350);
  const cards=[...document.querySelectorAll('.book-library .book-card')].map(card=>{
   const box=card.getBoundingClientRect(),style=getComputedStyle(card);
   const text=[...card.querySelectorAll('b,small')].map(node=>{const r=node.getBoundingClientRect();return{text:node.textContent,inside:r.left>=box.left&&r.right<=box.right+1&&r.top>=box.top&&r.bottom<=box.bottom+1,wrapped:node.scrollWidth<=node.clientWidth+1};});
   assert(parseFloat(style.borderTopLeftRadius)<=20,'资料库仍然是胶囊边框');assert(text.every(t=>t.inside&&t.wrapped),'资料库文字超出卡片');return{width:box.width,height:box.height,radius:style.borderTopLeftRadius,text};
  });return{ok:true,cards};
 }
 if(phase==='inventory'){host.renderBackpack();return{ok:true};}
 if(phase==='progress'){host.renderProgressModal();return{ok:true};}
 if(phase==='close'){host.closePlayerModal();await wait(350);return{ok:true};}
 if(phase==='diagnostics'){return{ok:!host.stageError,stageError: host.stageError,frames:host.stage?.livePortrait.frames||0,pending:Boolean(host.stage?.livePortrait.readingPortrait),shaders:(host.stage?.renderer.info.programs||[]).filter(p=>p.diagnostics&&!p.diagnostics.runnable).length};}
 throw Error(phase);
};

if(new URLSearchParams(location.search).has('smoke'))window.__vrmSmokeReference59Import=async imported=>{
 const models=imported.filter(a=>['vrm','mmdCharacter'].includes(a.type));if(models.length<3)throw Error('需要导入两个 VRM 和一个 PMX');
 host.project.assets.push(...imported);host.project.characters=models.map((a,i)=>({id:host.uid(),name:['木裳','嬅','千早爱音'][i]||a.name,modelId:a.id,nameColor:defaultNameColor,autoMouth:true,stories:[]}));
 const old=host.project.acts.find(a=>!isEvent(a)&&a.steps?.length),cast=emptyDialogueCast();
 for(const[i,slot]of ['left','center','right'].entries())cast[slot]={...cast[slot],characterId:host.project.characters[i].id,size:1.15};
 host.project.acts=[{id:host.uid(),name:'真实角色 · UI 验证',backgroundId:old?.backgroundId||'',environmentId:old?.environmentId||'',bgmId:'',steps:host.project.characters.slice(0,3).map(role=>({id:host.uid(),characterId:role.id,speaker:'',text:'我知道！可是你一盯着我，我就只记得你在盯着我了。',choices:[],cast:structuredClone(cast)}))}];
 host.project.title.actors=[];host.normalize();host.selectedAct=host.selectedStep=0;host.activePanel='story';host.modulePanel=null;host.markDirty();host.renderEditor();await host.updatePreview();
 return{ok:true,importedModels:models.map(a=>({id:a.id,name:a.name,type:a.type})),importedFiles:imported.length,originalFilesPreserved:true};
};
}
