using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
namespace VRMGalgame;
internal sealed partial class EditorWindow
{
    private async Task CommercialWait(string script)
    {
        for(int i=0;i<1200;i++){if(await web.CoreWebView2.ExecuteScriptAsync(script)=="true")return;await Task.Delay(100);}
        throw new Exception("等待超时："+script);
    }
    private async Task CommercialPhase(string phase)
    {
        await web.CoreWebView2.ExecuteScriptAsync("window.__commercialResult=null;window.__vrmSmokeCommercial55("+JsonSerializer.Serialize(phase)+").then(r=>window.__commercialResult=r).catch(e=>window.__commercialResult={error:e.message,stack:e.stack})");
        await CommercialWait("window.__commercialResult !== null");
        string result=await web.CoreWebView2.ExecuteScriptAsync("window.__commercialResult");
        File.WriteAllText(smokeBase+"."+phase+".json",result);
        if(JsonNode.Parse(result)?["ok"]?.GetValue<bool>()!=true)throw new Exception(result);
    }
    private async Task CommercialNotices()
    {
        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=third-party-notices]').click()");
        for(int i=0;i<100&&!OwnedForms.Any(f=>f.Text=="第三方声明与许可");i++)await Task.Delay(50);
        var dialog=OwnedForms.FirstOrDefault(f=>f.Text=="第三方声明与许可")??throw new Exception("许可窗口未打开");
        var box=dialog.Controls.OfType<RichTextBox>().Single();
        if(!box.ReadOnly||!box.Text.Contains("Moeru AI")||!box.Text.Contains("SharpZipLib")||!box.Text.Contains("pixiv"))throw new Exception("版权声明内容缺失");
        dialog.Close();dialog.Dispose();
    }
    private static void WriteStandardFontPdf(string path)
    {
        var objects=new List<string>{"<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>"};
        for(int i=0;i<3;i++){
            string content=$"BT /F1 22 Tf 40 760 Td (Commercial release PDF page {i+1}) Tj 0 -42 Td /F2 18 Tf (Times Roman text and 123456789) Tj 0 -42 Td /F3 20 Tf (abgD) Tj ET";
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R /F2 10 0 R /F3 11 0 R >> >> /Contents {4+2*i} 0 R >>");
            objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream");
        }
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>");
        var pdf=new StringBuilder("%PDF-1.4\n");var offsets=new List<int>{0};
        for(int i=0;i<objects.Count;i++){offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));pdf.Append($"{i+1} 0 obj\n{objects[i]}\nendobj\n");}
        int xref=Encoding.ASCII.GetByteCount(pdf.ToString());pdf.Append($"xref\n0 {offsets.Count}\n0000000000 65535 f \n");
        foreach(int offset in offsets.Skip(1))pdf.Append(offset.ToString("D10")+" 00000 n \n");
        pdf.Append($"trailer\n<< /Size {offsets.Count} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");File.WriteAllText(path,pdf.ToString(),Encoding.ASCII);
    }
    private async Task RunCommercial55Smoke()
    {
        await CommercialWait("Boolean(document.querySelector('.welcome [data-action=new-project]'))");await CommercialNotices();
        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#new-name').value='Commercial55';document.querySelector('[data-action=new-project]').click()");
        await CommercialWait("Boolean(window.editorProjectSnapshot?.()?.name==='Commercial55' && document.querySelector('.editor') && !window.__vrmDiagnostics().dirty)");
        if(ReadProject()?["assets"]?.AsArray().Count!=0)throw new Exception("新建工程附带动作");
        string books=Path.Combine(projectDirectory!,"assets/books");Directory.CreateDirectory(books);WriteStandardFontPdf(Path.Combine(books,"standard.pdf"));
        var args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"--smoke-commercial55-pdf");if(at<0)throw new Exception("缺少内部测试中文 PDF");File.Copy(args[at+1],Path.Combine(books,"chinese.pdf"));
        await CommercialPhase("prepare");await CommercialPhase("pdf");
        string exported=smokeBase+".export";BuildGame(exported,ReadProject()!);
        if(!File.Exists(Path.Combine(exported,"licenses/THIRD_PARTY_NOTICES.txt")))throw new Exception("导出未包含版权声明");
        await PreviewGameAsync(ReadProject());
        await CommercialWait("Boolean(window.__vrmDiagnostics)");
        for(int i=0;i<1800&&!File.Exists(smokeBase+".preview-child.complete.json");i++)await Task.Delay(100);
        if(!File.Exists(smokeBase+".preview-child.complete.json")||JsonNode.Parse(File.ReadAllText(smokeBase+".preview-child.complete.json"))?["ok"]?.GetValue<bool>()!=true)throw new Exception("临时试玩失败");
        File.WriteAllText(smokeBase+".commercial.json",JsonSerializer.Serialize(new{ok=true,archive=projectArchivePath,exported,newProjectEmpty=true,noticeUi=true,pdf=true,actualPreview=true}));
    }
    private async Task RunCommercial55PlayerSmoke()
    {
        await CommercialWait("Boolean(document.querySelector('#player-start [data-action=play]') && window.__vrmSmokeCommercial55)");
        if(!playerMode||!fullscreen||WindowState!=FormWindowState.Maximized)throw new Exception("游戏未默认全屏");
        await CommercialPhase("pdf");
        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=settings]').click()");await CommercialNotices();
        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=close-modal]').click();document.querySelector('#player-start [data-action=play]').click()");
        await CommercialWait("window.__vrmDiagnostics().typing === true");
        int before=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("Array.from(document.querySelector('#dialogue-text').textContent).length"))!.GetValue<int>();
        await Task.Delay(2100);
        int after=JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("Array.from(document.querySelector('#dialogue-text').textContent).length"))!.GetValue<int>();
        if(after-before<5||after-before>12)throw new Exception("字速异常："+(after-before));
        using(var shot=File.Create(smokeBase+".game.png"))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
        File.WriteAllText(smokeBase+".player.json",JsonSerializer.Serialize(new{ok=true,fullscreen,width=Width,height=Height,textSpeed=5,charactersIn2100ms=after-before,noticeUi=true,pdf=true}));
    }
    private async Task RunCommercial55LegacySmoke()
    {
        await CommercialWait("Boolean(window.editorProjectSnapshot?.()?.id && document.querySelector('.editor'))");
        var before=ReadProject()!;int assets=before["assets"]!.AsArray().Count,motions=before["assets"]!.AsArray().Count(a=>a?["type"]?.GetValue<string>()=="motion");
        await web.CoreWebView2.ExecuteScriptAsync("window.__commercialSaved=null;window.editorSaveBeforeClose().then(r=>window.__commercialSaved=r).catch(e=>window.__commercialSaved={error:e.message})");
        await CommercialWait("window.__commercialSaved !== null");
        if(JsonNode.Parse(await web.CoreWebView2.ExecuteScriptAsync("window.__commercialSaved"))?["saved"]?.GetValue<bool>()!=true)throw new Exception("旧工程保存失败");
        await SaveProjectAsync(ReadProject(),null);string archive=projectArchivePath!;LoadArchive(archive);
        var after=ReadProject()!;
        if(after["assets"]!.AsArray().Count!=assets||after["assets"]!.AsArray().Count(a=>a?["type"]?.GetValue<string>()=="motion")!=motions)throw new Exception("旧工程素材丢失");
        foreach(var item in after["assets"]!.AsArray())if(!File.Exists(Path.Combine(projectDirectory!,item!["path"]!.GetValue<string>().Replace('/',Path.DirectorySeparatorChar))))throw new Exception("旧素材文件缺失");
        File.WriteAllText(smokeBase+".legacy.json",JsonSerializer.Serialize(new{ok=true,assets,motions,saveTwiceAndReopen=true}));
    }
}
