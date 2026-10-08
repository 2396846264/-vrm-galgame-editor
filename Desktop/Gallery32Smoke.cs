using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunGallery32Smoke(){
  await Task.Delay(2000);await web.CoreWebView2.ExecuteScriptAsync("window.__gallery32=null;window.__vrmSmokeGallery32().then(r=>window.__gallery32=r).catch(e=>window.__gallery32={error:e.message,stack:e.stack})");
  string result="null";for(int i=0;i<6000;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__gallery32");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".gallery32.json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  using(var shot=File.Create(smokeBase+".gallery32.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);editorCloseApproved=true;Close();
 }
}
