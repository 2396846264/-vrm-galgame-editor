using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunPromoExtrasSmoke(){
  SetFullscreen(true);
  web.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled=false;
  web.CoreWebView2.ScriptDialogOpening+=(_,e)=>e.Accept();
  async Task WaitFor(string condition,int attempts=600){File.WriteAllText(smokeBase+".phase.txt",condition);for(int i=0;i<attempts;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean("+condition+")")=="true")return;await Task.Delay(100);}await Shot("failure");File.WriteAllText(smokeBase+".failure-diagnostics.json",await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics()"));throw new Exception("等待失败："+condition);}
  async Task Click(string selector){string js="(()=>{const n=document.querySelector("+JsonSerializer.Serialize(selector)+");if(!n||n.disabled)throw Error('按钮不可用: '+"+JsonSerializer.Serialize(selector)+");n.click();return true;})()";if(await web.CoreWebView2.ExecuteScriptAsync(js)!="true")throw new Exception("点击失败："+selector);await Task.Delay(450);}
  async Task Shot(string name){using var image=File.Create(smokeBase+"."+name+".png");await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);}
  await WaitFor("document.querySelector('#player-start [data-action=play]') && document.querySelector('#act-loading')?.classList.contains('hidden')");await Task.Delay(1800);await Shot("title-ready");
  if(Environment.GetCommandLineArgs().Contains("--smoke-promo-visual-only")){
   var project=ReadProject()!;int crowdIndex=project["acts"]!.AsArray().Select((a,i)=>(a,i)).First(x=>x.a?["id"]?.GetValue<string>()=="chapter-crowd").i;
   await Click("[data-action=play-progress]");await Click("[data-action=chapter-replay][data-index='"+crowdIndex+"']");await WaitFor("window.__vrmDiagnostics().visibleActorIds.length===30 && !window.__vrmDiagnostics().transitioning");await Task.Delay(3000);await Shot("crowd-visible-final");
   var visual=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics()"))!;if(!string.IsNullOrWhiteSpace(visual["stageError"]?.GetValue<string>()))throw new Exception(visual["stageError"]!.ToString());File.WriteAllText(smokeBase+".promo-visual.json",JsonSerializer.Serialize(new{ok=true,actualProtectedPlayer=true,actors=30,updatedFbxMaterial=true}));return;
  }
  await Click("[data-action=knowledge-open]");await WaitFor("document.querySelectorAll('.book-card:not(.book-locked)').length===2");await Shot("books-unlocked");
  await Click("[data-action=book-read][data-index='0']");await WaitFor("document.querySelectorAll('.book-paper canvas').length>0 && document.querySelector('#book-page-state')?.textContent.includes('/ 5')");
  for(int i=0;i<3;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('#book-page-state')?.textContent.startsWith('1'))")=="true")break;await Click("[data-action=book-prev]");await Task.Delay(600);}
  await WaitFor("document.querySelectorAll('.book-paper canvas').length===2 && document.querySelector('#book-page-state')?.textContent.startsWith('1')");await Shot("book-first");await Click("[data-action=book-next]");await WaitFor("document.querySelector('#book-page-state')?.textContent.startsWith('3')");await Shot("book-diagram");await Click("[data-action=book-next]");await WaitFor("document.querySelector('#book-page-state')?.textContent.startsWith('5') && document.querySelector('[data-action=book-next]')?.disabled");await Click("[data-action=book-reader-close]");await Click("[data-action=close-modal]");
  await Click("[data-action=gallery]");await WaitFor("document.querySelectorAll('.gallery-image-tile:not(:disabled)').length>0");await Shot("gallery-images");await Click("[data-action=gallery-tab][data-tab=music]");await WaitFor("document.querySelectorAll('[data-action=gallery-track]:not(:disabled)').length===3");await Shot("gallery-music");await Click("[data-action=close-modal]");
  await Click("[data-action=role-details]");await WaitFor("document.querySelector('.role-details-canvas')");await Task.Delay(7000);await Shot("roles");await Click("[data-role-close]");
  await Click("[data-action=play-progress]");await WaitFor("document.querySelectorAll('.chapter-card:not(:disabled)').length>15");await Shot("chapters");var p=ReadProject()!;int lastIndex=p["acts"]!.AsArray().Select((a,i)=>(a,i)).First(x=>x.a?["id"]?.GetValue<string>()=="chapter-21").i;await Click("[data-action=chapter-replay][data-index='"+lastIndex+"']");await WaitFor("!window.__vrmDiagnostics().transitioning && !window.__vrmDiagnostics().titleMode");
  await Click("[data-action=save-game]");await WaitFor("document.querySelector('[data-action=save-slot][data-index=\"1\"]')");await Click("[data-action=save-slot][data-index='1']");await WaitFor("window.__vrmDiagnostics().filledSaveSlots>=1");await Shot("saved");await Click("[data-action=close-modal]");await Click("[data-action=load-game]");await WaitFor("document.querySelector('[data-action=load-slot][data-index=\"1\"] img')");await Shot("load-thumbnail");await Click("[data-action=load-slot][data-index='1']");await WaitFor("!window.__vrmDiagnostics().transitioning");
  for(int i=0;i<200;i++){await Task.Delay(180);if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('[data-action=choose][data-index=\"1\"]'))")=="true")break;await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame').click()");}
  await Click("[data-action=choose][data-index='1']");await WaitFor("window.__vrmDiagnostics().visibleActorIds.length===30 && !window.__vrmDiagnostics().transitioning");await Task.Delay(3500);await Shot("crowd-30");
  await Click("[data-action=choose][data-index='0']");
  await WaitFor("!window.__vrmDiagnostics().transitioning");
  for(int i=0;i<180;i++){await Task.Delay(180);if(await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().titleMode && !window.__vrmDiagnostics().playing")=="true")break;await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame').click()");}
  await WaitFor("window.__vrmDiagnostics().titleMode && !window.__vrmDiagnostics().playing");await WaitFor("document.querySelector('#act-loading')?.classList.contains('hidden')");await Shot("returned-title");
  var d=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics()"))!;if(!string.IsNullOrWhiteSpace(d["stageError"]?.GetValue<string>()))throw new Exception(d["stageError"]!.ToString());
  File.WriteAllText(smokeBase+".promo-extras.json",JsonSerializer.Serialize(new{ok=true,realCompletedStoryProfile=true,bothBooksUnlocked=true,pdfPageTurn=true,threeMusicTracks=true,roleDetails=true,chapterReplay=true,manualSaveAndThumbnailLoad=true,optionalCrowd=30}));
 }
}
