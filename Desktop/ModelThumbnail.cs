using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
namespace VRMGalgame;
internal sealed partial class EditorWindow {
 private (string Path,object? Asset) CopyModelFolderThumbnail(string source,string modelId,IEnumerable<string>? textureReferences=null){
  string folder=System.IO.Path.GetDirectoryName(source)!,stem=System.IO.Path.GetFileNameWithoutExtension(source);
  var textureNames=(textureReferences??[]).Select(p=>System.IO.Path.GetFileName(p.Replace('\\','/'))).ToHashSet(StringComparer.OrdinalIgnoreCase);
  var candidates=Directory.EnumerateFiles(folder).Concat(new[]{"头像","preview","thumbnails"}.SelectMany(sub=>Directory.Exists(System.IO.Path.Combine(folder,sub))?Directory.EnumerateFiles(System.IO.Path.Combine(folder,sub)):Enumerable.Empty<string>()));
  string? image=candidates.Where(f=>!textureNames.Contains(System.IO.Path.GetFileName(f))&&new[]{".png",".jpg",".jpeg",".webp"}.Contains(System.IO.Path.GetExtension(f).ToLowerInvariant())).OrderBy(f=>System.IO.Path.GetFileNameWithoutExtension(f)==stem?0:1).FirstOrDefault(f=>{
   string name=System.IO.Path.GetFileNameWithoutExtension(f);return name.Equals(stem,StringComparison.OrdinalIgnoreCase)||name.Contains("头像")||name.Contains("预览图")||Regex.IsMatch(name,@"(?:^|[_\-\s])(portrait|thumbnail|avatar|preview)(?:$|[_\-\s]?\d+$)",RegexOptions.IgnoreCase);
  });
  if(image==null)return ("",null);
  string relative=$"assets/model-thumbnails/{modelId}{System.IO.Path.GetExtension(image).ToLowerInvariant()}",target=System.IO.Path.Combine(projectDirectory!,relative);Directory.CreateDirectory(System.IO.Path.GetDirectoryName(target)!);File.Copy(image,target,true);
  return (relative,new{id="model-thumbnail-"+modelId,type="modelDependency",name=System.IO.Path.GetFileName(image),path=relative,modelThumbnail=true});
 }
 private object SaveModelThumbnail(string dataUrl,string modelId){
  if(projectDirectory==null)throw new Exception("请先打开工程。");const string prefix="data:image/png;base64,";
  if(!dataUrl.StartsWith(prefix))throw new Exception("缩略图格式不正确。");byte[] bytes=Convert.FromBase64String(dataUrl[prefix.Length..]);
  if(bytes.Length<32||bytes.Length>3_000_000||!bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}))throw new Exception("缩略图无效。");
  string key=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(modelId))).ToLowerInvariant()[..32],path=$"assets/model-thumbnails/{key}.png",target=System.IO.Path.Combine(projectDirectory,path);Directory.CreateDirectory(System.IO.Path.GetDirectoryName(target)!);File.WriteAllBytes(target,bytes);
  return new{id="model-thumbnail-"+modelId,type="modelDependency",name="人物素材缩略图.png",path,modelThumbnail=true};
 }
}
