using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunUi33Smoke(){
  await Task.Delay(2000);
  foreach(string phase in Environment.GetCommandLineArgs().Contains("--smoke-ui33-reopen")?new[]{"reopen"}:new[]{"picker","pop-title","pop-dialogue","pop-settings","terminal-dialogue","terminal-settings","classic","camera-empty","save-export"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__ui33=null;window.__vrmSmokeUi33("+JsonSerializer.Serialize(phase)+").then(r=>window.__ui33=r).catch(e=>window.__ui33={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<6000;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__ui33");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".ui33-"+phase+".json",result);
   using(var shot=File.Create(smokeBase+".ui33-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  editorCloseApproved=true;Close();
 }
}
