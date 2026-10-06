using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
    private async Task RunEditorModulesSmoke(){
        if(playerMode)throw new Exception("窗口检查只能在编辑器中进行。");
        async Task<string> Main(string phase){await web.CoreWebView2.ExecuteScriptAsync("window.__workspaceCheck=null;window.__vrmSmokeWorkspace("+JsonSerializer.Serialize(phase)+").then(result=>window.__workspaceCheck=result).catch(error=>window.__workspaceCheck={error:error.message})");string value="null";for(int i=0;i<2400;i++){value=await web.CoreWebView2.ExecuteScriptAsync("window.__workspaceCheck");if(value!="null")break;await Task.Delay(50);}if(!value.Contains("\"ok\":true"))throw new Exception(value);return value;}
        File.WriteAllText(smokeBase+".layout.json",await Main("layout"));
        await Task.Delay(400);using(var shot=File.Create(smokeBase+".layout.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
        foreach(string module in new[]{"characters","items","title","render","knowledge"}){
            await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=open-module][data-module="+module+"]').click()");
            for(int i=0;i<200&&!moduleWindows.ContainsKey(module);i++)await Task.Delay(50);
            var child=moduleWindows[module];await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=open-module][data-module="+module+"]').click()");await Task.Delay(100);
            if(moduleWindows[module]!=child)throw new Exception("重复点击建立了重复窗口。");
            if(module=="characters")await Main("concurrent");
            string result=await child.Smoke("const changed=await window.__vrmSmokeModuleChange();await window.editorSaveBeforeClose();if(changed.module==='characters'){await window.__vrmSmokeModuleChange(true);await window.__vrmSmokeModuleUndoRedo();await window.editorSaveBeforeClose();}return {...changed,ok:true,saved:true};",smokeBase+"."+module+".png");
            if(!result.Contains("\"ok\":true"))throw new Exception(result);File.WriteAllText(smokeBase+"."+module+".json",result);child.CloseWithoutPrompt();
        }
        File.WriteAllText(smokeBase+".modules.json",await Main("verify"));
        if(ReadProject()?["characters"]?[0]?["name"]?.GetValue<string>()!="独立角色窗口连续保存")throw new Exception("窗口修改没有写进工程。");
        await web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeOpenModule('characters')");for(int i=0;i<200&&!moduleWindows.ContainsKey("characters");i++)await Task.Delay(50);
        var unsaved=moduleWindows["characters"];await unsaved.Smoke("return window.__vrmSmokeModuleLateEdit();",smokeBase+".pending-module.png");
        closeSmokeEvaluateOnly=true;closeSmokeChoice=UnsavedCloseChoice.Cancel;var cancel=new FormClosingEventArgs(CloseReason.UserClosing,false);OnEditorClosing(this,cancel);for(int i=0;i<6000&&editorClosePending;i++)await Task.Delay(50);
        if(editorCloseApproved||!await unsaved.HasChangesAsync())throw new Exception("取消主窗口关闭丢失了独立窗口修改。");
        closeSmokeChoice=UnsavedCloseChoice.Save;var save=new FormClosingEventArgs(CloseReason.UserClosing,false);OnEditorClosing(this,save);for(int i=0;i<6000&&editorClosePending;i++)await Task.Delay(50);
        if(!editorCloseApproved||await unsaved.HasChangesAsync()||ReadProject()?["characters"]?[0]?["name"]?.GetValue<string>()!="关闭时保存角色")throw new Exception("主窗口关闭没有保存独立窗口修改。");
        unsaved.CloseWithoutPrompt();closeSmokeEvaluateOnly=false;
        File.WriteAllText(smokeBase+".module-close.json",JsonSerializer.Serialize(new{ok=true,cancelKeepsModule=true,ownerSaveIncludesModule=true}));
        using(var shot=File.Create(smokeBase+".final.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
    }
}
