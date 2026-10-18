using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task PalettePhase(string phase)
 {
  await web.CoreWebView2.ExecuteScriptAsync("window.__paletteResult=null;window.__vrmSmokePalette56("+JsonSerializer.Serialize(phase)+").then(r=>window.__paletteResult=r).catch(e=>window.__paletteResult={error:e.message,stack:e.stack})");
  await CommercialWait("window.__paletteResult !== null");
  string result=await web.CoreWebView2.ExecuteScriptAsync("window.__paletteResult");
  File.WriteAllText(smokeBase+"."+phase+".json",result);
  if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  using var shot=File.Create(smokeBase+"."+phase+".png");await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
 }
 private async Task RunPalette56Smoke()
 {
  WindowState=System.Windows.Forms.FormWindowState.Maximized;
  var args=Environment.GetCommandLineArgs();
  if(args.Contains("--smoke-palette56-player")){await PalettePhase("reopen");await PalettePhase("widgets");return;}
  if(args.Contains("--smoke-palette56-reopen")){await PalettePhase("reopen");return;}
  await CommercialWait("Boolean(document.querySelector('.welcome [data-action=new-project]'))");
  await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#new-name').value='Palette56';document.querySelector('[data-action=new-project]').click()");
  await CommercialWait("Boolean(window.editorProjectSnapshot?.()?.name==='Palette56' && document.querySelector('.editor') && !window.__vrmDiagnostics().dirty)");
  string books=Path.Combine(projectDirectory!,"assets/books");Directory.CreateDirectory(books);WriteStandardFontPdf(Path.Combine(books,"palette.pdf"));
  string images=Path.Combine(projectDirectory!,"assets/image");Directory.CreateDirectory(images);File.WriteAllText(Path.Combine(images,"palette.svg"),"<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#dfc485'/></svg>");
  await PalettePhase("editor");
  await SaveProjectAsync(ReadProject(),null);
  BuildGame(smokeBase+".export",ReadProject()!);
  await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=close-game-ui]').click()");
  await PalettePhase("widgets");
 }
}
