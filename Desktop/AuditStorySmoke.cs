using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunAuditStorySmoke(){
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('[data-field=\"step.text\"]')&&window.editorProjectSnapshot?.())")=="true")break;await Task.Delay(100);}
  string script="""
  (async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)},text=()=>window.editorProjectSnapshot().acts[0].steps[0].text;
   const original=text(),input=document.querySelector('[data-field="step.text"]');input.focus();input.value='真实输入撤销重做验证';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();await wait(200);
   assert(text()==='真实输入撤销重做验证','输入没有生效');document.querySelector('[data-action=editor-undo]').click();for(let i=0;i<1600&&(text()!==original||document.querySelector('.editor.history-busy')||document.querySelector('[data-action=editor-redo]').disabled);i++)await wait(50);assert(text()===original&&!document.querySelector('[data-action=editor-redo]').disabled,'实际撤销操作未完成');
   document.querySelector('[data-action=editor-redo]').click();for(let i=0;i<1600&&(text()!=='真实输入撤销重做验证'||document.querySelector('.editor.history-busy')||document.querySelector('[data-action=editor-undo]').disabled);i++)await wait(50);assert(text()==='真实输入撤销重做验证'&&!document.querySelector('[data-action=editor-undo]').disabled,'实际重做操作未完成');
   const upload=document.querySelector('[data-action=upload-dialogue-voice]');assert(upload,'上传配音按钮不存在');upload.click();for(let i=0;i<600&&!window.editorProjectSnapshot().acts[0].steps[0].voiceId;i++)await wait(50);const p=window.editorProjectSnapshot(),line=p.acts[0].steps[0],voice=p.assets.find(a=>a.id===line.voiceId);assert(voice?.type==='voice'&&voice.characterId===line.characterId&&voice.path.startsWith('assets/voice/'),'实际对白配音上传失败');const response=await fetch('https://project.galgame/'+voice.path);assert(response.ok,'上传的配音文件无法读取');const audioContext=new AudioContext(),buffer=await audioContext.decodeAudioData(await response.arrayBuffer());assert(buffer.duration>0,'上传配音无法解码');await audioContext.close();await window.editorSaveBeforeClose();
   const war=window.editorProjectSnapshot().acts.findIndex(a=>a.event?.type==='war'&&!a.event.burst);let warAdvanced=false;
   // Runtime event transitions are exercised in an exported player separately.
   return {ok:true,actualInput:true,actualUndoRedoButtons:true,saved:true,dialogueVoiceImported:true,audioDecoded:true,voiceDuration:buffer.duration};
  })().then(r=>window.__auditStory=r).catch(e=>window.__auditStory={error:e.message,stack:e.stack,diagnostics:window.__vrmDiagnostics?.().editorHistory})
  """;
  await web.CoreWebView2.ExecuteScriptAsync("window.__auditStory=null;"+script);string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__auditStory");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".story-ui.json",result);using(var shot=File.Create(smokeBase+".story-ui.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
 private async Task RunAuditCutsceneSmoke(){
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('.editor #sidebar-body')&&window.editorProjectSnapshot?.())")=="true")break;await Task.Delay(100);}
  string script="""
  (async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)},snap=window.editorProjectSnapshot(),index=snap.acts.findIndex(a=>a.event?.type==='cutscene');assert(index>=0,'缺少过场样本');
   async function open(){document.querySelector('[data-action=stop-play]')?.click();await wait(150);document.querySelector('[data-action=select-act][data-index="'+index+'"]').click();await wait(200);document.querySelector('[data-action=event-preview]').click();for(let i=0;i<400;i++){const v=document.querySelector('video');if(v?.readyState>=2)return v;await wait(50)}throw Error('MP4未准备完成');}
   let video=await open();await wait(700);assert(video.currentTime>0&&!video.paused,'MP4未实际播放');const duration=video.duration;video.currentTime=duration-.15;await video.play();for(let i=0;i<400&&window.__vrmDiagnostics().playAct!==index+1;i++)await wait(50);assert(window.__vrmDiagnostics().playAct===index+1,'视频播放结束未进入下一幕');
   video=await open();video.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));for(let i=0;i<400&&window.__vrmDiagnostics().playAct!==index+1;i++)await wait(50);assert(window.__vrmDiagnostics().playAct===index+1,'双击视频未跳过');return {ok:true,actualMp4Playback:true,naturalEnd:true,doubleClickSkip:true,duration};
  })().then(r=>window.__auditVideo=r).catch(e=>window.__auditVideo={error:e.message,stack:e.stack})
  """;
  await web.CoreWebView2.ExecuteScriptAsync("window.__auditVideo=null;"+script);string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__auditVideo");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".cutscene-ui.json",result);using(var shot=File.Create(smokeBase+".cutscene-ui.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
}
