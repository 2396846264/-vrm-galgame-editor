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

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        EngineAttribution.Start();
        string[] args = Environment.GetCommandLineArgs();
        int origin = Array.IndexOf(args,"--engine-origin");
        if (origin >= 0 && origin + 1 < args.Length) {
            File.WriteAllText(args[origin+1],JsonSerializer.Serialize(EngineAttribution.Origin()));return;
        }
        int check = Array.IndexOf(args,"--check-package-integrity");
        if (check >= 0 && check + 2 < args.Length) {
            try { ProtectedResources.Verify(args[check+1]); File.WriteAllText(args[check+2],JsonSerializer.Serialize(new {ok=true})); }
            catch (Exception ex) { File.WriteAllText(args[check+2],JsonSerializer.Serialize(new {ok=false,error=ex.Message})); Environment.ExitCode=2; }
            return;
        }
        ApplicationConfiguration.Initialize();
        Application.Run(new EditorWindow());
    }
}
