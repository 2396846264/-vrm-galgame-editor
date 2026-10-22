using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow{
 private async Task RunNaval80Smoke(){
  for(int i=0;i<600;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmokeNaval80&&window.editorProjectSnapshot?.()?.id)")=="true")break;await Task.Delay(100);}
  bool carrier89=Environment.GetCommandLineArgs().Contains("--smoke-carrier89");
  foreach(string phase in carrier89?(playerMode?new[]{"water","export89","battle","carrier89","composition89"}:new[]{"water","battle","carrier89","composition89"}):playerMode?new[]{"water","ocean86","saved-water86","export-fire87","export88","explosion","battle","maneuver","carrier","launch-parked","launch","rim","air-render","custom-fire87","sea88","map88","composition88","carrier89","composition89"}:new[]{"water","ocean86","explosion","battle","maneuver","carrier","launch-parked","launch","rim","editor","air-render","custom-fire87","sea88","map88","composition88","carrier89","composition89"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__naval80Result=null;window.__vrmSmokeNaval80("+JsonSerializer.Serialize(phase)+").then(r=>window.__naval80Result=r).catch(e=>window.__naval80Result={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<1800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__naval80Result");if(result!="null")break;await Task.Delay(100);}
   File.WriteAllText(smokeBase+"."+phase+".json",result);using(var shot=File.Create(smokeBase+"."+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  }
  if(!playerMode&&!carrier89){
   await web.CoreWebView2.ExecuteScriptAsync("window.__vrmFirepower87Open()");for(int i=0;i<300&&!moduleWindows.ContainsKey("firepower");i++)await Task.Delay(50);if(!moduleWindows.ContainsKey("firepower"))throw new Exception("Firepower window missing");
   var gunWindow=moduleWindows["firepower"];string gunResult=await gunWindow.Smoke("return await window.firepowerSmoke();",smokeBase+".firepower87.png");File.WriteAllText(smokeBase+".firepower87.json",gunResult);if(JsonNode.Parse(gunResult)?["ok"]?.GetValue<bool>()!=true)throw new Exception(gunResult);string share=await gunWindow.Smoke("return await window.firepowerSmoke('share88');",smokeBase+".firepower-share88.png");File.WriteAllText(smokeBase+".firepower-share88.json",share);if(JsonNode.Parse(share)?["ok"]?.GetValue<bool>()!=true)throw new Exception(share);gunWindow.CloseWithoutPrompt();
   await web.CoreWebView2.ExecuteScriptAsync("window.__vrmFirepower87Open()");for(int i=0;i<300&&!moduleWindows.ContainsKey("firepower");i++)await Task.Delay(50);gunWindow=moduleWindows["firepower"];gunResult=await gunWindow.Smoke("return await window.firepowerSmoke('reopen');",smokeBase+".firepower-reopen87.png");File.WriteAllText(smokeBase+".firepower-reopen87.json",gunResult);if(JsonNode.Parse(gunResult)?["ok"]?.GetValue<bool>()!=true)throw new Exception(gunResult);gunWindow.CloseWithoutPrompt();
   await web.CoreWebView2.ExecuteScriptAsync("window.__vrmWater86Open()");for(int i=0;i<300&&environmentWindow==null;i++)await Task.Delay(50);
   if(environmentWindow==null)throw new Exception("Water editor did not open");
   string water=await environmentWindow.Water51Smoke("types86",smokeBase+".water-types86.png");File.WriteAllText(smokeBase+".water-types86.json",water);if(JsonNode.Parse(water)?["ok"]?.GetValue<bool>()!=true)throw new Exception(water);environmentWindow.CloseWithoutPrompt();await Task.Delay(250);
   var waterEnv=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorProjectSnapshot()"))?["environments"]?.AsArray().LastOrDefault();if(waterEnv?["nodes"]?.AsArray().Count(n=>n?["kind"]?.GetValue<string>()=="water")!=4)throw new Exception("Water scene not saved to project");
   await web.CoreWebView2.ExecuteScriptAsync("window.__vrmWater86Open(true)");for(int i=0;i<300&&environmentWindow==null;i++)await Task.Delay(50);if(environmentWindow==null)throw new Exception("Water editor did not reopen");
   water=await environmentWindow.Water51Smoke("reopen86",smokeBase+".water-reopen86.png");File.WriteAllText(smokeBase+".water-reopen86.json",water);if(JsonNode.Parse(water)?["ok"]?.GetValue<bool>()!=true)throw new Exception(water);environmentWindow.CloseWithoutPrompt();
   foreach(string module in new[]{"aircraft","warship"}){
    string selector=module=="aircraft"?"[data-action=event-air-open][data-role=aircraft]":"[data-action=event-air-ship-open][data-index=\"0\"]";
    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector("+JsonSerializer.Serialize(selector)+").click()");for(int i=0;i<300&&!moduleWindows.ContainsKey(module);i++)await Task.Delay(50);
    if(!moduleWindows.ContainsKey(module))throw new Exception("Missing editor "+module);var child=moduleWindows[module];
    foreach(var size in new[]{new Size(1050,650),new Size(1500,900)}){await child.SmokeViewport52(size.Width,size.Height);string result=await child.Smoke("return await window.vehicleSmoke('palette52');",smokeBase+"."+module+"-"+size.Width+".png");File.WriteAllText(smokeBase+"."+module+"-"+size.Width+".json",result);if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);}string gunMount=await child.Smoke("return await window.vehicleSmoke('firepower87');",smokeBase+"."+module+"-firepower87.png");File.WriteAllText(smokeBase+"."+module+"-firepower87.json",gunMount);if(JsonNode.Parse(gunMount)?["ok"]?.GetValue<bool>()!=true)throw new Exception(gunMount);if(module=="warship"){foreach(string phase in new[]{"ship88","south88"}){string ship=await child.Smoke("return await window.vehicleSmoke('"+phase+"');",smokeBase+"."+phase+".png");File.WriteAllText(smokeBase+"."+phase+".json",ship);if(JsonNode.Parse(ship)?["ok"]?.GetValue<bool>()!=true)throw new Exception(ship);}string result=await child.Smoke("return await window.vehicleSmoke('carrier83');",smokeBase+".carrier-editor.png");File.WriteAllText(smokeBase+".carrier-editor.json",result);if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);}child.CloseWithoutPrompt();
   }
  }
  if(!playerMode){var snapshot=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorProjectSnapshot()"))!;File.WriteAllText(Path.Combine(projectDirectory!,"project.json"),snapshot.ToJsonString());
   var archive=smokeBase+".vrmg";WriteArchive(projectDirectory!,archive);LoadArchive(archive);if(ReadProject()?["acts"]?[0]?["event"]?["bgmId"]?.GetValue<string>()!="test-bgm")throw new Exception("BGM lost on reopen");
   BuildGame(Path.Combine(Path.GetDirectoryName(smokeBase)!,"exported-game"),ReadProject()!);File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(new{ok=true,reopened=true,exported=true}));
  }
 }
}
