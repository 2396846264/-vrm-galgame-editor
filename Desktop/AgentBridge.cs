using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Xml;
using System.Xml.Linq;
using System.Security.Cryptography;

namespace VRMGalgame;
internal sealed partial class EditorWindow
{
    private CancellationTokenSource? agentCancellation;
    private NamedPipeServerStream? agentPipe;
    private string? agentSessionFile;
    private readonly Dictionary<string, TaskCompletionSource<JsonNode?>> agentReplies = new();
    private static readonly HashSet<string> AgentOperations = ["get_project","get_act","get_source","read_document","import_assets","set_asset_tags","propose_draft","apply_draft","undo","redo","save","preview","export_game","get_environments","get_environment","inspect_scene_asset","create_environment","edit_environment","set_environment_reference","open_environment","capture_environment","sync_environment_editor"];

    private JsonNode? GetAgentConnection()
    {
        if(agentSessionFile==null||!File.Exists(agentSessionFile))return null;
        var info=JsonNode.Parse(File.ReadAllText(agentSessionFile));
        if(info is JsonObject o)o["enabled"]=true;
        return info;
    }

    private object SetAgentEnabled(bool enabled)
    {
        StopAgentBridge();
        if (!enabled) return new {enabled=false};
        string command=Path.Combine(appDirectory,"VRMGalgame.Agent.exe");
        if (!File.Exists(command)) throw new Exception("缺少 Agent 程序，请重新解压完整安装包。");
        string sessionId=Guid.NewGuid().ToString("N"), pipeName="vrm-galgame-"+sessionId;
        string sessions=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"VRMGalgame","AgentSessions");
        Directory.CreateDirectory(sessions);
        agentSessionFile=Path.Combine(sessions,sessionId+".json");
        var metadata=new {sessionId,pipeName,command,pid=Environment.ProcessId,started=DateTimeOffset.UtcNow};
        File.WriteAllText(agentSessionFile,JsonSerializer.Serialize(metadata));
        agentCancellation=new CancellationTokenSource();
        _=RunAgentPipeAsync(pipeName,agentCancellation.Token);
        return new {enabled=true,sessionId,command,pid=Environment.ProcessId};
    }
    private void StopAgentBridge()
    {
        agentCancellation?.Cancel();agentPipe?.Dispose();agentPipe=null;
        agentCancellation?.Dispose();agentCancellation=null;
        foreach(var waiting in agentReplies.Values) waiting.TrySetException(new Exception("Agent 接口已经断开。"));
        agentReplies.Clear();
        if(agentSessionFile!=null) {try{File.Delete(agentSessionFile);}catch(IOException){}agentSessionFile=null;}
    }
    private async Task RunAgentPipeAsync(string name,CancellationToken token)
    {
        // One operation at a time, and only clients running as this Windows user.
        while(!token.IsCancellationRequested)
        {
            NamedPipeServerStream? current=null;
            try
            {
                using var pipe=new NamedPipeServerStream(name,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly);
                agentPipe=pipe;
                current=pipe;
                await pipe.WaitForConnectionAsync(token);
                using var reader=new StreamReader(pipe,new UTF8Encoding(false),false,4096,true);
                using var writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true){AutoFlush=true};
                string? line=await reader.ReadLineAsync(token);
                if(line==null)continue;
                JsonNode? result;
                try
                {
                    if(line.Length>24*1024*1024)throw new Exception("请求太大，请分批编排。");
                    var request=JsonNode.Parse(line) ?? throw new Exception("请求为空。");
                    string operation=request["name"]?.GetValue<string>() ?? "";
                    if(!AgentOperations.Contains(operation))throw new Exception("该操作没有开放给 Agent。");
                    if(token.IsCancellationRequested)throw new OperationCanceledException();
                    result=await InvokeAgentFrontend(operation,request["arguments"] ?? new JsonObject(),token);
                    await writer.WriteLineAsync(JsonSerializer.Serialize(new {ok=true,data=result}));
                }
                catch(Exception ex){await writer.WriteLineAsync(JsonSerializer.Serialize(new {ok=false,error=ex.Message}));}
            }
            catch(OperationCanceledException){break;}
            catch(ObjectDisposedException){break;}
            catch(IOException){if(token.IsCancellationRequested)break;}
            finally {if(ReferenceEquals(agentPipe,current))agentPipe=null;}
        }
    }
    private async Task<JsonNode?> InvokeAgentFrontend(string name,JsonNode args,CancellationToken token)
    {
        string id=Guid.NewGuid().ToString("N");
        var reply=new TaskCompletionSource<JsonNode?>(TaskCreationOptions.RunContinuationsAsynchronously);
        // This loop starts on the form thread; WebView messages and replies share it.
        agentReplies[id]=reply;
        try
        {
            Send(new {agentRequest=new {id,name,arguments=args}});
            return await reply.Task.WaitAsync(TimeSpan.FromMinutes(2),token);
        }
        finally {agentReplies.Remove(id);}
    }
    private object ReceiveAgentReply(JsonNode? payload)
    {
        string id=payload?["id"]?.GetValue<string>() ?? "";
        if(agentReplies.TryGetValue(id,out var waiting))
        {
            if(payload?["ok"]?.GetValue<bool>()==true)waiting.TrySetResult(payload["data"]?.DeepClone());
            else waiting.TrySetException(new Exception(payload?["error"]?.GetValue<string>() ?? "编辑器操作失败。"));
        }
        return new {received=true};
    }
    private object? PickStoryDocuments()
    {
        using var dialog=new OpenFileDialog{Title="导入小说、剧本或大纲",Filter="故事文本|*.txt;*.md;*.docx",Multiselect=true};
        if(dialog.ShowDialog(this)!=DialogResult.OK)return null;
        return dialog.FileNames.Select(ReadStoryDocument).ToArray();
    }
    private static object ReadStoryDocument(string path)
    {
        path=Path.GetFullPath(path);var file=new FileInfo(path);
        if(!file.Exists||file.Length>64*1024*1024)throw new Exception("故事文件不存在或超过 64 MB。");
        string extension=file.Extension.ToLowerInvariant(),text;
        if(extension==".docx")
        {
            using var archive=System.IO.Compression.ZipFile.OpenRead(path);
            var entry=archive.GetEntry("word/document.xml") ?? throw new Exception("这不是有效的 Word 文档。");
            if(entry.Length>32*1024*1024)throw new Exception("Word 正文太大，请按章节拆分。");
            using var stream=entry.Open();using var reader=XmlReader.Create(stream,new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null,MaxCharactersInDocument=32*1024*1024});
            XNamespace ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
            var xml=XDocument.Load(reader);
            text=string.Join("\n",xml.Descendants(ns+"p").Select(p=>string.Concat(p.Descendants().Select(n=>n.Name==ns+"t"?n.Value:n.Name==ns+"tab"?"\t":n.Name==ns+"br"?"\n":""))));
        }
        else if(extension is ".txt" or ".md")
        {
            byte[] bytes=File.ReadAllBytes(path);
            if(bytes.Length>=2&&(bytes[0]==0xff&&bytes[1]==0xfe||bytes[0]==0xfe&&bytes[1]==0xff))
            {using var r=new StreamReader(new MemoryStream(bytes),Encoding.UTF8,true);text=r.ReadToEnd();}
            else
            {
                try{text=new UTF8Encoding(false,true).GetString(bytes).TrimStart('\ufeff');}
                catch(DecoderFallbackException){Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);text=Encoding.GetEncoding("GB18030",EncoderFallback.ExceptionFallback,DecoderFallback.ExceptionFallback).GetString(bytes);}
            }
        }
        else throw new Exception("故事文本支持 TXT、Markdown、DOCX；其他格式请先导出为文本。");
        if(string.IsNullOrWhiteSpace(text))throw new Exception("文档没有可读取的正文。");
        if(text.Length>2000000)throw new Exception("单个故事超过 200 万字，请按章节拆分。");
        return new {name=file.Name,text};
    }
    private object? PickDraftPlan()
    {
        using var dialog=new OpenFileDialog{Title="导入 Agent 编排的粗稿",Filter="粗稿 JSON|*.json"};
        if(dialog.ShowDialog(this)!=DialogResult.OK)return null;
        if(new FileInfo(dialog.FileName).Length>16*1024*1024)throw new Exception("粗稿文件太大，请分批生成。");
        return JsonNode.Parse(File.ReadAllText(dialog.FileName)) ?? throw new Exception("粗稿为空。");
    }
    private object? PickDraftAssets()
    {
        using var dialog=new OpenFileDialog{Title="批量导入素材（配音请在对白上传）",Filter="模型、背景、动作、音乐、视频|*.vrm;*.vrma;*.fbx;*.glb;*.png;*.jpg;*.jpeg;*.webp;*.mp3;*.wav;*.ogg;*.mp4;*.webm",Multiselect=true};
        return dialog.ShowDialog(this)==DialogResult.OK?ImportDraftAssets(dialog.FileNames):null;
    }
    private object ImportDraftAssets(string[] paths)
    {
        if(projectDirectory==null)throw new Exception("请先打开工程。");
        if(paths.Length is <1 or >500)throw new Exception("一次需要导入 1～500 个素材。");
        var types=new Dictionary<string,string>{[".vrm"]="vrm",[".vrma"]="motion",[".fbx"]="motion",[".glb"]="sceneModel",[".png"]="image",[".jpg"]="image",[".jpeg"]="image",[".webp"]="image",[".mp3"]="audio",[".wav"]="audio",[".ogg"]="audio",[".mp4"]="video",[".webm"]="video"};
        var files=paths.Select(p=>new FileInfo(Path.GetFullPath(p))).ToArray();
        foreach(var f in files)if(!f.Exists||!types.ContainsKey(f.Extension.ToLowerInvariant())||f.Length>2L*1024*1024*1024)throw new Exception($"素材不支持、找不到或超过 2 GB：{f.Name}");
        foreach(var f in files.Where(f=>f.Extension.Equals(".glb",StringComparison.OrdinalIgnoreCase)))ValidateStandaloneGlb(f.FullName);
        var copied=new List<string>();var results=new List<object>();
        try
        {
            foreach(var f in files)
            {
                string extension=f.Extension.ToLowerInvariant(),type=types[extension],id=Guid.NewGuid().ToString("N");
                string relative=$"assets/{type}/{id}{extension}",target=Path.Combine(projectDirectory,relative.Replace('/',Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);copied.Add(target);File.Copy(f.FullName,target);
                results.Add(new {id,type,name=f.Name,path=relative,tags=Array.Empty<string>()});
            }
        }
        catch{foreach(var f in copied)if(File.Exists(f))File.Delete(f);throw;}
        return results;
    }
    private object ExportAgentGame(JsonNode? payload)
    {
        if(projectDirectory==null||payload?["project"] is not JsonObject p)throw new Exception("请先打开工程。");
        string destination=Path.GetFullPath(payload["directory"]?.GetValue<string>() ?? "");
        if(destination.StartsWith(Path.GetFullPath(projectDirectory)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("导出位置不能放在工程文件夹里面。");
        if(Directory.Exists(destination)||File.Exists(destination))throw new Exception("导出位置已经存在，请指定一个新的文件夹。");
        BuildGame(destination,p);
        return new {directory=destination};
    }
}
