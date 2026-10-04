
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
    public EnvironmentWindow(string webDirectory, string projectDirectory, JsonObject initial, Func<string, JsonNode?, Task<object?>> handle) {
        this.webDirectory=webDirectory;this.projectDirectory=projectDirectory;this.initial=initial;this.handle=handle;
        Text="3D 环境编辑器";Width=1280;Height=850;MinimumSize=new Size(1000,650);Controls.Add(view);
        Load+=async(_,_)=>{try{await view.EnsureCoreWebView2Async();view.CoreWebView2.SetVirtualHostNameToFolderMapping("app.galgame",webDirectory,CoreWebView2HostResourceAccessKind.DenyCors);view.CoreWebView2.SetVirtualHostNameToFolderMapping("project.galgame",projectDirectory,CoreWebView2HostResourceAccessKind.Allow);view.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith("https://app.galgame/",StringComparison.OrdinalIgnoreCase))e.Cancel=true;};view.CoreWebView2.WebMessageReceived+=OnMessage;view.Source=new Uri("https://app.galgame/environment.html"+(Environment.GetCommandLineArgs().Contains("--smoke-environment")?"?smoke=1":""));}catch(Exception ex){MessageBox.Show(this,ex.Message);Close();}};
        FormClosing+=async(_,e)=>{if(closing||view.CoreWebView2==null)return;e.Cancel=true;bool dirty=await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentHasChanges?.())")=="true";if(dirty&&MessageBox.Show(this,"场景还有未应用的修改，确定放弃并关闭吗？","关闭环境编辑器",MessageBoxButtons.YesNo)!=DialogResult.Yes)return;closing=true;Close();};
    }
    internal void RefreshScenes(JsonNode? payload){view.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new{environmentRefresh=payload}));}
    internal async Task<bool> ConfirmOwnerClose(){
        bool dirty=view.CoreWebView2!=null && await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.environmentHasChanges?.())")=="true";
        if(dirty&&MessageBox.Show(this,"环境还有未应用的修改，确定放弃并关闭编辑器吗？","未保存的场景",MessageBoxButtons.YesNo)!=DialogResult.Yes)return false;
        closing=true;Close();return true;
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
    private async void OnMessage(object? sender,CoreWebView2WebMessageReceivedEventArgs e){
        if(!e.Source.StartsWith("https://app.galgame/",StringComparison.OrdinalIgnoreCase))return;
        string id="";try{var m=JsonNode.Parse(e.WebMessageAsJson)!;id=m["id"]?.GetValue<string>()??"";string action=m["action"]?.GetValue<string>()??"";object? result=action=="init"?initial:await handle(action,m["payload"]);view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,ok=true,data=result}));}catch(Exception ex){view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,ok=false,error=ex.Message}));}
    }
}
internal sealed partial class EditorWindow {
    private EnvironmentWindow? environmentWindow;
    private bool environmentOwnerClosing;
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
            if(action=="import"){string type=data?["type"]?.GetValue<string>()??"";if(type is not ("image" or "sceneModel"))throw new Exception("不支持此素材");return ImportAssets(type);}
            if(action=="commit"){
                if(environmentCommit!=null)throw new Exception("正在保存，请稍后");
                var task=new TaskCompletionSource<JsonNode?>();environmentCommit=task;
                Send(new{environmentCommit=new{session,payload=data}});
                try{return await task.Task.WaitAsync(TimeSpan.FromSeconds(60));}finally{environmentCommit=null;}
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
