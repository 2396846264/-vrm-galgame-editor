using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow{
 private async Task RunRender42Smoke(){
  await Task.Delay(1400);foreach(string phase in new[]{"audit-vrm","audit-mmdCharacter","audit-fbxCharacter","ui-pop","ui-terminal","ui-classic","ui-astral","dependencies"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__render42=null;window.__vrmSmokeRender42("+JsonSerializer.Serialize(phase)+").then(r=>window.__render42=r).catch(e=>window.__render42={error:e.message,stack:e.stack})");string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__render42");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".render42-"+phase+".json",result);using(var stream=File.Create(smokeBase+".render42-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);if(!result.Contains("\"ok\":true"))throw new Exception(result);if(phase.StartsWith("audit-")){var shots=JsonSerializer.Deserialize<Dictionary<string,string>>(await web.CoreWebView2.ExecuteScriptAsync("window.__render42Shots"));foreach(var pair in shots!)File.WriteAllBytes(smokeBase+".render42-"+phase+"-"+pair.Key+".png",Convert.FromBase64String(pair.Value[(pair.Value.IndexOf(',')+1)..]));}
  }editorCloseApproved=true;Close();
 }
}
