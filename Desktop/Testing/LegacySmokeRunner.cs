using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace VRMGalgame;

// Regression orchestration has a separate owner from the production window.
internal sealed class LegacySmokeOptions
{
    internal bool playerMode { get; init; }
    internal string? smokeBase { get; init; }
    internal bool smokePlay { get; init; }
    internal bool smokeFastPlay { get; init; }
    internal string? smokeOpenDirectory { get; init; }
    internal bool smokeCharacterTwo { get; init; }
    internal bool smokeSaveSlots { get; init; }
    internal bool smokeControls { get; init; }
    internal bool smokeDuplicate { get; init; }
    internal bool smokeRender { get; init; }
    internal bool smokeCast { get; init; }
    internal bool smokeAdvance { get; init; }
    internal bool smokeIteration { get; init; }
    internal bool smokeBlend { get; init; }
    internal bool smokeStepCast { get; init; }
    internal bool smokeNewActCast { get; init; }
    internal bool smokeEmptyAct { get; init; }
    internal bool smokeTitle { get; init; }
    internal bool smokeTheme { get; init; }
    internal bool smokeAutoVolume { get; init; }
    internal bool smokeTitleMenus { get; init; }
    internal bool smokeGallery { get; init; }
    internal bool smokeGalleryLayout { get; init; }
    internal bool smokeGalleryProgress { get; init; }
    internal bool smokeRootMotion { get; init; }
    internal bool smokeMotionOptions { get; init; }
    internal bool smokeExternalPreview { get; init; }
    internal bool smokeCharacterPreview { get; init; }
    internal bool smokeDiscovery { get; init; }
    internal bool smokeRecent { get; init; }
    internal bool smokeImageImport { get; init; }
    internal bool smokeDepthShadow { get; init; }
    internal bool smokePortraits { get; init; }
    internal bool smokePortraitPose { get; init; }
    internal string? smokeFileOpsParent { get; init; }
    internal bool smokeNewArchive { get; init; }
    internal bool smokeSaveTwice { get; init; }
    internal string? smokeAvatarFile { get; init; }
}

internal sealed class LegacySmokeHost
{
    internal required WebView2 web { get; init; }
    internal required Func<string?> ProjectDirectory { get; init; }
    internal required Func<string?> ProjectArchivePath { get; init; }
    internal required Func<bool> ArchiveSaveRunning { get; init; }
    internal required Func<EnvironmentWindow?> EnvironmentWindow { get; init; }
    internal required Form Window { get; init; }
    internal string? projectDirectory => ProjectDirectory();
    internal string? projectArchivePath => ProjectArchivePath();
    internal bool archiveSaveRunning => ArchiveSaveRunning();
    internal Size ClientSize { get => Window.ClientSize; set => Window.ClientSize=value; }
    internal required Action Close { get; init; }
    internal required Action Complete { get; init; }
    internal required IReadOnlyDictionary<string,Func<Task>> Scenarios { get; init; }
    internal required Func<JsonNode?> ReadProject { get; init; }
    internal required Func<JsonNode?,object> SaveProject { get; init; }
    internal required Func<bool,object> SetFullscreen { get; init; }
    internal required Func<string,bool,object?> ImportAssets { get; init; }
    internal required Action<string,JsonNode> BuildGame { get; init; }
    internal required Func<string,object?> ExportGame { get; init; }
    internal required Func<bool,object> SetAgentEnabled { get; init; }
    internal required Action<string,string> WriteArchive { get; init; }
    internal required Action<string> LoadArchive { get; init; }
}

