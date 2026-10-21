using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private async Task RunEditorLanguageSmoke(){
  await CommercialWait("Boolean(window.editorProjectSnapshot?.()&&document.querySelector('.editor [data-action=editor-settings]'))");
  if(Environment.GetCommandLineArgs().Contains("--smoke-language-reopen")){
   string reopened=await web.CoreWebView2.ExecuteScriptAsync("({language:document.documentElement.lang,theme:window.editorProjectSnapshot().ui.gameTheme,accent:window.editorProjectSnapshot().ui.gamePalettes.ark.accent,text:window.editorProjectSnapshot().acts[0].steps[0].text})");
   var check=JsonNode.Parse(reopened)!;if(check["language"]?.GetValue<string>()!="en"||check["theme"]?.GetValue<string>()!="ark"||check["accent"]?.GetValue<string>()!="#315e8b"||check["text"]?.GetValue<string>()!="UI58 并发对白")throw new Exception(reopened);
   File.WriteAllText(smokeBase+".reopen-language.json",JsonSerializer.Serialize(new{ok=true,restartedPreference=true,projectUiRoundtrip=true}));return;
  }
  string before=await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.editorProjectSnapshot())");
  await web.CoreWebView2.ExecuteScriptAsync("(()=>{document.querySelector('[data-action=editor-settings]').click();const n=document.querySelector('#editor-language');n.value='en';n.dispatchEvent(new Event('input',{bubbles:true}));const b=document.createElement('button');b.dataset.action='open-module';b.dataset.module='ui';document.querySelector('.editor').append(b);b.click();b.remove()})()");
  await CommercialWait("document.documentElement.lang==='en'&&document.querySelector('#editor-settings-modal h2').textContent==='Editor settings'");
  using(var image=File.Create(smokeBase+".main-en.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
  for(int i=0;i<400&&!moduleWindows.ContainsKey("ui");i++)await Task.Delay(50);
  if(!moduleWindows.TryGetValue("ui",out var child))throw new Exception("UI editor did not open");
  string result=await child.Smoke("const assert=(v,m)=>{if(!v)throw Error(m);};assert(document.documentElement.lang==='en','Child did not inherit language');const before=JSON.stringify(window.editorProjectSnapshot());document.querySelector('[data-action=editor-settings]').click();const n=document.querySelector('#editor-language');n.value='ja';n.dispatchEvent(new Event('input',{bubbles:true}));assert(document.documentElement.lang==='ja','Japanese not applied');assert(before===JSON.stringify(window.editorProjectSnapshot()),'Language changed child project');return {ok:true,language:document.documentElement.lang,heading:document.querySelector('#editor-settings-modal h2').textContent}",smokeBase+".child-ja.png");
  File.WriteAllText(smokeBase+".child-ja.json",result);if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  await CommercialWait("document.documentElement.lang==='ja'&&document.querySelector('#editor-language').value==='ja'");
  if(Text!=EditorLanguage.T("公民文艺生产综合自动化系统")||child.Text!=EditorLanguage.T("游戏 UI编辑器"))throw new Exception("Native window title did not follow language");
  if(before!=await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.editorProjectSnapshot())"))throw new Exception("Language changed project content");
  using(var image=File.Create(smokeBase+".main-ja.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
  await web.CoreWebView2.ExecuteScriptAsync("(()=>{const n=document.querySelector('#editor-language');n.value='zh-CN';n.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await CommercialWait("document.documentElement.lang==='zh-CN'");
  await web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeCloseEdit('UI58 并发对白')");
  string saved=await child.Smoke("document.querySelector('[data-action=close-editor-settings]').click();const radio=document.querySelector('[name=game-ui-preset][value=ark]');radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));const color=document.querySelector('[data-palette-color=accent]');color.value='#315e8b';color.dispatchEvent(new Event('input',{bubbles:true}));await window.editorSaveBeforeClose();return {ok:true,ui:window.editorProjectSnapshot().ui}",smokeBase+".ui-save.png");
  File.WriteAllText(smokeBase+".ui-save.json",saved);if(JsonNode.Parse(saved)?["ok"]?.GetValue<bool>()!=true)throw new Exception(saved);
  string merged=await web.CoreWebView2.ExecuteScriptAsync("({theme:window.editorProjectSnapshot().ui.gameTheme,accent:window.editorProjectSnapshot().ui.gamePalettes.ark.accent,text:window.editorProjectSnapshot().acts[0].steps[0].text,dirty:window.editorCloseState().dirty})");
  var state=JsonNode.Parse(merged)!;if(state["theme"]?.GetValue<string>()!="ark"||state["accent"]?.GetValue<string>()!="#315e8b"||state["text"]?.GetValue<string>()!="UI58 并发对白"||state["dirty"]?.GetValue<bool>()!=false)throw new Exception(merged);
  File.WriteAllText(smokeBase+".language.json",JsonSerializer.Serialize(new{ok=true,english=true,japanese=true,windowSync=true,nativeTitles=true,languagePreservesProject=true,nativeUiSave=true,concurrentDialoguePreserved=true}));
  child.CloseWithoutPrompt();
  await web.CoreWebView2.ExecuteScriptAsync("(()=>{const n=document.querySelector('#editor-language');n.value='en';n.dispatchEvent(new Event('input',{bubbles:true}))})()");
 }
}
