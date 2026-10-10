using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunThumbnail37Smoke(){
  await Task.Delay(2500);string[] args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-mmd-inputs");var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;
  if(!args.Contains("--smoke-thumbnails-reopen")){var imported=new List<object>();foreach(var entry in input["models"]!.AsArray())imported.AddRange(ImportMmdModelFiles([entry!.GetValue<string>()],"mmdCharacter"));await web.CoreWebView2.ExecuteScriptAsync("window.__thumbnail37Imported="+JsonSerializer.Serialize(imported));}
  string[] phases=args.Contains("--smoke-thumbnails-reopen")?["reopen"]:["tiles","folder","mouth","save"];
  foreach(string phase in phases){
   if(phase=="folder"){
    string source=input["models"]![0]!.GetValue<string>(),folder=smokeBase+".avatar-source";CopyDirectory(Path.GetDirectoryName(source)!,folder);
    string thumb=JsonSerializer.Deserialize<string>(await web.CoreWebView2.ExecuteScriptAsync("window.__thumbnail37Path"))!;File.Copy(Path.Combine(projectDirectory!,thumb),Path.Combine(folder,"人物头像.png"));
    var rows=ImportMmdModelFiles([Path.Combine(folder,Path.GetFileName(source))],"mmdCharacter");await web.CoreWebView2.ExecuteScriptAsync("window.__thumbnail37Folder="+JsonSerializer.Serialize(rows));
   }
   await web.CoreWebView2.ExecuteScriptAsync("window.__thumbnail37=null;window.__vrmSmokeThumbnail37("+JsonSerializer.Serialize(phase)+").then(r=>window.__thumbnail37=r).catch(e=>window.__thumbnail37={error:e.message,stack:e.stack})");
   string result="null";for(int i=0;i<3600;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__thumbnail37");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".thumbnail37-"+phase+".json",result);using(var file=File.Create(smokeBase+".thumbnail37-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,file);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
  if(!args.Contains("--smoke-thumbnails-reopen"))WriteArchive(projectDirectory!,smokeBase+".vrmg");editorCloseApproved=true;Close();
 }
}
