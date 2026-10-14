using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunGaze50Smoke(){
  bool ready=false;for(int i=0;i<600;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmokeGaze50&&window.editorCloseState?.().hasProject)")=="true"){ready=true;break;}await Task.Delay(100);}if(!ready)throw new Exception("工程初始化没有完成");
  bool reopen=Environment.GetCommandLineArgs().Contains("--smoke-gaze-reopen");string[] phases=playerMode||reopen?["models","scene","natural"]:["models","scene","natural","vmd","save"];
  foreach(string phase in phases){
   await web.CoreWebView2.ExecuteScriptAsync("window.__gazeResult=null;window.__vrmSmokeGaze50("+JsonSerializer.Serialize(phase)+").then(r=>window.__gazeResult=r).catch(e=>window.__gazeResult={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<3000;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__gazeResult");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".gaze-"+phase+".json",result);using(var shot=File.Create(smokeBase+".gaze-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(!playerMode&&!reopen){WriteArchive(projectDirectory!,smokeBase+".vrmg");File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(ExportGame("自然视线验证_0.0.50")));}
  editorCloseApproved=true;Close();
 }
}
