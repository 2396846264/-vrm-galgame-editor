using System.Text.Json;
using System.Text.Json.Nodes;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private async Task RunAuditModuleSmoke(){
  string[] args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-audit-module");string module=args[at+1];
  for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('.editor #sidebar-body')&&window.editorProjectSnapshot?.())")=="true")break;await Task.Delay(100);}
  if(args.Contains("--smoke-audit-brand")){
   string brand=await web.CoreWebView2.ExecuteScriptAsync("(()=>{const expected='公民文艺生产综合自动化系统',label=document.querySelector('.brand b');return {ok:document.title===expected&&label?.textContent===expected,title:document.title,brand:label?.textContent};})()");
   File.WriteAllText(smokeBase+".brand.json",brand);if(Text!="公民文艺生产综合自动化系统"||JsonNode.Parse(brand)?["ok"]?.GetValue<bool>()!=true)throw new Exception("软件名称未更新："+brand);
   using var image=File.Create(smokeBase+".brand.png");await web.CoreWebView2.CapturePreviewAsync(Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat.Png,image);
  }
  await web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeOpenModule("+JsonSerializer.Serialize(module)+")");for(int i=0;i<1200&&!moduleWindows.ContainsKey(module);i++)await Task.Delay(50);
  if(!moduleWindows.TryGetValue(module,out var child))throw new Exception("没有创建独立编辑器："+module);
  string script=module=="characters"?"const input=document.querySelector('[data-field=\"character.name\"]');if(!input)throw Error('角色名字输入框不存在');input.focus();input.value='实机角色改名验证';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();await new Promise(r=>setTimeout(r,1000));await window.editorSaveBeforeClose();return {ok:true,module:'characters',saved:true,actualInput:true,name:window.editorProjectSnapshot().characters[0].name};":module=="knowledge"?"const input=document.querySelector('[data-book-field=name]');if(!input)throw Error('书名输入框不存在');input.value='实机知识库保存验证';input.dispatchEvent(new Event('input',{bubbles:true}));await window.editorSaveBeforeClose();document.querySelector('[data-action=book-preview]').click();for(let i=0;i<400&&!document.querySelector('.book-paper canvas');i++)await new Promise(r=>setTimeout(r,50));if(document.querySelectorAll('.book-paper canvas').length!==2)throw Error('PDF第一页跨页未显示');document.querySelector('[data-action=book-next]').click();await new Promise(r=>setTimeout(r,1000));const middle=document.querySelector('#book-page-state').textContent;if(!middle.startsWith('3'))throw Error('PDF翻页失败：'+middle);document.querySelector('[data-action=book-next]').click();await new Promise(r=>setTimeout(r,1000));if(document.querySelectorAll('.book-paper canvas').length!==1||!document.querySelector('[data-action=book-next]').disabled)throw Error('PDF末页状态错误');return {ok:true,module:'knowledge',saved:true,pdfPages:5,spreadAndTurn:true};":"const changed=await window.__vrmSmokeModuleChange();await window.editorSaveBeforeClose();return {...changed,ok:true,saved:true};";
  string result=await child.Smoke(script,smokeBase+".audit-"+module+".png");File.WriteAllText(smokeBase+".audit-"+module+".json",result);
  if(!result.Contains("\"ok\":true"))throw new Exception(result);
  if(module=="characters"){
   string labels=await child.Smoke("const p=window.editorProjectSnapshot(),expected={vrm:'VRM',fbxCharacter:'FBX',mmdCharacter:'MMD'},types=new Set(),labels=[...document.querySelectorAll('[data-action=select-character]')].map(row=>{const c=p.characters[Number(row.dataset.index)],type=p.assets.find(a=>a.id===c.modelId)?.type,label=row.querySelector('small').textContent,want=c.modelId?(expected[type]||'未知模型'):'未设模型';if(label!==want)throw Error('模型类型标签错误：'+type+' => '+label);types.add(type);return {type,label};});if(!['vrm','fbxCharacter','mmdCharacter'].every(t=>types.has(t)))throw Error('缺少三种真实模型样本');return {ok:true,labels};",smokeBase+".model-labels.png");
   File.WriteAllText(smokeBase+".model-labels.json",labels);if(!labels.Contains("\"ok\":true"))throw new Exception(labels);
  }
  var p=ReadProject()!;bool persisted=module switch{"characters"=>p["characters"]![0]!["name"]!.GetValue<string>()=="实机角色改名验证","items"=>p["items"]!.AsArray().Any(i=>i?["id"]?.GetValue<string>()=="module-item-test"),"title"=>p["title"]!["actors"]![0]!["yaw"]!.GetValue<double>()==23,"render"=>p["renderPresets"]!.AsArray().Any(r=>r?["settings"]?["brightness"]?.GetValue<double>()==123),"knowledge"=>p["knowledgeBooks"]![0]!["name"]!.GetValue<string>()=="实机知识库保存验证",_=>false};
  File.WriteAllText(smokeBase+".persisted.json",JsonSerializer.Serialize(new{ok=persisted,module,actualDiskProject=true}));if(!persisted)throw new Exception("独立编辑器修改未落盘："+module);child.CloseWithoutPrompt();
 }
}
