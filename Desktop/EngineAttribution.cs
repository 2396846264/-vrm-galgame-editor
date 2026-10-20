using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
namespace VRMGalgame;
internal static class EngineAttribution
{
    private const string PublicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEjFBv1j+saD6hLMG/sITPp/eCgZObnyS+Sn34fTWwmL8L6n5AlW6dlyj2m3NOauBqO6MEybsCQlC7veJrnDK4RA==";
    private static readonly Stopwatch Clock = Stopwatch.StartNew();
    internal static long ElapsedMilliseconds => Clock.ElapsedMilliseconds;
    internal static void Start() => _ = Clock.Elapsed;
    private static readonly Lazy<JsonElement> Data = new(Read);
    private static JsonElement Read()
    {
        using var stream = typeof(EngineAttribution).Assembly.GetManifestResourceStream("VRMGalgame.engine-attribution.json") ?? throw new InvalidDataException("来源信息缺失。");
        using var envelope = JsonDocument.Parse(stream);
        byte[] payload = Convert.FromBase64String(envelope.RootElement.GetProperty("payload").GetString()!);
        using var verifier = ECDsa.Create();
        verifier.ImportSubjectPublicKeyInfo(Convert.FromBase64String(PublicKey), out _);
        if (!verifier.VerifyData(payload, Convert.FromBase64String(envelope.RootElement.GetProperty("signature").GetString()!), HashAlgorithmName.SHA256)) throw new InvalidDataException("来源信息校验失败。");
        byte[] a = Convert.FromBase64String("vFZKWrDWooe8hR038aSCPTOzUsip+aI4fJkBFvAhKrw="), b = Convert.FromBase64String("gavsvt8F5QbeWgTP46J6E44zjfuw0wY9uCAxOAsQEy0="), key = a.Zip(b,(x,y)=>(byte)(x^y)).ToArray(), clear = new byte[payload.Length-28];
        try {
            using var aes = new AesGcm(key,16); aes.Decrypt(payload.AsSpan(0,12),payload.AsSpan(28),payload.AsSpan(12,16),clear);
            using var document = JsonDocument.Parse(clear);return document.RootElement.Clone();
        } finally { CryptographicOperations.ZeroMemory(key); CryptographicOperations.ZeroMemory(clear); }
    }
    internal static string Text(string name) => Data.Value.GetProperty(name).GetString()!;
    internal static object Origin() => new { id=Text("id"),engine=Text("engine"),creator=Text("creator"),version=Text("version"),verified=true };
    internal static object OpenHomepage()
    {
        // The caller cannot provide or replace an arbitrary executable/URL.
        Process.Start(new ProcessStartInfo(Text("homepage")) { UseShellExecute=true });
        return new { opened=true };
    }
}
