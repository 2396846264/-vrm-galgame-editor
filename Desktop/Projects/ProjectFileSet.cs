using System.Text.Json.Nodes;

namespace VRMGalgame;

internal static class ProjectFileSet
{
    internal static HashSet<string> AssetPaths(string directory)
    {
        var project = JsonNode.Parse(File.ReadAllText(Path.Combine(directory, "project.json")));
        return project?["assets"]?.AsArray().Select(item => (item?["path"]?.GetValue<string>() ?? "").Replace('\\', '/'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    }

    internal static bool Includes(string relative, HashSet<string> assets)
    {
        if (relative.StartsWith(".editor-history/", StringComparison.OrdinalIgnoreCase)) return false;
        if (relative.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) || relative.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) return false;
        return !relative.StartsWith("assets/", StringComparison.OrdinalIgnoreCase) || assets.Contains(relative);
    }

    internal static void Copy(string source, string destination)
    {
        var assets = AssetPaths(source);
        foreach (string file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            string relative = Path.GetRelativePath(source, file).Replace('\\', '/');
            if (!Includes(relative, assets)) continue;
            string target = Path.Combine(destination, relative.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.Copy(file, target);
        }
    }
}
