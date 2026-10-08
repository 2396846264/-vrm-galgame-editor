using System.Diagnostics;
using System.IO.Compression;
using System.Security;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace VRMGalgame;

internal static class AndroidBuilder
{
    internal static bool ExportEnabled => false;
    internal sealed record Progress(int Percent, string Message);
    internal sealed record Options(string AppName,string VersionName,string IconDataUrl);
    internal static byte[] ValidateOptions(Options options){
        if(string.IsNullOrWhiteSpace(options.AppName)||options.AppName.Length>80||options.AppName.Any(char.IsControl))throw new Exception("请填写有效的 App 名称（最多 80 字）。");
        if(options.VersionName.Length>32||!System.Text.RegularExpressions.Regex.IsMatch(options.VersionName,@"^\d{1,4}(\.\d{1,4}){0,3}(-[A-Za-z0-9.-]+)?$"))throw new Exception("请填写有效的 App 版本，例如 1.0.0。");
        const string prefix="data:image/png;base64,";if(!options.IconDataUrl.StartsWith(prefix,StringComparison.Ordinal)||options.IconDataUrl.Length>3_000_000)throw new Exception("请上传有效 App 图标。");
        byte[] bytes;try{bytes=Convert.FromBase64String(options.IconDataUrl[prefix.Length..]);}catch(FormatException){throw new Exception("App 图标无效。");}
        if(bytes.Length<33||!bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10})||System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16,4))!=512||System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20,4))!=512)throw new Exception("App 图标必须正确转换为 512×512 PNG。");
        return bytes;
    }
    internal static async Task<object> Build(string applicationDirectory, string projectDirectory, JsonNode snapshot,
        string destination, IProgress<Progress> progress,Options options)
    {
        if(!ExportEnabled)throw new NotSupportedException("此版本已移除安卓导出。");
        byte[] icon=ValidateOptions(options);
        string template=Path.Combine(applicationDirectory,"Android");
        if(!Directory.Exists(template))throw new Exception("Android 导出组件缺失，请使用完整新版编辑器。");
        string tools=Environment.GetEnvironmentVariable("VRMG_ANDROID_TOOLS")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"VRMGalgame","AndroidTools");
        await PrepareTools(template,tools,progress);
        string Find(string filename)=>Directory.GetFiles(tools,filename,SearchOption.AllDirectories).FirstOrDefault()??throw new Exception("Android 打包工具不完整："+filename);
        string java=Find("java.exe"),javac=Find("javac.exe"),keytool=Find("keytool.exe"),androidJar=Find("android.jar"),aapt=Find("aapt2.exe"),align=Find("zipalign.exe"),d8=Find("d8.jar"),signer=Find("apksigner.jar");
        string id=snapshot["id"]?.GetValue<string>()??throw new Exception("工程缺少身份，请先保存工程。");
        string identityId=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(id))).ToLowerInvariant()[..24];
        string packageName="com.vrmg.g"+identityId;
        string identity=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"VRMGalgame","AndroidSigning",identityId);
        Directory.CreateDirectory(identity);
        using var signingLock=new FileStream(Path.Combine(identity,"build.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);
        string passwordFile=Path.Combine(identity,"password.txt"),keystore=Path.Combine(identity,"game.p12"),versionFile=Path.Combine(identity,"version.txt");
        if(!File.Exists(passwordFile))File.WriteAllText(passwordFile,Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),new UTF8Encoding(false));
        if(!File.Exists(keystore))await Run(keytool,["-genkeypair","-alias","game","-keyalg","RSA","-keysize","2048","-validity","10000","-dname","CN=VRMGalgame","-storetype","PKCS12","-keystore",keystore,"-storepass:file",passwordFile,"-keypass:file",passwordFile],identity);
        int version=File.Exists(versionFile)&&int.TryParse(File.ReadAllText(versionFile),out int saved)?checked(saved+1):1;
        string work=Path.Combine(Path.GetTempPath(),"VRMGalgame","AndroidBuilds",Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(work);byte[] envelope=RandomNumberGenerator.GetBytes(32);
        try{
            progress.Report(new(30,"整理并加密游戏资源"));
            string assets=Path.Combine(work,"assets"),web=Path.Combine(assets,"web"),src=Path.Combine(work,"src"),classes=Path.Combine(work,"classes"),dex=Path.Combine(work,"dex"),res=Path.Combine(work,"res","values");
            foreach(string folder in new[]{assets,src,classes,dex,res})Directory.CreateDirectory(folder);
            CopyTree(Path.Combine(applicationDirectory,"web"),web);
            File.Copy(Path.Combine(template,"android-bridge.js"),Path.Combine(web,"android-bridge.js"));
            string html=Path.Combine(web,"player.html");File.WriteAllText(html,File.ReadAllText(html).Replace("<head>","<head><script src=\"/android-bridge.js\"></script>"),new UTF8Encoding(false));
            var project=snapshot.DeepClone();if(project is JsonObject obj)obj.Remove("authoring");
            var sources=new List<GameResourcePackage.Source>{new("project.json",null,Encoding.UTF8.GetBytes(project.ToJsonString()))};
            string allowed=Path.GetFullPath(projectDirectory).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
            foreach(string path in (project["assets"]?.AsArray()??[]).Select(a=>a?["path"]?.GetValue<string>()??"").Distinct(StringComparer.OrdinalIgnoreCase)){
                GameResourcePackage.NormalizePath(path);string full=Path.GetFullPath(Path.Combine(projectDirectory,path.Replace('/',Path.DirectorySeparatorChar)));
                if(!path.StartsWith("assets/",StringComparison.OrdinalIgnoreCase)||!full.StartsWith(allowed,StringComparison.OrdinalIgnoreCase)||!File.Exists(full))throw new Exception("素材缺失或路径无效："+path);
                sources.Add(new(path,full));
            }
            await Task.Run(()=>GameResourcePackage.Write(Path.Combine(assets,GameResourcePackage.FileName),sources,envelope));
            foreach(string file in Directory.GetFiles(Path.Combine(template,"player"),"*.java"))File.Copy(file,Path.Combine(src,Path.GetFileName(file)));
            File.WriteAllText(Path.Combine(src,"GameIdentity.java"),"package vrm.galgame.player; final class GameIdentity { static boolean debugEnabled(){return "+(Environment.GetEnvironmentVariable("VRMG_ANDROID_DEBUG")=="1"?"true":"false")+";} static byte[] wrappingKey(){return android.util.Base64.decode(\""+Convert.ToBase64String(envelope)+"\",0);} }",new UTF8Encoding(false));
            string appName=SecurityElement.Escape(options.AppName.Replace("\\","\\\\").Replace("'","\\'").Replace("\"","\\\""))!;
            File.WriteAllText(Path.Combine(res,"strings.xml"),"<resources><string name=\"app_name\" formatted=\"false\">\""+appName+"\"</string></resources>",new UTF8Encoding(false));
            string drawable=Path.Combine(work,"res","drawable");Directory.CreateDirectory(drawable);File.WriteAllBytes(Path.Combine(drawable,"app_icon.png"),icon);
            File.WriteAllText(Path.Combine(work,"AndroidManifest.xml"),"<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\" package=\""+packageName+"\"><uses-permission android:name=\"android.permission.INTERNET\"/><uses-feature android:glEsVersion=\"0x00030000\" android:required=\"true\"/><application android:label=\"@string/app_name\" android:theme=\"@android:style/Theme.Material.Light.NoActionBar\" android:allowBackup=\"false\" android:usesCleartextTraffic=\"false\" android:hardwareAccelerated=\"true\"><activity android:name=\"vrm.galgame.player.MainActivity\" android:exported=\"true\" android:screenOrientation=\"sensorLandscape\" android:configChanges=\"orientation|screenSize|keyboardHidden\"><intent-filter><action android:name=\"android.intent.action.MAIN\"/><category android:name=\"android.intent.category.LAUNCHER\"/></intent-filter></activity></application></manifest>",new UTF8Encoding(false));
            progress.Report(new(50,"编译 Android 播放器"));
            string manifestFile=Path.Combine(work,"AndroidManifest.xml");File.WriteAllText(manifestFile,File.ReadAllText(manifestFile).Replace("<application ","<application android:icon=\"@drawable/app_icon\" android:roundIcon=\"@drawable/app_icon\" "),new UTF8Encoding(false));
            string list=Path.Combine(work,"sources.txt");File.WriteAllLines(list,Directory.GetFiles(src,"*.java").Select(p=>"\""+p.Replace('\\','/')+"\""),new UTF8Encoding(false));
            await Run(javac,["-encoding","UTF-8","-source","8","-target","8","-classpath",androidJar,"-d",classes,"@"+list],work);
            string jar=Path.Combine(work,"classes.jar");ZipFile.CreateFromDirectory(classes,jar);
            await Run(java,["-cp",d8,"com.android.tools.r8.D8","--lib",androidJar,"--min-api","26","--output",dex,jar],work);
            await Run(aapt,["compile","--dir",Path.Combine(work,"res"),"-o",Path.Combine(work,"res.zip")],work);
            progress.Report(new(70,"生成 APK，画面固定为 16:9"));
            string raw=Path.Combine(work,"base.apk"),aligned=Path.Combine(work,"aligned.apk"),signed=Path.Combine(work,"game.apk");
            await Run(aapt,["link","-o",raw,"-I",androidJar,"--manifest",Path.Combine(work,"AndroidManifest.xml"),"--min-sdk-version","26","--target-sdk-version","35","--version-code",version.ToString(),"--version-name",options.VersionName,"-A",assets,"-0","vrgdata",Path.Combine(work,"res.zip")],work);
            using(var apk=ZipFile.Open(raw,ZipArchiveMode.Update))foreach(string file in Directory.GetFiles(dex,"*.dex"))apk.CreateEntryFromFile(file,Path.GetFileName(file),CompressionLevel.Optimal);
            // Windows aapt can leave backslashes in local ZIP headers while
            // .NET rewrites central names with slashes. Android rejects that
            // mismatch. Rebuild both headers together before alignment/signing.
            string normalized=Path.Combine(work,"normalized.apk");
            using(var original=ZipFile.OpenRead(raw))using(var clean=ZipFile.Open(normalized,ZipArchiveMode.Create)){
                foreach(var entry in original.Entries){string name=entry.FullName.Replace('\\','/');var target=clean.CreateEntry(name,CompressionLevel.NoCompression);using var input=entry.Open();using var output=target.Open();await input.CopyToAsync(output);}
            }
            File.Move(normalized,raw,true);
            await Run(align,["-f","-p","4",raw,aligned],work);
            progress.Report(new(90,"签名并检查安装包"));
            await Run(java,["-jar",signer,"sign","--ks",keystore,"--ks-key-alias","game","--ks-pass","file:"+passwordFile,"--out",signed,aligned],work);
            await Run(java,["-jar",signer,"verify","--verbose",signed],work);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);File.Move(signed,destination,true);File.WriteAllText(versionFile,version.ToString());
            File.WriteAllText(destination+".说明.txt","安装包："+Path.GetFileName(destination)+"\n画面固定 16:9，全面屏多余区域为白色。需要 Android 8.0 或以上，支持 WebGL 2。\n签名身份保存在："+identity+"\n请单独备份此签名文件夹，不要随游戏发送给玩家。后续更新需沿用此身份。\n",Encoding.UTF8);
            progress.Report(new(100,"APK 已导出"));return new{apk=destination,packageName,versionCode=version,signingDirectory=identity};
        }finally{CryptographicOperations.ZeroMemory(envelope);string permitted=Path.Combine(Path.GetTempPath(),"VRMGalgame","AndroidBuilds")+Path.DirectorySeparatorChar;if(Path.GetFullPath(work).StartsWith(permitted,StringComparison.OrdinalIgnoreCase))try{Directory.Delete(work,true);}catch{/* Failed-build cleanup is confined to a generated temporary directory. */}}
    }
    private static async Task PrepareTools(string template,string root,IProgress<Progress> progress){
        Directory.CreateDirectory(root);var tools=JsonNode.Parse(File.ReadAllText(Path.Combine(template,"tools.json")))!.AsArray();
        using var client=new HttpClient{Timeout=TimeSpan.FromMinutes(30)};
        foreach(var tool in tools){string name=tool!["name"]!.GetValue<string>(),target=Path.Combine(root,name);
            string marker=Path.Combine(target,".verified");if(File.Exists(marker)&&File.ReadAllText(marker)==tool["hash"]!.GetValue<string>())continue;
            string archive=Path.Combine(root,name+".zip"),partial=archive+".download";
            progress.Report(new(5,"首次准备 Android 打包工具："+name+"（需要联网）"));
            if(!File.Exists(archive)){
                using var response=await client.GetAsync(tool["url"]!.GetValue<string>(),HttpCompletionOption.ResponseHeadersRead);response.EnsureSuccessStatusCode();
                await using var input=await response.Content.ReadAsStreamAsync();await using(var output=File.Create(partial)){byte[] buffer=new byte[1024*1024];long received=0,total=response.Content.Headers.ContentLength??0;int n;while((n=await input.ReadAsync(buffer))>0){await output.WriteAsync(buffer.AsMemory(0,n));received+=n;progress.Report(new(10,"下载 "+name+"："+(total>0?(received*100/total)+"%":(received/1024/1024)+" MB")));}}File.Move(partial,archive,true);
            }
            using(var stream=File.OpenRead(archive)){byte[] digest=tool["algorithm"]!.GetValue<string>()=="sha1"?SHA1.HashData(stream):SHA256.HashData(stream);if(!Convert.ToHexString(digest).Equals(tool["hash"]!.GetValue<string>(),StringComparison.OrdinalIgnoreCase)){File.Delete(archive);throw new Exception("打包工具下载校验失败，请重新导出。");}}
            progress.Report(new(20,"解压并检查打包工具："+name));ZipFile.ExtractToDirectory(archive,target,true);File.WriteAllText(marker,tool["hash"]!.GetValue<string>());
        }
    }
    private static async Task Run(string exe,string[] arguments,string directory){
        var info=new ProcessStartInfo(exe){WorkingDirectory=directory,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};foreach(string argument in arguments)info.ArgumentList.Add(argument);
        using var process=Process.Start(info)??throw new Exception("打包工具启动失败。");var stdout=process.StandardOutput.ReadToEndAsync();var stderr=process.StandardError.ReadToEndAsync();await process.WaitForExitAsync();string output=await stdout+"\n"+await stderr;
        if(process.ExitCode!=0)throw new Exception("Android 打包失败（"+Path.GetFileName(exe)+"）：\n"+output[..Math.Min(output.Length,3000)]);
    }
    private static void CopyTree(string source,string destination){Directory.CreateDirectory(destination);foreach(string file in Directory.GetFiles(source))File.Copy(file,Path.Combine(destination,Path.GetFileName(file)));foreach(string child in Directory.GetDirectories(source))CopyTree(child,Path.Combine(destination,Path.GetFileName(child)));}
}
