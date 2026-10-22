using System.Reflection;
using System.Text.Json.Nodes;
using ICSharpCode.SharpZipLib.Zip;

// Exercise the actual archive service, without constructing a window or reading
// private material directly. Never include the archive password in test output.
string output = Path.GetFullPath(args[0]);
Directory.CreateDirectory(output);
var assembly = Assembly.Load("VRMGalgame");
var service = assembly.GetType("VRMGalgame.ProjectArchiveService")!;
const BindingFlags methods = BindingFlags.NonPublic | BindingFlags.Static;
string password = (string)assembly.GetType("VRMGalgame.ProtectedBuildConstants")!
    .GetMethod("ArchivePassword", methods)!.Invoke(null, null)!;
object Invoke(string name, params object[] values)
{
    try { return service.GetMethod(name, methods)!.Invoke(null, values)!; }
    catch (TargetInvocationException error) { throw error.InnerException!; }
}
void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
void RemoveWorkspace(string workspace)
{
    string allowed = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "VRMGalgame", "Workspaces")) + Path.DirectorySeparatorChar;
    if (!Path.GetFullPath(workspace).StartsWith(allowed, StringComparison.OrdinalIgnoreCase))
        throw new Exception("Unexpected test workspace");
    Directory.Delete(workspace, true);
}
string Load(string archive)
{
    var loaded = Invoke("Extract", archive, password);
    return (string)loaded.GetType().GetProperty("Workspace")!.GetValue(loaded)!;
}

string content = Path.Combine(output, "fixture-content");
Directory.CreateDirectory(Path.Combine(content, "assets"));
File.WriteAllText(Path.Combine(content, "project.json"), "{\"version\":1,\"id\":\"archive-regression\",\"assets\":[{\"path\":\"assets/keep.txt\"}],\"acts\":[]}");
File.WriteAllText(Path.Combine(content, "assets", "keep.txt"), "retained asset");
File.WriteAllText(Path.Combine(content, "assets", "unused.txt"), "excluded asset");
Directory.CreateDirectory(Path.Combine(content, ".editor-history"));
File.WriteAllText(Path.Combine(content, ".editor-history", "entry.txt"), "excluded history");
string archive = Path.Combine(output, "roundtrip.vrmg");
Invoke("Write", content, archive, password);
string workspace = Load(archive);
try {
    Assert(File.ReadAllText(Path.Combine(workspace, "assets", "keep.txt")) == "retained asset", "Asset changed");
    Assert(!File.Exists(Path.Combine(workspace, "assets", "unused.txt")), "Unused asset retained");
    Assert(!Directory.Exists(Path.Combine(workspace, ".editor-history")), "History retained");
    Invoke("Write", workspace, archive, password);
} finally { RemoveWorkspace(workspace); }
workspace = Load(archive);
RemoveWorkspace(workspace);
using (var zip = new ICSharpCode.SharpZipLib.Zip.ZipFile(File.OpenRead(archive)) { Password = password }) {
    Assert(zip.Cast<ZipEntry>().All(entry => entry.IsCrypted && entry.AESKeySize == 256), "Encryption changed");
}
byte[] before = File.ReadAllBytes(archive);
try { Invoke("Write", Path.Combine(output, "missing"), archive, password); throw new Exception("Invalid save accepted"); }
catch (DirectoryNotFoundException) { }
Assert(before.SequenceEqual(File.ReadAllBytes(archive)), "Failed save changed original package");

var compatible = new List<string>();
foreach (string input in args.Skip(1)) {
    byte[] original = File.ReadAllBytes(input);
    string copy = Path.Combine(output, Path.GetFileName(input));
    File.WriteAllBytes(copy, original);
    workspace = Load(copy);
    try {
        string json = File.ReadAllText(Path.Combine(workspace, "project.json"));
        Assert(JsonNode.Parse(json) is JsonObject, "Legacy project invalid");
        Invoke("Write", workspace, copy, password);
        Invoke("Write", workspace, copy, password);
        string reopened = Load(copy);
        try { Assert(File.ReadAllText(Path.Combine(reopened, "project.json")) == json, "Project content changed"); }
        finally { RemoveWorkspace(reopened); }
    } finally { RemoveWorkspace(workspace); }
    Assert(original.SequenceEqual(File.ReadAllBytes(input)), "Source fixture changed");
    compatible.Add(Path.GetFileName(input));
}
File.WriteAllText(Path.Combine(output, "results.json"), System.Text.Json.JsonSerializer.Serialize(new {
    ok = true, encryptedRoundtrip = true, failedSavePreservesOriginal = true, compatibleProjects = compatible
}, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"PASS: encrypted archive roundtrip, asset filtering, failed-save recovery; {compatible.Count} old projects opened, saved twice and reopened.");
