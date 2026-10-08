using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunLoad31Smoke(){
  await Task.Delay(1500);
  await web.CoreWebView2.ExecuteScriptAsync("window.__catalog31=null;window.__vrmSmokeOrganize31().then(r=>window.__catalog31=r).catch(e=>window.__catalog31={error:e.message,stack:e.stack})");
  string catalog="null";for(int i=0;i<4800;i++){catalog=await web.CoreWebView2.ExecuteScriptAsync("window.__catalog31");if(catalog!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".catalog31.json",catalog);if(!catalog.Contains("\"ok\":true"))throw new Exception(catalog);
  using(var catalogShot=File.Create(smokeBase+".catalog31.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,catalogShot);
  await web.CoreWebView2.ExecuteScriptAsync("window.__load31=null;window.__vrmSmokeLoad31().then(r=>window.__load31=r).catch(e=>window.__load31={error:e.message,stack:e.stack})");
  string result="null";for(int i=0;i<4800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__load31");if(result!="null")break;await Task.Delay(50);}
  File.WriteAllText(smokeBase+".load31.json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  using(var shot=File.Create(smokeBase+".formation.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
  await web.CoreWebView2.ExecuteScriptAsync("window.__load31Saved=null;window.__vrmSmokeSave31().then(r=>window.__load31Saved=r).catch(e=>window.__load31Saved={error:e.message})");
  string saved="null";for(int i=0;i<2400;i++){saved=await web.CoreWebView2.ExecuteScriptAsync("window.__load31Saved");if(saved!="null")break;await Task.Delay(50);}
  File.WriteAllText(smokeBase+".save31.json",saved);if(!saved.Contains("\"ok\":true"))throw new Exception(saved);
  var before=ReadProject()!.ToJsonString();WriteArchive(projectDirectory!,smokeBase+".vrmg");LoadArchive(smokeBase+".vrmg");if(ReadProject()!.ToJsonString()!=before)throw new Exception("30 人队列未随工程保存");
  File.WriteAllText(smokeBase+".archive31.json",JsonSerializer.Serialize(new{ok=true,archiveReopened=true,thirtySlotsSaved=true}));editorCloseApproved=true;Close();
 }
}
