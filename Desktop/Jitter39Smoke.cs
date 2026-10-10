using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunJitter39Smoke(){
  await Task.Delay(1500);string[] args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-mmd-inputs");var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;var rows=new List<object>();
  foreach(var entry in input["models"]!.AsArray())rows.AddRange(ImportMmdModelFiles([entry!.GetValue<string>()],"mmdCharacter"));
  foreach(var entry in input["motions"]!.AsArray()){string source=entry!.GetValue<string>(),id=Guid.NewGuid().ToString("N"),path="assets/motion/"+id+Path.GetExtension(source),target=Path.Combine(projectDirectory!,path);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(source,target);rows.Add(new{id,type="motion",name=Path.GetFileName(source),path});}
  await web.CoreWebView2.ExecuteScriptAsync("window.__mmdImported="+JsonSerializer.Serialize(rows));
  int phasesAt=Array.IndexOf(args,"--smoke-jitter-phases");var phases=new[]{"setup"}.Concat((phasesAt>=0?args[phasesAt+1]:"baseline,settled,baseline-idle,idle").Split(','));
  foreach(string phase in phases){
   string function=phase=="setup"?"__vrmSmokeMmd36":"__vrmSmokeJitter39";await web.CoreWebView2.ExecuteScriptAsync("window.__jitter39=null;window."+function+"("+JsonSerializer.Serialize(phase)+").then(r=>window.__jitter39=r).catch(e=>window.__jitter39={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<4800;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__jitter39");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".jitter39-"+phase+".json",result);using(var file=File.Create(smokeBase+".jitter39-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,file);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  editorCloseApproved=true;Close();
 }
}
