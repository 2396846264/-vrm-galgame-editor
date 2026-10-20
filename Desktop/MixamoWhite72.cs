using System.Text.Json.Nodes;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private object? ExportMixamoWhiteFile(JsonNode? payload,Form owner){
  string encoded=payload?["base64"]?.GetValue<string>()??"";
  if(encoded.Length>280_000_000)throw new Exception("白模文件过大，请先简化人物网格。");
  byte[] bytes=Convert.FromBase64String(encoded);
  string format=payload?["format"]?.GetValue<string>()??"fbx";
  if(format is not ("fbx" or "obj"))throw new Exception("不支持的白模格式。");
  if(format=="fbx"){
   if(bytes.Length<64||!System.Text.Encoding.ASCII.GetString(bytes,0,18).StartsWith("Kaydara FBX Binary")||System.Buffers.Binary.BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(23,4))!=7300)throw new Exception("生成的 FBX 2013 文件无效。");
  }else if(bytes.Length<64||!System.Text.Encoding.UTF8.GetString(bytes,0,Math.Min(bytes.Length,256)).StartsWith("# VRM Galgame Mixamo white character; T-pose; centimetres\no WhiteCharacter\nv "))throw new Exception("生成的 OBJ 白模无效。");
  string name=payload?["name"]?.GetValue<string>()??"角色";foreach(char c in Path.GetInvalidFileNameChars())name=name.Replace(c,'_');name=name.Trim();if(name.Length>80)name=name[..80];if(name.Length==0)name="角色";
  string? path=null;
  if(smokeFileOpsParent!=null&&Environment.GetCommandLineArgs().Contains("--smoke-motion72")){Directory.CreateDirectory(smokeFileOpsParent);path=Path.Combine(smokeFileOpsParent,name+".mixamo."+format);}
  else {using var dialog=new SaveFileDialog{Title=EditorLanguage.T(format=="obj"?"导出兼容白模（OBJ）":"导出 Mixamo 白模（FBX）"),Filter=format=="obj"?"Mixamo OBJ (*.obj)|*.obj":"Mixamo FBX (*.fbx)|*.fbx",FileName=name+".mixamo."+format,DefaultExt=format,AddExtension=true,OverwritePrompt=true};if(dialog.ShowDialog(owner)!=DialogResult.OK)return null;path=dialog.FileName;}
  File.WriteAllBytes(path,bytes);return new{path,bytes=bytes.Length,stats=payload?["stats"]?.DeepClone()};
 }
 private async Task RunMotion72Smoke(){
  await CommercialWait("Boolean(window.__vrmSmokeMotion72&&window.editorProjectSnapshot?.())");
  ClientSize=new System.Drawing.Size(1676,980);
  bool reopen=Environment.GetCommandLineArgs().Contains("--smoke-motion72-reopen");
  if(!reopen&&!playerMode){
   var args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-motion72-inputs");var input=JsonNode.Parse(File.ReadAllText(args[at+1]))!;var rows=new List<object>();
   foreach(var pair in new[]{("motion72-fbx-model","fbxCharacter",input["fbx"]!.GetValue<string>()),("motion72-walk","motion",input["walk"]!.GetValue<string>()),("motion72-idle","motion",input["idle"]!.GetValue<string>())}){
    string path="assets/"+pair.Item2+"/"+pair.Item1+Path.GetExtension(pair.Item3),target=Path.Combine(projectDirectory!,path);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(pair.Item3,target,true);rows.Add(new{id=pair.Item1,type=pair.Item2,path,name=Path.GetFileNameWithoutExtension(pair.Item3)});
   }
   await web.CoreWebView2.ExecuteScriptAsync("window.__motion72Assets="+JsonSerializer.Serialize(rows));
  }
  async Task Phase(string phase){
   await web.CoreWebView2.ExecuteScriptAsync("window.__motion72=null;window.__vrmSmokeMotion72("+JsonSerializer.Serialize(phase)+").then(r=>window.__motion72=r).catch(e=>window.__motion72={ok:false,error:e.message,stack:e.stack})");
   await CommercialWait("window.__motion72!==null");string result=await web.CoreWebView2.ExecuteScriptAsync("window.__motion72");File.WriteAllText(smokeBase+"."+phase+".json",result);if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
  }
  if(playerMode){await Phase("runtime");using(var shot=File.Create(smokeBase+".runtime.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);File.WriteAllText(smokeBase+".complete.json",JsonSerializer.Serialize(new{ok=true,player=true}));editorCloseApproved=true;Close();return;}
  if(reopen)await Phase("reopen");
  else{
   await Phase("setup");await Phase("main");
   var snapshot=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorProjectSnapshot()"));OpenEditorModule(new JsonObject{["module"]="characters",["project"]=snapshot});var child=moduleWindows["characters"];
   foreach(string phase in new[]{"character-mmdCharacter","character-vrm","character-fbxCharacter","save"}){
    string result=await child.Smoke("return await window.__vrmSmokeMotion72("+JsonSerializer.Serialize(phase)+");",smokeBase+"."+phase+".png");File.WriteAllText(smokeBase+"."+phase+".json",result);if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
   }
   child.CloseWithoutPrompt();await Phase("runtime");using(var shot=File.Create(smokeBase+".runtime.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);WriteArchive(projectDirectory!,smokeBase+".vrmg");
   if(smokeFileOpsParent!=null)File.WriteAllText(smokeBase+".export-game.json",JsonSerializer.Serialize(ExportGame("人物动作适配试玩_0.0.72")));
  }
  File.WriteAllText(smokeBase+".complete.json",JsonSerializer.Serialize(new{ok=true,reopen}));editorCloseApproved=true;Close();
 }
}
