using System.Reflection;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ICSharpCode.SharpZipLib.Zip;
using SecureZip = ICSharpCode.SharpZipLib.Zip.ZipFile;
string root=Path.GetFullPath(args[0]); Directory.CreateDirectory(root);
var assembly=Assembly.Load("VRMGalgame");
var secrets=assembly.GetType("VRMGalgame.ProtectedBuildConstants")!;
string password=(string)secrets.GetMethod("ArchivePassword",BindingFlags.NonPublic|BindingFlags.Static)!.Invoke(null,null)!;
var windowType=assembly.GetType("VRMGalgame.EditorWindow")!;
var write=windowType.GetMethod("WriteArchive",BindingFlags.NonPublic|BindingFlags.Static)!;
var load=windowType.GetMethod("LoadArchive",BindingFlags.NonPublic|BindingFlags.Instance)!;
var save=windowType.GetMethod("SaveProject",BindingFlags.NonPublic|BindingFlags.Instance)!;
var read=windowType.GetMethod("ReadProject",BindingFlags.NonPublic|BindingFlags.Instance)!;
var checks=new List<string>();
void Assert(bool value,string message) { if (!value) throw new Exception(message); }
string work=Path.Combine(root,"content");Directory.CreateDirectory(Path.Combine(work,"assets","voice","role"));
string voicePath="assets/voice/role/line.wav";byte[] bytes=Enumerable.Range(0,2048).Select(n=>(byte)n).ToArray();
File.WriteAllBytes(Path.Combine(work,voicePath),bytes);
File.WriteAllText(Path.Combine(work,"project.json"),JsonSerializer.Serialize(new {version=1,name="加密检查",id="protected-check",assets=new[]{new {id="voice",type="voice",path=voicePath,name="对白全文。"}},acts=Array.Empty<object>(),characters=Array.Empty<object>()}));
File.WriteAllText(Path.Combine(work,"assets","unused.txt"),"unreferenced");
Directory.CreateDirectory(Path.Combine(work,".editor-history"));File.WriteAllText(Path.Combine(work,".editor-history","ignored.txt"),"history");
string first=Path.Combine(root,"encrypted.vrmg"),second=Path.Combine(root,"encrypted-copy.vrmg");
write.Invoke(null,new object[]{work,first});write.Invoke(null,new object[]{work,second});
Assert(!File.ReadAllBytes(first).SequenceEqual(File.ReadAllBytes(second)),"AES salt is not random");
using(var z=new SecureZip(File.OpenRead(first)) {Password=password}) {
 var entries=z.Cast<ZipEntry>().ToArray();Assert(entries.Length==2 && entries.All(e=>e.IsCrypted && e.AESKeySize==256),"not all files AES256 protected");
 using var input=z.GetInputStream(z.GetEntry(voicePath));using var output=new MemoryStream();input.CopyTo(output);Assert(output.ToArray().SequenceEqual(bytes),"voice bytes changed");
 Assert(z.TestArchive(true),"encrypted package integrity");
}
foreach(string trial in new[]{"", "incorrect-password"}) {
 bool denied=false;try {using var z=new SecureZip(File.OpenRead(first)){Password=trial};using var input=z.GetInputStream(z.GetEntry("project.json"));using var reader=new StreamReader(input);reader.ReadToEnd();}catch {denied=true;}
 Assert(denied,"wrong or missing password accepted");
}
bool oldDenied=false;try{using var z=new ZipArchive(File.OpenRead(first));using var s=z.GetEntry("project.json")!.Open();s.ReadByte();}catch{oldDenied=true;}Assert(oldDenied,"old ZIP reader accepted new encrypted project");
checks.Add("工程清单和素材全部 AES-256 加密，随机盐不同，无密码及错误密码无法读取，旧版 ZIP 读取器无法打开");
var external = new System.Diagnostics.ProcessStartInfo(@"C:\Program Files\7-Zip\7z.exe") { UseShellExecute=false, CreateNoWindow=true, WindowStyle=System.Diagnostics.ProcessWindowStyle.Hidden, RedirectStandardOutput=true, RedirectStandardError=true };
foreach(string arg in new[]{"t",first,"-p"+password})external.ArgumentList.Add(arg);
using(var process=System.Diagnostics.Process.Start(external)!) { string output=process.StandardOutput.ReadToEnd();process.WaitForExit();Assert(process.ExitCode==0,"7-Zip could not read encrypted archive"); }
checks.Add("独立 7-Zip 工具使用指定密码验证成功");
using(var window=(IDisposable)Activator.CreateInstance(windowType,true)!) {
 load.Invoke(window,new object[]{first});var project=(JsonNode)read.Invoke(window,null)!;Assert(project["name"]!.GetValue<string>()=="加密检查","native reopen");
 project["name"]="修改后再次保存";save.Invoke(window,new object?[]{project,null});
 load.Invoke(window,new object[]{first});Assert(((JsonNode)read.Invoke(window,null)!)["name"]!.GetValue<string>()=="修改后再次保存","native resave");
}
checks.Add("原生编辑器重新打开、修改、保存、再打开成功，配音字节一致，历史文件及未使用素材未打包");
string plain=Path.Combine(root,"legacy.vrmg");
using(var z=System.IO.Compression.ZipFile.Open(plain,ZipArchiveMode.Create)) {
 foreach(string name in new[]{"project.json",voicePath})z.CreateEntryFromFile(Path.Combine(work,name),name);
}
using(var window=(IDisposable)Activator.CreateInstance(windowType,true)!) {
 load.Invoke(window,new object[]{plain});var project=(JsonNode)read.Invoke(window,null)!;save.Invoke(window,new object?[]{project,null});
}
using(var z=new SecureZip(File.OpenRead(plain)))Assert(z.Cast<ZipEntry>().All(e=>e.IsCrypted && e.AESKeySize==256),"legacy not upgraded on save");
checks.Add("无密码旧工程可打开，首次保存后全部转成加密格式");
byte[] clearSecret=Encoding.UTF8.GetBytes(password);
foreach(string file in Directory.GetFiles(Path.GetFullPath(args[1]),"*",SearchOption.AllDirectories).Where(p=>p.EndsWith(".js")||p.EndsWith(".json")||p.EndsWith(".md")||p.EndsWith(".exe")))
 Assert(File.ReadAllBytes(file).AsSpan().IndexOf(clearSecret)<0,"plaintext password in distributed file");
checks.Add("发布文件中没有明文工程密码");
File.WriteAllText(Path.Combine(root,"native-checks.json"),JsonSerializer.Serialize(new {ok=true,checks},new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine("PASS: encrypted round trip, wrong/missing password rejection, random salt, legacy upgrade, asset filtering and no plaintext secret.");
