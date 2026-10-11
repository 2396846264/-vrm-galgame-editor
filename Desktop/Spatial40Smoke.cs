using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow{
 private async Task RunSpatial40Smoke(){
  await Task.Delay(1500);string[] args=Environment.GetCommandLineArgs();bool reopen=args.Contains("--smoke-spatial-reopen"),user=args.Contains("--smoke-spatial-user");
  if(!reopen&&!user){int at=Array.IndexOf(args,"--smoke-mmd-inputs");var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;var rows=new List<object>();foreach(var file in input["models"]!.AsArray())rows.AddRange(ImportMmdModelFiles([file!.GetValue<string>()],"mmdCharacter"));foreach(var entry in input["motions"]!.AsArray()){string source=entry!.GetValue<string>(),id=Guid.NewGuid().ToString("N"),path="assets/motion/"+id+Path.GetExtension(source),target=Path.Combine(projectDirectory!,path);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(source,target);rows.Add(new{id,type="motion",name=Path.GetFileName(source),path});}await web.CoreWebView2.ExecuteScriptAsync("window.__mmdImported="+JsonSerializer.Serialize(rows));}
  foreach(string phase in user?new[]{"user-gpu"}:reopen?new[]{"reopen"}:new[]{"setup","dof-off","dof-on","pointer-dialogue","pointer-title","ui","save"}){
   string function=phase=="setup"?"__vrmSmokeMmd36":"__vrmSmokeSpatial40";await web.CoreWebView2.ExecuteScriptAsync("window.__spatial40=null;window."+function+"("+JsonSerializer.Serialize(phase)+").then(r=>window.__spatial40=r).catch(e=>window.__spatial40={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<4800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__spatial40");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".spatial40-"+phase+".json",result);using(var stream=File.Create(smokeBase+".spatial40-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(!reopen&&!user){WriteArchive(projectDirectory!,smokeBase+".vrmg");if(smokeFileOpsParent!=null)File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(ExportGame("空间镜头_0.0.40_测试游戏")));}editorCloseApproved=true;Close();
 }
}
