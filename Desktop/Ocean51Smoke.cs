using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunOcean51Smoke(){
  for(int i=0;i<600;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmoke51&&window.editorCloseState?.().hasProject)")=="true")break;await Task.Delay(100);}
  async Task Phase(string phase){
   await web.CoreWebView2.ExecuteScriptAsync("window.__oceanCheck=null;window.__vrmSmoke51("+JsonSerializer.Serialize(phase)+").then(r=>window.__oceanCheck=r).catch(e=>window.__oceanCheck={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<1600;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__oceanCheck");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".ocean-"+phase+".json",result);using(var shot=File.Create(smokeBase+".ocean-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  await Phase("setup");await Phase("picker-light");await Phase("picker-dark");await Phase("environment-open");
  for(int i=0;i<300&&environmentWindow==null;i++)await Task.Delay(50);
  if(environmentWindow==null)throw new Exception("场景编辑器没有打开");
  string water=await environmentWindow.Water51Smoke("create",smokeBase+".water-create.png");File.WriteAllText(smokeBase+".water-create.json",water);if(!water.Contains("\"ok\":true"))throw new Exception(water);environmentWindow.CloseWithoutPrompt();await Task.Delay(200);
  await Phase("environment-verify");await Phase("environment-open");for(int i=0;i<300&&environmentWindow==null;i++)await Task.Delay(50);
  water=await environmentWindow!.Water51Smoke("reopen",smokeBase+".water-reopen.png");File.WriteAllText(smokeBase+".water-reopen.json",water);if(!water.Contains("\"ok\":true"))throw new Exception(water);environmentWindow.CloseWithoutPrompt();
  await Phase("vehicle-open");for(int i=0;i<300&&!moduleWindows.ContainsKey("aircraft");i++)await Task.Delay(50);
  var child=moduleWindows["aircraft"];foreach(string phase in new[]{"preview","flight51","ground"}){string r=await child.Smoke("return await window.vehicleSmoke("+JsonSerializer.Serialize(phase)+");",smokeBase+".vehicle-"+phase+".png");File.WriteAllText(smokeBase+".vehicle-"+phase+".json",r);if(!r.Contains("\"ok\":true"))throw new Exception(r);}child.CloseWithoutPrompt();
  await Phase("export");WriteArchive(projectDirectory!,smokeBase+".vrmg");editorCloseApproved=true;Close();
 }
}
