using System.Text;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private object[] ImportMmdModelFiles(IEnumerable<string> sources,string type){
  if(projectDirectory==null)throw new Exception("请先打开工程。");
  var result=new List<object>();
  foreach(string source in sources){
   string extension=Path.GetExtension(source).ToLowerInvariant();if(extension is not (".pmx" or ".pmd"))throw new Exception("MMD 模型请选择 PMX 或 PMD 文件。");
   string id=Guid.NewGuid().ToString("N"),relativeFolder=$"assets/{type}/{id}",folder=Path.Combine(projectDirectory,relativeFolder.Replace('/',Path.DirectorySeparatorChar)),sourceFolder=Path.GetDirectoryName(source)!;
   var references=ReadMmdTextureReferences(source);var textures=new List<(string Original,string Source)>();
   foreach(string reference in references.Distinct(StringComparer.Ordinal)){
    string normalized=reference.Replace('\\','/').Trim();if(string.IsNullOrEmpty(normalized))continue;
    // Absolute paths left by an exporter are resolved beside the selected model;
    // do not follow embedded network URLs or arbitrary absolute machine paths.
    string candidate=Path.IsPathRooted(normalized)||normalized.Contains(":")?Path.Combine(sourceFolder,Path.GetFileName(normalized)):Path.GetFullPath(Path.Combine(sourceFolder,normalized.Replace('/',Path.DirectorySeparatorChar)));
    if(!File.Exists(candidate)){candidate=Directory.EnumerateFiles(sourceFolder).FirstOrDefault(f=>Path.GetFileName(f).Equals(Path.GetFileName(normalized),StringComparison.OrdinalIgnoreCase))??candidate;}
    if(!File.Exists(candidate))throw new Exception($"MMD 模型缺少贴图：{reference}。请把模型和贴图放在一起再导入。");
    if(!new[]{".png",".jpg",".jpeg",".bmp",".tga",".dds",".sph",".spa",".webp"}.Contains(Path.GetExtension(candidate).ToLowerInvariant()))throw new Exception("MMD 贴图文件类型不支持："+reference);
    textures.Add((reference,candidate));
   }
   Directory.CreateDirectory(folder);File.Copy(source,Path.Combine(folder,Path.GetFileName(source)));var map=new Dictionary<string,string>(StringComparer.Ordinal);
   foreach(var texture in textures){string path=$"{relativeFolder}/{Guid.NewGuid():N}{Path.GetExtension(texture.Source).ToLowerInvariant()}";File.Copy(texture.Source,Path.Combine(projectDirectory,path.Replace('/',Path.DirectorySeparatorChar)));map[texture.Original]=path;result.Add(new{id=Guid.NewGuid().ToString("N"),type="modelDependency",name=Path.GetFileName(texture.Source),path});}
   var thumbnail=type=="mmdCharacter"?CopyModelFolderThumbnail(source,id,references):("",null);
   result.Insert(result.Count-textures.Count,new{id,type,name=Path.GetFileName(source),path=$"{relativeFolder}/{Path.GetFileName(source)}",textureMap=map,thumbnailPath=thumbnail.Item1,thumbnailSource=thumbnail.Item2!=null?"folder":""});if(thumbnail.Item2!=null)result.Add(thumbnail.Item2);
  }
  return result.ToArray();
 }
 // Only read the dependency table for local asset collection. Geometry,
 // skeletons, materials and animation are parsed by the web MMD component.
 private static string[] ReadMmdTextureReferences(string path){
  using var stream=File.OpenRead(path);using var reader=new BinaryReader(stream);var refs=new List<string>();
  void Skip(long count){if(count<0||stream.Position+count>stream.Length)throw new Exception("MMD 文件内容不完整。");stream.Position+=count;}
  int Count(int max){int count=reader.ReadInt32();if(count<0||count>max)throw new Exception("MMD 文件数据数量无效。");return count;}
  string magic=Encoding.ASCII.GetString(reader.ReadBytes(3));stream.Position=0;
  if(magic=="PMX"){
   Skip(4);float version=reader.ReadSingle();if(version<2||version>2.1001)throw new Exception("不支持这个 PMX 版本。");int size=reader.ReadByte();byte[] globals=reader.ReadBytes(size);if(size<8||globals.Length!=size)throw new Exception("PMX 文件头不完整。");
   var encoding=globals[0]==0?Encoding.Unicode:Encoding.UTF8;
   string Text(){int bytes=Count(16*1024*1024);byte[] data=reader.ReadBytes(bytes);if(data.Length!=bytes)throw new Exception("PMX 文字数据不完整。");return encoding.GetString(data);}
   for(int i=0;i<4;i++)Text();int vertices=Count(10_000_000),boneIndex=globals[5];
   if(globals[1]>4||!new byte[]{1,2,4}.Contains(globals[2])||!new byte[]{1,2,4}.Contains((byte)boneIndex))throw new Exception("PMX 文件索引格式无效。");
   for(int i=0;i<vertices;i++){Skip(32+globals[1]*16);byte deform=reader.ReadByte();Skip(deform switch{0=>boneIndex,1=>boneIndex*2+4,2 or 4=>boneIndex*4+16,3=>boneIndex*2+40,_=>throw new Exception("PMX 蒙皮格式无效。")});Skip(4);}
   Skip((long)Count(30_000_000)*globals[2]);int textures=Count(100_000);for(int i=0;i<textures;i++)refs.Add(Text());
  }else if(magic.Equals("Pmd",StringComparison.OrdinalIgnoreCase)){
   Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);var sjis=Encoding.GetEncoding(932);Skip(3+4+20+256);Skip((long)Count(10_000_000)*38);Skip((long)Count(30_000_000)*2);int materials=Count(100_000);
   for(int i=0;i<materials;i++){Skip(50);refs.AddRange(sjis.GetString(reader.ReadBytes(20)).TrimEnd('\0').Split('*',StringSplitOptions.RemoveEmptyEntries));}
   refs.AddRange(Directory.EnumerateFiles(Path.GetDirectoryName(path)!,"toon*.bmp").Select(Path.GetFileName).OfType<string>());
  }else throw new Exception("文件不是 PMX 或 PMD 模型。");
  return refs.ToArray();
 }
}
