using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunPortrait35Smoke(){
  await Task.Delay(2000);
  foreach(string phase in new[]{"setup","nod","tilt","body-turn","animation"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__portrait35=null;window.__vrmSmokePortrait35("+JsonSerializer.Serialize(phase)+").then(r=>window.__portrait35=r).catch(e=>window.__portrait35={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<4800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__portrait35");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".portrait35-"+phase+".json",result);
   using(var shot=File.Create(smokeBase+".portrait35-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  editorCloseApproved=true;Close();
 }
}
