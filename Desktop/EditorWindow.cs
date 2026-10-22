using System.Text.Json;
using System.Text.Json.Nodes;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using ProtectedZipFile = ICSharpCode.SharpZipLib.Zip.ZipFile;
using ICSharpCode.SharpZipLib.Zip;

namespace VRMGalgame;

internal sealed partial class EditorWindow : Form
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
            if(arguments.Contains("--smoke-preload-raw"))projectDirectory=smokeOpenDirectory;
        }
        Text = "公民文艺生产综合自动化系统";
        using (var iconStream = typeof(EditorWindow).Assembly.GetManifestResourceStream("VRMGalgame.app.ico"))
            if (iconStream != null) Icon = new System.Drawing.Icon(iconStream, SystemInformation.IconSize);
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
        if (playerMode) SetFullscreen(true);
        Shown += async (_, _) => await InitializeWebAsync();
        FormClosing += OnEditorClosing;
        FormClosed += (_, _) => { StopAgentBridge(); foreach(var child in moduleWindows.Values.ToArray())child.CloseWithoutPrompt(); CleanupTemporaryProject(); playerResources?.Dispose(); };
    }

    private async Task InitializeWebAsync()
    {
        try
        {
            string webDirectory = Path.Combine(appDirectory, "web");
            if (!File.Exists(Path.Combine(webDirectory, "index.html")))
                throw new Exception("程序文件不完整：找不到 web/index.html。请重新解压完整安装包。");
            ProtectedResources.Verify(appDirectory);
            OpenPlayerResources();
            var smokeProfileArgs = Environment.GetCommandLineArgs();
            int smokeProfileIndex = Array.IndexOf(smokeProfileArgs,"--smoke-promo-profile");
            string? smokeProfilePath = smokeBase != null && smokeProfileIndex >= 0 && smokeProfileIndex + 1 < smokeProfileArgs.Length ? Path.GetFullPath(smokeProfileArgs[smokeProfileIndex+1]) : null;
            var environment = await CoreWebView2Environment.CreateAsync(
                userDataFolder: smokeProfilePath ?? (Environment.GetCommandLineArgs().Contains("--smoke-fresh-audio")
                    ? Path.Combine(Path.GetTempPath(), "VRMGalgame", "AudioSmoke", Guid.NewGuid().ToString("N"))
                    : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VRMGalgame", "WebView2")));
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
            if (playerMode) {
                web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                web.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
            }
            web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            web.CoreWebView2.SetVirtualHostNameToFolderMapping(AppHost, webDirectory, CoreWebView2HostResourceAccessKind.DenyCors);
            if (!playerMode && startupProjectPath != null)
            {
                // Folder workspaces are accepted only by the internal smoke harness.
                if (smokeBase != null && Directory.Exists(startupProjectPath) && File.Exists(Path.Combine(startupProjectPath, "project.json")))
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
            if (smokeBase != null) File.WriteAllText(smokeBase + ".error.txt", ex.ToString());
            else MessageBox.Show(this, ex.Message, "无法启动", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private Task RunSmokeAsync() => new LegacySmokeRunner(
        new LegacySmokeOptions
        {
            playerMode = playerMode,
            smokeBase = smokeBase,
            smokePlay = smokePlay,
            smokeFastPlay = smokeFastPlay,
            smokeOpenDirectory = smokeOpenDirectory,
            smokeCharacterTwo = smokeCharacterTwo,
            smokeSaveSlots = smokeSaveSlots,
            smokeControls = smokeControls,
            smokeDuplicate = smokeDuplicate,
            smokeRender = smokeRender,
            smokeCast = smokeCast,
            smokeAdvance = smokeAdvance,
            smokeIteration = smokeIteration,
            smokeBlend = smokeBlend,
            smokeStepCast = smokeStepCast,
            smokeNewActCast = smokeNewActCast,
            smokeEmptyAct = smokeEmptyAct,
            smokeTitle = smokeTitle,
            smokeTheme = smokeTheme,
            smokeAutoVolume = smokeAutoVolume,
            smokeTitleMenus = smokeTitleMenus,
            smokeGallery = smokeGallery,
            smokeGalleryLayout = smokeGalleryLayout,
            smokeGalleryProgress = smokeGalleryProgress,
            smokeRootMotion = smokeRootMotion,
            smokeMotionOptions = smokeMotionOptions,
            smokeExternalPreview = smokeExternalPreview,
            smokeCharacterPreview = smokeCharacterPreview,
            smokeDiscovery = smokeDiscovery,
            smokeRecent = smokeRecent,
            smokeImageImport = smokeImageImport,
            smokeDepthShadow = smokeDepthShadow,
            smokePortraits = smokePortraits,
            smokePortraitPose = smokePortraitPose,
            smokeFileOpsParent = smokeFileOpsParent,
            smokeNewArchive = smokeNewArchive,
            smokeSaveTwice = smokeSaveTwice,
            smokeAvatarFile = smokeAvatarFile,
        },
        new LegacySmokeHost
        {
            web = web, Window = this,
            ProjectDirectory = () => projectDirectory,
            ProjectArchivePath = () => projectArchivePath,
            ArchiveSaveRunning = () => archiveSaveRunning,
            EnvironmentWindow = () => environmentWindow,
            Close = Close,
            Complete = () => {
                foreach (var window in moduleWindows.Values.ToArray())
                    if (!window.IsDisposed) window.CloseWithoutPrompt();
                environmentWindow?.CloseWithoutPrompt();
                editorCloseApproved = true;
                Close();
            },
            ReadProject = ReadProject,
            SaveProject = project => SaveProject(project),
            SetFullscreen = SetFullscreen,
            ImportAssets = (type, single) => ImportAssets(type,single),
            BuildGame = BuildGame,
            ExportGame = ExportGame,
            SetAgentEnabled = SetAgentEnabled,
            WriteArchive = WriteArchive,
            LoadArchive = LoadArchive,
            Scenarios = new Dictionary<string,Func<Task>>
            {
                ["RunMotion72Smoke"] = RunMotion72Smoke,
                ["RunReference59Smoke"] = RunReference59Smoke,
                ["RunEditorLanguageSmoke"] = RunEditorLanguageSmoke,
                ["RunUi57Smoke"] = RunUi57Smoke,
                ["RunPalette56Smoke"] = RunPalette56Smoke,
                ["RunCommercial55Smoke"] = RunCommercial55Smoke,
                ["RunCommercial55PlayerSmoke"] = RunCommercial55PlayerSmoke,
                ["RunCommercial55LegacySmoke"] = RunCommercial55LegacySmoke,
                ["RunDefaults54Smoke"] = RunDefaults54Smoke,
                ["RunNaval80Smoke"] = RunNaval80Smoke,
                ["RunSecondary53Smoke"] = RunSecondary53Smoke,
                ["RunPromoPackageSmoke"] = RunPromoPackageSmoke,
                ["RunPromoPlayerSmoke"] = RunPromoPlayerSmoke,
                ["RunPromoExtrasSmoke"] = RunPromoExtrasSmoke,
                ["RunAuditModuleSmoke"] = RunAuditModuleSmoke,
                ["RunAuditStorySmoke"] = RunAuditStorySmoke,
                ["RunAuditSearchSmoke"] = RunAuditSearchSmoke,
                ["RunBlink49Smoke"] = RunBlink49Smoke,
                ["RunGaze50Smoke"] = RunGaze50Smoke,
                ["RunGeometry52Smoke"] = RunGeometry52Smoke,
                ["RunOcean51Smoke"] = RunOcean51Smoke,
                ["RunAirCombatSmoke"] = RunAirCombatSmoke,
                ["RunAndroidUISmoke"] = RunAndroidUISmoke,
                ["RunVrmPortrait28Smoke"] = RunVrmPortrait28Smoke,
                ["RunCutsceneSmoke"] = RunCutsceneSmoke,
                ["RunPortrait35Smoke"] = RunPortrait35Smoke,
                ["RunMmd36Smoke"] = RunMmd36Smoke,
                ["RunThumbnail37Smoke"] = RunThumbnail37Smoke,
                ["RunPhysics38Smoke"] = RunPhysics38Smoke,
                ["RunJitter39Smoke"] = RunJitter39Smoke,
                ["RunDetails43Smoke"] = RunDetails43Smoke,
                ["RunRender42Smoke"] = RunRender42Smoke,
                ["RunRender41Smoke"] = RunRender41Smoke,
                ["RunSpatial40Smoke"] = RunSpatial40Smoke,
                ["RunUi34Smoke"] = RunUi34Smoke,
                ["RunUi33Smoke"] = RunUi33Smoke,
                ["RunGallery32Smoke"] = RunGallery32Smoke,
                ["RunLoad31Smoke"] = RunLoad31Smoke,
                ["RunCopy30Smoke"] = RunCopy30Smoke,
                ["RunControls29Smoke"] = RunControls29Smoke,
                ["RunResidency29Smoke"] = RunResidency29Smoke,
                ["RunAndroidRepairExportSmoke"] = RunAndroidRepairExportSmoke,
                ["RunBlankProjectSmoke"] = RunBlankProjectSmoke,
                ["RunPlayerGraphicsSmoke"] = RunPlayerGraphicsSmoke,
                ["RunEditorFixSmoke"] = RunEditorFixSmoke,
                ["RunDialogueCameraSmoke"] = RunDialogueCameraSmoke,
                ["RunEditorModulesSmoke"] = RunEditorModulesSmoke,
                ["RunWalkAuditSmoke"] = RunWalkAuditSmoke,
                ["RunCloseGuardSmoke"] = RunCloseGuardSmoke,
                ["RunResourcePackageSmoke"] = RunResourcePackageSmoke,
                ["RunAuditCutscene"] = () => RunAuditRuntimeSmoke("cutscene"),
                ["RunAuditWar"] = () => RunAuditRuntimeSmoke("war"),
            }
        }).RunAsync();

    private void MapProject()
    {
        environmentSession = "";
        if (playerResources != null) { MapProtectedPlayerResources(); return; }
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
            if(archiveSaveRunning && action is not ("environmentCommitReply" or "editorModuleCommitReply" or "init"))throw new Exception("工程正在后台保存，请稍候再进行文件操作。");
            JsonNode? payload = message["payload"];
            object? data = await HandleEditorAction(action,payload);
            Send(new { id, ok = true, data });
        }
        catch (Exception ex)
        {
            Send(new { id, ok = false, error = ex.Message });
        }
        await Task.CompletedTask;
    }

    private async Task<object?> HandleEditorAction(string action,JsonNode? payload)
    {
        if(action=="editorLanguage"&&!playerMode)return EditorLanguage.Select(this,payload,"公民文艺生产综合自动化系统");
        if(archiveSaveRunning && action is not ("environmentCommitReply" or "editorModuleCommitReply" or "init"))throw new Exception("工程正在保存或导出，请稍候。");
        if(action is "newProject" or "openProject" or "openRecentProject" && moduleWindows.Values.Any(window=>!window.IsDisposed))throw new Exception("请先保存并关闭其他编辑窗口，再切换工程。");
        return action switch
            {
                "init" => GetProjectInfo(),
                "openEditorModule" when !playerMode => OpenEditorModule(payload),
                "notifyEditorModules" when !playerMode => NotifyEditorModules(payload),
                "editorModuleCommitReply" when !playerMode => EditorModuleCommitReply(payload),
                "openEnvironment" when !playerMode => OpenEnvironment(payload),
                "agentEnvironmentControl" when !playerMode => await AgentEnvironmentControl(payload),
                "environmentCommitReply" when !playerMode => EnvironmentCommitReply(payload),
                "setAgentEnabled" when !playerMode => SetAgentEnabled(payload?["enabled"]?.GetValue<bool>() ?? false),
                "agentReply" when !playerMode => ReceiveAgentReply(payload),
                "pickStoryDocuments" when !playerMode => PickStoryDocuments(),
                "pickDraftPlan" when !playerMode => PickDraftPlan(),
                "pickDraftAssets" when !playerMode => PickDraftAssets(),
                "agentReadDocument" when !playerMode => ReadStoryDocument(payload?["path"]?.GetValue<string>() ?? ""),
                "agentEditorWindows" when !playerMode => await AgentEditorWindows44(),
                "agentSyncEditorWindows" when !playerMode => await SyncAgentEditorWindows44(),
                "agentCaptureEditor" when !playerMode => await CaptureAgentEditor44(payload?["panel"]?.GetValue<string>()),
                "agentImportDialogueVoice" when !playerMode => ImportDialogueVoice(payload?["project"],payload?["actId"]?.GetValue<string>()??"",payload?["dialogueId"]?.GetValue<string>()??"",payload?["path"]?.GetValue<string>()),
                "agentImportAssets" when !playerMode => ImportAgentAssets44(payload),
                "agentExportGame" when !playerMode => ExportAgentGame(payload),
                "newProject" when !playerMode => NewProject(payload?["name"]?.GetValue<string>() ?? "新游戏"),
                "openProject" when !playerMode => OpenProject(),
                "openRecentProject" when !playerMode => OpenRecentProject(payload?["path"]?.GetValue<string>() ?? ""),
                "saveProject" when !playerMode => await SaveProjectAsync(payload?["project"], payload?["obsoletePortraitPaths"]?.AsArray().Select(node => node?.GetValue<string>() ?? "")),
                "saveProjectAs" when !playerMode => SaveProjectAs(payload?["project"], payload?["name"]?.GetValue<string>() ?? ""),
                "previewGame" when !playerMode => await PreviewGameAsync(payload?["project"]),
                "importDialogueVoice" when !playerMode => ImportDialogueVoice(payload?["project"], payload?["actId"]?.GetValue<string>() ?? "", payload?["dialogueId"]?.GetValue<string>() ?? ""),
                "organizeDialogueVoices" when !playerMode => OrganizeDialogueVoices(payload?["project"]),
                "importAsset" when !playerMode => ImportAssets(payload?["type"]?.GetValue<string>() ?? "", payload?["single"]?.GetValue<bool>() ?? false),
                "importCutsceneVideo" when !playerMode => ImportAssets("video",true,true),
                "importAssetChunk" when !playerMode => ImportAssetChunk(payload),
                "saveInventoryImage" when !playerMode => SaveInventoryImage(payload?["dataUrl"]?.GetValue<string>()??"",payload?["itemId"]?.GetValue<string>()??"",payload?["name"]?.GetValue<string>()??"物品"),
                "exportMixamoWhite" when !playerMode => ExportMixamoWhiteFile(payload,this),
                "saveGeneratedPortrait" when !playerMode => SaveGeneratedPortrait(payload?["dataUrl"]?.GetValue<string>() ?? "", payload?["characterId"]?.GetValue<string>() ?? "", payload?["name"]?.GetValue<string>() ?? "角色", payload?["previousRevision"]?.GetValue<string>() ?? ""),
                "saveModelThumbnail" when !playerMode => SaveModelThumbnail(payload?["dataUrl"]?.GetValue<string>()??"",payload?["modelId"]?.GetValue<string>()??""),
                "organizeGeneratedPortrait" when !playerMode => OrganizeGeneratedPortrait(payload?["path"]?.GetValue<string>() ?? "", payload?["characterId"]?.GetValue<string>() ?? "", payload?["name"]?.GetValue<string>() ?? "角色"),
                "restoreHistoryAssets" when !playerMode => RestoreHistoryAssets(payload?["project"]),
                "deleteAsset" when !playerMode => DeleteAsset(payload?["path"]?.GetValue<string>() ?? ""),
                "exportGame" when !playerMode => ExportGame(payload?["folderName"]?.GetValue<string>() ?? ""),
                "exportAndroid" when !playerMode => await ExportAndroidAsync(payload),
                "setWindowResolution" when playerMode => SetWindowResolution(payload?["value"]?.GetValue<string>() ?? ""),
                "openThirdPartyNotices" => OpenThirdPartyNotices(),
                "openCreatorHomepage" when !playerMode => EngineAttribution.OpenHomepage(),
                "engineOrigin" => EngineAttribution.Origin(),
                "setFullscreen" when playerMode => SetFullscreen(payload?["value"]?.GetValue<bool>() ?? false),
                "exitGame" when playerMode => ExitGame(),
                "captureGameThumbnail" => await CaptureGameThumbnail(payload),
                _ => throw new Exception("当前操作不可用")
            };
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
        feedbackGroup = playerMode ? "" : EngineAttribution.Text("feedbackGroup"),
        editorNotice = playerMode ? "" : EngineAttribution.Text("notice"),
        editorElapsedMilliseconds = EngineAttribution.ElapsedMilliseconds,
        agent = playerMode ? null : GetAgentConnection(),
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
        if (playerResources != null) {
            byte[] bytes = playerResources.ReadSmallFile("project.json");
            try { return JsonNode.Parse(bytes); } finally { CryptographicOperations.ZeroMemory(bytes); }
        }
        if (projectDirectory == null) return null;
        string file = Path.Combine(projectDirectory, "project.json");
        return File.Exists(file) ? JsonNode.Parse(File.ReadAllText(file)) : null;
    }

    private object? NewProject(string requestedName)
    {
        string name = SafeName(requestedName);
        string? archive = ChooseArchiveDestination(name, "选择新工程包的保存位置");
        if (archive == null) return null;
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
            Title = title, Filter = "公民文艺生产综合自动化系统工程包 (*.vrmg)|*.vrmg",
            DefaultExt = "vrmg", AddExtension = true, FileName = name + ".vrmg",
            OverwritePrompt = false
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return null;
        string path = Path.GetFullPath(dialog.FileName);
        if (File.Exists(path)) throw new Exception("同名工程包已存在，请换一个名字或保存位置。");
        return path;
    }

    private static string CreateWorkspace() => ProjectArchiveService.CreateWorkspace();

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
        var loaded = ProjectArchiveService.Extract(path, ProtectedBuildConstants.ArchivePassword());
        CleanupTemporaryProject();
        temporaryProjectDirectory = loaded.Workspace;
        projectDirectory = loaded.Workspace;
        projectArchivePath = loaded.ArchivePath;
        loadedArchiveBytes = loaded.Bytes;
    }

    private void RefreshArchiveMemory()
    {
        loadedArchiveBytes = projectArchivePath != null && new FileInfo(projectArchivePath).Length <= 512L * 1024 * 1024
            ? File.ReadAllBytes(projectArchivePath) : null;
    }

    private static void WriteArchive(string directory, string path) =>
        ProjectArchiveService.Write(directory, path, ProtectedBuildConstants.ArchivePassword());

    private List<object> CopyPresetMotions(string directory)
    {
        // Editor releases never redistribute an animation source library.
        // Existing projects retain their own imported animation files.
        return [];
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
            Title = EditorLanguage.T("打开公民文艺生产综合自动化系统工程包"),
            Filter = "公民文艺生产综合自动化系统工程包 (*.vrmg;*.zip)|*.vrmg;*.zip|所有文件 (*.*)|*.*"
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
            return paths.Where(path => File.Exists(path) && Path.GetExtension(path).Equals(".vrmg",StringComparison.OrdinalIgnoreCase))
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
        LoadArchive(full);
        RememberProject(full);
        MapProject();
        return GetProjectInfo();
    }

    private bool archiveSaveRunning;
    private void NotifyProjectSaving(bool saving)
    {
        if(web.CoreWebView2!=null)Send(new{projectSaving=saving});
        foreach(var window in moduleWindows.Values.ToArray())if(!window.IsDisposed)window.SetProjectSaving(saving);
    }
    private async Task<object> SaveProjectAsync(JsonNode? project, IEnumerable<string>? obsoletePortraitPaths = null)
    {
        if (archiveSaveRunning) throw new Exception("工程正在后台保存，请稍候。");
        archiveSaveRunning=true;
        NotifyProjectSaving(true);
        try
        {
            var result=SaveProject(project,obsoletePortraitPaths,false);
            string directory=projectDirectory!,archive=projectArchivePath??"";
            if(archive.Length==0)return result;
            byte[]? bytes=await Task.Run(()=>{WriteArchive(directory,archive);return new FileInfo(archive).Length<=512L*1024*1024?File.ReadAllBytes(archive):null;});
            loadedArchiveBytes=bytes;RememberProject(archive);return result;
        }
        finally {archiveSaveRunning=false;NotifyProjectSaving(false);}
    }
    private object SaveProject(JsonNode? project, IEnumerable<string>? obsoletePortraitPaths = null,bool writeArchive=true)
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
        if (writeArchive && projectArchivePath != null)
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
            throw new Exception("工程副本不能放在程序内部工作目录里面。");
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

    private static string VoiceCharacterKey(string characterId) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(characterId))).ToLowerInvariant()[..32];

    private object? ImportDialogueVoice(JsonNode? project, string actId, string dialogueId,string? providedPath=null)
    {
        if (projectDirectory == null || project is not JsonObject) throw new Exception("请先打开工程。");
        var act = project["acts"]?.AsArray().FirstOrDefault(item => item?["id"]?.GetValue<string>() == actId && item?["kind"]?.GetValue<string>() != "event");
        var line = act?["steps"]?.AsArray().FirstOrDefault(item => item?["id"]?.GetValue<string>() == dialogueId);
        if (line == null) throw new Exception("配音必须从对应的对白上传。");
        string characterId = line["characterId"]?.GetValue<string>() ?? "";
        var character = project["characters"]?.AsArray().FirstOrDefault(item => item?["id"]?.GetValue<string>() == characterId);
        if (string.IsNullOrWhiteSpace(characterId) || character == null) throw new Exception("请先选择这句对白的角色。");
        string text = line["text"]?.GetValue<string>() ?? "";
        if (string.IsNullOrWhiteSpace(text)) throw new Exception("请先填写对白内容，再上传配音。");
        string source;
        string[] args = Environment.GetCommandLineArgs(); int testIndex = Array.IndexOf(args, "--smoke-voice-file");
        if(providedPath!=null){source=Path.GetFullPath(providedPath);if(!File.Exists(source)||new FileInfo(source).Length>256*1024*1024)throw new Exception("配音不存在或超过 256 MB。");}
        else if (smokeBase != null && testIndex >= 0 && testIndex + 1 < args.Length) source = Path.GetFullPath(args[testIndex + 1]);
        else
        {
            using var dialog = new OpenFileDialog { Title = EditorLanguage.T("为这句对白上传配音"), Filter = "配音文件|*.mp3;*.wav;*.ogg", Multiselect = false };
            if (dialog.ShowDialog(this) != DialogResult.OK) return null;
            source = dialog.FileName;
        }
        string extension = Path.GetExtension(source).ToLowerInvariant();
        if (!new[] { ".mp3", ".wav", ".ogg" }.Contains(extension)) throw new Exception("配音只支持 MP3、WAV、OGG。");
        string id = Guid.NewGuid().ToString("N");
        string relative = $"assets/voice/{VoiceCharacterKey(characterId)}/{id}{extension}";
        string target = Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.Copy(source, target);
        return new { id, type = "voice", name = text, originalName = Path.GetFileName(source), path = relative,
            characterId, dialogueId, folderId = "character-voice-" + characterId, galleryMusic = false };
    }

    private object OrganizeDialogueVoices(JsonNode? project)
    {
        if (projectDirectory == null || project is not JsonObject) throw new Exception("请先打开工程。");
        string root = Path.GetFullPath(Path.Combine(projectDirectory, "assets")) + Path.DirectorySeparatorChar;
        var updates = new List<object>(); var warnings = new List<string>();
        foreach (var item in project["assets"]?.AsArray() ?? new JsonArray())
        {
            if (item?["type"]?.GetValue<string>() != "voice") continue;
            string id = item["id"]?.GetValue<string>() ?? "", characterId = item["characterId"]?.GetValue<string>() ?? "";
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(characterId)) throw new Exception("配音缺少所属角色。");
            string folderId = "character-voice-" + characterId;
            var folder = project["assetFolders"]?.AsArray().FirstOrDefault(folder => folder?["id"]?.GetValue<string>() == folderId && folder?["type"]?.GetValue<string>() == "voice");
            if (folder == null || item["folderId"]?.GetValue<string>() != folderId) throw new Exception("配音必须放在角色的专属文件夹。");
            string relative = (item["path"]?.GetValue<string>() ?? "").Replace('\\', '/');
            string source = Path.GetFullPath(Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar)));
            if (!source.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("配音文件路径无效。");
            string extension = Path.GetExtension(source).ToLowerInvariant();
            if (!new[] { ".mp3", ".wav", ".ogg" }.Contains(extension)) throw new Exception("配音文件格式无效。");
            string targetPrefix = $"assets/voice/{VoiceCharacterKey(characterId)}/";
            if (relative.StartsWith(targetPrefix, StringComparison.OrdinalIgnoreCase)) continue;
            if (!File.Exists(source)) { warnings.Add(item["name"]?.GetValue<string>() ?? id); continue; }
            string filename = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(id))).ToLowerInvariant()[..32] + extension;
            string targetRelative = targetPrefix + filename;
            string target = Path.Combine(projectDirectory, targetRelative.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            if (!File.Exists(target)) File.Copy(source, target);
            updates.Add(new { id, path = targetRelative });
        }
        return new { assets = updates, warnings };
    }

    private object? ImportAssets(string type, bool single = false,bool mp4Only=false,string[]? providedPaths=null)
    {
        if (projectDirectory == null) throw new Exception("请先新建或打开工程。");
        if (type == "voice") throw new Exception("配音不能从素材库导入，请到对应对白上传。");
        var extensions = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["vrm"] = [".vrm"], ["fbxCharacter"] = [".fbx"], ["mmdCharacter"]=[".pmx",".pmd"], ["sceneModel"] = [".glb",".pmx",".pmd"],
            ["motion"] = [".vrma", ".fbx", ".vmd"],
            ["image"] = [".png", ".jpg", ".jpeg", ".webp"],
            ["audio"] = [".mp3", ".wav", ".ogg"],
            ["video"] = mp4Only?[".mp4"]:[".mp4", ".webm"],
            ["pdf"] = [".pdf"]
        };
        if (!extensions.TryGetValue(type, out var allowed)) throw new Exception("不支持的素材类型。");
        string[] sources;
        int smokePdfIndex = Array.IndexOf(Environment.GetCommandLineArgs(), "--smoke-pdf");
        if(providedPaths!=null){sources=providedPaths.Select(Path.GetFullPath).ToArray();foreach(var path in sources)if(!File.Exists(path)||!allowed.Contains(Path.GetExtension(path).ToLowerInvariant()))throw new Exception("素材类型与文件扩展名不匹配。");}
        else if (type == "pdf" && smokePdfIndex >= 0 && smokePdfIndex + 1 < Environment.GetCommandLineArgs().Length)
            sources = [Path.GetFullPath(Environment.GetCommandLineArgs()[smokePdfIndex + 1])];
        else if (type == "image" && single && smokeAvatarFile != null) sources = [smokeAvatarFile];
        else
        {
            using var dialog = new OpenFileDialog
            {
                Title = EditorLanguage.T("选择要导入的素材"),
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
            if(type=="mmdCharacter"||(type=="sceneModel"&&(extension is ".pmx" or ".pmd"))){results.AddRange(ImportMmdModelFiles([source],type));continue;}
            if(type=="sceneModel")ValidateStandaloneGlb(source);
            string id = Guid.NewGuid().ToString("N");
            string filename = id + extension;
            if(type=="fbxCharacter") {
                string folder=Path.Combine(targetDirectory,id);Directory.CreateDirectory(folder);
                File.Copy(source,Path.Combine(folder,Path.GetFileName(source)));
                string sourceFolder=Path.GetDirectoryName(source)!;
                string fbxReferences=Encoding.UTF8.GetString(File.ReadAllBytes(source));
                var thumbnail=CopyModelFolderThumbnail(source,id,Directory.EnumerateFiles(sourceFolder).Where(f=>fbxReferences.Contains(Path.GetFileName(f),StringComparison.OrdinalIgnoreCase)).Select(Path.GetFileName).OfType<string>());
                results.Add(new {id,type,name=Path.GetFileName(source),path=$"assets/{type}/{id}/{Path.GetFileName(source)}",thumbnailPath=thumbnail.Path,thumbnailSource=thumbnail.Asset!=null?"folder":""});if(thumbnail.Asset!=null)results.Add(thumbnail.Asset);
                var textureExtensions=new HashSet<string>(StringComparer.OrdinalIgnoreCase){".png",".jpg",".jpeg",".webp",".bmp",".tga"};
                var candidates=Directory.EnumerateFiles(sourceFolder).Concat(new[]{"textures",Path.GetFileName(source)+".fbm",Path.GetFileNameWithoutExtension(source)+".fbm"}.SelectMany(sub=>Directory.Exists(Path.Combine(sourceFolder,sub))?Directory.EnumerateFiles(Path.Combine(sourceFolder,sub),"*",SearchOption.AllDirectories):Enumerable.Empty<string>()));
                foreach(string texture in candidates.Distinct(StringComparer.OrdinalIgnoreCase).Where(f=>textureExtensions.Contains(Path.GetExtension(f))&&fbxReferences.Contains(Path.GetFileName(f),StringComparison.OrdinalIgnoreCase))) {
                    string relative=Path.GetRelativePath(sourceFolder,texture).Replace('\\','/');string target=Path.Combine(folder,relative.Replace('/',Path.DirectorySeparatorChar));Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(texture,target);
                    results.Add(new{id=Guid.NewGuid().ToString("N"),type="modelDependency",name=Path.GetFileName(texture),path=$"assets/{type}/{id}/{relative}"});
                    string flat=Path.Combine(folder,Path.GetFileName(texture));if(!File.Exists(flat)){File.Copy(texture,flat);results.Add(new{id=Guid.NewGuid().ToString("N"),type="modelDependency",name=Path.GetFileName(texture),path=$"assets/{type}/{id}/{Path.GetFileName(texture)}"});}
                }
            }else {
                string target = Path.Combine(targetDirectory, filename);
                File.Copy(source, target);
                results.Add(new { id, type, name = Path.GetFileName(source), path = $"assets/{type}/{filename}" });
            }
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
                ["vrm"] = [".vrm"], ["fbxCharacter"] = [".fbx"], ["sceneModel"] = [".glb"], ["motion"] = [".vrma", ".fbx", ".vmd"],
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

    private object SaveInventoryImage(string dataUrl,string itemId,string name)
    {
        if(projectDirectory==null||string.IsNullOrWhiteSpace(itemId))throw new Exception("请先打开工程并选择物品。");
        const string prefix="data:image/png;base64,";if(!dataUrl.StartsWith(prefix,StringComparison.Ordinal))throw new Exception("物品立绘需要 PNG。");
        byte[] bytes=Convert.FromBase64String(dataUrl[prefix.Length..]);if(bytes.Length<32||bytes.Length>12_000_000||!bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}))throw new Exception("物品立绘无效或太大。");
        using(var stream=new MemoryStream(bytes))using(var image=System.Drawing.Image.FromStream(stream))if(image.Width!=image.Height||image.Width>4096)throw new Exception("物品立绘必须为1:1正方形。");
        string key=Guid.NewGuid().ToString("N"),folder=Path.Combine(projectDirectory,"assets","image","玩家物品立绘");Directory.CreateDirectory(folder);File.WriteAllBytes(Path.Combine(folder,key+".png"),bytes);
        return new{id="item-image-"+key,type="image",name=SafeName(name)+"_立绘.png",path="assets/image/玩家物品立绘/"+key+".png",itemImage=true,galleryImage=false};
    }

    private object SaveGeneratedPortrait(string dataUrl, string characterId, string name, string previousRevision = "")
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
        string revision = Guid.NewGuid().ToString("N");
        string historyFolder = Path.Combine(projectDirectory, ".editor-history", "portraits");
        Directory.CreateDirectory(historyFolder);
        if (File.Exists(target) && Guid.TryParseExact(previousRevision, "N", out _))
        {
            string previous = Path.Combine(historyFolder, key + "-" + previousRevision + ".png");
            if (!File.Exists(previous)) File.Copy(target, previous);
        }
        File.WriteAllBytes(Path.Combine(historyFolder, key + "-" + revision + ".png"), bytes);
        string temporary = target + ".tmp";
        File.WriteAllBytes(temporary, bytes);
        File.Move(temporary, target, true);
        return new { id, type = "image", name = SafeName(name) + "_头像.png", path = $"assets/image/自动角色头像/{key}.png", generatedPortrait = true, characterId, revision };
    }

    private object RestoreHistoryAssets(JsonNode? project)
    {
        if (projectDirectory == null || project is not JsonObject) throw new Exception("请先打开工程。");
        string root = Path.GetFullPath(Path.Combine(projectDirectory, "assets")) + Path.DirectorySeparatorChar;
        var copies = new List<(string Source, string Target)>();
        foreach (var item in project["assets"]?.AsArray() ?? new JsonArray())
        {
            if (item?["generatedPortrait"]?.GetValue<bool>() != true) continue;
            string revision = item["revision"]?.GetValue<string>() ?? "";
            string characterId = item["characterId"]?.GetValue<string>() ?? "";
            if (!Guid.TryParseExact(revision, "N", out _) || string.IsNullOrWhiteSpace(characterId)) continue;
            string target = Path.GetFullPath(Path.Combine(projectDirectory, (item["path"]?.GetValue<string>() ?? "").Replace('/', Path.DirectorySeparatorChar)));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("头像路径无效。");
            string key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(characterId))).ToLowerInvariant()[..32];
            string source = Path.Combine(projectDirectory, ".editor-history", "portraits", key + "-" + revision + ".png");
            if (File.Exists(source)) copies.Add((source, target));
        }
        foreach (var copy in copies) { Directory.CreateDirectory(Path.GetDirectoryName(copy.Target)!); File.Copy(copy.Source, copy.Target, true); }
        return new { restored = copies.Count };
    }

    private static HashSet<string> ProjectAssetPaths(string directory) =>
        ProjectFileSet.AssetPaths(directory);

    private static bool IncludeProjectFile(string relative, HashSet<string> assets) =>
        ProjectFileSet.Includes(relative, assets);

    private static void CopyCurrentProject(string source, string destination) =>
        ProjectFileSet.Copy(source, destination);

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
        ValidateInventoryContent(gameProject);
        BuildGame(destination, gameProject);
        return new { directory = destination, executable = Path.Combine(destination, "VRMGalgame.exe") };
    }

    private void ValidateInventoryContent(JsonNode project)
    {
        var items=(project["items"]?.AsArray()??new JsonArray()).Where(item=>item!=null).ToDictionary(item=>item!["id"]?.GetValue<string>()??"",item=>item!);
        var assets=(project["assets"]?.AsArray()??new JsonArray()).Where(item=>item!=null).ToDictionary(item=>item!["id"]?.GetValue<string>()??"",item=>item!);
        foreach(var act in project["acts"]?.AsArray()??new JsonArray())foreach(var line in act?["steps"]?.AsArray()??new JsonArray()){
            var rows=new List<JsonNode>();foreach(var row in line?["itemGrants"]?.AsArray()??new JsonArray())if(row!=null)rows.Add(row);
            foreach(var choice in line?["choices"]?.AsArray()??new JsonArray())foreach(var row in choice?["requirements"]?.AsArray()??new JsonArray())if(row!=null)rows.Add(row);
            foreach(var row in rows){string id=row["itemId"]?.GetValue<string>()??"";int count=row["quantity"]?.GetValue<int>()??0;
                if(count<1||count>1_000_000||!items.TryGetValue(id,out var item)||string.IsNullOrWhiteSpace(item["name"]?.GetValue<string>())||string.IsNullOrWhiteSpace(item["description"]?.GetValue<string>())||!assets.TryGetValue(item["imageId"]?.GetValue<string>()??"",out var image)||image["type"]?.GetValue<string>()!="image")throw new Exception("对白或分支的物品设置不完整，请检查名字、立绘、介绍与数量。");
            }
        }
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
                if(Environment.GetCommandLineArgs().Contains("--smoke-commercial55")){
                    start.ArgumentList.Add("--smoke-commercial55-player");
                    start.ArgumentList.Add("--smoke-fresh-audio");
                }
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
        File.Copy(Path.Combine(appDirectory,"web.integrity.json"),Path.Combine(destination,"web.integrity.json"));
        if(Directory.Exists(Path.Combine(appDirectory,"licenses")))CopyDirectory(Path.Combine(appDirectory,"licenses"),Path.Combine(destination,"licenses"));
        var playerProject=gameProject.DeepClone();
        if(playerProject is JsonObject playerObject)playerObject.Remove("authoring");
        var sources = new List<GameResourcePackage.Source> {
            new("project.json", null, Encoding.UTF8.GetBytes(playerProject.ToJsonString(new JsonSerializerOptions(JsonOptions) { WriteIndented = false })))
        };
        // Export only the snapshot's asset allowlist, never editor history,
        // backups, author notes, or unrelated files in the working directory.
        foreach (string relative in (playerProject["assets"]?.AsArray() ?? new JsonArray())
            .Select(item => (item?["path"]?.GetValue<string>() ?? "").Replace('\\', '/'))
            .Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(path => path, StringComparer.Ordinal)) {
            GameResourcePackage.NormalizePath(relative);
            if (!relative.StartsWith("assets/", StringComparison.OrdinalIgnoreCase)) throw new Exception("素材必须位于工程 assets 文件夹内。");
            sources.Add(new(relative, Path.Combine(projectDirectory, relative.Replace('/', Path.DirectorySeparatorChar))));
        }
        GameResourcePackage.Write(Path.Combine(destination, GameResourcePackage.FileName), sources);
        File.WriteAllText(Path.Combine(destination, "game.config.json"), "{\"resourceProtection\":\"aes-gcm-v1\"}");
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source))
            File.Copy(file, Path.Combine(destination, Path.GetFileName(file)));
        foreach (string folder in Directory.GetDirectories(source))
            if (!Path.GetFileName(folder).Equals(".editor-history", StringComparison.OrdinalIgnoreCase))
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
