
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
namespace VRMGalgame;
internal sealed class EnvironmentWindow : Form {
    private readonly WebView2 view = new() { Dock = DockStyle.Fill };
    private readonly JsonObject initial;
    private readonly Func<string, JsonNode?, Task<object?>> handle;
    private readonly string webDirectory, projectDirectory;
    private bool closing;
    private bool closePending;
    private readonly Dictionary<string,TaskCompletionSource<JsonNode?>> agentControlReplies=new();
    public EnvironmentWindow(string webDirectory, string projectDirectory, JsonObject initial, Func<string, JsonNode?, Task<object?>> handle) {
        this.webDirectory=webDirectory;this.projectDirectory=projectDirectory;this.initial=initial;this.handle=handle;
        FormClosed+=(_,_)=>{foreach(var task in agentControlReplies.Values)task.TrySetException(new Exception("环境窗口已关闭。"));agentControlReplies.Clear();};
        Text="3D 环境编辑器";Width=1280;Height=850;MinimumSize=new Size(1000,650);Controls.Add(view);
        Load+=async(_,_)=>{try{await view.EnsureCoreWebView2Async();view.CoreWebView2.SetVirtualHostNameToFolderMapping("app.galgame",webDirectory,CoreWebView2HostResourceAccessKind.DenyCors);view.CoreWebView2.SetVirtualHostNameToFolderMapping("project.galgame",projectDirectory,CoreWebView2HostResourceAccessKind.Allow);view.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith("https://app.galgame/",StringComparison.OrdinalIgnoreCase))e.Cancel=true;};view.CoreWebView2.WebMessageReceived+=OnMessage;view.Source=new Uri("https://app.galgame/environment.html"+(Environment.GetCommandLineArgs().Any(a=>a is "--smoke-environment" or "--smoke-render-regression" or "--smoke-agent-environment" or "--smoke-close-guard")?"?smoke=1":""));}catch(Exception ex){MessageBox.Show(this,ex.Message);Close();}};
        FormClosing+=async(_,e)=>{
            if(closing||view.CoreWebView2==null)return;e.Cancel=true;if(closePending)return;closePending=true;
            try{
                await SetClosePendingAsync(true);
                if(await IsBusyForCloseAsync()){MessageBox.Show(this,"当前场景操作或保存还没完成，请稍后关闭。","正在操作");return;}
                if(await HasChangesForCloseAsync()){
                    using var dialog=new UnsavedCloseDialog("环境还有未保存的修改。\n要保存后关闭，还是直接关闭？");dialog.ShowDialog(this);
                    if(dialog.Choice==UnsavedCloseChoice.Cancel)return;
                    if(dialog.Choice==UnsavedCloseChoice.Save)await SaveForCloseAsync();
                }
                CloseWithoutPrompt();
            }catch(Exception error){MessageBox.Show(this,"没有关闭环境编辑器："+error.Message+"\n修改仍保留在窗口里。","保存未完成");}
            finally{closePending=false;if(!IsDisposed&&!closing)await SetClosePendingAsync(false);}
        };
    }
    internal void RefreshScenes(JsonNode? payload){view.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new{environmentRefresh=payload}));}
    internal async Task CaptureReadySmoke(string path){
        for(int i=0;i<400;i++){if(view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentReady?.())")=="true")break;await Task.Delay(50);}
        await Task.Delay(250);using var image=File.Create(path);await view.CoreWebView2!.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
    }
    internal async Task<JsonNode?> AgentControl(JsonNode? payload){
        for(int i=0;i<200;i++){
            if(IsDisposed)throw new Exception("环境窗口已关闭，请重新打开。");
            if(view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentAgentReady?.())")=="true")break;
            if(i==199)throw new Exception("环境窗口尚未就绪，请稍候重试。");await Task.Delay(50);
        }
        string id=Guid.NewGuid().ToString("N"),command=payload?["command"]?.GetValue<string>()??"";
        var task=new TaskCompletionSource<JsonNode?>(TaskCreationOptions.RunContinuationsAsynchronously);agentControlReplies[id]=task;
        try{
            view.CoreWebView2!.PostWebMessageAsJson(JsonSerializer.Serialize(new{environmentAgentRequest=new{id,command,payload}}));
            var result=await task.Task.WaitAsync(TimeSpan.FromSeconds(180));
            if(command=="capture"){
                using var image=new MemoryStream();await view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
                result??=new JsonObject();result["image"]=new JsonObject{["mimeType"]="image/png",["data"]=Convert.ToBase64String(image.ToArray())};
            }
            return result;
        }finally{agentControlReplies.Remove(id);}
    }
    private object AgentControlReply(JsonNode? payload){
        if(agentControlReplies.TryGetValue(payload?["id"]?.GetValue<string>()??"",out var reply)){
            if(payload?["ok"]?.GetValue<bool>()==true)reply.TrySetResult(payload?["data"]?.DeepClone());else reply.TrySetException(new Exception(payload?["error"]?.GetValue<string>()??"环境操作失败"));
        }
        return new{received=true};
    }
    internal async Task<string> AgentEditSmoke(){
        await view.CoreWebView2!.ExecuteScriptAsync("window.__agentEdit=null;window.environmentAgentEditSmoke().then(v=>window.__agentEdit=v).catch(e=>window.__agentEdit={error:e.message})");
        for(int i=0;i<200;i++){string result=await view.CoreWebView2.ExecuteScriptAsync("window.__agentEdit");if(result!="null")return result;await Task.Delay(50);}throw new Exception("环境编辑验证超时");
    }
    internal async Task<bool> HasChangesForCloseAsync()=>view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentCloseState?.().dirty)")=="true";
    internal async Task<bool> IsBusyForCloseAsync()=>view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentCloseState?.().busy || window.environmentSaving?.())")=="true";
    internal async Task SetClosePendingAsync(bool pending){view.Enabled=!pending;if(view.CoreWebView2!=null)await view.CoreWebView2.ExecuteScriptAsync("window.environmentClosePending="+(pending?"true":"false"));}
    internal void CloseWithoutPrompt(){closing=true;Close();}
    internal async Task SaveForCloseAsync(){
        if(view.CoreWebView2==null)throw new Exception("环境窗口尚未就绪。");
        await view.CoreWebView2.ExecuteScriptAsync("window.__environmentCloseSave=null;window.environmentSaveBeforeClose().then(result=>window.__environmentCloseSave=result).catch(error=>window.__environmentCloseSave={error:error.message})");
        for(int i=0;i<6000;i++){
            string json=await view.CoreWebView2.ExecuteScriptAsync("window.__environmentCloseSave");
            if(json!="null"){var result=JsonNode.Parse(json)!;if(result["error"]!=null)throw new Exception(result["error"]!.GetValue<string>());if(result["saved"]?.GetValue<bool>()!=true)throw new Exception("环境没有保存完成。");return;}
            await Task.Delay(50);
        }
        throw new TimeoutException("环境保存尚未完成，请稍后关闭。");
    }
    internal async Task<string> Smoke(string imagePath){
        for(int i=0;i<100;i++){if(view.CoreWebView2!=null && await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentReady?.())")=="true")break;await Task.Delay(100);}
        await view.CoreWebView2.ExecuteScriptAsync("window.__envSmokeResult=null;window.environmentSmoke().then(r=>window.__envSmokeResult=r).catch(e=>window.__envSmokeResult={error:e.message})");
        string result="null";for(int i=0;i<200;i++){result=await view.CoreWebView2!.ExecuteScriptAsync("window.__envSmokeResult");if(result!="null")break;await Task.Delay(100);}
        using(var image=File.Create(imagePath))await view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
        await view.CoreWebView2.ExecuteScriptAsync("window.environmentOpenPicker?.()");
        using(var pickerImage=File.Create(Path.ChangeExtension(imagePath,"picker.png")))await view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,pickerImage);
        await view.CoreWebView2.ExecuteScriptAsync("window.environmentClosePicker?.()");
        return result;
    }
    internal async Task<string> AutosaveSmoke(string phase,string imagePath){
        for(int i=0;i<200;i++){if(view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentReady?.())")=="true")break;await Task.Delay(100);}
        await view.CoreWebView2!.ExecuteScriptAsync("window.__autoCheck=null;window.environmentAutosaveSmoke("+JsonSerializer.Serialize(phase)+").then(r=>window.__autoCheck=r).catch(e=>window.__autoCheck={error:e.message})");
        string result="null";for(int i=0;i<1200;i++){result=await view.CoreWebView2.ExecuteScriptAsync("window.__autoCheck");if(result!="null")break;await Task.Delay(50);}
        using(var image=File.Create(imagePath))await view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);return result;
    }
    private async void OnMessage(object? sender,CoreWebView2WebMessageReceivedEventArgs e){
        if(!e.Source.StartsWith("https://app.galgame/",StringComparison.OrdinalIgnoreCase))return;
        string id="";try{var m=JsonNode.Parse(e.WebMessageAsJson)!;id=m["id"]?.GetValue<string>()??"";string action=m["action"]?.GetValue<string>()??"";object? result=action=="init"?initial:action=="environmentAgentReply"?AgentControlReply(m["payload"]):await handle(action,m["payload"]);view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,ok=true,data=result}));}catch(Exception ex){view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,ok=false,error=ex.Message}));}
    }
}
internal sealed partial class EditorWindow {
    private async Task<JsonNode?> AgentEnvironmentControl(JsonNode? payload){
        string command=payload?["command"]?.GetValue<string>()??"";
        if(!new[]{"read","lock","release","refresh","sync","capture"}.Contains(command))throw new Exception("未知环境窗口操作。");
        if(environmentWindow is not {IsDisposed:false}){
            if(command=="capture")throw new Exception("请先打开环境窗口。");
            return new JsonObject{["opened"]=false};
        }
        return await environmentWindow.AgentControl(payload);
    }
    private EnvironmentWindow? environmentWindow;
    private string environmentSession="";
    private string openEnvironmentId="";
    private TaskCompletionSource<JsonNode?>? environmentCommit;
    private object OpenEnvironment(JsonNode? payload){
        if(projectDirectory==null)throw new Exception("请先打开工程");
        if(environmentWindow is {IsDisposed:false}){environmentWindow.Activate();environmentWindow.RefreshScenes(payload);return new{opened=true,created=false};}
        var initial=payload?.DeepClone() as JsonObject??throw new Exception("场景数据无效");
        openEnvironmentId=initial["environment"]?["id"]?.GetValue<string>()??"";
        string session=Guid.NewGuid().ToString("N");environmentSession=session;string directory=projectDirectory;
        var appDirectory=AppContext.BaseDirectory;var webDirectory=Path.Combine(appDirectory,"web");
        environmentWindow=new EnvironmentWindow(webDirectory,directory,initial,async(action,data)=>{
            if(environmentSession!=session||projectDirectory!=directory)throw new Exception("工程已切换，请关闭窗口后重新打开");
            if(action=="import"){if(archiveSaveRunning)throw new Exception("工程正在保存，请稍候。");string type=data?["type"]?.GetValue<string>()??"";if(type is not ("image" or "sceneModel"))throw new Exception("不支持此素材");return ImportAssets(type);}
            if(action=="commit"){
                if(environmentCommit!=null)throw new Exception("正在保存，请稍后");
                var task=new TaskCompletionSource<JsonNode?>();environmentCommit=task;
                Send(new{environmentCommit=new{session,payload=data}});
                try{return await task.Task.WaitAsync(TimeSpan.FromSeconds(180));}finally{environmentCommit=null;}
            }
            throw new Exception("当前操作不可用");
        });environmentWindow.Show(this);return new{opened=true,created=true};
    }
    private static void ValidateStandaloneGlb(string file){
        using var stream=File.OpenRead(file);using var reader=new BinaryReader(stream);
        if(stream.Length<20||reader.ReadUInt32()!=0x46546c67||reader.ReadUInt32()!=2||reader.ReadUInt32()!=stream.Length)throw new Exception("不是有效的 GLB 2.0 文件");
        uint jsonLength=reader.ReadUInt32();if(reader.ReadUInt32()!=0x4e4f534a||jsonLength>32*1024*1024||jsonLength>stream.Length-20)throw new Exception("GLB 内容无效或太大");
        var json=JsonNode.Parse(System.Text.Encoding.UTF8.GetString(reader.ReadBytes((int)jsonLength)).TrimEnd('\0',' '))!;
        foreach(var key in new[]{"buffers","images"})foreach(var item in json[key]?.AsArray()??new JsonArray()){string uri=item?["uri"]?.GetValue<string>()??"";if(uri.Length>0&&!uri.StartsWith("data:",StringComparison.OrdinalIgnoreCase))throw new Exception("第一版请导入贴图内嵌的 GLB，当前文件还引用外部资源");}
    }
    private object EnvironmentCommitReply(JsonNode? payload){if(payload?["session"]?.GetValue<string>()!=environmentSession)throw new Exception("场景会话已失效");if(payload?["ok"]?.GetValue<bool>()==true)environmentCommit?.TrySetResult(payload?["data"]?.DeepClone());else environmentCommit?.TrySetException(new Exception(payload?["error"]?.GetValue<string>()??"保存失败"));return new{received=true};}
}
