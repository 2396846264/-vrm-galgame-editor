using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task RunReference59Smoke(){
  await CommercialWait("Boolean(window.__vrmSmokeReference59&&window.editorProjectSnapshot?.())");
  ClientSize=new System.Drawing.Size(1676,940);
  int manifestIndex=Array.IndexOf(Environment.GetCommandLineArgs(),"--smoke-import-manifest");
  if(manifestIndex>=0){
   string manifest=Environment.GetCommandLineArgs()[manifestIndex+1];
   var imported=ImportAgentAssets44(JsonNode.Parse(File.ReadAllText(manifest)));
   await web.CoreWebView2.ExecuteScriptAsync("window.__reference59=null;"+(Environment.GetCommandLineArgs().Contains("--smoke-air68")?"window.__vrmSmokeAir68Import(":Environment.GetCommandLineArgs().Contains("--smoke-air67")?"window.__vrmSmokeAir67Import(":"window.__vrmSmokeReference59Import(")+JsonSerializer.Serialize(imported)+").then(r=>window.__reference59=r).catch(e=>window.__reference59={ok:false,error:e.message})");
   await CommercialWait("window.__reference59!==null");
   string importResult=await web.CoreWebView2.ExecuteScriptAsync("window.__reference59");
   File.WriteAllText(smokeBase+".imported.json",importResult);
   if(JsonNode.Parse(importResult)?["ok"]?.GetValue<bool>()!=true)throw new Exception(importResult);
  }
  if(Environment.GetCommandLineArgs().Contains("--smoke-reference59-mcp")){
   var connection=SetAgentEnabled(true);
   File.WriteAllText(smokeBase+".mcp-ready.json",JsonSerializer.Serialize(connection));
   for(int i=0;i<3000&&!File.Exists(smokeBase+".imports-ready");i++)await Task.Delay(100);
   if(!File.Exists(smokeBase+".imports-ready"))throw new Exception("Waiting for explicit model import test setup timed out");
  }
  bool skinSmoke=Environment.GetCommandLineArgs().Contains("--smoke-skin63");
  bool chatSmoke=Environment.GetCommandLineArgs().Contains("--smoke-skin64");
  bool introSmoke=Environment.GetCommandLineArgs().Contains("--smoke-intro66");
  bool air67=Environment.GetCommandLineArgs().Contains("--smoke-air67");
  bool air68=Environment.GetCommandLineArgs().Contains("--smoke-air68");
  bool naval70=Environment.GetCommandLineArgs().Contains("--smoke-naval70");
  bool air69=Environment.GetCommandLineArgs().Contains("--smoke-air69");
  var phases=naval70?(playerMode?new[]{"naval70:setup","naval70:offstage","naval70:hold","naval70:handoff","naval70:naval-runtime","naval70:checkpoint","diagnostics"}:Environment.GetCommandLineArgs().Contains("--smoke-reference59-reopen")?new[]{"naval70:fleet-layout","naval70:offstage","naval70:hold","naval70:handoff","naval70:naval-runtime","naval70:checkpoint","diagnostics"}:new[]{"naval70:setup","naval70:fleet-layout","naval70:offstage","naval70:hold","naval70:handoff","naval70:naval-runtime","naval70:checkpoint","diagnostics"}):air69?new[]{"air69:setup","air69:offstage","air69:hold","air69:handoff","air69:tracers","air69:range","air69:checkpoint","diagnostics"}:air68?(playerMode?new[]{"air68:setup","air68:offstage","air68:hold","air68:handoff","air68:tracers","air68:range","air68:checkpoint","diagnostics"}:new[]{"air68:setup","air68:layout","air68:offstage","air68:hold","air68:handoff","air68:tracers","air68:range","air68:checkpoint","diagnostics"}):air67?(playerMode?new[]{"air67:setup","air67:offstage","air67:hold","air67:handoff","air67:checkpoint","diagnostics"}:new[]{"air67:setup","air67:preview","air67:offstage","air67:hold","air67:handoff","air67:checkpoint","diagnostics"}):introSmoke?new[]{"intro:hold-classic","intro:finish","intro:hold-pink-pop","intro:finish","intro:hold-wechat-green","intro:finish","intro:hold-wechat-dark","intro:finish","intro:sequence","diagnostics"}:chatSmoke?(Environment.GetCommandLineArgs().Contains("--smoke-reference59-reopen")?new[]{"chat:reopen","title","story","name2","chat:dark-runtime","chat:dark-settings","close","chat:light-runtime","chat:light-settings","close","diagnostics"}:new[]{"chat:editor","chat:green","chat:preview","chat:save","title","story","name0","name1","name2","chat:light-settings","close","library","close","chat:dark-runtime","chat:dark-settings","close","chat:light-runtime","diagnostics"}):skinSmoke?(Environment.GetCommandLineArgs().Contains("--smoke-reference59-reopen")?new[]{"skin:reopen","title","story","name2","settings","close","skin:classic-runtime","skin:pink-runtime","diagnostics"}:new[]{"skin:editor","skin:pink","skin:preview","skin:save","title","story","name0","name1","name2","settings","close","library","close","skin:classic-runtime","skin:pink-runtime","diagnostics"}):Environment.GetCommandLineArgs().Contains("--smoke-reference59-reopen")?new[]{"reopen","title","story","name0","name1","name2","diagnostics"}:new[]{"prepare","editor","title","story","name0","name1","name2","settings","close","saves","close","library","close","inventory","close","progress","close","diagnostics"};
  if(Environment.GetCommandLineArgs().Contains("--smoke-naval71-runtime"))phases=new[]{"naval70:combat71","naval70:naval-runtime","diagnostics"};
  foreach(string phase in phases){
   await web.CoreWebView2.ExecuteScriptAsync("window.__reference59=null;"+(phase.StartsWith("naval70:")?"window.__vrmSmokeNaval70(":phase.StartsWith("air69:")?"window.__vrmSmokeAir69(":phase.StartsWith("air68:")?"window.__vrmSmokeAir68(":phase.StartsWith("air67:")?"window.__vrmSmokeAir67(":phase.StartsWith("intro:")?"window.__vrmSmokeIntro66(":phase.StartsWith("chat:")?"window.__vrmSmokeSkin64(":phase.StartsWith("skin:")?"window.__vrmSmokeSkin63(":"window.__vrmSmokeReference59(")+JsonSerializer.Serialize(phase.Replace("skin:","").Replace("chat:","").Replace("intro:","").Replace("air67:","").Replace("air68:","").Replace("air69:","").Replace("naval70:",""))+").then(r=>window.__reference59=r).catch(e=>window.__reference59={ok:false,error:e.message,stack:e.stack})");
   await CommercialWait("window.__reference59!==null");
   string result=await web.CoreWebView2.ExecuteScriptAsync("window.__reference59");
   File.WriteAllText(smokeBase+"."+phase.Replace(":","-")+".json",result);
   if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
   if(phase is not "prepare" and not "close" and not "reopen" and not "diagnostics"){
    await Task.Delay(phase.StartsWith("intro:hold-")?60:450);
    using(var image=File.Create(smokeBase+"."+phase.Replace(":","-")+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
   }
   if(naval70&&phase=="naval70:setup"&&!playerMode){
    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=event-air-open][data-role=aircraft]').click()");for(int i=0;i<300&&!moduleWindows.ContainsKey("aircraft");i++)await Task.Delay(50);
    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=event-air-ship-open][data-index=\"0\"]').click()");for(int i=0;i<300&&!moduleWindows.ContainsKey("warship");i++)await Task.Delay(50);
    if(!moduleWindows.ContainsKey("aircraft")||!moduleWindows.ContainsKey("warship"))throw new Exception("Independent vehicle windows missing");
    var shipWindow=moduleWindows["warship"];foreach(string part in new[]{"naval70-preview","naval70-files"}){string result70=await shipWindow.Smoke("return await window.vehicleSmoke('"+part+"');",smokeBase+"."+part+".png");File.WriteAllText(smokeBase+"."+part+".json",result70);if(!result70.Contains("\"ok\":true"))throw new Exception(result70);}shipWindow.CloseWithoutPrompt();
    var planeWindow=moduleWindows["aircraft"];string planeResult=await planeWindow.Smoke("return await window.vehicleSmoke('combat69');",smokeBase+".plane-regression.png");File.WriteAllText(smokeBase+".plane-regression.json",planeResult);if(!planeResult.Contains("\"ok\":true"))throw new Exception(planeResult);planeWindow.CloseWithoutPrompt();
   }
   if(air69&&phase=="air69:setup"&&!playerMode){await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=event-air-open][data-role=aircraft]').click()");for(int i=0;i<300&&!moduleWindows.ContainsKey("aircraft");i++)await Task.Delay(50);var child=moduleWindows["aircraft"];foreach(string part in new[]{"files69","combat69"}){string test=await child.Smoke("return await window.vehicleSmoke('"+part+"');",smokeBase+"."+part+".png");File.WriteAllText(smokeBase+"."+part+".json",test);if(!test.Contains("\"ok\":true"))throw new Exception(test);}child.CloseWithoutPrompt();}
   if(air67&&phase=="air67:setup"&&!playerMode){await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=event-air-open][data-role=aircraft]').click()");for(int i=0;i<300&&!moduleWindows.ContainsKey("aircraft");i++)await Task.Delay(50);var child=moduleWindows["aircraft"];string test=await child.Smoke("return await window.vehicleSmoke('camera67');",smokeBase+".builder.png");File.WriteAllText(smokeBase+".builder.json",test);if(!test.Contains("\"ok\":true"))throw new Exception(test);child.CloseWithoutPrompt();}
  }
  if(Environment.GetCommandLineArgs().Contains("--smoke-reference59-export"))
   File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(ExportGame("UI59-真实角色游戏")));
 }
}
