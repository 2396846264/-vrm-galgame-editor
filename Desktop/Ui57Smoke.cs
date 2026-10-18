using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task Ui57Phase(string phase){
  await web.CoreWebView2.ExecuteScriptAsync("window.__ui57Result=null;window.__vrmSmokeUi57("+JsonSerializer.Serialize(phase)+").then(r=>window.__ui57Result=r).catch(e=>window.__ui57Result={error:e.message,stack:e.stack})");
  await CommercialWait("window.__ui57Result!==null");
  string result=await web.CoreWebView2.ExecuteScriptAsync("window.__ui57Result");File.WriteAllText(smokeBase+"."+phase+".json",result);
  if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  using var shot=File.Create(smokeBase+"."+phase+".png");await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
 }
 private async Task RunUi57Smoke(){
  WindowState=FormWindowState.Maximized;
  if(Environment.GetCommandLineArgs().Contains("--smoke-ui57-reopen")){await Ui57Phase("reopen");return;}
  await CommercialWait("Boolean(document.querySelector('.welcome [data-action=new-project]'))");
  await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#new-name').value='UI57';document.querySelector('[data-action=new-project]').click()");
  await CommercialWait("Boolean(window.editorProjectSnapshot?.()?.name==='UI57'&&document.querySelector('.editor')&&!window.__vrmDiagnostics().dirty)");
  await Ui57Phase("prepare");await Ui57Phase("concurrent");
  var child=moduleWindows["ui"];
  string result=await child.Smoke("return await window.__vrmSmokeUi57('module')",smokeBase+".module.png");
  File.WriteAllText(smokeBase+".module.json",result);if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  await Ui57Phase("verify");await SaveProjectAsync(ReadProject(),null);BuildGame(smokeBase+".export",ReadProject()!);
  child.CloseWithoutPrompt();
  foreach(string id in new[]{"tactical","ark","heian","noir"}){await Ui57Phase("theme-"+id);await Ui57Phase("story");}
  await Ui57Phase("editor-shot");
 }
}
