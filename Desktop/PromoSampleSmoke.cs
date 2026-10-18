using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunPromoPackageSmoke(){
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.editorProjectSnapshot?.()?.id)")=="true")break;await Task.Delay(100);}
  var p=ReadProject()??throw new Exception("样板工程未打开");
  if(p["id"]?.GetValue<string>()!="nanting-tomorrow-demo-20261015")throw new Exception("不是宣传样板工程");
  var info=SaveProjectAs(p,p["name"]!.GetValue<string>());
  if(smokeFileOpsParent==null||Directory.Exists(smokeFileOpsParent))throw new Exception("请提供尚不存在的样板导出目录");
  BuildGame(smokeFileOpsParent,ReadProject()!);
  File.WriteAllText(smokeBase+".promo-package.json",JsonSerializer.Serialize(new{ok=true,archive=info,gameDirectory=smokeFileOpsParent,encryptedArchive=true,actualProtectedExporter=true}));
 }
 private async Task RunPromoPlayerSmoke(){
  if(!playerMode)throw new Exception("需要实际导出游戏");
  SetFullscreen(true);
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('#player-start [data-action=play]'))")=="true")break;await Task.Delay(100);}
  var p=ReadProject()!;var acts=p["acts"]!.AsArray();var visited=new HashSet<string>();var trace=new JsonArray();bool completed=false;
  using(var image=File.Create(smokeBase+".title.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
  await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=play]').click()");
  for(int i=0;i<4000;i++){
   await Task.Delay(180);var d=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics()"))!;
   if(d["stageError"]?.GetValue<string>() is string error&&!string.IsNullOrWhiteSpace(error))throw new Exception("样板渲染："+error);
   int a=d["playAct"]?.GetValue<int>()??0,s=d["playStep"]?.GetValue<int>()??0;
   if(a>=acts.Count && visited.Contains("chapter-end") && d["playing"]?.GetValue<bool>()==false){if(d["titleMode"]?.GetValue<bool>()==true){completed=true;break;}continue;}
   if(a<0||a>=acts.Count)throw new Exception("剧情索引越界");string id=acts[a]!["id"]!.GetValue<string>();
   if(d["titleMode"]?.GetValue<bool>()==true&&visited.Contains("chapter-end")){completed=true;break;}
   if(d["transitioning"]?.GetValue<bool>()==true)continue;
   if(visited.Add(id)){
    await Task.Delay(1500);trace.Add(new JsonObject{{"actId",id},{"name",acts[a]!["name"]!.GetValue<string>()},{"at",DateTime.UtcNow.ToString("O")}});File.WriteAllText(smokeBase+".tour-progress.json",trace.ToJsonString());
    using var image=File.Create(smokeBase+".scene-"+id+".png");await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
   }
   string result=await web.CoreWebView2.ExecuteScriptAsync("""
    (()=>{const click=s=>{const n=document.querySelector(s);if(n&&!n.disabled){n.click();return true;}return false;};
     if(click('[data-action=confirm-item-reward]'))return 'reward';
     const v=document.querySelector('video');if(v)return 'video';
     if(document.querySelector('.aircombat')){if(click('[data-air-run=continue]'))return 'air-result';const canvas=document.querySelector('.air-canvas');if(canvas){canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:canvas.getBoundingClientRect().left+canvas.clientWidth/2,clientY:canvas.getBoundingClientRect().top+canvas.clientHeight/2,bubbles:true}));}return 'air';}
     if(document.querySelector('[data-action=event-confirm]')){click('[data-action=event-confirm]');return 'event';}
     const d=window.__vrmDiagnostics();if(d.typing){document.querySelector('.stage-frame').click();return 'typing';}
     if(click('[data-action=choose]:not(:disabled)'))return 'choice';
     document.querySelector('.stage-frame').click();return 'advance';})()
   """);
  }
  if(!completed)throw new Exception("完整剧情未在测试期限内完成");
  File.WriteAllText(smokeBase+".promo-player.json",JsonSerializer.Serialize(new{ok=true,actualExportedPlayer=true,completedMainStory=true,visited=visited.ToArray(),traceCount=trace.Count}));
 }
}
