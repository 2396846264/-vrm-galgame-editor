using System.Text.Json.Nodes;
using System.Security.Cryptography;
using Microsoft.Web.WebView2.Core;

namespace VRMGalgame;

internal sealed partial class EditorWindow
{
    private GameResourcePackage? playerResources;

    private async Task RunResourcePackageSmoke()
    {
        string report = smokeBase + ".resources.json";
        if (!playerMode)
        {
            var project = ReadProject() ?? throw new Exception("测试工程缺失。");
            project["id"] = "protected-resources-v020-test";
            if(await web.CoreWebView2.ExecuteScriptAsync("Boolean(document.querySelector('[data-action=import-folder-project]'))")!="false")
                throw new Exception("旧文件夹工程导入入口仍存在。");
            var expected = (project["assets"]?.AsArray()??new JsonArray()).Select(asset=>new {
                path=asset!["path"]!.GetValue<string>(),type=asset["type"]!.GetValue<string>(),
                sha256=Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Path.Combine(projectDirectory!,asset["path"]!.GetValue<string>())))).ToLowerInvariant()
            }).ToArray();
            string destination=Path.Combine(smokeFileOpsParent!,"加密资源测试游戏");
            var timer=System.Diagnostics.Stopwatch.StartNew();BuildGame(destination,project);timer.Stop();
            if(Directory.Exists(Path.Combine(destination,"game")))throw new Exception("导出仍存在明文 game 文件夹。");
            using(var package=GameResourcePackage.Open(Path.Combine(destination,GameResourcePackage.FileName))) {
                var packed=JsonNode.Parse(package.ReadSmallFile("project.json"))!;
                if(packed["authoring"]!=null)throw new Exception("作者资料进入了发行包。");
                foreach(var item in expected)using(var stream=package.OpenStream(package.Find(item.path)!))
                    if(Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant()!=item.sha256)throw new Exception("资源往返不一致："+item.path);
                if(package.Find("project.json.bak")!=null||package.Find("private-author-note.txt")!=null)throw new Exception("备份或作者文件进入发行包。");
            }
            File.WriteAllText(report,System.Text.Json.JsonSerializer.Serialize(new{ok=true,encryptedExport=true,noLooseAssets=true,authoringExcluded=true,folderImportRemoved=true,exportMs=timer.ElapsedMilliseconds,expected,destination}));
            return;
        }
        if(playerResources==null)throw new Exception("播放器未使用加密资源包。");
        var assets=ReadProject()?["assets"]?.AsArray()??new JsonArray();
        string files=System.Text.Json.JsonSerializer.Serialize(assets.Select(asset=>new{path=asset!["path"]!.GetValue<string>(),type=asset["type"]!.GetValue<string>()}));
        string script="""
            window.__resourceCheck=null;(async()=>{
              const files=FILES,results=[],wait=ms=>new Promise(r=>setTimeout(r,ms)),url=path=>'https://project.galgame/'+path.split('/').map(encodeURIComponent).join('/');
              const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
              for(const item of files){const response=await fetch(url(item.path));if(!response.ok||!response.headers.get('cache-control')?.includes('no-store'))throw Error('Unprotected response');
                const bytes=await response.arrayBuffer();const partial=await fetch(url(item.path),{headers:{Range:'bytes=7-50'}});
                const part=new Uint8Array(await partial.arrayBuffer());if(partial.status!==206||!part.every((n,i)=>n===new Uint8Array(bytes)[i+7]))throw Error('Range mismatch');
                results.push({path:item.path,sha256:await digest(bytes),bytes:bytes.byteLength});
              }
              const source=files.find(a=>a.type==='audio');let audioSeek=false;
              async function mediaSeek(element,path){element.muted=true;element.preload='auto';element.src=url(path);document.body.append(element);
                const deadline=performance.now()+15000;while(element.readyState<1&&performance.now()<deadline)await wait(50);
                if(element.readyState<1)throw Error('Media metadata failed: '+path+' error='+element.error?.code+' network='+element.networkState);await element.play();element.currentTime=Math.min(.7,element.duration/2);
                await wait(600);if(element.currentTime<.1||element.error)throw Error('Media seek failed');element.pause();element.remove();return true;
              }
              if(source)audioSeek=await mediaSeek(new Audio(),source.path);
              const video=files.find(a=>a.type==='video');let videoSeek=false;
              if(video)videoSeek=await mediaSeek(document.createElement('video'),video.path);
              const missing=await fetch(url('assets/not-found.glb'));if(missing.status!==404)throw Error('Missing resource accepted');
              const invalid=await fetch(url(files[0].path),{headers:{Range:'bytes=999999999999-'}});if(invalid.status!==416)throw Error('Invalid range accepted');
              return {ok:true,results,audioSeek,videoSeek,noStore:true,missingRejected:true};
            })().then(result=>window.__resourceCheck=result).catch(error=>window.__resourceCheck={error:error.message});
            """;
        await web.CoreWebView2.ExecuteScriptAsync(script.Replace("FILES",files));
        string check="null";
        for(int i=0;i<2400;i++){check=await web.CoreWebView2.ExecuteScriptAsync("window.__resourceCheck");if(check!="null")break;await Task.Delay(50);}
        var outcome=JsonNode.Parse(check)!;outcome["profileDirectory"]=web.CoreWebView2.Environment.UserDataFolder;
        File.WriteAllText(report,outcome.ToJsonString());
        if(!check.Contains("\"ok\":true"))throw new Exception(check);
        using(var shot=File.Create(smokeBase+".resources.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
    }

    private void OpenPlayerResources()
    {
        if (!playerMode) return;
        var config = JsonNode.Parse(File.ReadAllText(Path.Combine(appDirectory, "game.config.json")));
        bool protectedExport = config?["resourceProtection"]?.GetValue<string>() == "aes-gcm-v1";
        string filename = Path.Combine(appDirectory, GameResourcePackage.FileName);
        if (!protectedExport && !File.Exists(filename)) return; // Previous loose-file games remain playable.
        playerResources = GameResourcePackage.Open(filename);
        if (Directory.Exists(Path.Combine(appDirectory, "game", "assets")))
            throw new InvalidDataException("游戏包混入了旧版明文素材，请使用新导出文件夹中的完整游戏。");
    }

    private void MapProtectedPlayerResources()
    {
        web.CoreWebView2.AddWebResourceRequestedFilter($"https://{ProjectHost}/*", CoreWebView2WebResourceContext.All,
            CoreWebView2WebResourceRequestSourceKinds.All);
        web.CoreWebView2.WebResourceRequested += ServePlayerResource;
    }

    private void ServePlayerResource(object? sender, CoreWebView2WebResourceRequestedEventArgs request)
    {
        if (playerResources == null || !Uri.TryCreate(request.Request.Uri, UriKind.Absolute, out var uri) ||
            uri.Scheme != "https" || uri.Host != ProjectHost) return;
        const string headers = "Cache-Control: no-store, no-cache, max-age=0\r\nPragma: no-cache\r\nExpires: 0\r\n" +
            "Access-Control-Allow-Origin: https://app.galgame\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n" +
            "Access-Control-Allow-Headers: Range\r\nAccess-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges\r\n" +
            "Vary: Origin\r\nX-Content-Type-Options: nosniff\r\n";
        void Respond(int status, string reason, string extra = "", Stream? stream = null)
        {
            if(smokeBase!=null&&Environment.GetCommandLineArgs().Contains("--smoke-resource-package"))
                File.AppendAllText(smokeBase+".requests.jsonl",System.Text.Json.JsonSerializer.Serialize(new{method=request.Request.Method,uri=request.Request.Uri,status,range=request.Request.Headers.Contains("Range")?request.Request.Headers.GetHeader("Range"):"",extra})+"\n");
            request.Response = web.CoreWebView2.Environment.CreateWebResourceResponse(stream, status, reason, headers + extra);
        }
        try
        {
            string origin = request.Request.Headers.Contains("Origin") ? request.Request.Headers.GetHeader("Origin") : "";
            if (origin.Length > 0 && origin != $"https://{AppHost}" && origin != $"https://{ProjectHost}") { Respond(403, "Forbidden"); return; }
            string method = request.Request.Method;
            if (method == "OPTIONS") { Respond(204, "No Content"); return; }
            if (method != "GET" && method != "HEAD") { Respond(405, "Method Not Allowed", "Allow: GET, HEAD, OPTIONS\r\n"); return; }
            string path = GameResourcePackage.NormalizePath(Uri.UnescapeDataString(uri.AbsolutePath[1..]));
            var entry = playerResources.Find(path);
            if (entry == null) { Respond(404, "Not Found"); return; }
            string? rangeHeader = method == "HEAD" || !request.Request.Headers.Contains("Range") ? null : request.Request.Headers.GetHeader("Range");
            var range = GameResourceRequest.ParseRange(rangeHeader, entry.Length);
            if (range == null) { Respond(416, "Range Not Satisfiable", $"Content-Range: bytes */{entry.Length}\r\nContent-Length: 0\r\n"); return; }
            string extra = $"Content-Type: {GameResourceRequest.ContentType(path)}\r\nContent-Length: {range.Count}\r\nAccept-Ranges: bytes\r\n";
            if (range.Partial) extra += $"Content-Range: bytes {range.Start}-{range.Start + range.Count - 1}/{entry.Length}\r\n";
            Stream? stream = method == "HEAD" ? null : playerResources.OpenStream(entry, range.Start, range.Count);
            Respond(range.Partial ? 206 : 200, range.Partial ? "Partial Content" : "OK", extra, stream);
        }
        catch (InvalidDataException) { Respond(400, "Bad Request"); }
        catch (Exception error) when (error is IOException or CryptographicException or ArgumentException)
        { Respond(500, "Resource Unavailable"); }
    }
}
