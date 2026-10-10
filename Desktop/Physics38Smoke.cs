using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunPhysics38Smoke(){
  await Task.Delay(2000);string[] args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-mmd-inputs");var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;var rows=new List<object>();
  bool reopen=args.Contains("--smoke-physics-reopen");if(!reopen){
  foreach(var file in input["models"]!.AsArray())rows.AddRange(ImportMmdModelFiles([file!.GetValue<string>()],"mmdCharacter"));
  foreach(var entry in input["motions"]!.AsArray()){string source=entry!.GetValue<string>(),id=Guid.NewGuid().ToString("N"),path="assets/motion/"+id+Path.GetExtension(source),target=Path.Combine(projectDirectory!,path);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(source,target);rows.Add(new{id,type="motion",name=Path.GetFileName(source),path});}
  await web.CoreWebView2.ExecuteScriptAsync("window.__mmdImported="+JsonSerializer.Serialize(rows));
  }
  foreach(string phase in reopen?new[]{"reopen"}:new[]{"setup","swing","vmd","reset","performance","dispose"}){
   string function=phase=="setup"?"__vrmSmokeMmd36":"__vrmSmokePhysics38";await web.CoreWebView2.ExecuteScriptAsync("window.__physics38=null;window."+function+"("+JsonSerializer.Serialize(phase)+").then(r=>window.__physics38=r).catch(e=>window.__physics38={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<4800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__physics38");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".physics38-"+phase+".json",result);using(var file=File.Create(smokeBase+".physics38-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,file);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(!reopen){WriteArchive(projectDirectory!,smokeBase+".vrmg");if(smokeFileOpsParent!=null)File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(ExportGame("MMD物理_0.0.39_测试游戏")));}editorCloseApproved=true;Close();
 }
}