internal sealed class LegacySmokeRunner(LegacySmokeOptions options, LegacySmokeHost host)
{
    private EnvironmentWindow? environmentWindow => host.EnvironmentWindow();
    private string? projectDirectory => host.projectDirectory;
    internal async Task RunAsync()
    {
        try
        {
            if(Environment.GetCommandLineArgs().Contains("--smoke-motion72")){await host.Scenarios["RunMotion72Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-reference59")){await host.Scenarios["RunReference59Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-editor-language")){await host.Scenarios["RunEditorLanguageSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-ui57")){await host.Scenarios["RunUi57Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Any(a=>a.StartsWith("--smoke-palette56"))){await host.Scenarios["RunPalette56Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-commercial55")){await host.Scenarios["RunCommercial55Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-commercial55-player")){await host.Scenarios["RunCommercial55PlayerSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-commercial55-legacy")){await host.Scenarios["RunCommercial55LegacySmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-defaults54")){await host.Scenarios["RunDefaults54Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-naval80")){await host.Scenarios["RunNaval80Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-secondary53")){await host.Scenarios["RunSecondary53Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-promo-package")){await host.Scenarios["RunPromoPackageSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-promo-player")){await host.Scenarios["RunPromoPlayerSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-promo-extras")){await host.Scenarios["RunPromoExtrasSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-audit-module")){await host.Scenarios["RunAuditModuleSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-audit-story")){await host.Scenarios["RunAuditStorySmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-audit-search")){await host.Scenarios["RunAuditSearchSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-audit-cutscene")){await host.Scenarios["RunAuditCutscene"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-audit-war")){await host.Scenarios["RunAuditWar"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-blink49")){await host.Scenarios["RunBlink49Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-gaze50")){await host.Scenarios["RunGaze50Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-geometry52")){await host.Scenarios["RunGeometry52Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-ocean51")){await host.Scenarios["RunOcean51Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-aircombat")){await host.Scenarios["RunAirCombatSmoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-apk-ui")){await host.Scenarios["RunAndroidUISmoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-portrait28")){await host.Scenarios["RunVrmPortrait28Smoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-cutscene")){await host.Scenarios["RunCutsceneSmoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-portrait35")){await host.Scenarios["RunPortrait35Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-mmd36")){await host.Scenarios["RunMmd36Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-thumbnails37")){await host.Scenarios["RunThumbnail37Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-physics38")){await host.Scenarios["RunPhysics38Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-jitter39")){await host.Scenarios["RunJitter39Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-details43")){await host.Scenarios["RunDetails43Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-render42")){await host.Scenarios["RunRender42Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-render41")){await host.Scenarios["RunRender41Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-spatial40")){await host.Scenarios["RunSpatial40Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-ui34")){await host.Scenarios["RunUi34Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-ui33")){await host.Scenarios["RunUi33Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-gallery32")){await host.Scenarios["RunGallery32Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-load31")){await host.Scenarios["RunLoad31Smoke"]();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-copy30")){await host.Scenarios["RunCopy30Smoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-controls29")){await host.Scenarios["RunControls29Smoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-resident29")){await host.Scenarios["RunResidency29Smoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-android-repair-export")){await host.Scenarios["RunAndroidRepairExportSmoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-optional-motions")){await host.Scenarios["RunBlankProjectSmoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-player-graphics")){await host.Scenarios["RunPlayerGraphicsSmoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-editor-fixes")){await host.Scenarios["RunEditorFixSmoke"]();host.Close();return;}
            if(Environment.GetCommandLineArgs().Contains("--smoke-editor-layout")){
                await Task.Delay(1600);
                foreach(var size in new[]{new Size(2560,1600),new Size(2048,1280),new Size(1707,1067),new Size(1280,800),new Size(1280,720)}){
                    await host.web.CoreWebView2.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride",JsonSerializer.Serialize(new{width=size.Width,height=size.Height,deviceScaleFactor=1,mobile=false}));
                    await Task.Delay(300);
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__layoutCheck=null;window.__vrmSmokeEditorLayout().then(r=>window.__layoutCheck=r).catch(e=>window.__layoutCheck={error:e.message})");
                    string check="null";for(int i=0;i<600;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__layoutCheck");if(check!="null")break;await Task.Delay(50);}
                    string prefix=options.smokeBase+".layout-"+size.Width+"x"+size.Height;File.WriteAllText(prefix+".json",check);
                    string captured=await host.web.CoreWebView2.CallDevToolsProtocolMethodAsync("Page.captureScreenshot",JsonSerializer.Serialize(new{format="png",captureBeyondViewport=true,clip=new{x=0,y=0,width=size.Width,height=size.Height,scale=1}}));
                    using(var parsed=JsonDocument.Parse(captured))File.WriteAllBytes(prefix+".png",Convert.FromBase64String(parsed.RootElement.GetProperty("data").GetString()!));
                    if(!check.Contains("\"ok\":true"))throw new Exception(check);
                }
                await host.web.CoreWebView2.CallDevToolsProtocolMethodAsync("Emulation.setDeviceMetricsOverride",JsonSerializer.Serialize(new{width=1280,height=800,deviceScaleFactor=1,mobile=false}));
                await Task.Delay(300);
                string info=await host.web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokePreviewResize('reset')");
                await host.web.CoreWebView2.ExecuteScriptAsync("window.__resizeInfo=null;window.__vrmSmokePreviewResize('reset').then(r=>window.__resizeInfo=r)");await Task.Delay(150);
                info=await host.web.CoreWebView2.ExecuteScriptAsync("window.__resizeInfo");
                await host.web.CoreWebView2.ExecuteScriptAsync("document.addEventListener('pointerdown',e=>window.__resizePointer={x:e.clientX,y:e.clientY,button:e.button,target:e.target.outerHTML.slice(0,250)},{once:true,capture:true})");
                double initialPreviewWidth;
                using(var data=JsonDocument.Parse(info)){
                    initialPreviewWidth=data.RootElement.GetProperty("width").GetDouble();
                    double x=data.RootElement.GetProperty("corner").GetProperty("x").GetDouble(),y=data.RootElement.GetProperty("corner").GetProperty("y").GetDouble();
                    await host.web.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type="mousePressed",x,y,button="left",buttons=1,clickCount=1}));
                    await Task.Delay(120);
                    await host.web.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type="mouseMoved",x=x-150,y=y-84,button="left",buttons=1}));
                    await Task.Delay(120);
                    await host.web.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent",JsonSerializer.Serialize(new{type="mouseReleased",x=x-150,y=y-84,button="left",buttons=0,clickCount=1}));
                }
                await Task.Delay(200);
                foreach(string phase in new[]{"check","persist","reset"}){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__resizeInfo=null;window.__vrmSmokePreviewResize("+JsonSerializer.Serialize(phase)+").then(r=>window.__resizeInfo=r).catch(e=>window.__resizeInfo={error:e.message})");await Task.Delay(300);
                    string check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__resizeInfo");File.WriteAllText(options.smokeBase+".resize-"+phase+".json",check);if(!check.Contains("\"ok\":true"))throw new Exception(check);
                    if(phase=="check")using(var data=JsonDocument.Parse(check))if(data.RootElement.GetProperty("width").GetDouble()>=initialPreviewWidth-20)throw new Exception("拖动没有缩小预览");
                }
                host.Close();return;
            }
            if (options.smokeOpenDirectory != null)
            {
                await Task.Delay(150);
                if(!Environment.GetCommandLineArgs().Contains("--smoke-preload-raw"))await host.web.CoreWebView2.ExecuteScriptAsync(
                    "document.querySelector('[data-action=open-project]')?.click()");
                if (options.smokeCharacterTwo)
                {
                    await Task.Delay(1000);
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=select-character][data-index=\"1\"]')?.click()");
                }
                await Task.Delay(7000);
            }
            else
            {
                if (options.smokeNewArchive)
                {
                    await Task.Delay(150);
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('#new-name').value='测试压缩工程'; document.querySelector('[data-action=new-project]').click()");
                    await Task.Delay(1700);
                    File.WriteAllText(options.smokeBase + ".new-archive.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics ? window.__vrmDiagnostics() : {error:'UI not ready'})"));
                }
                await Task.Delay(options.smokeFastPlay ? 50 : options.smokePlay || options.smokeSaveSlots || options.smokeGallery || options.smokeGalleryProgress ? 1500 : 7000);
                if (options.smokeRecent && !options.playerMode)
                {
                    File.WriteAllText(options.smokeBase + ".recent-list.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({count:document.querySelectorAll('[data-action=open-recent]').length, first:document.querySelector('[data-action=open-recent]')?.textContent})"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=open-recent]')?.click()");
                    await Task.Delay(8500);
                    File.WriteAllText(options.smokeBase + ".recent-open.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (options.smokeAvatarFile != null && !options.playerMode && !Environment.GetCommandLineArgs().Contains("--smoke-chapters"))
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=add-character]')?.click(); document.querySelector('[data-action=upload-character-portrait]')?.click()");
                    await Task.Delay(2500);
                    File.WriteAllText(options.smokeBase + ".avatar-upload.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                }
                if (options.smokePortraitPose && !options.playerMode)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=select-character][data-index=\"0\"]')?.click(); const motion=document.querySelector('[data-field=\"character.galleryMotionId\"]'); motion.value='preset-mixamo-017'; motion.dispatchEvent(new Event('input',{bubbles:true})); motion.dispatchEvent(new Event('change',{bubbles:true}))");
                    string baseline = await host.web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                    for (int attempt = 0; attempt < 45; attempt++)
                    {
                        await Task.Delay(1000);
                        string current = await host.web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                        if (current != baseline && current != "\"\"") break;
                    }
                    File.WriteAllText(options.smokeBase + ".pose-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    string beforeId = await host.web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                    await host.web.CoreWebView2.ExecuteScriptAsync("const pose=document.querySelector('[data-gallery-adjust=galleryPoseFrame]'); pose.value=String(Math.min(40, Number(pose.max))); pose.dispatchEvent(new Event('input',{bubbles:true})); pose.dispatchEvent(new Event('change',{bubbles:true}))");
                    for (int attempt = 0; attempt < 45; attempt++)
                    {
                        await Task.Delay(1000);
                        string current = await host.web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                        if (current != beforeId && current != "\"\"") break;
                    }
                    File.WriteAllText(options.smokeBase + ".pose-after.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using var poseStream = File.Create(options.smokeBase + ".pose-after.png");
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, poseStream);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                }
                if (options.smokePlay || options.smokeFastPlay || options.smokeSaveSlots || options.smokeAutoVolume)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-action=play]')?.click()");
                    await Task.Delay(options.smokeFastPlay ? 100 : options.smokeSaveSlots ? 4000 : 9000);
                    if (options.smokeSaveSlots)
                    {
                        await host.web.CoreWebView2.ExecuteScriptAsync(
                            "localStorage.removeItem('vrm-save-slots-' + (window.__vrmProjectId || ''))");
                        await host.web.CoreWebView2.ExecuteScriptAsync(
                            "document.querySelector('[data-action=save-game]')?.click(); document.querySelector('[data-action=save-slot][data-index=\"1\"]')?.click(); document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('.stage-frame')?.click(); document.querySelector('[data-action=save-game]')?.click(); document.querySelector('[data-action=save-slot][data-index=\"2\"]')?.click(); document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('[data-action=load-game]')?.click(); document.querySelector('[data-action=load-slot][data-index=\"2\"]')?.click(); document.querySelector('[data-action=load-game]')?.click()");
                        await Task.Delay(2000);
                    }
                }
                if (options.smokePortraits && options.playerMode)
                {
                    for (int stepIndex = 1; stepIndex <= 6; stepIndex++)
                    {
                        await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                        await Task.Delay(2600);
                        if (stepIndex >= 5)
                            File.WriteAllText(options.smokeBase + $".player-step-{stepIndex}.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                                "JSON.stringify(window.__vrmDiagnostics())"));
                    }
                    using var playerPortraitStream = File.Create(options.smokeBase + ".player-portrait.png");
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, playerPortraitStream);
                }
                if (options.smokeControls)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "for (const [selector, value] of [['[data-adjust=size]','150'],['[data-adjust=offsetX]','0.5'],['[data-adjust=offsetY]','0.25'],['[data-expression=happy]','35']]) { const input=document.querySelector(selector); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} } document.querySelector('.inspector').scrollTop=600");
                    await Task.Delay(1200);
                }
                if (options.smokeDuplicate)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-action=duplicate-step]')?.click(); for (const [selector, value] of [['[data-adjust=size]','250'],['[data-adjust=offsetY]','-4']]) { const input=document.querySelector(selector); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} }");
                    await Task.Delay(1200);
                }
                if (options.smokeRender)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-panel=render]')?.click(); for (const [key,value] of [['antialias','high'],['style','anime'],['outline','1'],['autoLight','true']]) { const input=document.querySelector('[data-render='+key+']'); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} }");
                    await Task.Delay(2000);
                }
                if (options.smokeDepthShadow && !options.playerMode)
                {
                    File.WriteAllText(options.smokeBase + ".shadow-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".shadow-before.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (() => {
                          document.querySelector('.cast-editor')?.setAttribute('open', '');
                          const cast = document.querySelector('[data-cast-adjust="left.offsetZ"]');
                          if (cast) { cast.value = '0.7'; cast.dispatchEvent(new Event('input', { bubbles: true })); }
                          const step = document.querySelector('[data-adjust="offsetZ"]');
                          if (step) { step.value = '0.4'; step.dispatchEvent(new Event('input', { bubbles: true })); }
                          document.querySelector('[data-panel=render]')?.click();
                          const advanced = document.querySelector('.render-advanced');
                          if (advanced) advanced.open = true;
                          for (const [key, value] of [['shadowEnabled', true], ['shadowAngle', '55'], ['shadowOpacity', '75']]) {
                            const input = document.querySelector('[data-render=' + key + ']');
                            if (!input) continue;
                            if (key === 'shadowEnabled') input.checked = value;
                            else input.value = value;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                        })()
                        """);
                    await Task.Delay(2500);
                    File.WriteAllText(options.smokeBase + ".shadow-after.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".shadow-after.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("(()=>{const height=document.querySelector('[data-render=shadowHeight]');height.value='13';height.dispatchEvent(new Event('input',{bubbles:true}));})()");
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-render=shadowHeight]')?.scrollIntoView({block:'center'})");
                    await Task.Delay(600);
                    File.WriteAllText(options.smokeBase + ".shadow-raised.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".shadow-raised.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.head.insertAdjacentHTML('beforeend','<style>.stage-frame::after{display:none!important}</style>')");
                    using (var image = File.Create(options.smokeBase + ".shadow-no-fade.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("(()=>{const shadow=document.querySelector('[data-render=shadowEnabled]'); shadow.checked=false; shadow.dispatchEvent(new Event('input',{bubbles:true}));})()");
                    await Task.Delay(250);
                    using (var image = File.Create(options.smokeBase + ".shadow-off-no-fade.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("(()=>{const shadow=document.querySelector('[data-render=shadowEnabled]'); shadow.checked=true; shadow.dispatchEvent(new Event('input',{bubbles:true}));})()");
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=story]')?.click()");
                    await Task.Delay(100);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('[data-action=select-step]')[1]?.click()");
                    await Task.Delay(100);
                    await host.web.CoreWebView2.ExecuteScriptAsync("(()=>{const depth=document.querySelector('[data-adjust=offsetZ]'); if(depth){depth.value='0.4';depth.dispatchEvent(new Event('input',{bubbles:true}));}})()");
                    await Task.Delay(1400);
                    File.WriteAllText(options.smokeBase + ".speaker-depth.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=title]')?.click()");
                    await Task.Delay(100);
                    await host.web.CoreWebView2.ExecuteScriptAsync("(()=>{const depth=document.querySelector('[data-title-adjust=offsetZ]'); if(depth){depth.value='0.5';depth.dispatchEvent(new Event('input',{bubbles:true}));}})()");
                    await Task.Delay(1400);
                    File.WriteAllText(options.smokeBase + ".title-depth.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                    File.WriteAllText(options.smokeBase + ".shadow-saved.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (options.smokeCast)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-panel=story]')?.click(); document.querySelector('.cast-editor')?.setAttribute('open',''); for (const [key,value] of [['left.size','160'],['left.yaw','35']]) { const input=[...document.querySelectorAll('[data-cast-adjust]')].find(node=>node.dataset.castAdjust===key); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} } const motion=document.querySelector('[data-cast-motion=left]'); if(motion?.options[1]){motion.value=motion.options[1].value;motion.dispatchEvent(new Event('input',{bubbles:true}));}");
                    await Task.Delay(2000);
                    await host.web.CoreWebView2.ExecuteScriptAsync(
                        "const input=[...document.querySelectorAll('[data-cast-expression]')].find(node=>node.dataset.castExpression==='left.happy'); if(input){input.value='55';input.dispatchEvent(new Event('input',{bubbles:true}));}");
                    await Task.Delay(500);
                }
                if (options.smokeAdvance)
                {
                    for (int index = 0; index < 3; index++)
                    {
                        await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                        await Task.Delay(1300);
                    }
                }
                if (options.smokeRootMotion)
                {
                    File.WriteAllText(options.smokeBase + ".root-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await Task.Delay(800);
                    File.WriteAllText(options.smokeBase + ".root-after.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await Task.Delay(3200);
                    File.WriteAllText(options.smokeBase + ".root-long.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    if (Environment.GetCommandLineArgs().Contains("--smoke-feet-loop"))
                    {
                        await Task.Delay(8200);
                        File.WriteAllText(options.smokeBase + ".root-loop.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    }
                }
                if (options.smokeMotionOptions)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (() => {
                          document.querySelector('[data-action="select-step"][data-index="1"]')?.click();
                          const set = (selector, value) => {
                            const node = document.querySelector(selector);
                            if (!node) throw new Error('找不到动作测试控件：' + selector);
                            node.value = value;
                            node.dispatchEvent(new Event('input', { bubbles: true }));
                          };
                          set('[data-field="step.motionId"]', 'preset-mixamo-020');
                          set('[data-motion-options="step"][data-motion-setting="loop"]', 'false');
                          set('[data-motion-options="step"][data-motion-setting="startFrame"]', '5');
                          set('[data-motion-options="step"][data-motion-setting="endFrame"]', '15');
                          document.querySelector('.motion-advanced').open = true;
                        })()
                        """);
                    await Task.Delay(1800);
                    File.WriteAllText(options.smokeBase + ".motion-hold.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (() => {
                          const node = document.querySelector('[data-motion-options="step"][data-motion-setting="after"]');
                          node.value = 'idle';
                          node.dispatchEvent(new Event('input', { bubbles: true }));
                        })()
                        """);
                    await Task.Delay(1800);
                    File.WriteAllText(options.smokeBase + ".motion-idle.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                    File.WriteAllText(options.smokeBase + ".motion-saved.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (options.smokeExternalPreview && !options.playerMode)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=play]')?.click()");
                    await Task.Delay(4000);
                    File.WriteAllText(options.smokeBase + ".preview-result.json",
                        await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__lastPreviewGame || null)"));
                }
                if (options.smokeCharacterPreview && !options.playerMode)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=select-character][data-index=\"1\"]')?.click()");
                    await Task.Delay(1800);
                    File.WriteAllText(options.smokeBase + ".character-preview.json",
                        await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (options.smokeFileOpsParent != null && !options.playerMode && !Environment.GetCommandLineArgs().Contains("--smoke-chapters") && !Environment.GetCommandLineArgs().Contains("--smoke-props") && !Environment.GetCommandLineArgs().Contains("--smoke-scene-animations") && !Environment.GetCommandLineArgs().Contains("--smoke-render-regression") && !Environment.GetCommandLineArgs().Contains("--smoke-shoulder-portrait") && !Environment.GetCommandLineArgs().Contains("--smoke-fbx-portrait") && !Environment.GetCommandLineArgs().Contains("--smoke-preload") && !Environment.GetCommandLineArgs().Contains("--smoke-npr") && !Environment.GetCommandLineArgs().Contains("--smoke-inventory") && !Environment.GetCommandLineArgs().Contains("--smoke-resource-package") && !Environment.GetCommandLineArgs().Contains("--smoke-dialogue-camera"))
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=editor-settings]').click(); const interval=document.querySelector('#editor-auto-save-minutes'); interval.value='10'; interval.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('[data-action=close-editor-settings]').click(); window.prompt=()=> '测试副本'; document.querySelector('[data-action=save-as]').click()");
                    await Task.Delay(2600);
                    File.WriteAllText(options.smokeBase + ".save-as.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.prompt=()=> '测试导出'; document.querySelector('[data-action=export]').click()");
                    await Task.Delay(1800);
                    File.WriteAllText(options.smokeBase + ".export.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (options.smokeSaveTwice && !options.playerMode)
                {
                    for(int i=0;i<2400&&host.archiveSaveRunning;i++)await Task.Delay(50);
                    if(host.archiveSaveRunning)throw new Exception("等待前台保存完成超时。");
                    host.SaveProject(host.ReadProject());
                    host.SaveProject(host.ReadProject());
                    File.WriteAllText(options.smokeBase + ".save-twice.txt", "OK");
                }
                if (options.smokeIteration)
                {
                    string initial = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".initial.json", initial);
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          function drag(kind, source, target) {
                            const rows = [...document.querySelectorAll('[data-order-kind=' + kind + ']')];
                            const dataTransfer = new DataTransfer();
                            rows[source].dispatchEvent(new DragEvent('dragstart', {bubbles:true, dataTransfer}));
                            const y = rows[target].getBoundingClientRect().top + 1;
                            rows[target].dispatchEvent(new DragEvent('dragover', {bubbles:true, cancelable:true, dataTransfer, clientY:y}));
                            rows[target].dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer, clientY:y}));
                          }
                          drag('step', 2, 0);
                          drag('act', 1, 0);
                          document.querySelector('[data-panel=assets]').click();
                          window.prompt = (_, value) => value === '新文件夹' ? '测试分组' : '模型分组';
                          document.querySelector('[data-action=add-asset-folder][data-type=vrm]').click();
                          const folder = document.querySelector('.asset-folder[data-folder-key]:not([data-folder-key="unfiled:vrm"])');
                          folder.querySelector('[data-action=rename-asset-folder]').click();
                          const firstAsset = document.querySelector('[data-asset-folder]');
                          firstAsset.value = folder.dataset.folderKey;
                          firstAsset.dispatchEvent(new Event('input', {bubbles:true}));
                        })();
                        """);
                    await Task.Delay(1200);
                    string after = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".iteration.json", after);
                }
                if (options.smokeBlend)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=play]')?.click()");
                    await Task.Delay(9000);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                    await Task.Delay(150);
                    string middle = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".blend-mid.json", middle);
                    await Task.Delay(550);
                    string final = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".blend-final.json", final);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                    await Task.Delay(150);
                    string backMiddle = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".blend-back-mid.json", backMiddle);
                    await Task.Delay(550);
                    string backFinal = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".blend-back-final.json", backFinal);
                }
                if (options.smokeStepCast)
                {
                    string before = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".cast-before.json", before);
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          const slot = document.querySelector('[data-step-cast]');
                          if (!slot) throw new Error('No dialogue position selector');
                          slot.value = slot.value === 'right' ? 'left' : 'right';
                          slot.dispatchEvent(new Event('input', {bubbles:true}));
                        })();
                        """);
                    await Task.Delay(1500);
                    string after = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".cast-after.json", after);
                }
                if (options.smokeNewActCast)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          document.querySelector('[data-action=add-act]').click();
                          const slots = [...document.querySelectorAll('[data-cast-slot]')];
                          const actors = [...document.querySelectorAll('[data-panel=characters]')];
                          const first = slots[0].options[1]?.value;
                          const second = slots[1].options[2]?.value;
                          slots[0].value = first;
                          slots[0].dispatchEvent(new Event('input', {bubbles:true}));
                          const middle = document.querySelector('[data-cast-slot=center]');
                          middle.value = second;
                          middle.dispatchEvent(new Event('input', {bubbles:true}));
                        })();
                        """);
                    await Task.Delay(1200);
                    string before = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".new-act-before.json", before);
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          for (const [key, value] of [['left.size','180'], ['left.offsetX','0.5'], ['left.offsetY','0.75'], ['left.yaw','45']]) {
                            const input = [...document.querySelectorAll('[data-cast-adjust]')].find(node => node.dataset.castAdjust === key);
                            if (!input) throw new Error('Missing slider: ' + key);
                            input.value = value;
                            input.dispatchEvent(new Event('input', {bubbles:true}));
                          }
                          const motion = document.querySelector('[data-cast-motion=left]');
                          if (motion?.options[1]) {
                            motion.value = motion.options[1].value;
                            motion.dispatchEvent(new Event('input', {bubbles:true}));
                          }
                          const expression = document.querySelector('[data-cast-expression="left.happy"]');
                          if (expression) {
                            expression.value = '60';
                            expression.dispatchEvent(new Event('input', {bubbles:true}));
                          }
                        })();
                        """);
                    await Task.Delay(1400);
                    string after = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".new-act-after.json", after);
                }
                if (options.smokeEmptyAct)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=select-act][data-index=\"1\"]')?.click()");
                    await Task.Delay(2200);
                    string before = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".empty-before.json", before);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=add-act]')?.click()");
                    await Task.Delay(1700);
                    string after = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".empty-after.json", after);
                }
                if (options.smokeTitle)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          document.querySelector('[data-panel=title]').click();
                          for (const [key, index] of [['modelId',1], ['logoImageId',1], ['motionId',1]]) {
                            const select = document.querySelector('[data-title-field=' + key + ']');
                            if (!select?.options[index]) throw new Error('Missing title asset ' + key);
                            select.value = select.options[index].value;
                            select.dispatchEvent(new Event('input', {bubbles:true}));
                          }
                          for (const [key,value] of [['size','200'], ['offsetX','0.5'], ['offsetY','-0.85'], ['yaw','25'], ['pitch','-20'], ['cameraAngle','35']]) {
                            const slider = document.querySelector('[data-title-adjust=' + key + ']');
                            if (!slider) throw new Error('Missing title slider ' + key);
                            slider.value = value;
                            slider.dispatchEvent(new Event('input', {bubbles:true}));
                          }
                        })();
                        """);
                    await Task.Delay(2400);
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          const slider = document.querySelector('[data-title-expression=happy]');
                          if (!slider) throw new Error('Missing title expression slider');
                          slider.value = '65';
                          slider.dispatchEvent(new Event('input', {bubbles:true}));
                        })();
                        """);
                    await Task.Delay(250);
                    string titleResult = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".title.json", titleResult);
                }
                if (options.smokeAutoVolume)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          document.querySelector('[data-action=settings]').click();
                          for (const [key,value] of [['master','70'], ['music','40'], ['voice','55']]) {
                            const slider = document.querySelector('[data-volume=' + key + ']');
                            if (!slider) throw new Error('Missing volume slider ' + key);
                            slider.value = value;
                            slider.dispatchEvent(new Event('input', {bubbles:true}));
                          }
                          document.querySelector('[data-action=close-modal]').click();
                          document.querySelector('[data-action=auto-toggle]').click();
                        })();
                        """);
                    string autoStart = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".auto-start.json", autoStart);
                    await Task.Delay(5500);
                    string autoLater = await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(options.smokeBase + ".auto-later.json", autoLater);
                }
                if (options.smokeTitleMenus && options.playerMode)
                {
                    string menus = await host.web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          const hit = window.__vrmDiagnostics().titlePlayButtonHit;
                          document.querySelector('#player-start [data-action=settings]').click();
                          const settings = Boolean(document.querySelector('#player-modal [data-volume=master]'));
                          document.querySelector('#player-modal [data-action=close-modal]').click();
                          document.querySelector('#player-start [data-action=gallery]').click();
                          const gallery = document.querySelectorAll('#player-modal .gallery-image-tile').length;
                          document.querySelector('#player-modal [data-action=close-modal]').click();
                          document.querySelector('#player-start [data-action=play-progress]').click();
                          const progress = window.__vrmDiagnostics().progressStats;
                          const actRows = document.querySelectorAll('#player-modal .progress-act-row').length;
                          const characterRows = document.querySelectorAll('#player-modal .progress-character-row').length;
                          document.querySelector('#player-modal [data-action=close-modal]').click();
                          return JSON.stringify({hit,settings,gallery,progress,actRows,characterRows,menuItems:document.querySelectorAll('#player-start .title-bottom-menu button').length});
                        })();
                        """);
                    File.WriteAllText(options.smokeBase + ".menus.json", menus);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=play-progress]').click()");
                    using (var image = File.Create(options.smokeBase + ".progress.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-modal [data-action=close-modal]').click(); document.querySelector('#player-start [data-action=play]').click()");
                    await Task.Delay(3500);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('#player-start [data-action=play-progress]')?.click()");
                    File.WriteAllText(options.smokeBase + ".progress-after.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics().progressStats)"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-modal [data-action=close-modal]').click(); document.querySelector('#player-start [data-action=play]').click()");
                    await Task.Delay(1800);
                    for (int index = 0; index < 6; index++)
                    {
                        await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                        await Task.Delay(900);
                    }
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('#player-start [data-action=play-progress]')?.click()");
                    File.WriteAllText(options.smokeBase + ".progress-complete.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics().progressStats)"));
                }
                if (options.smokeImageImport && !options.playerMode)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=assets]')?.click()");
                    File.WriteAllText(options.smokeBase + ".images-before.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({included:window.__vrmDiagnostics().galleryImageCount, checks:document.querySelectorAll('[data-gallery-image]').length})"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=import][data-type=image]')?.click()");
                    File.WriteAllText(options.smokeBase + ".import-choice.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({visible:Boolean(document.querySelector('#image-import-modal')),defaultChecked:document.querySelector('#image-import-gallery')?.checked})"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=cancel-image-import]')?.click(); const check=document.querySelector('[data-gallery-image]'); if(check){check.checked=false;check.dispatchEvent(new Event('input',{bubbles:true}));}");
                    File.WriteAllText(options.smokeBase + ".images-excluded.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({included:window.__vrmDiagnostics().galleryImageCount,firstChecked:document.querySelector('[data-gallery-image]')?.checked})"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1600);
                    File.WriteAllText(options.smokeBase + ".images-saved.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({included:window.__vrmDiagnostics().galleryImageCount,dirty:window.__vrmDiagnostics().dirty})"));
                }
                if (options.smokeGallery && options.playerMode)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]').click()");
                    File.WriteAllText(options.smokeBase + ".images.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".images.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-page][data-index=\"1\"]')?.click()");
                    File.WriteAllText(options.smokeBase + ".page-two.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-page][data-index=\"0\"]')?.click()");
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-image]')?.click()");
                    File.WriteAllText(options.smokeBase + ".large-image.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-image-close]')?.click();document.querySelector('[data-action=gallery-tab][data-tab=music]')?.click()");
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-track]')?.click()");
                    await Task.Delay(800);
                    File.WriteAllText(options.smokeBase + ".music.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".music.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await Task.Delay(4400);
                    File.WriteAllText(options.smokeBase + ".music-next.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-repeat]')?.click()");
                    await Task.Delay(4400);
                    File.WriteAllText(options.smokeBase + ".music-repeat.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-tab][data-tab=characters]')?.click()");
                    await Task.Delay(2300);
                    File.WriteAllText(options.smokeBase + ".characters.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-story][data-index=\"1\"]')?.click()");
                    File.WriteAllText(options.smokeBase + ".story.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".first-character.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('[data-action=gallery-character]')[1]?.click()");
                    await Task.Delay(2200);
                    using (var image = File.Create(options.smokeBase + ".second-character.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('[data-action=gallery-character]')[2]?.click()");
                    await Task.Delay(2200);
                    using (var image = File.Create(options.smokeBase + ".third-character.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                }
                if (options.smokeGalleryProgress)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("localStorage.removeItem('vrm-save-slots-' + (window.__vrmProjectId || ''));document.querySelector('#player-start [data-action=play]').click()");
                    await Task.Delay(4500);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save-game]').click();document.querySelector('[data-action=save-slot][data-index=\"1\"]').click();document.querySelector('[data-action=close-modal]').click()");
                    File.WriteAllText(options.smokeBase + ".first-save.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame').click()");
                    await Task.Delay(1100);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save-game]').click();document.querySelector('[data-action=save-slot][data-index=\"2\"]').click();document.querySelector('[data-action=close-modal]').click();document.querySelector('[data-action=stop-play]').click()");
                    await Task.Delay(1800);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]').click();document.querySelector('[data-action=gallery-tab][data-tab=characters]').click();document.querySelector('[data-action=gallery-story][data-index=\"1\"]')?.click()");
                    File.WriteAllText(options.smokeBase + ".unlocked.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    File.WriteAllText(options.smokeBase + ".slots.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(JSON.parse(localStorage.getItem('vrm-save-slots-' + (window.__vrmProjectId || ''))))"));
                }
                if (options.smokeDiscovery && options.playerMode)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]')?.click()");
                    File.WriteAllText(options.smokeBase + ".gallery-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".gallery-before.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-tab][data-tab=music]')?.click()");
                    File.WriteAllText(options.smokeBase + ".music-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-tab][data-tab=characters]')?.click(); document.querySelectorAll('[data-action=gallery-character]')[1]?.click()");
                    File.WriteAllText(options.smokeBase + ".character-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(options.smokeBase + ".character-before.png"))
                        await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('#player-start [data-action=play]')?.click()");
                    await Task.Delay(4200);
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save-game]')?.click()");
                    File.WriteAllText(options.smokeBase + ".save-before.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeAutoSave?.(); document.querySelector('[data-action=save-slot][data-index=\"0\"]')?.click(); document.querySelector('[data-action=save-slot][data-index=\"1\"]')?.click()");
                    await Task.Delay(350);
                    File.WriteAllText(options.smokeBase + ".manual-click.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    File.WriteAllText(options.smokeBase + ".save-after.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('.stage-frame')?.click()");
                    await Task.Delay(1200);
                    File.WriteAllText(options.smokeBase + ".progress-before-load.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.confirm = () => true; document.querySelector('[data-action=load-game]')?.click(); document.querySelector('[data-action=load-slot][data-index=\"1\"]')?.click()");
                    await Task.Delay(1200);
                    File.WriteAllText(options.smokeBase + ".progress-after-load.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('#player-start [data-action=gallery]')?.click()");
                    await Task.Delay(500);
                    File.WriteAllText(options.smokeBase + ".gallery-after.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
            }
            if (options.smokeTheme && !options.playerMode)
            {
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=toggle-editor-theme]')?.click()");
                await Task.Delay(200);
                File.WriteAllText(options.smokeBase + ".theme.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                    "JSON.stringify({theme:document.body.dataset.editorTheme, saved:JSON.parse(localStorage.getItem('vrm-editor-settings') || '{}').theme, background:getComputedStyle(document.querySelector('.editor')).backgroundColor, spinnerDots:document.querySelectorAll('#act-loading .loading-spinner i').length, spinnerText:document.querySelector('#act-loading')?.textContent.trim()})"));
            }
            if (options.smokeGalleryLayout && options.playerMode)
            {
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]')?.click(); document.querySelector('[data-action=gallery-tab][data-tab=characters]')?.click()");
                await Task.Delay(1800);
                File.WriteAllText(options.smokeBase + ".gallery-layout.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                    "JSON.stringify({portraitNameCount:document.querySelectorAll('.gallery-character-portrait .gallery-character-name').length,detailName:document.querySelector('.gallery-detail-name')?.textContent,detailFont:getComputedStyle(document.querySelector('.gallery-detail-name')).fontFamily,loaded:document.fonts.check('16px \"HarmonyOS Sans SC\"'),fontCredit:document.querySelector('.font-credit')?.textContent || ''})"));
            }
            if (options.smokePortraits && !options.playerMode)
            {
                for (int attempt = 0; attempt < 45; attempt++)
                {
                    string ready = await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics()?.characterPortraitIds?.every(x=>!x.modelId||(x.portraitId&&x.portraitPoseKey)))");
                    if (ready.Contains("true")) break;
                    await Task.Delay(2000);
                }
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                await Task.Delay(2500);
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=story]')?.click(); document.querySelector('[data-action=select-step][data-index=\"1\"]')?.click()");
                await Task.Delay(5000);
                File.WriteAllText(options.smokeBase + ".portrait-story.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                    "JSON.stringify(window.__vrmDiagnostics())"));
                using var portraitStream = File.Create(options.smokeBase + ".portrait-story.png");
                await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, portraitStream);
                for (int stepIndex = 5; stepIndex <= 6; stepIndex++)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync($"document.querySelector('[data-action=select-step][data-index=\"{stepIndex}\"]')?.click()");
                    await Task.Delay(2500);
                    File.WriteAllText(options.smokeBase + $".portrait-step-{stepIndex}.json", await host.web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics())"));
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-menu-polish"))
            {
                if(Environment.GetCommandLineArgs().Contains("--smoke-agent-direct"))host.SetFullscreen(true);
                else host.ClientSize = new Size(960, 540);
                var menuPhases = new List<string> { "audio", "settings", "gallery" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-glass")) menuPhases.AddRange(new[] { "music", "characters", "chapters", "saves", "story" });
                if (Environment.GetCommandLineArgs().Contains("--smoke-library")) menuPhases.AddRange(new[] { "library-search", "library-editor", "library-shelf", "library-reader", "library-turn" });
                if (Environment.GetCommandLineArgs().Contains("--smoke-weather")) menuPhases = new List<string> { "weather-editor", "weather-lifecycle", "weather-rain", "weather-snow", "weather-wind", "weather-sunny", "weather-cloudy", "weather-depth" };
                if(Environment.GetCommandLineArgs().Contains("--smoke-audit-current-weather"))menuPhases.Remove("weather-lifecycle");
                if (Environment.GetCommandLineArgs().Contains("--smoke-events")) menuPhases = new List<string> { "events-editor", "events-news", "events-war", "events-burst", "events-major", "events-save", "events-flow" };
                if(Environment.GetCommandLineArgs().Contains("--smoke-audit-current-events"))menuPhases.Remove("events-war");
                if (options.playerMode) menuPhases.Remove("events-editor");
                if (Environment.GetCommandLineArgs().Contains("--smoke-history")) menuPhases = new List<string> { "history-editor" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-history-portrait")) menuPhases = new List<string> { "history-portrait" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-mouth")) menuPhases = new List<string> { options.playerMode ? "mouth-player" : "mouth-editor" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-protected")) menuPhases = new List<string> { "protected-editor" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-agent")) menuPhases = new List<string> { "agent-editor" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-agent-environment")) menuPhases = new List<string> { "agent-env-editor" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-agent-environment-player")) menuPhases = new List<string> { "agent-env-player" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-agent-player")) menuPhases = new List<string> { "agent-player" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-voices")) menuPhases = new List<string> { options.playerMode ? "voices-player" : "voices-editor" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-event-media"))
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("""
                        window.__eventVideo = null;
                        (async () => {
                          const canvas=document.createElement('canvas'); canvas.width=640;canvas.height=360;
                          const context=canvas.getContext('2d'), chunks=[];
                          const encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);chunks.push({time:chunk.timestamp/1000,key:chunk.type==='key',data});},error:e=>{throw e;}});
                          encoder.configure({codec:'vp8',width:640,height:360,bitrate:400000,framerate:10,hardwareAcceleration:'prefer-software'});
                          for(let i=0;i<25;i++){
                            context.fillStyle='#18231f';context.fillRect(0,0,640,360);context.fillStyle='#d8dfd5';context.font='30px sans-serif';context.fillText('WORLD BULLETIN / VIDEO',70,160);context.fillRect(70,205,i*16,5);
                            const frame=new VideoFrame(canvas,{timestamp:i*100000,duration:100000});encoder.encode(frame,{keyFrame:i===0});frame.close();
                          }
                          await encoder.flush();encoder.close();
                          const join=arrays=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const array of arrays){out.set(array,offset);offset+=array.length;}return out;};
                          const size=n=>{let width=1;while(n>=2**(7*width)-1)width++;const out=new Uint8Array(width);for(let i=width-1;i>=0;i--){out[i]=n%256;n=Math.floor(n/256);}out[0]|=1<<(8-width);return out;};
                          const tag=(id,data)=>join([Uint8Array.from(id),size(data.length),data]);
                          const number=n=>{const result=[];do{result.unshift(n%256);n=Math.floor(n/256);}while(n);return Uint8Array.from(result);};
                          const uint=(id,n)=>tag(id,number(n)),str=(id,s)=>tag(id,new TextEncoder().encode(s)),group=(id,entries)=>tag(id,join(entries));
                          const duration=new Uint8Array(8);new DataView(duration.buffer).setFloat64(0,2500);
                          const header=group([0x1a,0x45,0xdf,0xa3],[uint([0x42,0x86],1),uint([0x42,0xf7],1),uint([0x42,0xf2],4),uint([0x42,0xf3],8),str([0x42,0x82],'webm'),uint([0x42,0x87],2),uint([0x42,0x85],2)]);
                          const info=group([0x15,0x49,0xa9,0x66],[uint([0x2a,0xd7,0xb1],1000000),tag([0x44,0x89],duration),str([0x4d,0x80],'Event media test'),str([0x57,0x41],'Event media test')]);
                          const tracks=group([0x16,0x54,0xae,0x6b],[group([0xae],[uint([0xd7],1),uint([0x73,0xc5],1),uint([0x83],1),str([0x86],'V_VP8'),uint([0x23,0xe3,0x83],100000000),group([0xe0],[uint([0xb0],640),uint([0xba],360)])])]);
                          const cluster=group([0x1f,0x43,0xb6,0x75],[uint([0xe7],0),...chunks.map(chunk=>tag([0xa3],join([Uint8Array.from([0x81,(chunk.time>>8)&255,chunk.time&255,chunk.key?0x80:0]),chunk.data])))]);
                          const video=join([header,Uint8Array.from([0x18,0x53,0x80,0x67,0xff]),info,tracks,cluster]);
                          const reader=new FileReader();const done=new Promise(resolve=>reader.onload=resolve);reader.readAsDataURL(new Blob([video],{type:'video/webm'}));await done;window.__eventVideo=reader.result;
                        })().catch(e=>window.__eventVideo='error:'+e.message);
                        """);
                    string videoJson = "null";
                    for (int attempt = 0; attempt < 60 && videoJson == "null"; attempt++)
                    {
                        await Task.Delay(100);
                        videoJson = await host.web.CoreWebView2.ExecuteScriptAsync("window.__eventVideo");
                    }
                    string videoData = JsonSerializer.Deserialize<string>(videoJson) ?? throw new Exception("测试视频未生成");
                    if (!videoData.StartsWith("data:video/webm;base64,")) throw new Exception(videoData);
                    string videoPath = Path.Combine(host.projectDirectory ?? throw new Exception("测试工程未打开"), "assets", "events", "test-video.webm");
                    Directory.CreateDirectory(Path.GetDirectoryName(videoPath)!);
                    File.WriteAllBytes(videoPath, Convert.FromBase64String(videoData.Split(',')[1]));
                    File.Copy(videoPath, options.smokeBase + ".test-video.webm", true);
                    menuPhases = new List<string> { "events-media" };
                }
                if(Environment.GetCommandLineArgs().Contains("--smoke-agent-direct"))menuPhases.Clear();
                foreach (string phase in menuPhases)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__polishResult=null; window.__vrmSmokeMenuPolish(" + JsonSerializer.Serialize(phase) + ").then(r=>window.__polishResult=r).catch(e=>window.__polishResult={error:e.message})");
                    string polishResult = "null";
                    for (int attempt = 0; attempt < 2400 && polishResult == "null"; attempt++)
                    {
                        await Task.Delay(100);
                        polishResult = await host.web.CoreWebView2.ExecuteScriptAsync("window.__polishResult");
                    }
                    File.WriteAllText(options.smokeBase + ".menu-" + phase + ".json", polishResult);
                    using var polishImage = File.Create(options.smokeBase + ".menu-" + phase + ".png");
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, polishImage);
                    if (polishResult == "null" || polishResult.Contains("\"error\"")) throw new Exception(polishResult);
                }
                if (!options.playerMode && (Environment.GetCommandLineArgs().Contains("--smoke-library") || Environment.GetCommandLineArgs().Contains("--smoke-weather") || Environment.GetCommandLineArgs().Contains("--smoke-events") || Environment.GetCommandLineArgs().Contains("--smoke-history") || Environment.GetCommandLineArgs().Contains("--smoke-voices") || Environment.GetCommandLineArgs().Contains("--smoke-mouth") || Environment.GetCommandLineArgs().Contains("--smoke-protected")))
                {
                    var bookProject = host.ReadProject() ?? throw new Exception("PDF 测试工程缺失");
                    if (Environment.GetCommandLineArgs().Contains("--smoke-pdf"))
                    {
                        var importedBooks = JsonSerializer.SerializeToNode(host.ImportAssets("pdf", true))?.AsArray();
                        foreach (var importedBook in importedBooks ?? new JsonArray()) bookProject["assets"]!.AsArray().Add(importedBook?.DeepClone());
                        host.SaveProject(bookProject);
                    }
                    host.BuildGame(options.smokeBase + ".export", bookProject);
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-chapters"))
            {
                var chapterPhases = new List<string> { "editor", "render", "player", "replay" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-portrait-reuse")) chapterPhases.Add("portraits");
                foreach (string phase in chapterPhases)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__chapterResult=null; window.__vrmSmokeChapters(" + JsonSerializer.Serialize(phase) + "," + (options.smokeAvatarFile != null ? "true" : "false") + ").then(r=>window.__chapterResult=r).catch(e=>window.__chapterResult={error:e.message})");
                    string phaseResult = "null";
                    for (int attempt = 0; attempt < 100 && phaseResult == "null"; attempt++)
                    {
                        await Task.Delay(100);
                        phaseResult = await host.web.CoreWebView2.ExecuteScriptAsync("window.__chapterResult");
                    }
                    File.WriteAllText(options.smokeBase + ".chapters-" + phase + ".json", phaseResult);
                    using var chapterImage = File.Create(options.smokeBase + ".chapters-" + phase + ".png");
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, chapterImage);
                    if (phaseResult.Contains("\"error\"")) throw new Exception(phaseResult);
                    if (phase == "editor")
                    {
                        var savedChapter = host.ReadProject()?["acts"]?[0];
                        if (savedChapter?["render"]?["brightness"]?.GetValue<int>() != 135) throw new Exception("Chapter settings not saved");
                        if (options.smokeFileOpsParent != null) host.ExportGame("章节功能验证游戏");
                    }
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-agent")||Environment.GetCommandLineArgs().Contains("--smoke-agent-environment")){
                File.WriteAllText(options.smokeBase+".agent-connection.json",JsonSerializer.Serialize(host.SetAgentEnabled(true)));
                for(int n=0;n<3600 && !File.Exists(options.smokeBase+".agent-done");n++){
                    if(File.Exists(options.smokeBase+".agent-close-environment")&&!File.Exists(options.smokeBase+".agent-close-environment.done.json")){environmentWindow?.CloseWithoutPrompt();File.WriteAllText(options.smokeBase+".agent-close-environment.done.json",JsonSerializer.Serialize(new{ok=true,closed=environmentWindow==null||environmentWindow.IsDisposed}));}
                    if(Environment.GetCommandLineArgs().Contains("--smoke-agent-environment")&&File.Exists(options.smokeBase+".agent-window-edit")&&!File.Exists(options.smokeBase+".agent-window-edit.json")){
                        if(environmentWindow==null)throw new Exception("测试环境窗口没有打开");
                        File.WriteAllText(options.smokeBase+".agent-window-edit.json",await environmentWindow.AgentEditSmoke());
                    }
                    await Task.Delay(500);
                }
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-environment")){
                await host.web.CoreWebView2.ExecuteScriptAsync("window.__envOpen=null;window.__vrmSmokeEnvironmentOpen().then(r=>window.__envOpen=r).catch(e=>window.__envOpen={error:e.message})");
                for(int i=0;i<100&&environmentWindow==null;i++)await Task.Delay(100);
                if(environmentWindow==null)throw new Exception("环境窗口没有打开");
                string environmentResult=await environmentWindow.Smoke(options.smokeBase+".environment.png");File.WriteAllText(options.smokeBase+".environment.json",environmentResult);
                if(!environmentResult.Contains("\"ok\":true"))throw new Exception(environmentResult);
                await host.web.CoreWebView2.ExecuteScriptAsync("window.__envCheck=null;window.__vrmSmokeEnvironmentCheck().then(r=>window.__envCheck=r).catch(e=>window.__envCheck={error:e.message})");
                string checkResult="null";for(int i=0;i<200;i++){checkResult=await host.web.CoreWebView2.ExecuteScriptAsync("window.__envCheck");if(checkResult!="null")break;await Task.Delay(100);}
                File.WriteAllText(options.smokeBase+".environment-check.json",checkResult);if(!checkResult.Contains("\"ok\":true"))throw new Exception(checkResult);
                environmentWindow.Close();
                host.BuildGame(Path.Combine(Path.GetDirectoryName(options.smokeBase)!,"exported-game"),host.ReadProject()!);
                string expectedEnvironments=host.ReadProject()?["environments"]?.ToJsonString()??"";
                string expectedLibrary=host.ReadProject()?["environmentLibrary"]?.ToJsonString()??"";
                string archiveCheck=options.smokeBase+".vrmg";host.WriteArchive(host.projectDirectory!,archiveCheck);host.LoadArchive(archiveCheck);
                if(host.ReadProject()?["environments"]?.ToJsonString()!=expectedEnvironments||host.ReadProject()?["environmentLibrary"]?.ToJsonString()!=expectedLibrary)throw new Exception("环境或素材文件夹没有随工程包重开");
                File.WriteAllText(options.smokeBase+".archive-check.json",JsonSerializer.Serialize(new{ok=true,environments=host.ReadProject()?["environments"]?.AsArray().Count,libraryPreserved=true,archiveBytes=new FileInfo(archiveCheck).Length}));
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-vrm-thumbnails"))
            {
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=asset-tab][data-type=vrm]')?.click()");
                await Task.Delay(2500);
                File.WriteAllText(options.smokeBase + ".thumbnails.json", await host.web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                using (var shot = File.Create(options.smokeBase + ".thumbnails.png"))
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, shot);
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=asset-tab][data-type=image]')?.click()");
                await Task.Delay(300);
                using (var shot = File.Create(options.smokeBase + ".images.png"))
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, shot);
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                await Task.Delay(800);
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-depth-number"))
            {
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=title]')?.click()");
                await Task.Delay(400);
                File.WriteAllText(options.smokeBase + ".depth.json", await host.web.CoreWebView2.ExecuteScriptAsync("""
                    (() => {
                      const n=document.querySelector('.depth-number[data-title-adjust=offsetZ]');
                      const r=document.querySelector('input[type=range][data-title-adjust=offsetZ]');
                      if(!n||!r) throw Error('Missing numeric depth control');
                      const input=v=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));};
                      input('0.01');const exact=[n.valueAsNumber,r.valueAsNumber];
                      input('');const blankRange=r.valueAsNumber;
                      input('-2.41');const negative=[n.valueAsNumber,r.valueAsNumber];
                      r.value='0.02';r.dispatchEvent(new Event('input',{bubbles:true}));
                      const slider=[n.valueAsNumber,r.valueAsNumber];
                      input('-2.41');n.scrollIntoView({block:'center'});
                      return JSON.stringify({exact,blankRange,negative,slider,step:n.step});
                    })()
                    """));
                await Task.Delay(500);
                using (var shot = File.Create(options.smokeBase + ".depth.png"))
                    await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, shot);
                await host.web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                await Task.Delay(1200);
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-dialogue-camera"))await host.Scenarios["RunDialogueCameraSmoke"]();
            if(Environment.GetCommandLineArgs().Contains("--smoke-editor-modules"))await host.Scenarios["RunEditorModulesSmoke"]();
            if(Environment.GetCommandLineArgs().Contains("--smoke-walk-audit"))await host.Scenarios["RunWalkAuditSmoke"]();
            if(Environment.GetCommandLineArgs().Contains("--smoke-close-guard"))await host.Scenarios["RunCloseGuardSmoke"]();
            if(Environment.GetCommandLineArgs().Contains("--smoke-resource-package"))await host.Scenarios["RunResourcePackageSmoke"]();
            if(Environment.GetCommandLineArgs().Contains("--smoke-inventory")){
                foreach(string phase in options.playerMode?new[]{"player"}:Environment.GetCommandLineArgs().Contains("--smoke-inventory-reopen")?new[]{"reopen"}:new[]{"prepare","locked","reward","reload-pending","spend","gallery","detail","export"}){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__inventoryCheck=null;window.__vrmSmokeInventory("+JsonSerializer.Serialize(phase)+").then(r=>window.__inventoryCheck=r).catch(e=>window.__inventoryCheck={error:e.message})");
                    string check="null";for(int i=0;i<2400;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__inventoryCheck");if(check!="null")break;await Task.Delay(50);}
                    File.WriteAllText(options.smokeBase+".inventory-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".inventory-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(!check.Contains("\"ok\":true"))throw new Exception(check);
                }
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-npr")){
                foreach(string phase in options.playerMode?new[]{"player"}:Environment.GetCommandLineArgs().Contains("--smoke-npr-reopen")?new[]{"reopen"}:new[]{"neutral","zzz-low","zzz-high","custom","tno","dialogue","fbx","export"}){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__nprCheck=null;window.__vrmSmokeNpr("+JsonSerializer.Serialize(phase)+").then(r=>window.__nprCheck=r).catch(e=>window.__nprCheck={error:e.message})");
                    string check="null";for(int i=0;i<2400;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__nprCheck");if(check!="null")break;await Task.Delay(50);}
                    File.WriteAllText(options.smokeBase+".npr-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".npr-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(!check.Contains("\"ok\":true"))throw new Exception(check);
                }
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-preload")){
                foreach(string phase in options.playerMode?new[]{"trigger","player"}:Environment.GetCommandLineArgs().Contains("--smoke-preload-reopen")?new[]{"reopen"}:new[]{"off","trigger","partial","full","dynamic","adopt","export"}){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__preloadCheck=null;window.__vrmSmokePreload("+JsonSerializer.Serialize(phase)+").then(r=>window.__preloadCheck=r).catch(e=>window.__preloadCheck={error:e.message})");
                    string check="null";for(int i=0;i<2400;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__preloadCheck");if(check!="null")break;await Task.Delay(50);}
                    File.WriteAllText(options.smokeBase+".preload-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".preload-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(!check.Contains("\"ok\":true"))throw new Exception(check);
                }
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-fbx-portrait")){
                foreach(string phase in options.playerMode?new[]{"player"}:Environment.GetCommandLineArgs().Contains("--smoke-fbx-portrait-reopen")?new[]{"reopen"}:new[]{"auto","manual","reshoot","export"}){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__fbxPortraitCheck=null;window.__vrmSmokeFbxPortrait("+JsonSerializer.Serialize(phase)+").then(r=>window.__fbxPortraitCheck=r).catch(e=>window.__fbxPortraitCheck={error:e.message})");
                    string check="null";for(int i=0;i<1800;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__fbxPortraitCheck");if(check!="null")break;await Task.Delay(50);}
                    File.WriteAllText(options.smokeBase+".fbx-portrait-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".fbx-portrait-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(!check.Contains("\"ok\":true"))throw new Exception(check);
                }
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-shoulder-portrait")){
                foreach(string phase in options.playerMode?new[]{"player"}:new[]{"vrm","fbx","png","export"}){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__shoulderCheck=null;window.__vrmSmokeShoulderPortrait("+JsonSerializer.Serialize(phase)+").then(r=>window.__shoulderCheck=r).catch(e=>window.__shoulderCheck={error:e.message})");
                    string check="null";for(int i=0;i<1200;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__shoulderCheck");if(check!="null")break;await Task.Delay(50);}
                    File.WriteAllText(options.smokeBase+".shoulder-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".shoulder-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(check.Contains("\"error\""))throw new Exception(check);
                }
            }
            if(Environment.GetCommandLineArgs().Contains("--smoke-render-regression")){
                bool reopenOnly=Environment.GetCommandLineArgs().Contains("--smoke-render-reopen");
                string[] phases=options.playerMode?new[]{"player"}:reopenOnly?new[]{"reopen","texture-sky"}:new[]{"prepare","outline-0","outline-1","outline-2","outline-3","dark","mouth","offstage","fbx","export","environment"};
                foreach(string phase in phases){
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__renderCheck=null;window.__vrmSmokeRenderRegression("+JsonSerializer.Serialize(phase)+").then(r=>window.__renderCheck=r).catch(e=>window.__renderCheck={error:e.message})");
                    string check="null";for(int i=0;i<1200;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__renderCheck");if(check!="null")break;await Task.Delay(50);}
                    File.WriteAllText(options.smokeBase+".render-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".render-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(check.Contains("\"error\""))throw new Exception(check);
                }
                if(!options.playerMode&&!reopenOnly){
                    for(int i=0;i<100&&environmentWindow==null;i++)await Task.Delay(100);
                    if(environmentWindow==null)throw new Exception("环境窗口没有打开");
                    foreach(string phase in new[]{"countdown","warning","saving","result"}){
                        string check=await environmentWindow.AutosaveSmoke(phase,options.smokeBase+".autosave-"+phase+".png");File.WriteAllText(options.smokeBase+".autosave-"+phase+".json",check);
                        if(check.Contains("\"error\""))throw new Exception(check);
                    }
                    environmentWindow.Close();
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-scene-animations"))
            {
                string[] phases=Environment.GetCommandLineArgs().Contains("--smoke-scene-reopen")?new[]{"reopen"}:options.playerMode?new[]{"player"}:new[]{"editor","playback","archive-export"};
                foreach(string phase in phases)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__sceneCheck=null;window.__vrmSmokeSceneAnimations("+JsonSerializer.Serialize(phase)+").then(r=>window.__sceneCheck=r).catch(e=>window.__sceneCheck={error:e.message})");
                    string check="null";
                    for(int i=0;i<600;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__sceneCheck");if(check!="null")break;await Task.Delay(100);}
                    File.WriteAllText(options.smokeBase+".scene-"+phase+".json",check);
                    using(var shot=File.Create(options.smokeBase+".scene-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(check.Contains("\"error\""))break;
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-mixamo"))
            {
                string[] phases=Environment.GetCommandLineArgs().Contains("--smoke-mixamo-before")?new[]{"before"}:new[]{"fbx","vrm","binding"};
                foreach(string phase in phases)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__mixamoCheck=null;window.__vrmSmokeMixamo("+JsonSerializer.Serialize(phase)+").then(r=>window.__mixamoCheck=r).catch(e=>window.__mixamoCheck={error:e.message})");
                    string check="null";
                    for(int i=0;i<600;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__mixamoCheck");if(check!="null")break;await Task.Delay(100);}
                    File.WriteAllText(options.smokeBase+".mixamo-"+phase+".json",check);
                    string? posePng=JsonSerializer.Deserialize<string>(await host.web.CoreWebView2.ExecuteScriptAsync("window.__mixamoPng || null"));
                    if(posePng!=null)File.WriteAllBytes(options.smokeBase+".mixamo-"+phase+".pose.png",Convert.FromBase64String(posePng));
                    using(var shot=File.Create(options.smokeBase+".mixamo-"+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(check.Contains("\"error\""))break;
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-props"))
            {
                string[] phases = Environment.GetCommandLineArgs().Contains("--smoke-props-reopen")
                    ? new[] { "reopen" } : Environment.GetCommandLineArgs().Contains("--smoke-props-player") ? new[] { "player-props" } : Environment.GetCommandLineArgs().Contains("--smoke-props-export") ? new[] { "archive-export" } : new[] { "fbx-binding", "vrm-binding", "model-switch", "dialogue-visible", "one-shot", "dialogue-hidden", "dialogue-roster", "title-multi", "finger-bindings", "binding-view", "binding-view-exit" };
                foreach (string phase in phases)
                {
                    await host.web.CoreWebView2.ExecuteScriptAsync("window.__propCheck=null;window.__vrmSmokeProps(" + JsonSerializer.Serialize(phase) + ").then(r=>window.__propCheck=r).catch(e=>window.__propCheck={error:e.message})");
                    string check="null";
                    for(int i=0;i<600;i++){check=await host.web.CoreWebView2.ExecuteScriptAsync("window.__propCheck");if(check!="null")break;await Task.Delay(100);}
                    File.WriteAllText(options.smokeBase + "." + phase + ".json",check);
                    using(var shot=File.Create(options.smokeBase+"."+phase+".png"))await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,shot);
                    if(check.Contains("\"error\""))break;
                }
            }
            string result = await host.web.CoreWebView2.ExecuteScriptAsync(
                "JSON.stringify(window.__vrmDiagnostics ? window.__vrmDiagnostics() : {error:'UI not ready'})");
            File.WriteAllText(options.smokeBase + ".json", result);
            if (host.projectArchivePath != null && host.projectDirectory != null)
            {
                string? firstAsset = host.ReadProject()?["assets"]?.AsArray().FirstOrDefault()?["path"]?.GetValue<string>();
                string? firstPath = firstAsset == null ? null : Path.Combine(host.projectDirectory, firstAsset.Replace('/', Path.DirectorySeparatorChar));
                string url = firstAsset == null ? "" : "https://project.galgame/" + string.Join('/', firstAsset.Split('/').Select(Uri.EscapeDataString));
                await host.web.CoreWebView2.ExecuteScriptAsync(
                    "fetch(" + JsonSerializer.Serialize(url) + ").then(r=>window.__testFetch=JSON.stringify({status:r.status,url:r.url})).catch(e=>window.__testFetch=String(e))");
                await Task.Delay(500);
                string browserFetch = await host.web.CoreWebView2.ExecuteScriptAsync("window.__testFetch || 'pending'");
                File.WriteAllText(options.smokeBase + ".archive-debug.txt",
                    $"workspace={projectDirectory}\nasset={firstPath}\nexists={File.Exists(firstPath)}\nfetch={browserFetch}");
            }
            using var stream = File.Create(options.smokeBase + ".png");
            await host.web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
            if (options.smokeSaveSlots)
                await host.web.CoreWebView2.ExecuteScriptAsync(
                    "localStorage.removeItem('vrm-save-slots-' + (window.__vrmProjectId || ''))");
        }
        catch (Exception ex)
        {
            File.WriteAllText(options.smokeBase + ".error.txt", ex.ToString());
        }
        finally { File.WriteAllText(options.smokeBase+".complete.json",JsonSerializer.Serialize(new{ok=!File.Exists(options.smokeBase+".error.txt"),completed=true}));host.Complete(); }
    }


}
