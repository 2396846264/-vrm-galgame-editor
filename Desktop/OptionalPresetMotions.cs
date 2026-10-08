using System.Text.Json.Nodes;
namespace VRMGalgame;
internal static class OptionalPresetMotions {
 internal static List<object> Copy(string sourceDirectory,string projectDirectory){
  var assets=new List<object>();JsonArray? manifest;
  try{string path=Path.Combine(sourceDirectory,"manifest.json");if(!File.Exists(path))return assets;manifest=JsonNode.Parse(File.ReadAllText(path)) as JsonArray;}catch(Exception error)when(error is System.Text.Json.JsonException or IOException or UnauthorizedAccessException){return assets;}
  if(manifest==null)return assets;
  var ids=new HashSet<string>(StringComparer.Ordinal);var filenames=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  string Text(JsonNode? node)=>node is JsonValue value&&value.TryGetValue<string>(out var text)?text:"";
  foreach(var row in manifest){if(row is not JsonObject entry)continue;string filename=Text(entry["file"]),id=Text(entry["id"]),name=Text(entry["name"]);
   if(filename!=Path.GetFileName(filename)||filename.Contains(':')||filename.Contains('\\')||filename.Contains('/')||!filename.EndsWith(".fbx",StringComparison.OrdinalIgnoreCase)||string.IsNullOrWhiteSpace(id)||string.IsNullOrWhiteSpace(name)||ids.Contains(id)||filenames.Contains(filename))continue;
   string source=Path.Combine(sourceDirectory,filename);if(!File.Exists(source))continue;
   try{if(new FileInfo(source).Length==0)continue;string destination=Path.Combine(projectDirectory,"assets","motion","预制动作");Directory.CreateDirectory(destination);File.Copy(source,Path.Combine(destination,filename));}
   catch(Exception error)when(error is IOException or UnauthorizedAccessException){continue;}
   ids.Add(id);filenames.Add(filename);assets.Add(new{id,name,path=$"assets/motion/预制动作/{filename}",type="motion",folderId="preset-motion-folder"});
  }
  return assets;
 }
}
