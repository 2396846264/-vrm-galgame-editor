using System.Text.Json;
using System.Text.Json.Nodes;
using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunAuditRuntimeSmoke(string kind){
  if(!playerMode){
   var p=ReadProject()??throw new Exception("没有测试工程");var acts=p["acts"]!.AsArray();var target=acts.First(a=>a?["event"]?["type"]?.GetValue<string>()==kind&&(kind!="war"||a?["event"]?["burst"]?.GetValue<bool>()!=true))!;var following=acts.First(a=>a?["kind"]?.GetValue<string>()!="event")!;
   p["acts"]=new JsonArray(target.DeepClone(),following.DeepClone());p["characters"]=new JsonArray();p["title"]!["actors"]=new JsonArray();
   string directory=smokeBase+".runtime-game";BuildGame(directory,p);
   var start=new ProcessStartInfo(Path.Combine(directory,"VRMGalgame.exe")){UseShellExecute=false};foreach(string arg in new[]{"--smoke","-",smokeBase+".player",kind=="war"?"--smoke-audit-war":"--smoke-audit-cutscene","--smoke-fresh-audio"})start.ArgumentList.Add(arg);
   using var child=Process.Start(start)!;var finished=child.WaitForExitAsync();if(await Task.WhenAny(finished,Task.Delay(180000))!=finished){child.Kill();throw new Exception("导出游戏测试超时");}await finished;
   string resultFile=smokeBase+".player.runtime-"+kind+".json";if(!File.Exists(resultFile)||JsonNode.Parse(File.ReadAllText(resultFile))?["ok"]?.GetValue<bool>()!=true)throw new Exception(File.Exists(smokeBase+".player.error.txt")?File.ReadAllText(smokeBase+".player.error.txt"):"导出运行未返回成功结果");
   File.WriteAllText(smokeBase+".runtime-export.json",JsonSerializer.Serialize(new{ok=true,kind,exportedGame=directory,actualPlayer=true}));return;
  }
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('#player-start [data-action=play]'))")=="true")break;await Task.Delay(100);}
  string body=kind=="war"?"""
   document.querySelector('#player-start [data-action=knowledge-open]').click();for(let i=0;i<100&&!document.querySelector('.book-card');i++)await wait(50);assert(document.querySelector('.book-card')?.classList.contains('book-locked'),'未完成章节时书本未锁定');document.querySelector('#player-modal [data-action=close-modal]').click();await wait(150);
   document.querySelector('#player-start [data-action=play]').click();for(let i=0;i<400&&!window.__vrmDiagnostics().event?.ready;i++)await wait(50);const button=document.querySelector('[data-action=event-confirm]');assert(button&&!button.disabled,'宣战立即关闭按钮不可用');assert(document.querySelectorAll('.crt-flags img').length===2,'宣战国旗未显示');button.click();for(let i=0;i<400&&window.__vrmDiagnostics().playAct!==1;i++)await wait(50);assert(window.__vrmDiagnostics().playAct===1,'宣战实际确认后未进入下一幕');
   for(let i=0;i<400&&window.__vrmDiagnostics().transitioning;i++)await wait(50);for(let i=0;i<6&&!window.__vrmDiagnostics().titleMode;i++){document.querySelector('.stage-frame').click();await wait(350)}assert(window.__vrmDiagnostics().titleMode,'完成章节后未返回标题');document.querySelector('#player-start [data-action=knowledge-open]').click();for(let i=0;i<100&&!document.querySelector('.book-card');i++)await wait(50);const book=document.querySelector('.book-card');assert(book&&!book.classList.contains('book-locked'),'完成章节后PDF未解锁');book.click();for(let i=0;i<400&&!document.querySelector('.book-paper canvas');i++)await wait(50);assert(document.querySelectorAll('.book-paper canvas').length===2,'导出游戏PDF无法阅读');return {ok:true,actualPlayer:true,immediateClose:true,flags:2,asynchronousAdvance:true,bookInitiallyLocked:true,bookUnlockedAfterChapter:true,offlinePdfRead:true};
  """:"""
   async function open(){document.querySelector('[data-action=stop-play]')?.click();await wait(150);document.querySelector('#player-start [data-action=play]').click();for(let i=0;i<400;i++){const v=document.querySelector('video');if(v?.readyState>=2&&window.__vrmDiagnostics().event?.ready)return v;await wait(50)}throw Error('MP4未准备完成');}
   let video=await open();await wait(700);assert(video.currentTime>0&&!video.paused,'MP4未实际播放');const duration=video.duration;assert(Number.isFinite(duration)&&duration>0,'MP4时长无效');video.currentTime=duration-.15;await video.play();for(let i=0;i<400&&window.__vrmDiagnostics().playAct!==1;i++)await wait(50);assert(window.__vrmDiagnostics().playAct===1,'播放结束未进入下一幕');
   video=await open();video.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,detail:2}));for(let i=0;i<400&&window.__vrmDiagnostics().playAct!==1;i++)await wait(50);assert(window.__vrmDiagnostics().playAct===1,'双击未跳过视频');return {ok:true,actualPlayer:true,actualMp4Playback:true,naturalEnd:true,doubleClickSkip:true,duration};
  """;
  await web.CoreWebView2.ExecuteScriptAsync("window.__runtimeAudit=null;(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)};"+body+"})().then(r=>window.__runtimeAudit=r).catch(e=>window.__runtimeAudit={error:e.message,stack:e.stack})");
  string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__runtimeAudit");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".runtime-"+kind+".json",result);using(var shot=File.Create(smokeBase+".runtime-"+kind+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
}
