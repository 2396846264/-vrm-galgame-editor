using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow{
 private object ImportAgentAssets44(JsonNode? payload){
  if(projectDirectory==null)throw new Exception("请先打开工程。");var paths=payload?["paths"]?.AsArray().Select(p=>Path.GetFullPath(p!.GetValue<string>())).ToArray()??[];if(paths.Length is <1 or >500)throw new Exception("一次导入 1 至 500 个文件。");
  string requested=payload?["type"]?.GetValue<string>()??"auto",audioKind=payload?["audioKind"]?.GetValue<string>()??"music";var auto=new Dictionary<string,string>{[".vrm"]="vrm",[".vrma"]="motion",[".vmd"]="motion",[".pmx"]="mmdCharacter",[".pmd"]="mmdCharacter",[".fbx"]="fbxCharacter",[".glb"]="sceneModel",[".png"]="image",[".jpg"]="image",[".jpeg"]="image",[".webp"]="image",[".mp3"]="audio",[".wav"]="audio",[".ogg"]="audio",[".mp4"]="video",[".webm"]="video",[".pdf"]="pdf"};
  if(requested!="auto"&&!new[]{"vrm","fbxCharacter","mmdCharacter","sceneModel","motion","image","music","effect","pdf","video"}.Contains(requested))throw new Exception("素材类型无效。");if(audioKind is not ("music" or "effect"))throw new Exception("声音分类无效。");
  foreach(string path in paths){var file=new FileInfo(path);if(!file.Exists||file.Length>2L*1024*1024*1024||!auto.ContainsKey(file.Extension.ToLowerInvariant()))throw new Exception("文件不存在、不支持或超过 2 GB："+file.Name);if(file.Extension.Equals(".glb",StringComparison.OrdinalIgnoreCase))ValidateStandaloneGlb(path);}
  var result=new List<object>();foreach(string path in paths){string type=requested=="auto"?auto[Path.GetExtension(path).ToLowerInvariant()]:requested;
   if(requested=="auto"&&type=="fbxCharacter"){var bytes=File.ReadAllBytes(path);var data=System.Text.Encoding.UTF8.GetString(bytes);if(!data.Contains("Geometry",StringComparison.Ordinal)||!data.Contains("Mesh",StringComparison.Ordinal))type="motion";}
   string category=type is "music" or "effect"?type:audioKind;if(type is "music" or "effect")type="audio";
   var rows=(IEnumerable<object>)(ImportAssets(type,false,false,[path])??Array.Empty<object>());
   foreach(var row in rows){var node=JsonSerializer.SerializeToNode(row)!.AsObject();if(node["type"]?.GetValue<string>()=="audio")node["audioKind"]=category;result.Add(node);}
  }return result;
 }
 private async Task<object> CaptureAgentEditor44(string? panel=null){if(!string.IsNullOrEmpty(panel)&&panel!="main"){if(!moduleWindows.TryGetValue(panel,out var child))throw new Exception("请先用 open_editor_panel 打开这个窗口。");return await child.CaptureAgent44();}using var stream=new MemoryStream();await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);if(stream.Length>16*1024*1024)throw new Exception("截图过大，请缩小编辑器窗口。");return new{width=web.ClientSize.Width,height=web.ClientSize.Height,image=new{mimeType="image/png",data=Convert.ToBase64String(stream.ToArray())}};}
 private async Task<object> AgentEditorWindows44(){var rows=new List<object>();foreach(var pair in moduleWindows.ToArray())rows.Add(new{panel=pair.Key,dirty=await pair.Value.HasChangesAsync(),busy=await pair.Value.IsBusyAsync()});return new{modules=rows};}
 private async Task<object> SyncAgentEditorWindows44(){var applied=new List<string>();foreach(var pair in moduleWindows.ToArray()){if(await pair.Value.IsBusyAsync())throw new Exception(pair.Key+" 窗口正在操作，请稍后。");if(await pair.Value.HasChangesAsync()){await pair.Value.SaveForCloseAsync();applied.Add(pair.Key);}}return new{applied};}
}
