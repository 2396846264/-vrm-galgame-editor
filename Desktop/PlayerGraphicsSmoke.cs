using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task RunPlayerGraphicsSmoke(){
  for(int i=0;i<400;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmokeGraphics && window.editorProjectSnapshot?.()?.id)")=="true")break;await Task.Delay(50);}
  var cases=new List<(string,object)>();
  if(!playerMode){cases.Add(("kernel","kernel"));cases.Add(("export","export"));}
  else{
   cases.Add(("kernel","kernel"));cases.Add(("settings","settings"));
   foreach(string aa in new[]{"off","fxaa","msaa2","msaa4","msaa8","ssaa2","ssaa4","ssaa8","ssaa16"})cases.Add((aa,new{aa}));
   foreach(string upscale in new[]{"ultra","quality","balanced","performance"})cases.Add(("fsr-"+upscale,new{aa="fxaa",upscale,sharpness=40}));
   cases.Add(("low-shadow",new{aa="fxaa",shadows="low"}));cases.Add(("off-shadow",new{aa="fxaa",shadows="off"}));cases.Add(("render-50",new{aa="fxaa",renderScale=50}));cases.Add(("inherit","inherit"));cases.Add(("styles","styles"));cases.Add(("restart","restart"));
  }
  foreach(var (name,value)in cases){
   await web.CoreWebView2.ExecuteScriptAsync("window.__graphicsCheck=null;window.__vrmSmokeGraphics("+JsonSerializer.Serialize(value)+").then(r=>window.__graphicsCheck=r).catch(error=>window.__graphicsCheck={error:error.message})");
   string result="null";for(int i=0;i<6000;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__graphicsCheck");if(result!="null")break;await Task.Delay(50);}
   if(JsonNode.Parse(result) is JsonObject data&&data["image"] is JsonValue image){string url=image.GetValue<string>();File.WriteAllBytes(smokeBase+".scene-"+name+".png",Convert.FromBase64String(url[(url.IndexOf(',')+1)..]));data.Remove("image");result=data.ToJsonString();}
   File.WriteAllText(smokeBase+".graphics-"+name+".json",result);using(var shot=File.Create(smokeBase+".graphics-"+name+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);if(!result.Contains("\"ok\":true"))throw new Exception(result);
  }
 }
}
