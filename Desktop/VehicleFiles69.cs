using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
 private object? VehicleFile(string action,JsonNode? payload,Form owner){
  if(projectDirectory==null)throw new Exception("请先打开工程。");
  bool ship=payload?["vehicleType"]?.GetValue<string>()=="warship";string label=ship?"战舰":"飞机",extension=ship?".vrmship":".vrmair",format=ship?"vrm-warship":"vrm-aircraft",manifestName=ship?"warship.json":"aircraft.json";
  string? chosen=null;
  if(smokeFileOpsParent!=null&&Environment.GetCommandLineArgs().Any(a=>a is "--smoke-air69" or "--smoke-naval70")){Directory.CreateDirectory(smokeFileOpsParent);chosen=Path.Combine(smokeFileOpsParent,"独立"+label+extension);}
  if(action=="exportVehicleFile"){
   var blueprint=payload?["blueprint"]?.DeepClone()??throw new Exception("载具数据为空。");
   var assets=payload?["assets"]?.AsArray()??new JsonArray();if(assets.Count>64)throw new Exception("音效数量过多。");
   blueprint.AsObject().Remove("vehicleId");
   var sounds=blueprint["fireSounds"]?.AsObject();var wanted=(sounds?.Select(v=>v.Value?.GetValue<string>()??"")??Enumerable.Empty<string>()).Where(s=>s.Length>0).ToHashSet();
   var rows=new List<(string Source,string Entry,JsonObject Asset)>();
   foreach(string id in wanted){var asset=assets.FirstOrDefault(a=>a?["id"]?.GetValue<string>()==id)??throw new Exception("飞机引用的音效不存在。");string relative=asset["path"]?.GetValue<string>()??"";string full=Path.GetFullPath(Path.Combine(projectDirectory,relative));string root=Path.GetFullPath(Path.Combine(projectDirectory,"assets"))+Path.DirectorySeparatorChar;
    string ext=Path.GetExtension(full).ToLowerInvariant();if(!full.StartsWith(root,StringComparison.OrdinalIgnoreCase)||!new[]{".wav",".mp3",".ogg"}.Contains(ext)||!File.Exists(full))throw new Exception("飞机音效路径无效。");
    string entry="audio/"+rows.Count+ext;rows.Add((full,entry,new JsonObject{["id"]=id,["name"]=asset["name"]?.GetValue<string>()??Path.GetFileName(full),["entry"]=entry}));
   }
   if(rows.Sum(r=>new FileInfo(r.Source).Length)>256L*1024*1024)throw new Exception("飞机音效总大小超过256MB。");
   if(chosen==null){using var dialog=new SaveFileDialog{Title=EditorLanguage.T("导出当前"+label+"（含武器音效）"),Filter=label+"文件 (*"+extension+")|*"+extension,FileName=string.Join("_",(blueprint["name"]?.GetValue<string>()??"飞机").Split(Path.GetInvalidFileNameChars()))+extension};if(dialog.ShowDialog(owner)!=DialogResult.OK)return null;chosen=dialog.FileName;}
   // Finish the archive before replacing a selected destination, so a failed export keeps it intact.
   string temp=chosen+"."+Guid.NewGuid().ToString("N")+".tmp";
   try{using(var zip=System.IO.Compression.ZipFile.Open(temp,ZipArchiveMode.Create)){foreach(var row in rows)zip.CreateEntryFromFile(row.Source,row.Entry,CompressionLevel.Optimal);using var writer=new StreamWriter(zip.CreateEntry(manifestName).Open());writer.Write(new JsonObject{["format"]=format,["version"]=1,["blueprint"]=blueprint,["assets"]=new JsonArray(rows.Select(r=>(JsonNode)r.Asset).ToArray())}.ToJsonString());}File.Move(temp,chosen,true);}finally{if(File.Exists(temp))File.Delete(temp);}
   return new{path=chosen,audioCount=rows.Count};
  }
  if(chosen==null){using var dialog=new OpenFileDialog{Title=EditorLanguage.T("导入"+label+"文件"),Filter=label+"文件 (*"+extension+")|*"+extension,Multiselect=false};if(dialog.ShowDialog(owner)!=DialogResult.OK)return null;chosen=dialog.FileName;}
  using var archive=System.IO.Compression.ZipFile.OpenRead(chosen);
  if(archive.Entries.Count>65||archive.Entries.Sum(e=>e.Length)>272L*1024*1024)throw new Exception("飞机文件过大或内容无效。");
  var manifest=archive.GetEntry(manifestName)??throw new Exception("缺少飞机数据。");if(manifest.Length>16*1024*1024)throw new Exception("飞机数据过大。");
  JsonNode data;using(var reader=new StreamReader(manifest.Open()))data=JsonNode.Parse(reader.ReadToEnd())??throw new Exception("飞机文件无效。");
  if(data["format"]?.GetValue<string>()!=format||data["version"]?.GetValue<int>()!=1)throw new Exception("不支持这个飞机文件格式。");
  var plane=data["blueprint"]?.DeepClone()??throw new Exception("缺少飞机。");plane.AsObject().Remove("vehicleId");if(ship!=(plane["vehicleType"]?.GetValue<string>()=="warship"))throw new Exception("载具文件类型与编辑器不一致。");
  var sourceAssets=data["assets"]?.AsArray()??new JsonArray();if(sourceAssets.Count>64)throw new Exception("音效数量过多。");
  var mappings=new Dictionary<string,string>();var imports=new JsonArray();var copied=new List<string>();
  try{foreach(var row in sourceAssets){string oldId=row?["id"]?.GetValue<string>()??"",entryName=row?["entry"]?.GetValue<string>()??"",ext=Path.GetExtension(entryName).ToLowerInvariant();
    if(oldId.Length==0||mappings.ContainsKey(oldId)||!new[]{".wav",".mp3",".ogg"}.Contains(ext))throw new Exception("飞机音效数据无效。");
    var entry=archive.GetEntry(entryName)??throw new Exception("飞机音效缺失。");if(entry.Length>256L*1024*1024)throw new Exception("音效过大。");string id=Guid.NewGuid().ToString("N"),relative="assets/audio/"+id+ext,target=Path.Combine(projectDirectory,relative);Directory.CreateDirectory(Path.GetDirectoryName(target)!);
    copied.Add(target);using(var stream=entry.Open())using(var output=File.Create(target))stream.CopyTo(output);
    mappings.Add(oldId,id);imports.Add(new JsonObject{["id"]=id,["name"]=Path.GetFileName(row?["name"]?.GetValue<string>()??"机炮音效"),["type"]="audio",["audioKind"]="effect",["folderId"]="",["path"]=relative});
   }
   if(plane["fireSounds"] is JsonObject fire)foreach(string type in fire.Select(k=>k.Key).ToArray()){string old=fire[type]?.GetValue<string>()??"";fire[type]=old.Length==0?"":mappings.GetValueOrDefault(old)??throw new Exception("飞机音效引用缺失。");}
   return new{blueprint=plane,assets=imports};
  }catch{foreach(string file in copied)File.Delete(file);throw;}
 }
}
