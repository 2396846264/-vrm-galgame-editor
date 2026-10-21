using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
string privateRoot = Environment.GetEnvironmentVariable("VRMGALGAME_PRIVATE_ROOT") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".codex", "private", "vrm-galgame");
Directory.CreateDirectory(privateRoot);
string keyFile = Path.Combine(privateRoot, "web-signing-key.pem");
using var signer = ECDsa.Create(ECCurve.NamedCurves.nistP256);
if (File.Exists(keyFile)) signer.ImportFromPem(File.ReadAllText(keyFile));
else throw new InvalidOperationException("Signing key missing; restore the original private key before building.");
if (args[0] == "sign")
{
    string directory=Path.GetFullPath(args[1]);
    var files=Directory.EnumerateFiles(directory,"*",SearchOption.AllDirectories)
        .OrderBy(file=>Path.GetRelativePath(directory,file),StringComparer.Ordinal)
        .ToDictionary(file=>Path.GetRelativePath(directory,file).Replace('\\','/'),file=>Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file))).ToLowerInvariant());
    byte[] payload=JsonSerializer.SerializeToUtf8Bytes(files);
    byte[] signature=signer.SignData(payload,HashAlgorithmName.SHA256);
    File.WriteAllText(args[2],JsonSerializer.Serialize(new {payload=Convert.ToBase64String(payload),signature=Convert.ToBase64String(signature)}));
    Console.WriteLine($"Signed {files.Count} interface files.");
}
