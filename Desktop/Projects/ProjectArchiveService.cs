using System.Text.Json.Nodes;
using System.Security.Cryptography;
using System.Text;
using ICSharpCode.SharpZipLib.Zip;
using ProtectedZipFile = ICSharpCode.SharpZipLib.Zip.ZipFile;

namespace VRMGalgame;

internal sealed record LoadedProjectArchive(string Workspace, string ArchivePath, byte[]? Bytes);

// File operations only: callers own the current project and UI lifecycle.
internal static class ProjectArchiveService
{
    internal static string CreateWorkspace()
    {
        string path = Path.Combine(Path.GetTempPath(),
            "VRMGalgame", "Workspaces", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    internal static LoadedProjectArchive Extract(string path, string password)
    {
        path = Path.GetFullPath(path);
        if (!File.Exists(path) || !new[] { ".vrmg", ".zip" }.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase))
            throw new Exception("请选择 .vrmg 单文件工程包，已不支持旧版文件夹工程。");
        string workspace = CreateWorkspace();
        byte[]? archiveBytes = null;
        try
        {
            // Common-size projects are read into memory first, so the original package is never kept open.
            using (Stream stream = new FileInfo(path).Length <= 512L * 1024 * 1024
                ? new MemoryStream(archiveBytes = File.ReadAllBytes(path), writable: false)
                : File.OpenRead(path))
            using (var archive = new ProtectedZipFile(stream) { Password = password })
            {
                var entries = archive.Cast<ZipEntry>().ToArray();
                if (entries.Length > 20000 || entries.Any(entry => entry.Size < 0) || entries.Sum(entry => entry.Size) > 30L * 1024 * 1024 * 1024)
                    throw new Exception("工程包内容过大或文件数量过多。");
                if (!entries.Any(entry => entry.IsFile && entry.Name == "project.json"))
                    throw new Exception("工程包中找不到 project.json。");
                string root = Path.GetFullPath(workspace) + Path.DirectorySeparatorChar;
                var extracted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var entry in entries)
                {
                    string relative = entry.Name.Replace('\\','/');
                    string target = Path.GetFullPath(Path.Combine(workspace,relative.Replace('/',Path.DirectorySeparatorChar)));
                    if (!target.StartsWith(root,StringComparison.OrdinalIgnoreCase) || !extracted.Add(target))
                        throw new Exception("工程包文件路径无效或重复。");
                    if (!entry.IsFile) { Directory.CreateDirectory(target); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    using var input = archive.GetInputStream(entry);
                    using var output = File.Create(target);
                    input.CopyTo(output);
                    if (output.Length != entry.Size) throw new Exception("工程包文件长度无效。");
                }
            }
            JsonNode? project = JsonNode.Parse(File.ReadAllText(Path.Combine(workspace, "project.json")));
            if (project is not JsonObject) throw new Exception("工程内容无效。");
        }
        catch
        {
            try { Directory.Delete(workspace, recursive: true); } catch { }
            throw;
        }
        return new LoadedProjectArchive(workspace, path, archiveBytes);
    }

    internal static void Write(string directory, string path, string password)
    {
        string temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            var activeAssets = ProjectFileSet.AssetPaths(directory);
            using (var archive = new ZipOutputStream(File.Create(temp)) { Password = password, UseZip64 = UseZip64.Dynamic })
            {
                archive.SetLevel(1);
                foreach (string file in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories))
                {
                    if (file.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) || file.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) continue;
                    string relative = Path.GetRelativePath(directory, file).Replace('\\', '/');
                    if (ProjectFileSet.Includes(relative, activeAssets)) {
                        var entry = new ZipEntry(relative) { AESKeySize = 256, IsUnicodeText = true, Size = new FileInfo(file).Length, DateTime = File.GetLastWriteTime(file) };
                        archive.PutNextEntry(entry);
                        using (var input = File.OpenRead(file)) input.CopyTo(archive);
                        archive.CloseEntry();
                    }
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
}
