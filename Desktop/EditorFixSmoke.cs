using System.Drawing.Imaging;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task RunEditorFixSmoke(){
  string path=Path.Combine(projectDirectory!,"assets","images","alpha-check.png");Directory.CreateDirectory(Path.GetDirectoryName(path)!);
  using(var image=new Bitmap(96,96,PixelFormat.Format32bppArgb)){
   for(int y=0;y<96;y++)for(int x=0;x<96;x++)image.SetPixel(x,y,x<32?Color.FromArgb(0,0,0,0):Color.FromArgb(x<64?128:255,255,25,25));
   image.Save(path,ImageFormat.Png);
  }
  for(int i=0;i<400;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__vrmSmokeV024 && window.editorProjectSnapshot?.())")=="true")break;await Task.Delay(50);}
  foreach(var phase in new[]{"alpha","feet","save-start","save-finish","save-failure","environment","names"}){
   await web.CoreWebView2.ExecuteScriptAsync("window.__fixCheck=null;window.__vrmSmokeV024("+JsonSerializer.Serialize(phase)+").then(r=>window.__fixCheck=r).catch(error=>window.__fixCheck={error:error.message})");
   string result="null";for(int i=0;i<6000;i++){result=await web.CoreWebView2.ExecuteScriptAsync("window.__fixCheck");if(result!="null")break;await Task.Delay(50);}
   File.WriteAllText(smokeBase+".fix-"+phase+".json",result);using(var shot=File.Create(smokeBase+".fix-"+phase+".png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
   if(!result.Contains("\"ok\":true"))throw new Exception(result);
   if(phase=="environment"&&environmentWindow!=null)await environmentWindow.CaptureReadySmoke(smokeBase+".transparent-environment.png");
   if(phase=="names"&&moduleWindows.TryGetValue("render",out var renderWindow)){
    string check=await renderWindow.Smoke("const select=document.querySelector('[data-render=preset]');if(!select)throw Error('没有风格选项');const names=[...select.options].map(option=>option.textContent);if(!names.includes('明彩动画')||!names.includes('复古荧屏')||names.some(name=>/绝区零|TNO/i.test(name)))throw Error('风格名称没有修改');select.value='zzz';select.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,400));if(!document.querySelector('[data-render=strength]'))throw Error('明彩动画未应用');return {ok:true,names,styleApplied:true};",smokeBase+".render-names.png");
    File.WriteAllText(smokeBase+".render-names.json",check);if(!check.Contains("\"ok\":true"))throw new Exception(check);renderWindow.CloseWithoutPrompt();
   }
  }
  environmentWindow?.CloseWithoutPrompt();
 }
}
