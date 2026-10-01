using System.Security.Cryptography;
using System.Text.Json;

if (args.Length != 4 || args[0] is not ("generate" or "sign"))
    throw new ArgumentException("generate <identity-directory> <constants-output> <feedback-group> OR sign <identity-directory> <web-directory> <manifest-output>");

string identity = Path.GetFullPath(args[1]);
Directory.CreateDirectory(identity);
string keyFile = Path.Combine(identity, "web-signing-key.pem");
using var signer = ECDsa.Create(ECCurve.NamedCurves.nistP256);
if (File.Exists(keyFile)) signer.ImportFromPem(File.ReadAllText(keyFile));
else if (args[0] == "generate") File.WriteAllText(keyFile, signer.ExportPkcs8PrivateKeyPem());
else throw new InvalidOperationException("Developer signing key is missing.");

if (args[0] == "generate")
{
    string passwordFile = Path.Combine(identity, "archive-password.txt");
    if (!File.Exists(passwordFile)) File.WriteAllText(passwordFile, Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
    string password = File.ReadAllText(passwordFile).Trim();
    string publicKey = Convert.ToBase64String(signer.ExportSubjectPublicKeyInfo());
    string code = "namespace VRMGalgame;\ninternal static class ProtectedBuildConstants\n{\n"
        + $"    internal const string PublicKey = {JsonSerializer.Serialize(publicKey)};\n"
        + $"    internal static string ArchivePassword() => {JsonSerializer.Serialize(password)};\n"
        + $"    internal static string FeedbackGroup() => {JsonSerializer.Serialize(args[3])};\n}}\n";
    string output = Path.GetFullPath(args[2]);
    Directory.CreateDirectory(Path.GetDirectoryName(output)!);
    File.WriteAllText(output, code);
    Console.WriteLine("Developer build identity generated. Preserve its directory to reopen your developer projects.");
}
else
{
    string web = Path.GetFullPath(args[2]);
    var files = Directory.EnumerateFiles(web, "*", SearchOption.AllDirectories)
        .OrderBy(file => Path.GetRelativePath(web, file), StringComparer.Ordinal)
        .ToDictionary(file => Path.GetRelativePath(web, file).Replace('\\', '/'),
            file => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file))).ToLowerInvariant());
    byte[] payload = JsonSerializer.SerializeToUtf8Bytes(files);
    byte[] signature = signer.SignData(payload, HashAlgorithmName.SHA256);
    File.WriteAllText(args[3], JsonSerializer.Serialize(new {
        payload = Convert.ToBase64String(payload), signature = Convert.ToBase64String(signature)
    }));
    Console.WriteLine($"Signed {files.Count} interface files.");
}
