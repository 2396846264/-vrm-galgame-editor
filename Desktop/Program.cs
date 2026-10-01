using System.Text.Json;
using System.Text.Json.Nodes;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace VRMGalgame;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new EditorWindow());
    }
}

internal sealed class EditorWindow : Form
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly Dictionary<string, (FileStream Stream, string Id, string Type, string Name, string Path)> droppedImports = new();
    private string? projectDirectory;
    private string? projectArchivePath;
    private string? temporaryProjectDirectory;
    private string? startupProjectPath;
    private byte[]? loadedArchiveBytes;
    private readonly bool playerMode;
    private readonly string? smokeBase;
    private readonly bool smokePlay;
    private readonly bool smokeFastPlay;
    private readonly string? smokeOpenDirectory;
    private readonly bool smokeCharacterTwo;
    private readonly bool smokeSaveSlots;
    private readonly bool smokeControls;
    private readonly bool smokeDuplicate;
    private readonly bool smokeRender;
    private readonly bool smokeCast;
    private readonly bool smokeAdvance;
    private readonly bool smokeIteration;
    private readonly bool smokeBlend;
    private readonly bool smokeStepCast;
    private readonly bool smokeNewActCast;
    private readonly bool smokeEmptyAct;
    private readonly bool smokeTitle;
    private readonly bool smokeTheme;
    private readonly bool smokeAutoVolume;
    private readonly bool smokeTitleMenus;
    private readonly bool smokeGallery;
    private readonly bool smokeGalleryLayout;
    private readonly bool smokeGalleryProgress;
    private readonly bool smokeRootMotion;
    private readonly bool smokeMotionOptions;
    private readonly bool smokeExternalPreview;
    private readonly bool smokeCharacterPreview;
    private readonly bool smokeDiscovery;
    private readonly bool smokeRecent;
    private readonly bool smokeImageImport;
    private readonly bool smokeDepthShadow;
    private readonly bool smokePortraits;
    private readonly bool smokePortraitPose;
    private readonly string? smokeFileOpsParent;
    private readonly string? smokeArchiveParent;
    private readonly bool smokeNewArchive;
    private readonly bool smokeSaveTwice;
    private readonly string? smokeImportFolderPath;
    private readonly string? smokeAvatarFile;
    private bool smokeStarted;
    private bool fullscreen;
    private Size windowedClientSize;
    private readonly string appDirectory = AppContext.BaseDirectory;
    private const string AppHost = "app.galgame";
    private const string ProjectHost = "project.galgame";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private static readonly Size[] PlayerResolutions =
    [
        new(640, 360), new(960, 540), new(1280, 720),
        new(1600, 900), new(1920, 1080)
    ];

    public EditorWindow()
    {
        playerMode = File.Exists(Path.Combine(appDirectory, "game.config.json"));
        if (playerMode) projectDirectory = Path.Combine(appDirectory, "game");
        string[] arguments = Environment.GetCommandLineArgs();
        if (!playerMode)
        {
            int index = Array.IndexOf(arguments, "--project");
            if (index >= 0 && index + 1 < arguments.Length)
                startupProjectPath = Path.GetFullPath(arguments[index + 1]);
        }
        int smokeIndex = Array.IndexOf(arguments, "--smoke");
        smokePlay = arguments.Contains("--smoke-play");
        smokeFastPlay = arguments.Contains("--smoke-fast-play");
        smokeCharacterTwo = arguments.Contains("--smoke-character-two");
        smokeSaveSlots = arguments.Contains("--smoke-save-slots");
        smokeControls = arguments.Contains("--smoke-controls");
        smokeDuplicate = arguments.Contains("--smoke-duplicate");
        smokeRender = arguments.Contains("--smoke-render");
        smokeCast = arguments.Contains("--smoke-cast");
        smokeAdvance = arguments.Contains("--smoke-advance");
        smokeIteration = arguments.Contains("--smoke-iteration");
        smokeBlend = arguments.Contains("--smoke-blend");
        smokeStepCast = arguments.Contains("--smoke-step-cast");
        smokeNewActCast = arguments.Contains("--smoke-new-act-cast");
        smokeEmptyAct = arguments.Contains("--smoke-empty-act");
        smokeTitle = arguments.Contains("--smoke-title");
        smokeTheme = arguments.Contains("--smoke-theme");
        smokeAutoVolume = arguments.Contains("--smoke-auto-volume");
        smokeTitleMenus = arguments.Contains("--smoke-title-menus");
        smokeGallery = arguments.Contains("--smoke-gallery");
        smokeGalleryLayout = arguments.Contains("--smoke-gallery-layout");
        smokeGalleryProgress = arguments.Contains("--smoke-gallery-progress");
        smokeRootMotion = arguments.Contains("--smoke-root-motion");
        smokeMotionOptions = arguments.Contains("--smoke-motion-options");
        smokeExternalPreview = arguments.Contains("--smoke-external-preview");
        smokeCharacterPreview = arguments.Contains("--smoke-character-preview");
        smokeDiscovery = arguments.Contains("--smoke-discovery");
        smokeRecent = arguments.Contains("--smoke-recent");
        smokeImageImport = arguments.Contains("--smoke-image-import");
        smokeDepthShadow = arguments.Contains("--smoke-depth-shadow");
        smokePortraits = arguments.Contains("--smoke-portraits");
        smokePortraitPose = arguments.Contains("--smoke-portrait-pose");
        smokeNewArchive = arguments.Contains("--smoke-new-archive");
        smokeSaveTwice = arguments.Contains("--smoke-save-twice");
        int smokeFileOpsIndex = Array.IndexOf(arguments, "--smoke-file-ops");
        if (smokeFileOpsIndex >= 0 && smokeFileOpsIndex + 1 < arguments.Length)
            smokeFileOpsParent = Path.GetFullPath(arguments[smokeFileOpsIndex + 1]);
        int smokeArchiveIndex = Array.IndexOf(arguments, "--smoke-archive-ops");
        if (smokeArchiveIndex >= 0 && smokeArchiveIndex + 1 < arguments.Length)
            smokeArchiveParent = Path.GetFullPath(arguments[smokeArchiveIndex + 1]);
        int smokeImportIndex = Array.IndexOf(arguments, "--smoke-import-folder");
        if (smokeImportIndex >= 0 && smokeImportIndex + 1 < arguments.Length)
            smokeImportFolderPath = Path.GetFullPath(arguments[smokeImportIndex + 1]);
        int smokeAvatarIndex = Array.IndexOf(arguments, "--smoke-avatar");
        if (smokeAvatarIndex >= 0 && smokeAvatarIndex + 1 < arguments.Length)
            smokeAvatarFile = Path.GetFullPath(arguments[smokeAvatarIndex + 1]);
        if (smokeIndex >= 0 && smokeIndex + 2 < arguments.Length)
        {
            if (!playerMode && arguments[smokeIndex + 1] != "-")
                startupProjectPath = Path.GetFullPath(arguments[smokeIndex + 1]);
            smokeBase = Path.GetFullPath(arguments[smokeIndex + 2]);
        }
        int smokeOpenIndex = Array.IndexOf(arguments, "--smoke-open");
        if (smokeOpenIndex >= 0 && smokeOpenIndex + 2 < arguments.Length)
        {
            smokeOpenDirectory = Path.GetFullPath(arguments[smokeOpenIndex + 1]);
            smokeBase = Path.GetFullPath(arguments[smokeOpenIndex + 2]);
            projectDirectory = null;
            startupProjectPath = null;
        }
        Text = playerMode ? "VRM Galgame" : "VRM Galgame 编辑器";
        if (playerMode)
        {
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            windowedClientSize = GetAvailableResolutions()
                .Where(size => size.Width <= 1280).LastOrDefault(new Size(640, 360));
            ClientSize = windowedClientSize;
        }
        else
        {
            Width = 1500;
            Height = 900;
            MinimumSize = new Size(1024, 650);
        }
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(web);
        Shown += async (_, _) => await InitializeWebAsync();
        FormClosed += (_, _) => CleanupTemporaryProject();
    }

    private async Task InitializeWebAsync()
    {
        try
        {
            string webDirectory = Path.Combine(appDirectory, "web");
            if (!File.Exists(Path.Combine(webDirectory, "index.html")))
                throw new Exception("程序文件不完整：找不到 web/index.html。请重新解压完整安装包。");
            var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: Environment.GetCommandLineArgs().Contains("--smoke-fresh-audio")
                    ? Path.Combine(Path.GetTempPath(), "VRMGalgame", "AudioSmoke", Guid.NewGuid().ToString("N"))
                    : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VRMGalgame", "WebView2"));
            await web.EnsureCoreWebView2Async(environment);
            await web.CoreWebView2.Profile.SetPermissionStateAsync(CoreWebView2PermissionKind.Autoplay,
                $"https://{AppHost}", CoreWebView2PermissionState.Allow);
            await web.CoreWebView2.Profile.SetPermissionStateAsync(CoreWebView2PermissionKind.Autoplay,
                $"https://{ProjectHost}", CoreWebView2PermissionState.Allow);
            web.CoreWebView2.PermissionRequested += (_, request) =>
            {
                if (request.PermissionKind == CoreWebView2PermissionKind.Autoplay &&
                    (request.Uri.StartsWith("https://app.galgame/") || request.Uri.StartsWith("https://project.galgame/")))
                    request.State = CoreWebView2PermissionState.Allow;
            };
            web.CoreWebView2.Settings.AreDevToolsEnabled = !playerMode;
            web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            web.CoreWebView2.SetVirtualHostNameToFolderMapping(AppHost, webDirectory, CoreWebView2HostResourceAccessKind.DenyCors);
            if (!playerMode && startupProjectPath != null)
            {
                if (Directory.Exists(startupProjectPath) && File.Exists(Path.Combine(startupProjectPath, "project.json")))
                    projectDirectory = startupProjectPath;
                else LoadArchive(startupProjectPath);
                RememberProject(startupProjectPath);
            }
            if (projectDirectory != null) MapProject();
            web.CoreWebView2.WebMessageReceived += OnWebMessage;
            web.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!e.Uri.StartsWith($"https://{AppHost}/", StringComparison.OrdinalIgnoreCase))
                    e.Cancel = true;
            };
            if (smokeBase != null)
                web.CoreWebView2.NavigationCompleted += async (_, _) =>
                {
                    if (smokeStarted) return;
                    smokeStarted = true;
                    await RunSmokeAsync();
                };
            web.Source = new Uri($"https://{AppHost}/{(playerMode ? "player.html" : "index.html")}{(smokeBase != null ? "?smoke=1" : "")}");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "无法启动", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task RunSmokeAsync()
    {
        try
        {
            if (smokeOpenDirectory != null)
            {
                await Task.Delay(150);
                await web.CoreWebView2.ExecuteScriptAsync(
                    "document.querySelector('[data-action=open-project]')?.click()");
                if (smokeCharacterTwo)
                {
                    await Task.Delay(1000);
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=select-character][data-index=\"1\"]')?.click()");
                }
                await Task.Delay(7000);
            }
            else
            {
                if (smokeNewArchive)
                {
                    await Task.Delay(150);
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('#new-name').value='测试压缩工程'; document.querySelector('[data-action=new-project]').click()");
                    await Task.Delay(1700);
                    File.WriteAllText(smokeBase + ".new-archive.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics ? window.__vrmDiagnostics() : {error:'UI not ready'})"));
                }
                if (smokeImportFolderPath != null)
                {
                    await Task.Delay(150);
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-action=import-folder-project]').click()");
                    await Task.Delay(1700);
                    File.WriteAllText(smokeBase + ".import-folder.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics ? window.__vrmDiagnostics() : {error:'UI not ready'})"));
                }
                await Task.Delay(smokeFastPlay ? 50 : smokePlay || smokeSaveSlots || smokeGallery || smokeGalleryProgress ? 1500 : 7000);
                if (smokeRecent && !playerMode)
                {
                    File.WriteAllText(smokeBase + ".recent-list.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({count:document.querySelectorAll('[data-action=open-recent]').length, first:document.querySelector('[data-action=open-recent]')?.textContent})"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=open-recent]')?.click()");
                    await Task.Delay(8500);
                    File.WriteAllText(smokeBase + ".recent-open.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (smokeAvatarFile != null && !playerMode && !Environment.GetCommandLineArgs().Contains("--smoke-chapters"))
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=add-character]')?.click(); document.querySelector('[data-action=upload-character-portrait]')?.click()");
                    await Task.Delay(2500);
                    File.WriteAllText(smokeBase + ".avatar-upload.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                }
                if (smokePortraitPose && !playerMode)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=select-character][data-index=\"0\"]')?.click(); const motion=document.querySelector('[data-field=\"character.galleryMotionId\"]'); motion.value='preset-mixamo-017'; motion.dispatchEvent(new Event('input',{bubbles:true})); motion.dispatchEvent(new Event('change',{bubbles:true}))");
                    string baseline = await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                    for (int attempt = 0; attempt < 45; attempt++)
                    {
                        await Task.Delay(1000);
                        string current = await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                        if (current != baseline && current != "\"\"") break;
                    }
                    File.WriteAllText(smokeBase + ".pose-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    string beforeId = await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                    await web.CoreWebView2.ExecuteScriptAsync("const pose=document.querySelector('[data-gallery-adjust=galleryPoseFrame]'); pose.value=String(Math.min(40, Number(pose.max))); pose.dispatchEvent(new Event('input',{bubbles:true})); pose.dispatchEvent(new Event('change',{bubbles:true}))");
                    for (int attempt = 0; attempt < 45; attempt++)
                    {
                        await Task.Delay(1000);
                        string current = await web.CoreWebView2.ExecuteScriptAsync("window.__vrmDiagnostics().characterPortraitIds[0].portraitId");
                        if (current != beforeId && current != "\"\"") break;
                    }
                    File.WriteAllText(smokeBase + ".pose-after.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using var poseStream = File.Create(smokeBase + ".pose-after.png");
                    await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, poseStream);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                }
                if (smokePlay || smokeFastPlay || smokeSaveSlots || smokeAutoVolume)
                {
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-action=play]')?.click()");
                    await Task.Delay(smokeFastPlay ? 100 : smokeSaveSlots ? 4000 : 9000);
                    if (smokeSaveSlots)
                    {
                        await web.CoreWebView2.ExecuteScriptAsync(
                            "localStorage.removeItem('vrm-save-slots-' + (window.__vrmProjectId || ''))");
                        await web.CoreWebView2.ExecuteScriptAsync(
                            "document.querySelector('[data-action=save-game]')?.click(); document.querySelector('[data-action=save-slot][data-index=\"1\"]')?.click(); document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('.stage-frame')?.click(); document.querySelector('[data-action=save-game]')?.click(); document.querySelector('[data-action=save-slot][data-index=\"2\"]')?.click(); document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('[data-action=load-game]')?.click(); document.querySelector('[data-action=load-slot][data-index=\"2\"]')?.click(); document.querySelector('[data-action=load-game]')?.click()");
                        await Task.Delay(2000);
                    }
                }
                if (smokePortraits && playerMode)
                {
                    for (int stepIndex = 1; stepIndex <= 6; stepIndex++)
                    {
                        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                        await Task.Delay(2600);
                        if (stepIndex >= 5)
                            File.WriteAllText(smokeBase + $".player-step-{stepIndex}.json", await web.CoreWebView2.ExecuteScriptAsync(
                                "JSON.stringify(window.__vrmDiagnostics())"));
                    }
                    using var playerPortraitStream = File.Create(smokeBase + ".player-portrait.png");
                    await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, playerPortraitStream);
                }
                if (smokeControls)
                {
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "for (const [selector, value] of [['[data-adjust=size]','150'],['[data-adjust=offsetX]','0.5'],['[data-adjust=offsetY]','0.25'],['[data-expression=happy]','35']]) { const input=document.querySelector(selector); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} } document.querySelector('.inspector').scrollTop=600");
                    await Task.Delay(1200);
                }
                if (smokeDuplicate)
                {
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-action=duplicate-step]')?.click(); for (const [selector, value] of [['[data-adjust=size]','250'],['[data-adjust=offsetY]','-4']]) { const input=document.querySelector(selector); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} }");
                    await Task.Delay(1200);
                }
                if (smokeRender)
                {
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-panel=render]')?.click(); for (const [key,value] of [['antialias','high'],['style','anime'],['outline','1'],['autoLight','true']]) { const input=document.querySelector('[data-render='+key+']'); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} }");
                    await Task.Delay(2000);
                }
                if (smokeDepthShadow && !playerMode)
                {
                    File.WriteAllText(smokeBase + ".shadow-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".shadow-before.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    File.WriteAllText(smokeBase + ".shadow-after.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".shadow-after.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("(()=>{const height=document.querySelector('[data-render=shadowHeight]');height.value='13';height.dispatchEvent(new Event('input',{bubbles:true}));})()");
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-render=shadowHeight]')?.scrollIntoView({block:'center'})");
                    await Task.Delay(600);
                    File.WriteAllText(smokeBase + ".shadow-raised.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".shadow-raised.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.head.insertAdjacentHTML('beforeend','<style>.stage-frame::after{display:none!important}</style>')");
                    using (var image = File.Create(smokeBase + ".shadow-no-fade.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("(()=>{const shadow=document.querySelector('[data-render=shadowEnabled]'); shadow.checked=false; shadow.dispatchEvent(new Event('input',{bubbles:true}));})()");
                    await Task.Delay(250);
                    using (var image = File.Create(smokeBase + ".shadow-off-no-fade.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("(()=>{const shadow=document.querySelector('[data-render=shadowEnabled]'); shadow.checked=true; shadow.dispatchEvent(new Event('input',{bubbles:true}));})()");
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=story]')?.click()");
                    await Task.Delay(100);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('[data-action=select-step]')[1]?.click()");
                    await Task.Delay(100);
                    await web.CoreWebView2.ExecuteScriptAsync("(()=>{const depth=document.querySelector('[data-adjust=offsetZ]'); if(depth){depth.value='0.4';depth.dispatchEvent(new Event('input',{bubbles:true}));}})()");
                    await Task.Delay(1400);
                    File.WriteAllText(smokeBase + ".speaker-depth.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=title]')?.click()");
                    await Task.Delay(100);
                    await web.CoreWebView2.ExecuteScriptAsync("(()=>{const depth=document.querySelector('[data-title-adjust=offsetZ]'); if(depth){depth.value='0.5';depth.dispatchEvent(new Event('input',{bubbles:true}));}})()");
                    await Task.Delay(1400);
                    File.WriteAllText(smokeBase + ".title-depth.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                    File.WriteAllText(smokeBase + ".shadow-saved.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (smokeCast)
                {
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "document.querySelector('[data-panel=story]')?.click(); document.querySelector('.cast-editor')?.setAttribute('open',''); for (const [key,value] of [['left.size','160'],['left.yaw','35']]) { const input=[...document.querySelectorAll('[data-cast-adjust]')].find(node=>node.dataset.castAdjust===key); if(input){input.value=value; input.dispatchEvent(new Event('input',{bubbles:true}));} } const motion=document.querySelector('[data-cast-motion=left]'); if(motion?.options[1]){motion.value=motion.options[1].value;motion.dispatchEvent(new Event('input',{bubbles:true}));}");
                    await Task.Delay(2000);
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "const input=[...document.querySelectorAll('[data-cast-expression]')].find(node=>node.dataset.castExpression==='left.happy'); if(input){input.value='55';input.dispatchEvent(new Event('input',{bubbles:true}));}");
                    await Task.Delay(500);
                }
                if (smokeAdvance)
                {
                    for (int index = 0; index < 3; index++)
                    {
                        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                        await Task.Delay(1300);
                    }
                }
                if (smokeRootMotion)
                {
                    File.WriteAllText(smokeBase + ".root-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await Task.Delay(800);
                    File.WriteAllText(smokeBase + ".root-after.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await Task.Delay(3200);
                    File.WriteAllText(smokeBase + ".root-long.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (smokeMotionOptions)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    File.WriteAllText(smokeBase + ".motion-hold.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("""
                        (() => {
                          const node = document.querySelector('[data-motion-options="step"][data-motion-setting="after"]');
                          node.value = 'idle';
                          node.dispatchEvent(new Event('input', { bubbles: true }));
                        })()
                        """);
                    await Task.Delay(1800);
                    File.WriteAllText(smokeBase + ".motion-idle.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1500);
                    File.WriteAllText(smokeBase + ".motion-saved.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (smokeExternalPreview && !playerMode)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=play]')?.click()");
                    await Task.Delay(4000);
                    File.WriteAllText(smokeBase + ".preview-result.json",
                        await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__lastPreviewGame || null)"));
                }
                if (smokeCharacterPreview && !playerMode)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=characters]')?.click(); document.querySelector('[data-action=select-character][data-index=\"1\"]')?.click()");
                    await Task.Delay(1800);
                    File.WriteAllText(smokeBase + ".character-preview.json",
                        await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (smokeFileOpsParent != null && !playerMode && !Environment.GetCommandLineArgs().Contains("--smoke-chapters"))
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=editor-settings]').click(); const interval=document.querySelector('#editor-auto-save-minutes'); interval.value='10'; interval.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('[data-action=close-editor-settings]').click(); window.prompt=()=> '测试副本'; document.querySelector('[data-action=save-as]').click()");
                    await Task.Delay(2600);
                    File.WriteAllText(smokeBase + ".save-as.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("window.prompt=()=> '测试导出'; document.querySelector('[data-action=export]').click()");
                    await Task.Delay(1800);
                    File.WriteAllText(smokeBase + ".export.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
                if (smokeSaveTwice && !playerMode)
                {
                    SaveProject(ReadProject());
                    SaveProject(ReadProject());
                    File.WriteAllText(smokeBase + ".save-twice.txt", "OK");
                }
                if (smokeIteration)
                {
                    string initial = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".initial.json", initial);
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    string after = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".iteration.json", after);
                }
                if (smokeBlend)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=play]')?.click()");
                    await Task.Delay(9000);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                    await Task.Delay(150);
                    string middle = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".blend-mid.json", middle);
                    await Task.Delay(550);
                    string final = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".blend-final.json", final);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                    await Task.Delay(150);
                    string backMiddle = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".blend-back-mid.json", backMiddle);
                    await Task.Delay(550);
                    string backFinal = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".blend-back-final.json", backFinal);
                }
                if (smokeStepCast)
                {
                    string before = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".cast-before.json", before);
                    await web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          const slot = document.querySelector('[data-step-cast]');
                          if (!slot) throw new Error('No dialogue position selector');
                          slot.value = slot.value === 'right' ? 'left' : 'right';
                          slot.dispatchEvent(new Event('input', {bubbles:true}));
                        })();
                        """);
                    await Task.Delay(1500);
                    string after = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".cast-after.json", after);
                }
                if (smokeNewActCast)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    string before = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".new-act-before.json", before);
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    string after = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".new-act-after.json", after);
                }
                if (smokeEmptyAct)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=select-act][data-index=\"1\"]')?.click()");
                    await Task.Delay(2200);
                    string before = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".empty-before.json", before);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=add-act]')?.click()");
                    await Task.Delay(1700);
                    string after = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".empty-after.json", after);
                }
                if (smokeTitle)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    await web.CoreWebView2.ExecuteScriptAsync("""
                        (function () {
                          const slider = document.querySelector('[data-title-expression=happy]');
                          if (!slider) throw new Error('Missing title expression slider');
                          slider.value = '65';
                          slider.dispatchEvent(new Event('input', {bubbles:true}));
                        })();
                        """);
                    await Task.Delay(250);
                    string titleResult = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".title.json", titleResult);
                }
                if (smokeAutoVolume)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("""
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
                    string autoStart = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".auto-start.json", autoStart);
                    await Task.Delay(5500);
                    string autoLater = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())");
                    File.WriteAllText(smokeBase + ".auto-later.json", autoLater);
                }
                if (smokeTitleMenus && playerMode)
                {
                    string menus = await web.CoreWebView2.ExecuteScriptAsync("""
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
                    File.WriteAllText(smokeBase + ".menus.json", menus);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=play-progress]').click()");
                    using (var image = File.Create(smokeBase + ".progress.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-modal [data-action=close-modal]').click(); document.querySelector('#player-start [data-action=play]').click()");
                    await Task.Delay(3500);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('#player-start [data-action=play-progress]')?.click()");
                    File.WriteAllText(smokeBase + ".progress-after.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics().progressStats)"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-modal [data-action=close-modal]').click(); document.querySelector('#player-start [data-action=play]').click()");
                    await Task.Delay(1800);
                    for (int index = 0; index < 6; index++)
                    {
                        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame')?.click()");
                        await Task.Delay(900);
                    }
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('#player-start [data-action=play-progress]')?.click()");
                    File.WriteAllText(smokeBase + ".progress-complete.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics().progressStats)"));
                }
                if (smokeImageImport && !playerMode)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=assets]')?.click()");
                    File.WriteAllText(smokeBase + ".images-before.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({included:window.__vrmDiagnostics().galleryImageCount, checks:document.querySelectorAll('[data-gallery-image]').length})"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=import][data-type=image]')?.click()");
                    File.WriteAllText(smokeBase + ".import-choice.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({visible:Boolean(document.querySelector('#image-import-modal')),defaultChecked:document.querySelector('#image-import-gallery')?.checked})"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=cancel-image-import]')?.click(); const check=document.querySelector('[data-gallery-image]'); if(check){check.checked=false;check.dispatchEvent(new Event('input',{bubbles:true}));}");
                    File.WriteAllText(smokeBase + ".images-excluded.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({included:window.__vrmDiagnostics().galleryImageCount,firstChecked:document.querySelector('[data-gallery-image]')?.checked})"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                    await Task.Delay(1600);
                    File.WriteAllText(smokeBase + ".images-saved.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({included:window.__vrmDiagnostics().galleryImageCount,dirty:window.__vrmDiagnostics().dirty})"));
                }
                if (smokeGallery && playerMode)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]').click()");
                    File.WriteAllText(smokeBase + ".images.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".images.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-page][data-index=\"1\"]')?.click()");
                    File.WriteAllText(smokeBase + ".page-two.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-page][data-index=\"0\"]')?.click()");
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-image]')?.click()");
                    File.WriteAllText(smokeBase + ".large-image.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-image-close]')?.click();document.querySelector('[data-action=gallery-tab][data-tab=music]')?.click()");
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-track]')?.click()");
                    await Task.Delay(800);
                    File.WriteAllText(smokeBase + ".music.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".music.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await Task.Delay(4400);
                    File.WriteAllText(smokeBase + ".music-next.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-repeat]')?.click()");
                    await Task.Delay(4400);
                    File.WriteAllText(smokeBase + ".music-repeat.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-tab][data-tab=characters]')?.click()");
                    await Task.Delay(2300);
                    File.WriteAllText(smokeBase + ".characters.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-story][data-index=\"1\"]')?.click()");
                    File.WriteAllText(smokeBase + ".story.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".first-character.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('[data-action=gallery-character]')[1]?.click()");
                    await Task.Delay(2200);
                    using (var image = File.Create(smokeBase + ".second-character.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('[data-action=gallery-character]')[2]?.click()");
                    await Task.Delay(2200);
                    using (var image = File.Create(smokeBase + ".third-character.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                }
                if (smokeGalleryProgress)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("localStorage.removeItem('vrm-save-slots-' + (window.__vrmProjectId || ''));document.querySelector('#player-start [data-action=play]').click()");
                    await Task.Delay(4500);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save-game]').click();document.querySelector('[data-action=save-slot][data-index=\"1\"]').click();document.querySelector('[data-action=close-modal]').click()");
                    File.WriteAllText(smokeBase + ".first-save.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.stage-frame').click()");
                    await Task.Delay(1100);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save-game]').click();document.querySelector('[data-action=save-slot][data-index=\"2\"]').click();document.querySelector('[data-action=close-modal]').click();document.querySelector('[data-action=stop-play]').click()");
                    await Task.Delay(1800);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]').click();document.querySelector('[data-action=gallery-tab][data-tab=characters]').click();document.querySelector('[data-action=gallery-story][data-index=\"1\"]')?.click()");
                    File.WriteAllText(smokeBase + ".unlocked.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    File.WriteAllText(smokeBase + ".slots.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(JSON.parse(localStorage.getItem('vrm-save-slots-' + (window.__vrmProjectId || ''))))"));
                }
                if (smokeDiscovery && playerMode)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]')?.click()");
                    File.WriteAllText(smokeBase + ".gallery-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".gallery-before.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-tab][data-tab=music]')?.click()");
                    File.WriteAllText(smokeBase + ".music-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=gallery-tab][data-tab=characters]')?.click(); document.querySelectorAll('[data-action=gallery-character]')[1]?.click()");
                    File.WriteAllText(smokeBase + ".character-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    using (var image = File.Create(smokeBase + ".character-before.png"))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('#player-start [data-action=play]')?.click()");
                    await Task.Delay(4200);
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save-game]')?.click()");
                    File.WriteAllText(smokeBase + ".save-before.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("window.__vrmSmokeAutoSave?.(); document.querySelector('[data-action=save-slot][data-index=\"0\"]')?.click(); document.querySelector('[data-action=save-slot][data-index=\"1\"]')?.click()");
                    await Task.Delay(350);
                    File.WriteAllText(smokeBase + ".manual-click.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    File.WriteAllText(smokeBase + ".save-after.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=close-modal]')?.click(); document.querySelector('.stage-frame')?.click()");
                    await Task.Delay(1200);
                    File.WriteAllText(smokeBase + ".progress-before-load.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("window.confirm = () => true; document.querySelector('[data-action=load-game]')?.click(); document.querySelector('[data-action=load-slot][data-index=\"1\"]')?.click()");
                    await Task.Delay(1200);
                    File.WriteAllText(smokeBase + ".progress-after-load.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                    await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=stop-play]')?.click(); document.querySelector('#player-start [data-action=gallery]')?.click()");
                    await Task.Delay(500);
                    File.WriteAllText(smokeBase + ".gallery-after.json", await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(window.__vrmDiagnostics())"));
                }
            }
            if (smokeTheme && !playerMode)
            {
                await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=toggle-editor-theme]')?.click()");
                await Task.Delay(200);
                File.WriteAllText(smokeBase + ".theme.json", await web.CoreWebView2.ExecuteScriptAsync(
                    "JSON.stringify({theme:document.body.dataset.editorTheme, saved:JSON.parse(localStorage.getItem('vrm-editor-settings') || '{}').theme, background:getComputedStyle(document.querySelector('.editor')).backgroundColor, spinnerDots:document.querySelectorAll('#act-loading .loading-spinner i').length, spinnerText:document.querySelector('#act-loading')?.textContent.trim()})"));
            }
            if (smokeGalleryLayout && playerMode)
            {
                await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-start [data-action=gallery]')?.click(); document.querySelector('[data-action=gallery-tab][data-tab=characters]')?.click()");
                await Task.Delay(1800);
                File.WriteAllText(smokeBase + ".gallery-layout.json", await web.CoreWebView2.ExecuteScriptAsync(
                    "JSON.stringify({portraitNameCount:document.querySelectorAll('.gallery-character-portrait .gallery-character-name').length,detailName:document.querySelector('.gallery-detail-name')?.textContent,detailFont:getComputedStyle(document.querySelector('.gallery-detail-name')).fontFamily,loaded:document.fonts.check('16px \"HarmonyOS Sans SC\"'),fontCredit:document.querySelector('.font-credit')?.textContent || ''})"));
            }
            if (smokePortraits && !playerMode)
            {
                for (int attempt = 0; attempt < 45; attempt++)
                {
                    string ready = await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics()?.characterPortraitIds?.every(x=>!x.modelId||(x.portraitId&&x.portraitPoseKey)))");
                    if (ready.Contains("true")) break;
                    await Task.Delay(2000);
                }
                await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=save]')?.click()");
                await Task.Delay(2500);
                await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-panel=story]')?.click(); document.querySelector('[data-action=select-step][data-index=\"1\"]')?.click()");
                await Task.Delay(5000);
                File.WriteAllText(smokeBase + ".portrait-story.json", await web.CoreWebView2.ExecuteScriptAsync(
                    "JSON.stringify(window.__vrmDiagnostics())"));
                using var portraitStream = File.Create(smokeBase + ".portrait-story.png");
                await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, portraitStream);
                for (int stepIndex = 5; stepIndex <= 6; stepIndex++)
                {
                    await web.CoreWebView2.ExecuteScriptAsync($"document.querySelector('[data-action=select-step][data-index=\"{stepIndex}\"]')?.click()");
                    await Task.Delay(2500);
                    File.WriteAllText(smokeBase + $".portrait-step-{stepIndex}.json", await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__vrmDiagnostics())"));
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-menu-polish"))
            {
                ClientSize = new Size(960, 540);
                var menuPhases = new List<string> { "audio", "settings", "gallery" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-glass")) menuPhases.AddRange(new[] { "music", "characters", "chapters", "saves", "story" });
                if (Environment.GetCommandLineArgs().Contains("--smoke-library")) menuPhases.AddRange(new[] { "library-search", "library-editor", "library-shelf", "library-reader", "library-turn" });
                foreach (string phase in menuPhases)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("window.__polishResult=null; window.__vrmSmokeMenuPolish(" + JsonSerializer.Serialize(phase) + ").then(r=>window.__polishResult=r).catch(e=>window.__polishResult={error:e.message})");
                    string polishResult = "null";
                    for (int attempt = 0; attempt < 100 && polishResult == "null"; attempt++)
                    {
                        await Task.Delay(100);
                        polishResult = await web.CoreWebView2.ExecuteScriptAsync("window.__polishResult");
                    }
                    File.WriteAllText(smokeBase + ".menu-" + phase + ".json", polishResult);
                    using var polishImage = File.Create(smokeBase + ".menu-" + phase + ".png");
                    await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, polishImage);
                    if (polishResult == "null" || polishResult.Contains("\"error\"")) throw new Exception(polishResult);
                }
                if (Environment.GetCommandLineArgs().Contains("--smoke-library"))
                {
                    var bookProject = ReadProject() ?? throw new Exception("PDF 测试工程缺失");
                    if (Environment.GetCommandLineArgs().Contains("--smoke-pdf"))
                    {
                        var importedBooks = JsonSerializer.SerializeToNode(ImportAssets("pdf", true))?.AsArray();
                        foreach (var importedBook in importedBooks ?? new JsonArray()) bookProject["assets"]!.AsArray().Add(importedBook?.DeepClone());
                        SaveProject(bookProject);
                    }
                    BuildGame(smokeBase + ".export", bookProject);
                }
            }
            if (Environment.GetCommandLineArgs().Contains("--smoke-chapters"))
            {
                var chapterPhases = new List<string> { "editor", "render", "player", "replay" };
                if (Environment.GetCommandLineArgs().Contains("--smoke-portrait-reuse")) chapterPhases.Add("portraits");
                foreach (string phase in chapterPhases)
                {
                    await web.CoreWebView2.ExecuteScriptAsync("window.__chapterResult=null; window.__vrmSmokeChapters(" + JsonSerializer.Serialize(phase) + "," + (smokeAvatarFile != null ? "true" : "false") + ").then(r=>window.__chapterResult=r).catch(e=>window.__chapterResult={error:e.message})");
                    string phaseResult = "null";
                    for (int attempt = 0; attempt < 100 && phaseResult == "null"; attempt++)
                    {
                        await Task.Delay(100);
                        phaseResult = await web.CoreWebView2.ExecuteScriptAsync("window.__chapterResult");
                    }
                    File.WriteAllText(smokeBase + ".chapters-" + phase + ".json", phaseResult);
                    using var chapterImage = File.Create(smokeBase + ".chapters-" + phase + ".png");
                    await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, chapterImage);
                    if (phaseResult.Contains("\"error\"")) throw new Exception(phaseResult);
                    if (phase == "editor")
                    {
                        var savedChapter = ReadProject()?["acts"]?[0];
                        if (savedChapter?["render"]?["brightness"]?.GetValue<int>() != 135) throw new Exception("Chapter settings not saved");
                        if (smokeFileOpsParent != null) ExportGame("章节功能验证游戏");
                    }
                }
            }
            string result = await web.CoreWebView2.ExecuteScriptAsync(
                "JSON.stringify(window.__vrmDiagnostics ? window.__vrmDiagnostics() : {error:'UI not ready'})");
            File.WriteAllText(smokeBase + ".json", result);
            if (projectArchivePath != null && projectDirectory != null)
            {
                string? firstAsset = ReadProject()?["assets"]?.AsArray().FirstOrDefault()?["path"]?.GetValue<string>();
                string? firstPath = firstAsset == null ? null : Path.Combine(projectDirectory, firstAsset.Replace('/', Path.DirectorySeparatorChar));
                string url = firstAsset == null ? "" : "https://project.galgame/" + string.Join('/', firstAsset.Split('/').Select(Uri.EscapeDataString));
                await web.CoreWebView2.ExecuteScriptAsync(
                    "fetch(" + JsonSerializer.Serialize(url) + ").then(r=>window.__testFetch=JSON.stringify({status:r.status,url:r.url})).catch(e=>window.__testFetch=String(e))");
                await Task.Delay(500);
                string browserFetch = await web.CoreWebView2.ExecuteScriptAsync("window.__testFetch || 'pending'");
                File.WriteAllText(smokeBase + ".archive-debug.txt",
                    $"workspace={projectDirectory}\nasset={firstPath}\nexists={File.Exists(firstPath)}\nfetch={browserFetch}");
            }
            using var stream = File.Create(smokeBase + ".png");
            await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
            if (smokeSaveSlots)
                await web.CoreWebView2.ExecuteScriptAsync(
                    "localStorage.removeItem('vrm-save-slots-' + (window.__vrmProjectId || ''))");
        }
        catch (Exception ex)
        {
            File.WriteAllText(smokeBase + ".error.txt", ex.ToString());
        }
        finally { Close(); }
    }

    private void MapProject()
    {
        if (projectDirectory == null) return;
        web.CoreWebView2.SetVirtualHostNameToFolderMapping(
            ProjectHost, projectDirectory, CoreWebView2HostResourceAccessKind.Allow);
    }

    private async void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!e.Source.StartsWith($"https://{AppHost}/", StringComparison.OrdinalIgnoreCase)) return;
        string id = "";
        try
        {
            JsonNode message = JsonNode.Parse(e.WebMessageAsJson) ?? throw new Exception("消息为空");
            id = message["id"]?.GetValue<string>() ?? "";
            string action = message["action"]?.GetValue<string>() ?? "";
            JsonNode? payload = message["payload"];
            object? data = action switch
            {
                "init" => GetProjectInfo(),
                "newProject" when !playerMode => NewProject(payload?["name"]?.GetValue<string>() ?? "新游戏"),
                "openProject" when !playerMode => OpenProject(),
                "openRecentProject" when !playerMode => OpenRecentProject(payload?["path"]?.GetValue<string>() ?? ""),
                "importFolderProject" when !playerMode => ImportFolderProject(),
                "saveProject" when !playerMode => SaveProject(payload?["project"], payload?["obsoletePortraitPaths"]?.AsArray().Select(node => node?.GetValue<string>() ?? "")),
                "saveProjectAs" when !playerMode => SaveProjectAs(payload?["project"], payload?["name"]?.GetValue<string>() ?? ""),
                "previewGame" when !playerMode => await PreviewGameAsync(payload?["project"]),
                "importAsset" when !playerMode => ImportAssets(payload?["type"]?.GetValue<string>() ?? "", payload?["single"]?.GetValue<bool>() ?? false),
                "importAssetChunk" when !playerMode => ImportAssetChunk(payload),
                "saveGeneratedPortrait" when !playerMode => SaveGeneratedPortrait(payload?["dataUrl"]?.GetValue<string>() ?? "", payload?["characterId"]?.GetValue<string>() ?? "", payload?["name"]?.GetValue<string>() ?? "角色"),
                "organizeGeneratedPortrait" when !playerMode => OrganizeGeneratedPortrait(payload?["path"]?.GetValue<string>() ?? "", payload?["characterId"]?.GetValue<string>() ?? "", payload?["name"]?.GetValue<string>() ?? "角色"),
                "deleteAsset" when !playerMode => DeleteAsset(payload?["path"]?.GetValue<string>() ?? ""),
                "exportGame" when !playerMode => ExportGame(payload?["folderName"]?.GetValue<string>() ?? ""),
                "setWindowResolution" when playerMode => SetWindowResolution(payload?["value"]?.GetValue<string>() ?? ""),
                "setFullscreen" when playerMode => SetFullscreen(payload?["value"]?.GetValue<bool>() ?? false),
                "exitGame" when playerMode => ExitGame(),
                _ => throw new Exception("当前操作不可用")
            };
            Send(new { id, ok = true, data });
        }
        catch (Exception ex)
        {
            Send(new { id, ok = false, error = ex.Message });
        }
        await Task.CompletedTask;
    }

    private object ExitGame()
    {
        BeginInvoke(new Action(Close));
        return new { closing = true };
    }

    private void Send(object value) => web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(value));

    private object GetProjectInfo() => new
    {
        mode = playerMode ? "player" : "editor",
        directory = projectArchivePath ?? projectDirectory,
        recentProjects = playerMode ? [] : ReadRecentProjects(),
        project = ReadProject(),
        windowResolution = $"{windowedClientSize.Width}x{windowedClientSize.Height}",
        availableResolutions = GetAvailableResolutions().Select(size => $"{size.Width}x{size.Height}").ToArray(),
        fullscreen
    };

    private static Size[] GetAvailableResolutions()
    {
        Rectangle area = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 720);
        return PlayerResolutions.Where(size => size.Width + 24 <= area.Width && size.Height + 62 <= area.Height).ToArray();
    }

    private object SetWindowResolution(string value)
    {
        if (fullscreen) throw new Exception("请先退出全屏，再调整窗口大小。");
        Size requested = GetAvailableResolutions()
            .FirstOrDefault(size => $"{size.Width}x{size.Height}" == value);
        if (requested == Size.Empty) throw new Exception("这个窗口大小不适合当前屏幕，请选列表里的大小。");
        windowedClientSize = requested;
        ClientSize = windowedClientSize;
        CenterToScreen();
        return new { windowResolution = value, fullscreen };
    }

    private object SetFullscreen(bool value)
    {
        if (fullscreen == value) return new { windowResolution = $"{windowedClientSize.Width}x{windowedClientSize.Height}", fullscreen };
        if (value)
        {
            windowedClientSize = ClientSize;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
        }
        else
        {
            WindowState = FormWindowState.Normal;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            ClientSize = windowedClientSize;
            CenterToScreen();
        }
        fullscreen = value;
        return new { windowResolution = $"{windowedClientSize.Width}x{windowedClientSize.Height}", fullscreen };
    }

    private JsonNode? ReadProject()
    {
        if (projectDirectory == null) return null;
        string file = Path.Combine(projectDirectory, "project.json");
        return File.Exists(file) ? JsonNode.Parse(File.ReadAllText(file)) : null;
    }

    private object? NewProject(string requestedName)
    {
        string name = SafeName(requestedName);
        string? archive = ChooseArchiveDestination(name, "选择新工程包的保存位置");
        if (archive == null) return null;
        ValidatePresetMotions();
        string directory = CreateWorkspace();
        Directory.CreateDirectory(Path.Combine(directory, "assets"));
        var presetAssets = CopyPresetMotions(directory);
        CleanupTemporaryProject();
        temporaryProjectDirectory = directory;
        projectDirectory = directory;
        projectArchivePath = archive;
        RememberProject(archive);
        MapProject();
        return new { directory = archive, presetAssets };
    }

    private string? ChooseArchiveDestination(string name, string title)
    {
        if (smokeArchiveParent != null)
        {
            Directory.CreateDirectory(smokeArchiveParent);
            string testPath = Path.Combine(smokeArchiveParent, name + ".vrmg");
            if (File.Exists(testPath)) throw new Exception("同名工程包已存在，请换一个名字。");
            return testPath;
        }
        using var dialog = new SaveFileDialog
        {
            Title = title, Filter = "VRM Galgame 工程包 (*.vrmg)|*.vrmg",
            DefaultExt = "vrmg", AddExtension = true, FileName = name + ".vrmg",
            OverwritePrompt = false
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return null;
        string path = Path.GetFullPath(dialog.FileName);
        if (File.Exists(path)) throw new Exception("同名工程包已存在，请换一个名字或保存位置。");
        return path;
    }

    private static string CreateWorkspace()
    {
        string path = Path.Combine(Path.GetTempPath(),
            "VRMGalgame", "Workspaces", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private void CleanupTemporaryProject()
    {
        string? old = temporaryProjectDirectory;
        temporaryProjectDirectory = null;
        loadedArchiveBytes = null;
        if (old == null) return;
        try { Directory.Delete(old, recursive: true); }
        catch { /* A still-loading model may hold a file briefly; stale workspaces can be removed later. */ }
    }

    private void LoadArchive(string path)
    {
        path = Path.GetFullPath(path);
        if (!File.Exists(path) || !new[] { ".vrmg", ".zip" }.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase))
            throw new Exception("请选择 .vrmg 工程包；旧版文件夹请用“导入旧工程”。");
        string workspace = CreateWorkspace();
        byte[]? archiveBytes = null;
        try
        {
            // Common-size projects are read into memory first, so the original package is never kept open.
            using (Stream stream = new FileInfo(path).Length <= 512L * 1024 * 1024
                ? new MemoryStream(archiveBytes = File.ReadAllBytes(path), writable: false)
                : File.OpenRead(path))
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                if (archive.Entries.Count > 20000 || archive.Entries.Sum(entry => entry.Length) > 30L * 1024 * 1024 * 1024)
                    throw new Exception("工程包内容过大或文件数量过多。");
                if (!archive.Entries.Any(entry => entry.FullName == "project.json"))
                    throw new Exception("工程包中找不到 project.json。");
                archive.ExtractToDirectory(workspace);
            }
            JsonNode? project = JsonNode.Parse(File.ReadAllText(Path.Combine(workspace, "project.json")));
            if (project is not JsonObject) throw new Exception("工程内容无效。");
        }
        catch
        {
            try { Directory.Delete(workspace, recursive: true); } catch { }
            throw;
        }
        CleanupTemporaryProject();
        temporaryProjectDirectory = workspace;
        projectDirectory = workspace;
        projectArchivePath = path;
        loadedArchiveBytes = archiveBytes;
    }

    private void RefreshArchiveMemory()
    {
        loadedArchiveBytes = projectArchivePath != null && new FileInfo(projectArchivePath).Length <= 512L * 1024 * 1024
            ? File.ReadAllBytes(projectArchivePath) : null;
    }

    private static void WriteArchive(string directory, string path)
    {
        string temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var archive = ZipFile.Open(temp, ZipArchiveMode.Create))
            {
                foreach (string file in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories))
                {
                    if (file.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) || file.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) continue;
                    string relative = Path.GetRelativePath(directory, file).Replace('\\', '/');
                    archive.CreateEntryFromFile(file, relative, CompressionLevel.Fastest);
                }
            }
            if (File.Exists(path))
            {
                string backupRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "VRMGalgame", "Backups");
                Directory.CreateDirectory(backupRoot);
                string key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Path.GetFullPath(path))));
                string backup = Path.Combine(backupRoot, key + ".vrmg");
                string backupTemp = backup + ".tmp";
                try
                {
                    File.Copy(path, backupTemp, overwrite: true);
                    File.Move(backupTemp, backup, overwrite: true);
                }
                finally { if (File.Exists(backupTemp)) File.Delete(backupTemp); }
                File.Replace(temp, path, null);
            }
            else File.Move(temp, path);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }

    private List<object> CopyPresetMotions(string directory)
    {
        string sourceDirectory = Path.Combine(appDirectory, "preset-motions");
        string manifestPath = Path.Combine(sourceDirectory, "manifest.json");
        if (!File.Exists(manifestPath)) throw new Exception("安装包缺少预制动作，请重新解压完整文件夹。");
        var manifest = JsonNode.Parse(File.ReadAllText(manifestPath))?.AsArray()
            ?? throw new Exception("预制动作清单无效。");
        string destination = Path.Combine(directory, "assets", "motion", "预制动作");
        Directory.CreateDirectory(destination);
        var assets = new List<object>();
        foreach (JsonNode? entry in manifest)
        {
            string filename = entry?["file"]?.GetValue<string>() ?? "";
            string id = entry?["id"]?.GetValue<string>() ?? "";
            string name = entry?["name"]?.GetValue<string>() ?? "";
            if (filename != Path.GetFileName(filename) || !filename.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
                throw new Exception("预制动作清单里有无效文件名。");
            string source = Path.Combine(sourceDirectory, filename);
            if (!File.Exists(source)) throw new Exception($"安装包缺少动作：{filename}");
            File.Copy(source, Path.Combine(destination, filename));
            assets.Add(new { id, name, path = $"assets/motion/预制动作/{filename}", type = "motion", folderId = "preset-motion-folder" });
        }
        return assets;
    }

    private void ValidatePresetMotions()
    {
        string sourceDirectory = Path.Combine(appDirectory, "preset-motions");
        string manifestPath = Path.Combine(sourceDirectory, "manifest.json");
        if (!File.Exists(manifestPath)) throw new Exception("安装包缺少预制动作，请重新解压完整文件夹。");
        var manifest = JsonNode.Parse(File.ReadAllText(manifestPath))?.AsArray()
            ?? throw new Exception("预制动作清单无效。");
        foreach (JsonNode? entry in manifest)
        {
            string filename = entry?["file"]?.GetValue<string>() ?? "";
            if (filename != Path.GetFileName(filename) || !filename.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase)
                || !File.Exists(Path.Combine(sourceDirectory, filename)))
                throw new Exception($"安装包缺少预制动作：{filename}");
        }
    }

    private object DeleteAsset(string relative)
    {
        if (projectDirectory == null) throw new Exception("请先打开工程。");
        string root = Path.GetFullPath(Path.Combine(projectDirectory, "assets")) + Path.DirectorySeparatorChar;
        string target = Path.GetFullPath(Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("只能删除当前工程里的素材。");
        if (File.Exists(target)) File.Delete(target);
        return new { deleted = true };
    }

    private object? OpenProject()
    {
        if (smokeOpenDirectory != null)
        {
            if (File.Exists(smokeOpenDirectory)) LoadArchive(smokeOpenDirectory);
            else { projectDirectory = smokeOpenDirectory; projectArchivePath = null; }
            RememberProject(smokeOpenDirectory);
            MapProject();
            return GetProjectInfo();
        }
        using var dialog = new OpenFileDialog
        {
            Title = "打开 VRM Galgame 工程包",
            Filter = "VRM Galgame 工程包 (*.vrmg;*.zip)|*.vrmg;*.zip|所有文件 (*.*)|*.*"
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return null;
        LoadArchive(dialog.FileName);
        RememberProject(dialog.FileName);
        MapProject();
        return GetProjectInfo();
    }

    private static string RecentProjectsFile => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "VRMGalgame", "recent-projects.json");

    private static string[] ReadRecentProjects()
    {
        try
        {
            var paths = JsonSerializer.Deserialize<string[]>(File.ReadAllText(RecentProjectsFile)) ?? [];
            return paths.Where(path => File.Exists(path) || Directory.Exists(path))
                .Distinct(StringComparer.OrdinalIgnoreCase).Take(10).ToArray();
        }
        catch { return []; }
    }

    private static void RememberProject(string path)
    {
        string full = Path.GetFullPath(path);
        string[] recent = [full, .. ReadRecentProjects().Where(item =>
            !string.Equals(item, full, StringComparison.OrdinalIgnoreCase)).Take(9)];
        string filename = RecentProjectsFile;
        Directory.CreateDirectory(Path.GetDirectoryName(filename)!);
        string temp = filename + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(recent));
        File.Move(temp, filename, overwrite: true);
    }

    private object OpenRecentProject(string path)
    {
        string full = Path.GetFullPath(path);
        if (!ReadRecentProjects().Contains(full, StringComparer.OrdinalIgnoreCase))
            throw new Exception("这个工程不在最近打开列表中，或文件已被移动。请重新选择工程包。");
        if (Directory.Exists(full) && File.Exists(Path.Combine(full, "project.json")))
        {
            CleanupTemporaryProject();
            projectDirectory = full;
            projectArchivePath = null;
        }
        else LoadArchive(full);
        RememberProject(full);
        MapProject();
        return GetProjectInfo();
    }

    private object? ImportFolderProject()
    {
        string source;
        if (smokeImportFolderPath != null) source = smokeImportFolderPath;
        else
        {
            using var dialog = new FolderBrowserDialog
            { Description = "选择旧版工程文件夹（里面有 project.json）", UseDescriptionForTitle = true };
            if (dialog.ShowDialog(this) != DialogResult.OK) return null;
            source = Path.GetFullPath(dialog.SelectedPath);
        }
        if (!File.Exists(Path.Combine(source, "project.json")))
            throw new Exception("所选文件夹没有 project.json，不是旧版工程。");
        JsonNode? content = JsonNode.Parse(File.ReadAllText(Path.Combine(source, "project.json")));
        if (content is not JsonObject) throw new Exception("旧版工程内容无效。");
        string? archive = ChooseArchiveDestination(SafeName(content["name"]?.GetValue<string>() ?? Path.GetFileName(source)), "将旧工程保存为工程包");
        if (archive == null) return null;
        string workspace = CreateWorkspace();
        try
        {
            CopyDirectory(source, workspace);
            WriteArchive(workspace, archive);
        }
        catch
        {
            try { Directory.Delete(workspace, recursive: true); } catch { }
            throw;
        }
        CleanupTemporaryProject();
        temporaryProjectDirectory = workspace;
        projectDirectory = workspace;
        projectArchivePath = archive;
        RememberProject(archive);
        RefreshArchiveMemory();
        MapProject();
        return GetProjectInfo();
    }

    private object SaveProject(JsonNode? project, IEnumerable<string>? obsoletePortraitPaths = null)
    {
        if (projectDirectory == null) throw new Exception("请先新建或打开工程。");
        if (project is not JsonObject) throw new Exception("工程内容无效。");
        project["version"] = 1;
        string file = Path.Combine(projectDirectory, "project.json");
        string temp = file + ".tmp";
        string backup = file + ".bak";
        File.WriteAllText(temp, project.ToJsonString(JsonOptions));
        if (File.Exists(file)) File.Replace(temp, file, backup);
        else File.Move(temp, file);
        if (obsoletePortraitPaths != null)
        {
            var usedPaths = project["assets"]?.AsArray().Select(node => node?["path"]?.GetValue<string>() ?? "").ToHashSet(StringComparer.OrdinalIgnoreCase) ?? new HashSet<string>();
            foreach (string obsolete in obsoletePortraitPaths)
                if (!usedPaths.Contains(obsolete)) DeleteAsset(obsolete);
        }
        if (projectArchivePath != null)
        {
            WriteArchive(projectDirectory, projectArchivePath);
            RefreshArchiveMemory();
            RememberProject(projectArchivePath);
        }
        return new { directory = projectArchivePath ?? projectDirectory };
    }

    private object? SaveProjectAs(JsonNode? project, string requestedName)
    {
        if (projectDirectory == null || project is not JsonObject) throw new Exception("请先打开有效的工程。");
        if (string.IsNullOrWhiteSpace(requestedName)) throw new Exception("工程名字不能为空。");
        string name = SafeName(requestedName);
        string? destination = ChooseArchiveDestination(name, "选择副本工程包的保存位置");
        if (destination == null) return null;
        string source = Path.GetFullPath(projectDirectory);
        if (destination.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new Exception("新工程包不能放在旧工程文件夹里面。");
        string workspace = projectArchivePath == null ? CreateWorkspace() : source;
        if (workspace != source) CopyDirectory(source, workspace);
        project["name"] = requestedName.Trim();
        project["version"] = 1;
        File.WriteAllText(Path.Combine(workspace, "project.json"), project.ToJsonString(JsonOptions));
        WriteArchive(workspace, destination);
        if (workspace != source)
        {
            CleanupTemporaryProject();
            temporaryProjectDirectory = workspace;
            projectDirectory = workspace;
        }
        projectArchivePath = destination;
        RememberProject(destination);
        RefreshArchiveMemory();
        MapProject();
        return new { directory = destination };
    }

    private object? ImportAssets(string type, bool single = false)
    {
        if (projectDirectory == null) throw new Exception("请先新建或打开工程。");
        var extensions = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["vrm"] = [".vrm"],
            ["motion"] = [".vrma", ".fbx"],
            ["image"] = [".png", ".jpg", ".jpeg", ".webp"],
            ["audio"] = [".mp3", ".wav", ".ogg"],
            ["video"] = [".mp4", ".webm"],
            ["pdf"] = [".pdf"]
        };
        if (!extensions.TryGetValue(type, out var allowed)) throw new Exception("不支持的素材类型。");
        string[] sources;
        int smokePdfIndex = Array.IndexOf(Environment.GetCommandLineArgs(), "--smoke-pdf");
        if (type == "pdf" && smokePdfIndex >= 0 && smokePdfIndex + 1 < Environment.GetCommandLineArgs().Length)
            sources = [Path.GetFullPath(Environment.GetCommandLineArgs()[smokePdfIndex + 1])];
        else if (type == "image" && single && smokeAvatarFile != null) sources = [smokeAvatarFile];
        else
        {
            using var dialog = new OpenFileDialog
            {
                Title = "选择要导入的素材",
                Filter = $"支持的文件|{string.Join(';', allowed.Select(x => "*" + x))}|所有文件|*.*",
                Multiselect = !single
            };
            if (dialog.ShowDialog(this) != DialogResult.OK) return null;
            sources = dialog.FileNames;
        }
        string targetDirectory = Path.Combine(projectDirectory, "assets", type);
        Directory.CreateDirectory(targetDirectory);
        var results = new List<object>();
        foreach (string source in sources)
        {
            string extension = Path.GetExtension(source).ToLowerInvariant();
            if (!allowed.Contains(extension)) throw new Exception($"不支持 {extension} 文件。");
            string id = Guid.NewGuid().ToString("N");
            string filename = id + extension;
            string target = Path.Combine(targetDirectory, filename);
            File.Copy(source, target);
            results.Add(new { id, type, name = Path.GetFileName(source), path = $"assets/{type}/{filename}" });
        }
        return results;
    }

    private object? ImportAssetChunk(JsonNode? payload)
    {
        if (projectDirectory == null) throw new Exception("请先新建或打开工程。");
        string transferId = payload?["transferId"]?.GetValue<string>() ?? "";
        string type = payload?["type"]?.GetValue<string>() ?? "";
        string name = Path.GetFileName(payload?["name"]?.GetValue<string>() ?? "");
        string command = payload?["command"]?.GetValue<string>() ?? "";
        if (transferId.Length is < 1 or > 80) throw new Exception("拖入文件标识无效。");
        if (command == "abort")
        {
            if (droppedImports.Remove(transferId, out var aborted))
            {
                aborted.Stream.Dispose();
                File.Delete(Path.Combine(projectDirectory, aborted.Path.Replace('/', Path.DirectorySeparatorChar)));
            }
            return null;
        }
        if (command == "start")
        {
            var extensions = new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["vrm"] = [".vrm"], ["motion"] = [".vrma", ".fbx"],
                ["image"] = [".png", ".jpg", ".jpeg", ".webp"],
                ["audio"] = [".mp3", ".wav", ".ogg"], ["video"] = [".mp4", ".webm"]
            };
            if (!extensions.TryGetValue(type, out var allowed) || !allowed.Contains(Path.GetExtension(name).ToLowerInvariant()))
                throw new Exception($"“{name}”不是当前标签支持的素材。");
            if (droppedImports.ContainsKey(transferId)) throw new Exception("文件正在导入。");
            string id = Guid.NewGuid().ToString("N");
            string relative = $"assets/{type}/{id}{Path.GetExtension(name).ToLowerInvariant()}";
            string target = Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            droppedImports.Add(transferId, (new FileStream(target, FileMode.CreateNew, FileAccess.Write), id, type, name, relative));
            return null;
        }
        if (!droppedImports.TryGetValue(transferId, out var current)) throw new Exception("拖入文件已经中断，请重新拖入。");
        if (command == "append")
        {
            byte[] chunk = Convert.FromBase64String(payload?["base64"]?.GetValue<string>() ?? "");
            if (chunk.Length > 512 * 1024) throw new Exception("文件片段太大。");
            current.Stream.Write(chunk);
            return null;
        }
        if (command == "finish")
        {
            current.Stream.Dispose();
            droppedImports.Remove(transferId);
            return new { id = current.Id, type = current.Type, name = current.Name, path = current.Path };
        }
        throw new Exception("不支持的文件导入操作。");
    }

    private object OrganizeGeneratedPortrait(string relative, string characterId, string name)
    {
        if (projectDirectory == null) throw new Exception("请先打开工程。");
        string root = Path.GetFullPath(Path.Combine(projectDirectory, "assets")) + Path.DirectorySeparatorChar;
        string source = Path.GetFullPath(Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!source.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("只能整理工程里的头像。");
        return SaveGeneratedPortrait("data:image/png;base64," + Convert.ToBase64String(File.ReadAllBytes(source)), characterId, name);
    }

    private object SaveGeneratedPortrait(string dataUrl, string characterId, string name)
    {
        if (projectDirectory == null) throw new Exception("请先新建或打开工程。");
        const string prefix = "data:image/png;base64,";
        if (!dataUrl.StartsWith(prefix, StringComparison.Ordinal)) throw new Exception("头像图片格式不正确。");
        byte[] bytes = Convert.FromBase64String(dataUrl[prefix.Length..]);
        if (bytes.Length < 32 || bytes.Length > 12_000_000 || !bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            throw new Exception("头像图片无效或太大。");
        if (string.IsNullOrWhiteSpace(characterId)) throw new Exception("头像缺少角色编号。");
        string key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(characterId))).ToLowerInvariant()[..32];
        string id = "auto-portrait-" + key;
        string folder = Path.Combine(projectDirectory, "assets", "image", "自动角色头像");
        Directory.CreateDirectory(folder);
        string target = Path.Combine(folder, key + ".png");
        string temporary = target + ".tmp";
        File.WriteAllBytes(temporary, bytes);
        File.Move(temporary, target, true);
        return new { id, type = "image", name = SafeName(name) + "_头像.png", path = $"assets/image/自动角色头像/{key}.png", generatedPortrait = true, characterId, revision = Guid.NewGuid().ToString("N") };
    }

    private object? ExportGame(string requestedName)
    {
        if (projectDirectory == null || !File.Exists(Path.Combine(projectDirectory, "project.json")))
            throw new Exception("请先保存工程，再导出游戏。");
        if (string.IsNullOrWhiteSpace(requestedName)) throw new Exception("导出文件夹名字不能为空。");
        string parent;
        if (smokeFileOpsParent != null) parent = smokeFileOpsParent;
        else
        {
            using var dialog = new FolderBrowserDialog { Description = "选择游戏导出位置", UseDescriptionForTitle = true, ShowNewFolderButton = true };
            if (dialog.ShowDialog(this) != DialogResult.OK) return null;
            parent = dialog.SelectedPath;
        }
        string destination = Path.Combine(parent, SafeName(requestedName));
        if (Directory.Exists(destination)) throw new Exception("导出文件夹已存在。请选一个新位置，避免覆盖旧版本。");
        if (Path.GetFullPath(destination).StartsWith(Path.GetFullPath(projectDirectory) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new Exception("导出位置不能放在工程文件夹里面，请选择别的位置。");
        JsonNode gameProject = ReadProject() ?? throw new Exception("工程文件无法读取。");
        BuildGame(destination, gameProject);
        return new { directory = destination, executable = Path.Combine(destination, "VRMGalgame.exe") };
    }

    private async Task<object> PreviewGameAsync(JsonNode? snapshot)
    {
        if (projectDirectory == null || snapshot == null) throw new Exception("请先打开工程。");
        string root = Path.Combine(Path.GetTempPath(), "VRMGalgame", "Previews");
        Directory.CreateDirectory(root);
        string destination = Path.Combine(root, "preview-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N")[..8]);
        try
        {
            JsonNode projectCopy = snapshot.DeepClone();
            await Task.Run(() => BuildGame(destination, projectCopy));
            string executable = Path.Combine(destination, "VRMGalgame.exe");
            var start = new ProcessStartInfo(executable) { WorkingDirectory = destination, UseShellExecute = true };
            if (smokeBase != null)
            {
                start.ArgumentList.Add("--smoke");
                start.ArgumentList.Add("-");
                start.ArgumentList.Add(smokeBase + ".preview-child");
                start.ArgumentList.Add(smokeDiscovery ? "--smoke-discovery" : smokeTitleMenus ? "--smoke-title-menus" : smokeGallery ? "--smoke-gallery" : "--smoke-play");
            }
            Process process = Process.Start(start) ?? throw new Exception("临时游戏程序未能启动。");
            process.EnableRaisingEvents = true;
            process.Exited += (_, _) =>
            {
                process.Dispose();
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1500);
                    for (int attempt = 0; attempt < 3; attempt++)
                    {
                        try { DeletePreviewDirectory(root, destination); return; }
                        catch (IOException) { await Task.Delay(2000); }
                        catch (UnauthorizedAccessException) { await Task.Delay(2000); }
                    }
                });
            };
            return new { directory = destination, executable };
        }
        catch
        {
            try { DeletePreviewDirectory(root, destination); } catch { /* 留给系统临时目录清理 */ }
            throw;
        }
    }

    private static void DeletePreviewDirectory(string root, string destination)
    {
        string allowed = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string target = Path.GetFullPath(destination);
        if (!target.StartsWith(allowed, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("临时目录路径无效。");
        if (Directory.Exists(target)) Directory.Delete(target, recursive: true);
    }

    private void BuildGame(string destination, JsonNode gameProject)
    {
        if (projectDirectory == null) throw new Exception("工程尚未打开。");
        foreach (JsonNode? item in gameProject["assets"]?.AsArray() ?? new JsonArray())
        {
            string relative = item?["path"]?.GetValue<string>() ?? "";
            string full = Path.GetFullPath(Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar)));
            if (!full.StartsWith(Path.GetFullPath(projectDirectory) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
                throw new Exception($"工程素材缺失或路径无效：{relative}");
        }
        Directory.CreateDirectory(destination);
        foreach (string filename in new[] { "VRMGalgame.exe", "WebView2Loader.dll" })
        {
            string source = Path.Combine(appDirectory, filename);
            if (!File.Exists(source)) throw new Exception($"程序文件不完整：{filename}");
            File.Copy(source, Path.Combine(destination, filename));
        }
        CopyDirectory(Path.Combine(appDirectory, "web"), Path.Combine(destination, "web"));
        CopyDirectory(projectDirectory, Path.Combine(destination, "game"));
        File.WriteAllText(Path.Combine(destination, "game", "project.json"), gameProject.ToJsonString(JsonOptions));
        File.WriteAllText(Path.Combine(destination, "game.config.json"), "{}");
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source))
            File.Copy(file, Path.Combine(destination, Path.GetFileName(file)));
        foreach (string folder in Directory.GetDirectories(source))
            CopyDirectory(folder, Path.Combine(destination, Path.GetFileName(folder)));
    }

    private static string SafeName(string value)
    {
        string cleaned = new(value.Trim().Where(c => !Path.GetInvalidFileNameChars().Contains(c)).ToArray());
        cleaned = cleaned.Trim().Trim('.');
        if (cleaned.Length > 60) cleaned = cleaned[..60];
        return string.IsNullOrWhiteSpace(cleaned) ? "新游戏" : cleaned;
    }
}
