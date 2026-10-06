using System.Text.Json;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
    private async Task RunWalkAuditSmoke(){
        if(playerMode)throw new Exception("动作检查只能在编辑器中进行。");
        File.WriteAllText(smokeBase+".project.json",ReadProject()!.ToJsonString());
        await web.CoreWebView2.ExecuteScriptAsync("window.__walkAudit=null;window.__vrmSmokeWalkAudit().then(r=>window.__walkAudit=r).catch(e=>window.__walkAudit={error:e.message})");
        string json="null";for(int i=0;i<2400;i++){json=await web.CoreWebView2.ExecuteScriptAsync("window.__walkAudit");if(json!="null")break;await Task.Delay(50);}
        File.WriteAllText(smokeBase+".walk.json",json);
        if(Environment.GetCommandLineArgs().Contains("--smoke-walk-video")){
            await web.CoreWebView2.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride",JsonSerializer.Serialize(new{width=2560,height=1600,deviceScaleFactor=1,mobile=false}));
            await web.CoreWebView2.ExecuteScriptAsync("window.__videoReady=false;window.__vrmSmokeWalkVideoSetup().then(()=>window.__videoReady=true)");
            for(int i=0;i<400;i++){if(await web.CoreWebView2.ExecuteScriptAsync("window.__videoReady")=="true")break;await Task.Delay(50);}
            string folder=smokeBase+"-frames";Directory.CreateDirectory(folder);
            for(int i=0;i<90;i++){string image=JsonSerializer.Deserialize<string>(await web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeWalkVideoFrame()"))!;File.WriteAllBytes(Path.Combine(folder,$"frame-{i:D3}.png"),Convert.FromBase64String(image[(image.IndexOf(',')+1)..]));}
        }
        foreach(var a in ReadProject()!["assets"]!.AsArray().Where(a=>a?["type"]?.GetValue<string>()=="motion")){
            string relative=a!["path"]!.GetValue<string>();string name=a["name"]!.GetValue<string>();
            if(name.Contains("走路")||name.Contains("walk",StringComparison.OrdinalIgnoreCase))File.Copy(Path.Combine(projectDirectory!,relative),smokeBase+".walk-source.fbx",true);
        }
    }
}
