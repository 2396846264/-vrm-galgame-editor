using System.Text.Json.Nodes;
namespace VRMGalgame;

internal sealed partial class EditorWindow
{
    private bool editorCloseApproved,editorClosePending;
    private UnsavedCloseChoice? closeSmokeChoice;
    private bool closeSmokeEvaluateOnly;
    private int closePromptCount;

    private async void OnEditorClosing(object? sender,FormClosingEventArgs e)
    {
        if(playerMode||editorCloseApproved||web.CoreWebView2==null)return;
        if(smokeBase!=null&&!closeSmokeEvaluateOnly&&!Environment.GetCommandLineArgs().Contains("--smoke-close-guard"))return;
        e.Cancel=true;if(editorClosePending)return;
        editorClosePending=true;
        try
        {
            if(archiveSaveRunning){ShowCloseError("工程正在保存，请等保存完成后再关闭。");return;}
            await web.CoreWebView2.ExecuteScriptAsync("window.editorClosePending=true");
            var scene=environmentWindow is {IsDisposed:false}?environmentWindow:null;
            var panels=moduleWindows.Values.Where(window=>!window.IsDisposed).ToArray();
            foreach(var panel in panels)await panel.SetClosePendingAsync(true);
            if(scene!=null)await scene.SetClosePendingAsync(true);
            var state=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorCloseState?.() || {dirty:false,busy:false}"))!;
            bool panelBusy=false,panelDirty=false;
            foreach(var panel in panels){panelBusy|=await panel.IsBusyAsync();panelDirty|=await panel.HasChangesAsync();}
            if(state["busy"]?.GetValue<bool>()==true||panelBusy||scene!=null&&await scene.IsBusyForCloseAsync()){
                ShowCloseError("当前操作还没完成，请等操作结束后再关闭。");return;
            }
            bool mainDirty=state["dirty"]?.GetValue<bool>()==true,sceneDirty=scene!=null&&await scene.HasChangesForCloseAsync();
            UnsavedCloseChoice choice=UnsavedCloseChoice.Discard;
            if(mainDirty||sceneDirty||panelDirty){
                using var dialog=new UnsavedCloseDialog(sceneDirty||panelDirty?"工程或其他编辑窗口还有未保存的修改。\n要保存后关闭，还是直接关闭？":"工程还有未保存的修改。\n要保存后关闭，还是直接关闭？");
                closePromptCount++;
                if(closeSmokeChoice is {} injected){
                    var timer=new System.Windows.Forms.Timer{Interval=300};timer.Tick+=(_,_)=>{
                        timer.Stop();if(smokeBase!=null&&!File.Exists(smokeBase+".close-dialog.png")){using var shot=new Bitmap(dialog.Width,dialog.Height);dialog.DrawToBitmap(shot,new Rectangle(0,0,dialog.Width,dialog.Height));shot.Save(smokeBase+".close-dialog.png");}
                        dialog.ChooseForSmoke(injected);timer.Dispose();};dialog.Shown+=(_,_)=>timer.Start();
                }
                dialog.ShowDialog(this);choice=dialog.Choice;
            }
            if(choice==UnsavedCloseChoice.Cancel)return;
            web.Enabled=false;
            if(choice==UnsavedCloseChoice.Save){
                if(sceneDirty)await scene!.SaveForCloseAsync();
                foreach(var panel in panels)if(await panel.HasChangesAsync())await panel.SaveForCloseAsync();
                state=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorCloseState()"))!;
                if(state["dirty"]?.GetValue<bool>()==true)await SaveFrontendForCloseAsync();
                state=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorCloseState()"))!;
                bool remainingPanelChanges=false;foreach(var panel in panels)remainingPanelChanges|=await panel.HasChangesAsync();
                if(state["dirty"]?.GetValue<bool>()==true||remainingPanelChanges||scene!=null&&await scene.HasChangesForCloseAsync())throw new Exception("保存期间又有新修改，请保存后重新关闭。");
            }
            editorCloseApproved=true;
            if(closeSmokeEvaluateOnly)return;
            foreach(var panel in panels)panel.CloseWithoutPrompt();scene?.CloseWithoutPrompt();Close();
        }
        catch(Exception error){ShowCloseError("没有关闭编辑器："+error.Message+"\n修改仍保留在窗口里。");}
        finally
        {
            editorClosePending=false;
            if(!IsDisposed&&!editorCloseApproved){web.Enabled=true;await web.CoreWebView2.ExecuteScriptAsync("window.editorClosePending=false");if(environmentWindow is {IsDisposed:false})await environmentWindow.SetClosePendingAsync(false);foreach(var panel in moduleWindows.Values.ToArray())if(!panel.IsDisposed)await panel.SetClosePendingAsync(false);}
        }
    }
    private void ShowCloseError(string message)
    {
        if(closeSmokeEvaluateOnly){File.AppendAllText(smokeBase+".close-errors.txt",message+"\n");return;}
        MessageBox.Show(this,message,"编辑器尚未关闭",MessageBoxButtons.OK,MessageBoxIcon.Information);
    }
    private async Task SaveFrontendForCloseAsync()
    {
        await web.CoreWebView2.ExecuteScriptAsync("window.__editorCloseSave=null;window.editorSaveBeforeClose().then(result=>window.__editorCloseSave=result).catch(error=>window.__editorCloseSave={error:error.message})");
        for(int i=0;i<6000;i++){
            string json=await web.CoreWebView2.ExecuteScriptAsync("window.__editorCloseSave");
            if(json!="null") {var result=JsonNode.Parse(json)!;if(result["error"]!=null)throw new Exception(result["error"]!.GetValue<string>());if(result["saved"]?.GetValue<bool>()!=true)throw new Exception("工程没有保存完成。");return;}
            await Task.Delay(50);
        }
        throw new TimeoutException("保存尚未完成，请稍后重新关闭。");
    }
    private async Task RunCloseGuardSmoke()
    {
        closeSmokeEvaluateOnly=true;
        async Task<JsonNode> State()=>JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.editorCloseState()"))!;
        async Task Edit(string? text)=>await web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeCloseEdit("+System.Text.Json.JsonSerializer.Serialize(text)+")");
        async Task Request(UnsavedCloseChoice choice){
            closeSmokeChoice=choice;var args=new FormClosingEventArgs(CloseReason.UserClosing,false);OnEditorClosing(this,args);
            if(!args.Cancel)throw new Exception("首次关闭没有拦截。");
            for(int i=0;i<6000&&editorClosePending;i++)await Task.Delay(50);
            if(editorClosePending)throw new Exception("关闭验证超时。");
        }
        async Task Reset(){editorCloseApproved=false;web.Enabled=true;await web.CoreWebView2.ExecuteScriptAsync("window.editorClosePending=false");if(environmentWindow is {IsDisposed:false})await environmentWindow.SetClosePendingAsync(false);}
        void Assert(bool value,string message){if(!value)throw new Exception(message);}
        string DiskText()=>ReadProject()!["acts"]![0]!["steps"]![0]!["text"]!.GetValue<string>();
        await Edit(null);await SaveFrontendForCloseAsync();string original=DiskText();
        await Edit("取消关闭后仍保留的对白");await Request(UnsavedCloseChoice.Cancel);
        Assert(!editorCloseApproved&&(await State())["dirty"]!.GetValue<bool>()&&DiskText()==original,"取消时关闭或丢失修改。");
        await Request(UnsavedCloseChoice.Discard);Assert(editorCloseApproved&&DiskText()==original,"直接关闭写入了未保存修改。");await Reset();
        await web.CoreWebView2.ExecuteScriptAsync("window.__actualCloseSave=window.editorSaveBeforeClose;window.editorSaveBeforeClose=async()=>{throw Error('模拟保存失败')}");
        await Request(UnsavedCloseChoice.Save);Assert(!editorCloseApproved&&(await State())["dirty"]!.GetValue<bool>(),"保存失败仍关闭。");
        await web.CoreWebView2.ExecuteScriptAsync("window.editorSaveBeforeClose=window.__actualCloseSave");
        await Request(UnsavedCloseChoice.Save);Assert(editorCloseApproved&&!(await State())["dirty"]!.GetValue<bool>()&&DiskText()=="取消关闭后仍保留的对白","保存关闭没有持久化。");await Reset();
        int previous=closePromptCount;await Request(UnsavedCloseChoice.Cancel);Assert(editorCloseApproved&&closePromptCount==previous,"已保存工程仍弹提醒。");await Reset();
        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=edit-environment]').click()");
        for(int i=0;i<200&&environmentWindow is not {IsDisposed:false};i++)await Task.Delay(50);
        if(environmentWindow is not {IsDisposed:false})throw new Exception("环境窗口没打开。");
        await environmentWindow.AgentControl(new JsonObject{["command"]="read"});await environmentWindow.AgentEditSmoke();
        Assert(await environmentWindow.HasChangesForCloseAsync(),"场景验证没有产生修改。");
        await Edit("主窗口和环境一起保存");await Request(UnsavedCloseChoice.Cancel);
        Assert(!editorCloseApproved&&await environmentWindow.HasChangesForCloseAsync(),"取消丢失环境修改。");
        await Request(UnsavedCloseChoice.Save);
        Assert(editorCloseApproved&&!(await environmentWindow.HasChangesForCloseAsync())&&DiskText()=="主窗口和环境一起保存","两个窗口未一起保存。");
        File.WriteAllText(smokeBase+".close-check.json",System.Text.Json.JsonSerializer.Serialize(new{ok=true,cancelPreservesEdits=true,discardDoesNotSave=true,savePersists=true,saveFailureKeepsOpen=true,cleanClosesDirectly=true,bothWindowsSaved=true,prompts=closePromptCount}));
        environmentWindow.CloseWithoutPrompt();editorCloseApproved=true;
    }
}
