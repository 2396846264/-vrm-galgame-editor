using System.Globalization;

namespace VRMGalgame;

internal static class GameResourceRequest
{
    internal sealed record Range(long Start, long Count, bool Partial);
    internal static Range? ParseRange(string? value, long length)
    {
        if (string.IsNullOrWhiteSpace(value)) return new(0, length, false);
        if (length <= 0 || !value.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase)) return null;
        string[] parts = value[6..].Split('-');
        if (parts.Length != 2) return null;
        bool Number(string text, out long number) => long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out number);
        if (parts[0].Length == 0)
        {
            if (!Number(parts[1], out long suffix) || suffix <= 0) return null;
            long count = Math.Min(suffix, length); return new(length - count, count, true);
        }
        if (!Number(parts[0], out long start) || start >= length) return null;
        long end = length - 1;
        if (parts[1].Length > 0 && (!Number(parts[1], out end) || end < start)) return null;
        end = Math.Min(end, length - 1); return new(start, end - start + 1, true);
    }
    internal static string ContentType(string path) => System.IO.Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".json" or ".gltf" => "application/json; charset=utf-8",
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp", ".bmp" => "image/bmp",
        ".gif" => "image/gif", ".svg" => "image/svg+xml", ".ktx2" => "image/ktx2",
        ".glb" or ".vrm" => "model/gltf-binary", ".wav" => "audio/wav", ".mp3" => "audio/mpeg", ".ogg" => "audio/ogg",
        ".mp4" => "video/mp4", ".webm" => "video/webm", ".pdf" => "application/pdf",
        _ => "application/octet-stream"
    };
}
