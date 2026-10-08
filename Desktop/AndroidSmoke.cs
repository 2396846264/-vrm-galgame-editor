using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunResidency29Smoke(){await Task.Delay(1500);await web.CoreWebView2.ExecuteScriptAsync("window.__resident29=null;window.__vrmSmokeResidency29().then(r=>window.__resident29=r).catch(e=>window.__resident29={error:e.message})");string result="null";for(int i=0;i<1200;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__resident29");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".resident29.json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);}
 private async Task RunAndroidRepairExportSmoke(){
  var snapshot=ReadProject()??throw new Exception("工程无法读取");var settings=snapshot["authoring"]?["androidExport"];string icon=settings?["iconDataUrl"]?.GetValue<string>()??"data:image/png;base64,"+Convert.ToBase64String(File.ReadAllBytes(Path.Combine(appDirectory,"test-icon.png")));
  var options=new AndroidBuilder.Options(settings?["appName"]?.GetValue<string>()??snapshot["name"]?.GetValue<string>()??"我的 VRM 故事",settings?["versionName"]?.GetValue<string>()??"1.0.0",icon);
  var result=await AndroidBuilder.Build(appDirectory,projectDirectory!,snapshot,smokeBase+".apk",new Progress<AndroidBuilder.Progress>(p=>File.WriteAllText(smokeBase+".progress.txt",p.Percent+"% "+p.Message)),options);File.WriteAllText(smokeBase+".apk-export.json",JsonSerializer.Serialize(result));
 }
 private async Task RunControls29Smoke(){await Task.Delay(1500);await web.CoreWebView2.ExecuteScriptAsync("window.__controls29=null;window.__vrmSmokeControls29().then(r=>window.__controls29=r).catch(e=>window.__controls29={error:e.message})");string result="null";for(int i=0;i<1200;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__controls29");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".controls29.json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);}
 private async Task RunCutsceneSmoke(){
  await Task.Delay(1500);await web.CoreWebView2.ExecuteScriptAsync("window.__cutsceneCheck=null;window.__vrmSmokeCutscene().then(r=>window.__cutsceneCheck=r).catch(e=>window.__cutsceneCheck={error:e.message})");string result="null";for(int i=0;i<1200;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__cutsceneCheck");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".cutscene.json",result);using(var shot=File.Create(smokeBase+".cutscene.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
 private async Task RunVrmPortrait28Smoke(){
  await Task.Delay(1500);await web.CoreWebView2.ExecuteScriptAsync("window.__portrait28=null;window.__vrmSmokeVrmPortrait28().then(r=>window.__portrait28=r).catch(e=>window.__portrait28={error:e.message})");string result="null";for(int i=0;i<1200;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__portrait28");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".portrait28.json",result);using(var shot=File.Create(smokeBase+".portrait28.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
 private async Task RunBlankProjectSmoke(){
  await Task.Delay(1000);await web.CoreWebView2.ExecuteScriptAsync("window.__blankCheck=null;window.__vrmSmokeBlankWithoutMotion().then(r=>window.__blankCheck=r).catch(e=>window.__blankCheck={error:e.message})");
  string result="null";for(int i=0;i<1200;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__blankCheck");if(result!="null")break;await Task.Delay(50);}File.WriteAllText(smokeBase+".blank-project.json",result);if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
 private async Task RunAndroidUISmoke(){
  await Task.Delay(1500);
  await web.CoreWebView2.ExecuteScriptAsync("window.__androidUICheck=null;window.__vrmSmokeAndroidUI().then(r=>window.__androidUICheck=r).catch(e=>window.__androidUICheck={error:e.message})");
  string result="null";for(int i=0;i<800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__androidUICheck");if(result!="null")break;await Task.Delay(50);}
  File.WriteAllText(smokeBase+".android-ui.json",result);
  using(var shot=File.Create(smokeBase+".android-ui.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
  if(!result.Contains("\"ok\":true"))throw new Exception(result);
 }
}
