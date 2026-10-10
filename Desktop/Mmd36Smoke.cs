using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunMmd36Smoke(){
  await Task.Delay(1800);
  string[] args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-mmd-inputs");
  var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;var assets=new List<object>();
  if(!args.Contains("--smoke-mmd-reopen")){
  foreach(var entry in input["models"]!.AsArray())assets.AddRange(ImportMmdModelFiles([entry!.GetValue<string>()],"mmdCharacter"));
  foreach(var entry in input["weapons"]!.AsArray())assets.AddRange(ImportMmdModelFiles([entry!.GetValue<string>()],"sceneModel"));
  foreach(var entry in input["motions"]!.AsArray()){
   string source=entry!.GetValue<string>(),id=Guid.NewGuid().ToString("N"),path="assets/motion/"+id+Path.GetExtension(source);string target=Path.Combine(projectDirectory!,path);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(source,target);assets.Add(new{id,type="motion",name=Path.GetFileName(source),path});
  }
  await web.CoreWebView2.ExecuteScriptAsync("window.__mmdImported="+JsonSerializer.Serialize(assets));
  }
  string[] phases=args.Contains("--smoke-mmd-reopen")?["reopen"]:["setup","mixamo","expressions","portrait","vmd","weapons","performance","details","save"];
  foreach(string phase in phases){
   await web.CoreWebView2.ExecuteScriptAsync("window.__mmd36=null;window.__vrmSmokeMmd36("+JsonSerializer.Serialize(phase)+").then(r=>window.__mmd36=r).catch(e=>window.__mmd36={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<3600;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__mmd36");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".mmd36-"+phase+".json",result);
   using(var shot=File.Create(smokeBase+".mmd36-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(!args.Contains("--smoke-mmd-reopen")){
   WriteArchive(projectDirectory!,smokeBase+".vrmg");
   if(smokeFileOpsParent!=null)File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(ExportGame("MMD36本地导出验证游戏")));
  }
  editorCloseApproved=true;Close();
 }
}
