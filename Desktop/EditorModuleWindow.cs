using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
namespace VRMGalgame;
internal sealed class EditorModuleWindow : Form
{
    private readonly WebView2 view=new(){Dock=DockStyle.Fill};
    private readonly Func<string,JsonNode?,Task<object?>> handle;
    private readonly object initial;
    private bool closing,checking;
    internal string Module {get;}
    internal EditorModuleWindow(string module,string label,string webDirectory,string projectDirectory,object initial,Func<string,JsonNode?,Task<object?>> handle){
        Module=module;this.initial=initial;this.handle=handle;Text=label+"编辑器";Width=1440;Height=900;MinimumSize=new Size(1050,650);Controls.Add(view);
        Activated+=(_,_)=>view.CoreWebView2?.PostWebMessageAsJson("{\"modulePreviewActive\":true}");
        Deactivate+=(_,_)=>view.CoreWebView2?.PostWebMessageAsJson("{\"modulePreviewActive\":false}");
        Load+=async(_,_)=>{try{await view.EnsureCoreWebView2Async();view.CoreWebView2.SetVirtualHostNameToFolderMapping("app.galgame",webDirectory,CoreWebView2HostResourceAccessKind.DenyCors);view.CoreWebView2.SetVirtualHostNameToFolderMapping("project.galgame",projectDirectory,CoreWebView2HostResourceAccessKind.Allow);view.CoreWebView2.Settings.IsStatusBarEnabled=false;view.CoreWebView2.WebMessageReceived+=Message;
            view.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith("https://app.galgame/",StringComparison.OrdinalIgnoreCase))e.Cancel=true;};
            view.Source=new Uri("https://app.galgame/index.html?module="+Uri.EscapeDataString(module)+(Environment.GetCommandLineArgs().Contains("--smoke-editor-modules")?"&smoke=1":""));
        }catch(Exception error){MessageBox.Show(this,error.Message,"窗口无法打开");closing=true;Close();}};
        FormClosing+=async(_,e)=>{if(closing||view.CoreWebView2==null)return;e.Cancel=true;if(checking)return;checking=true;
            try{await SetClosePendingAsync(true);if(await IsBusyAsync()){MessageBox.Show(this,"当前操作或保存还没完成，请稍后关闭。");return;}
                if(await HasChangesAsync()){using var dialog=new UnsavedCloseDialog("本窗口的修改还没应用到工程。\n要保存后关闭，还是直接关闭？");dialog.ShowDialog(this);if(dialog.Choice==UnsavedCloseChoice.Cancel)return;if(dialog.Choice==UnsavedCloseChoice.Save)await SaveForCloseAsync();else await handle("discardModule",null);}
                CloseWithoutPrompt();
            }catch(Exception error){MessageBox.Show(this,"没有关闭窗口："+error.Message+"\n修改仍保留在本窗口里。","保存未完成");}
            finally{checking=false;if(!IsDisposed&&!closing)await SetClosePendingAsync(false);}
        };
    }
    private async void Message(object? sender,CoreWebView2WebMessageReceivedEventArgs e){
        if(!e.Source.StartsWith("https://app.galgame/",StringComparison.OrdinalIgnoreCase))return;string id="";
        try{var message=JsonNode.Parse(e.WebMessageAsJson)!;id=message["id"]?.GetValue<string>()??"";string action=message["action"]!.GetValue<string>();
            object? data=action=="init"?initial:await handle(action,message["payload"]);
            view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,ok=true,data}));
        }catch(Exception error){view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new{id,ok=false,error=error.Message}));}
    }
    internal async Task<bool> HasChangesAsync()=>view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.editorCloseState?.().dirty)")=="true";
    internal void SetProjectSaving(bool saving)=>view.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new{projectSaving=saving}));
    internal async Task<bool> IsBusyAsync()=>view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.editorCloseState?.().busy)")=="true";
    internal async Task SetClosePendingAsync(bool value){view.Enabled=!value;if(view.CoreWebView2!=null)await view.CoreWebView2.ExecuteScriptAsync("window.editorClosePending="+(value?"true":"false"));}
    internal async Task SaveForCloseAsync(){
        await view.CoreWebView2.ExecuteScriptAsync("window.__moduleSave=null;window.editorSaveBeforeClose().then(result=>window.__moduleSave=result).catch(error=>window.__moduleSave={error:error.message})");
        for(int i=0;i<6000;i++){var result=await view.CoreWebView2.ExecuteScriptAsync("window.__moduleSave");if(result!="null"){var data=JsonNode.Parse(result)!;if(data["error"]!=null)throw new Exception(data["error"]!.GetValue<string>());if(data["saved"]?.GetValue<bool>()!=true)throw new Exception("修改还没保存完成。");return;}await Task.Delay(50);}throw new TimeoutException("保存尚未完成，请稍后重试。");
    }
    internal void CloseWithoutPrompt(){closing=true;Close();}
    internal void RefreshProject(JsonNode? project){view.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new{editorModuleRefresh=project}));}
    internal async Task<string> Smoke(string script,string imagePath){
        for(int i=0;i<400;i++){if(view.CoreWebView2!=null&&await view.CoreWebView2.ExecuteScriptAsync("Boolean(window.editorCloseState?.().hasProject)")=="true")break;await Task.Delay(50);}
        await view.CoreWebView2!.ExecuteScriptAsync("window.__moduleCheck=null;(async()=>{"+script+"})().then(result=>window.__moduleCheck=result).catch(error=>window.__moduleCheck={error:error.message})");
        string result="null";for(int i=0;i<2400;i++){result=await view.CoreWebView2.ExecuteScriptAsync("window.__moduleCheck");if(result!="null")break;await Task.Delay(50);}
        using(var shot=File.Create(imagePath))await view.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);return result;
    }
}
internal sealed partial class EditorWindow
{
    private readonly Dictionary<string,EditorModuleWindow> moduleWindows=new();
    private readonly Dictionary<string,TaskCompletionSource<JsonNode?>> moduleCommits=new();
    private async Task<JsonNode?> CommitEditorModule(string module,JsonNode? payload){
        if(payload?["project"]?["id"]?.GetValue<string>()!=ReadProject()?["id"]?.GetValue<string>())throw new Exception("工程已切换，请重新打开这个窗口。");
        string id=Guid.NewGuid().ToString("N");var task=new TaskCompletionSource<JsonNode?>(TaskCreationOptions.RunContinuationsAsynchronously);moduleCommits[id]=task;
        Send(new{editorModuleCommit=new{id,module,payload}});
        try{return await task.Task.WaitAsync(TimeSpan.FromSeconds(300));}finally{moduleCommits.Remove(id);}
    }
    private object EditorModuleCommitReply(JsonNode? data){
        if(moduleCommits.TryGetValue(data?["id"]?.GetValue<string>()??"",out var task)){
            if(data?["ok"]?.GetValue<bool>()==true)task.TrySetResult(data?["data"]?.DeepClone());else task.TrySetException(new Exception(data?["error"]?.GetValue<string>()??"窗口修改没有保存。"));
        }return new{received=true};
    }
    private object NotifyEditorModules(JsonNode? payload){foreach(var window in moduleWindows.Values.ToArray())if(!window.IsDisposed)window.RefreshProject(payload);return new{notified=moduleWindows.Count};}
    private object OpenEditorModule(JsonNode? payload){
        string module=payload?["module"]?.GetValue<string>()??"";
        var labels=new Dictionary<string,string>{{"characters","角色"},{"items","物品"},{"title","标题"},{"render","渲染"},{"knowledge","知识库"}};
        if(!labels.TryGetValue(module,out var label)||projectDirectory==null)throw new Exception("请先打开工程。");
        if(moduleWindows.TryGetValue(module,out var active)&&!active.IsDisposed){active.Activate();return new{opened=true,reused=true};}
        string directory=projectDirectory;var initial=JsonSerializer.SerializeToNode(GetProjectInfo())!.AsObject();
        initial["project"]=payload!["project"]!.DeepClone();initial["editorModule"]=module;initial["agent"]=null;
        initial["moduleRevision"]=payload["revision"]?.DeepClone();
        initial["moduleView"]=payload["view"]?.DeepClone();
        EditorModuleWindow? child=null;
        child=new(module,label,Path.Combine(appDirectory,"web"),directory,initial,async(action,data)=>{
            if(directory!=projectDirectory)throw new Exception("工程已切换，请关闭本窗口后重新打开。");
            if(archiveSaveRunning&&action!="discardModule")throw new Exception("工程正在保存，请稍后重试。");
            if(action=="saveModule")return await CommitEditorModule(module,data);
            if(action=="discardModule"){
                var snapshot=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorProjectSnapshot()"));return RestoreHistoryAssets(snapshot);
            }
            if(action=="deleteAsset")return new{deferred=true};
            if(action=="openEditorModule")return OpenEditorModule(data);
            if(action=="openEnvironment"){
                var latest=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorEnvironmentFromModule("+data!.ToJsonString()+")"));return OpenEnvironment(latest);
            }
            if(action is not ("importAsset" or "importAssetChunk" or "saveInventoryImage" or "saveGeneratedPortrait" or "organizeGeneratedPortrait" or "restoreHistoryAssets" or "organizeDialogueVoices" or "pickStoryDocuments" or "agentReadDocument" or "importDialogueVoice"))throw new Exception("这个操作请在主窗口执行。");
            return await HandleEditorAction(action,data);
        });
        if(Icon is {} parentIcon)child.Icon=(System.Drawing.Icon)parentIcon.Clone();moduleWindows[module]=child;child.FormClosed+=(_,_)=>{if(moduleWindows.GetValueOrDefault(module)==child)moduleWindows.Remove(module);};child.Show(this);
        return new{opened=true,reused=false};
    }
}
