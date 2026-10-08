using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunCopy30Smoke(){
  await Task.Delay(1500);
  await web.CoreWebView2.ExecuteScriptAsync("window.__copy30=null;window.__vrmSmokeCopy30().then(r=>window.__copy30=r).catch(e=>window.__copy30={error:e.message})");
  string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__copy30");if(result!="null")break;await Task.Delay(50);}
  File.WriteAllText(smokeBase+".copy30.json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  using(var shot=File.Create(smokeBase+".copy30.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
  var before=ReadProject()!.ToJsonString();WriteArchive(projectDirectory!,smokeBase+".vrmg");LoadArchive(smokeBase+".vrmg");if(ReadProject()!.ToJsonString()!=before)throw new Exception("复制内容未随工程包保存");
  bool disabled=false;try{await ExportAndroidAsync(null);}catch(NotSupportedException){disabled=true;}
  if(!disabled||AndroidBuilder.ExportEnabled)throw new Exception("安卓导出仍可用");
  File.WriteAllText(smokeBase+".copy30-native.json",JsonSerializer.Serialize(new{ok=true,archiveReopened=true,androidExportBlocked=true}));
 }
}
