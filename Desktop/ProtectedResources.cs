using System.Security.Cryptography;
using System.Text.Json;
namespace VRMGalgame;
internal static class ProtectedResources
{
    internal static void Verify(string appDirectory)
    {
        try
        {
            string manifest = Path.Combine(appDirectory, "web.integrity.json");
            if (!File.Exists(manifest)) throw new InvalidDataException();
            using var document = JsonDocument.Parse(File.ReadAllBytes(manifest));
            byte[] payload = Convert.FromBase64String(document.RootElement.GetProperty("payload").GetString()!);
            byte[] signature = Convert.FromBase64String(document.RootElement.GetProperty("signature").GetString()!);
            using var verifier = ECDsa.Create();
            verifier.ImportSubjectPublicKeyInfo(Convert.FromBase64String(ProtectedBuildConstants.PublicKey), out _);
            if (!verifier.VerifyData(payload, signature, HashAlgorithmName.SHA256)) throw new InvalidDataException();
            var files = JsonSerializer.Deserialize<Dictionary<string,string>>(payload) ?? throw new InvalidDataException();
            string web = Path.GetFullPath(Path.Combine(appDirectory,"web")) + Path.DirectorySeparatorChar;
            if (files.Count == 0 || files.Count != Directory.EnumerateFiles(web,"*",SearchOption.AllDirectories).Count()) throw new InvalidDataException();
            foreach (var item in files)
            {
                string path = Path.GetFullPath(Path.Combine(web,item.Key.Replace('/',Path.DirectorySeparatorChar)));
                if (!path.StartsWith(web,StringComparison.OrdinalIgnoreCase) || !File.Exists(path)) throw new InvalidDataException();
                using var stream = File.OpenRead(path);
                byte[] actual = SHA256.HashData(stream), expected = Convert.FromHexString(item.Value);
                if (!CryptographicOperations.FixedTimeEquals(actual,expected)) throw new InvalidDataException();
            }
        }
        catch
        {
            throw new InvalidDataException("程序界面文件校验失败：文件缺失或已被修改。请重新解压完整安装包。");
        }
    }
}
