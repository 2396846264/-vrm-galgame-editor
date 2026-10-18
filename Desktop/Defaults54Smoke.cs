using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;

namespace VRMGalgame;

internal sealed partial class EditorWindow
{
    // Uses an isolated smoke profile; never changes the player's real preferences.
    private async Task RunDefaults54Smoke()
    {
        async Task WaitReady()
        {
            for (int i = 0; i < 1200; i++)
            {
                if (await web.CoreWebView2.ExecuteScriptAsync("Boolean(window.editorProjectSnapshot?.()?.id && window.__vrmDiagnostics)") == "true") return;
                await Task.Delay(100);
            }
            throw new Exception("游戏初始化超时");
        }
        async Task CheckJs(string expression)
        {
            if (await web.CoreWebView2.ExecuteScriptAsync(expression) != "true") throw new Exception(expression);
        }
        async Task Reload()
        {
            var done = new TaskCompletionSource<bool>();
            void Loaded(object? sender, CoreWebView2NavigationCompletedEventArgs e) => done.TrySetResult(e.IsSuccess);
            web.CoreWebView2.NavigationCompleted += Loaded;
            try
            {
                web.CoreWebView2.Reload();
                if (!await done.Task.WaitAsync(TimeSpan.FromSeconds(30))) throw new Exception("页面重载失败");
            }
            finally { web.CoreWebView2.NavigationCompleted -= Loaded; }
            await WaitReady();
        }
        await WaitReady();
        var startup = new { playerMode, fullscreen, border = FormBorderStyle.ToString(), state = WindowState.ToString(), width = Width, height = Height };
        if (playerMode && (!fullscreen || FormBorderStyle != FormBorderStyle.None || WindowState != FormWindowState.Maximized)) throw new Exception("游戏未默认全屏");
        if (!playerMode && fullscreen) throw new Exception("编辑器被强制全屏");
        await CheckJs("window.__vrmDiagnostics().textSpeed === 5");
        if (playerMode)
        {
            await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=settings]').click()");
            await CheckJs("document.querySelector('[data-text-speed]')?.value === '5'");
            using (var shot = File.Create(smokeBase + ".settings.png")) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, shot);
            await web.CoreWebView2.ExecuteScriptAsync("(()=>{const n=document.querySelector('[data-text-speed]');n.value='17';n.dispatchEvent(new Event('input',{bubbles:true}));})()");
            await CheckJs("window.__vrmDiagnostics().textSpeed === 17");
            await Reload();
            await CheckJs("window.__vrmDiagnostics().textSpeed === 17");
            await web.CoreWebView2.ExecuteScriptAsync("localStorage.setItem('vrm-text-speed-'+(window.editorProjectSnapshot().id||window.editorProjectSnapshot().name),'invalid')");
            await Reload();
            await CheckJs("window.__vrmDiagnostics().textSpeed === 5");
            await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=settings]').click();document.querySelector('#player-modal [data-action=toggle-fullscreen]').click()");
            for (int i = 0; i < 100 && fullscreen; i++) await Task.Delay(50);
            if (fullscreen || FormBorderStyle != FormBorderStyle.FixedSingle || ClientSize != windowedClientSize) throw new Exception("切回窗口失败");
            await CheckJs("!document.querySelector('#window-resolution').disabled");
            await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#player-modal [data-action=toggle-fullscreen]').click()");
            for (int i = 0; i < 100 && !fullscreen; i++) await Task.Delay(50);
            if (!fullscreen || WindowState != FormWindowState.Maximized) throw new Exception("恢复全屏失败");
        }
        File.WriteAllText(smokeBase + ".defaults.json", JsonSerializer.Serialize(new { ok = true, startup, defaultTextSpeed = 5, savedPreferencePreserved = playerMode, invalidPreferenceFallback = playerMode, windowTogglePassed = playerMode }));
    }
}
