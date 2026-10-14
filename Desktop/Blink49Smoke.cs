using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunBlink49Smoke(){
  bool ready=false;for(int i=0;i<600;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmokeBlink49&&window.editorCloseState?.().hasProject)")=="true"){ready=true;break;}await Task.Delay(100);}if(!ready)throw new Exception("工程初始化没有完成");
  string[] args=Environment.GetCommandLineArgs();bool reopen=args.Contains("--smoke-blink-reopen");
  if(!playerMode&&!reopen){
   int at=Array.IndexOf(args,"--smoke-blink-inputs");var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;var assets=new List<object>();
   foreach(var entry in input["mmd"]!.AsArray())assets.AddRange(ImportMmdModelFiles([entry!.GetValue<string>()],"mmdCharacter"));
   foreach(var entry in input["vrm"]!.AsArray()){
    string source=entry!.GetValue<string>(),id=Guid.NewGuid().ToString("N"),path="assets/vrm/"+id+".vrm",target=Path.Combine(projectDirectory!,path);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(source,target);assets.Add(new{id,type="vrm",name=Path.GetFileNameWithoutExtension(source),path});
   }
   string motion=input["vmd"]!.GetValue<string>(),mid=Guid.NewGuid().ToString("N"),mp="assets/motion/"+mid+".vmd",mt=Path.Combine(projectDirectory!,mp);Directory.CreateDirectory(Path.GetDirectoryName(mt)!);File.Copy(motion,mt);assets.Add(new{id=mid,type="motion",name=Path.GetFileName(motion),path=mp});
   await web.CoreWebView2.ExecuteScriptAsync("window.__blinkImported="+JsonSerializer.Serialize(assets));
  }
  string[] phases=playerMode?["player","natural"]:reopen?["reopen"]:["setup","natural","closed","vmd","save"];
  foreach(string phase in phases){
   await web.CoreWebView2.ExecuteScriptAsync("window.__blinkResult=null;window.__vrmSmokeBlink49("+JsonSerializer.Serialize(phase)+").then(r=>window.__blinkResult=r).catch(e=>window.__blinkResult={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<2400;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__blinkResult");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".blink-"+phase+".json",result);using(var shot=File.Create(smokeBase+".blink-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(!playerMode&&!reopen){WriteArchive(projectDirectory!,smokeBase+".vrmg");File.WriteAllText(smokeBase+".export.json",JsonSerializer.Serialize(ExportGame("自动眨眼验证_0.0.49")));}
  editorCloseApproved=true;Close();
 }
}
