using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunUi34Smoke(){
  await Task.Delay(2000);
  foreach(string phase in Environment.GetCommandLineArgs().Contains("--smoke-ui34-reopen")?new[]{"reopen"}:new[]{"picker","title","portrait-turn","dialogue","settings","save","gallery","progress","export"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__ui34=null;window.__vrmSmokeUi34("+JsonSerializer.Serialize(phase)+").then(r=>window.__ui34=r).catch(e=>window.__ui34={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<6000;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__ui34");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".ui34-"+phase+".json",result);
   using(var shot=File.Create(smokeBase+".ui34-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
   if(phase=="save"){
    string? data=JsonSerializer.Deserialize<string>(await web.CoreWebView2.ExecuteScriptAsync("window.__ui34Thumbnail"));
    if(data!=null)File.WriteAllBytes(smokeBase+".save-thumbnail.jpg",Convert.FromBase64String(data.Split(',')[1]));
   }
  }
  editorCloseApproved=true;Close();
 }
}
