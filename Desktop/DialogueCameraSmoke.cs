using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task RunDialogueCameraSmoke(){
  foreach(var phase in playerMode?new[]{"player"}:new[]{"editor","export"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__cameraCheck=null;window.__vrmSmokeDialogueCamera("+JsonSerializer.Serialize(phase)+").then(r=>window.__cameraCheck=r).catch(error=>window.__cameraCheck={error:error.message})");
   string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__cameraCheck");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".camera-"+phase+".json",result);using(var shot=File.Create(smokeBase+".camera-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
 }
}
