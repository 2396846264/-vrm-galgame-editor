using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunSecondary53Smoke(){
  SetFullscreen(true);var args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-secondary-kind");string kind=at>=0?args[at+1]:"vrm";
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.editorProjectSnapshot?.()?.id && window.__vrmSmokeSecondary53)")=="true")break;await Task.Delay(100);}
  foreach(string phase in new[]{"setup-"+kind,"idle","translation","teleport","turn-scale","head-turn","walk"}.Concat(kind.StartsWith("mmd")?new[]{"vmd","full"}:Array.Empty<string>()).Concat(new[]{"collision-off","collision-on","settings"})){
   await web.CoreWebView2.ExecuteScriptAsync("window.__secondaryResult=null;window.__vrmSmokeSecondary53("+JsonSerializer.Serialize(phase)+").then(r=>window.__secondaryResult=r).catch(e=>window.__secondaryResult={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<3600;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__secondaryResult");if(result!="null")break;await Task.Delay(100);}File.WriteAllText(smokeBase+"."+phase+".json",result);
   using(var shot=File.Create(smokeBase+"."+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  }
 }
}
