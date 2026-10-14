using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunAirCombatSmoke(){
  bool ready=false;for(int i=0;i<600;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmokeAirCombat&&window.editorCloseState?.().hasProject)")=="true"){ready=true;break;}await Task.Delay(100);}if(!ready)throw new Exception("工程初始化没有完成");await Task.Delay(500);
  async Task Phase(string phase){
   await web.CoreWebView2.ExecuteScriptAsync("window.__airCheck=null;window.__vrmSmokeAirCombat("+JsonSerializer.Serialize(phase)+").then(r=>window.__airCheck=r).catch(e=>window.__airCheck={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<1200;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__airCheck");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".air-"+phase+".json",result);using(var shot=File.Create(smokeBase+".air-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(playerMode){foreach(string phase in new[]{"player-start","player-menu","player-save"})await Phase(phase);editorCloseApproved=true;Close();return;}
  await Phase("setup");
  await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=event-air-open][data-role=aircraft]').click()");
  for(int i=0;i<300&&!moduleWindows.ContainsKey("aircraft");i++)await Task.Delay(50);
  var child=moduleWindows["aircraft"];
  foreach(string phase in new[]{"files","build","shapes","gear","preview","weapons","ground","combat"}){string result=await child.Smoke("return await window.vehicleSmoke("+JsonSerializer.Serialize(phase)+");",smokeBase+".assembly-"+phase+".png");File.WriteAllText(smokeBase+".assembly-"+phase+".json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);}
  child.CloseWithoutPrompt();
  foreach(string phase in new[]{"verify-separate","flight","pause","checkpoint","endings","export"})await Phase(phase);
  WriteArchive(projectDirectory!,smokeBase+".vrmg");editorCloseApproved=true;Close();
 }
}
