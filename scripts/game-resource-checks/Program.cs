using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using VRMGalgame;

string root = Path.GetFullPath(args[0]); Directory.CreateDirectory(root);
void Assert(bool value, string message) { if (!value) throw new Exception(message); }
void Denied(Action action, string message) { bool denied = false; try { action(); } catch (Exception error) when (error is InvalidDataException or IOException or CryptographicException) { denied = true; } Assert(denied, message); }
byte[] bytes = RandomNumberGenerator.GetBytes(3 * GameResourcePackage.ChunkSize + 123);
byte[] marker = Encoding.UTF8.GetBytes("PRIVATE_ASSET_MARKER_DO_NOT_PUBLISH_20261005"); marker.CopyTo(bytes, 1050);
string name = "assets/模型/秘密人物.glb", first = Path.Combine(root, "first.vrgdata"), second = Path.Combine(root, "second.vrgdata");
var sources = new[] {
    new GameResourcePackage.Source("project.json", null, "{\"name\":\"秘密剧情标题\",\"id\":\"roundtrip\"}"u8.ToArray()),
    new GameResourcePackage.Source(name, null, bytes), new GameResourcePackage.Source("assets/empty.bin", null, [])
};
var watch = Stopwatch.StartNew(); GameResourcePackage.Write(first, sources); watch.Stop(); long writeMs = watch.ElapsedMilliseconds;
GameResourcePackage.Write(second, sources);
Assert(!File.ReadAllBytes(first).SequenceEqual(File.ReadAllBytes(second)), "Exports reused ciphertext or keys");
foreach (var needle in new[] { marker, Encoding.UTF8.GetBytes(name), "秘密剧情标题"u8.ToArray() })
    Assert(File.ReadAllBytes(first).AsSpan().IndexOf(needle) < 0, "Plaintext or asset name leaked");
using (var package = GameResourcePackage.Open(first))
{
    Assert(Encoding.UTF8.GetString(package.ReadSmallFile("project.json")).Contains("秘密剧情标题"), "Encrypted project did not load");
    var entry = package.Find(name)!;
    watch.Restart(); using (var stream = package.OpenStream(entry)) {
        var recovered = new byte[bytes.Length]; stream.ReadExactly(recovered); Assert(recovered.SequenceEqual(bytes), "Asset bytes changed");
        stream.Position = GameResourcePackage.ChunkSize - 7; var cross = new byte[33]; stream.ReadExactly(cross);
        Assert(cross.AsSpan().SequenceEqual(bytes.AsSpan(GameResourcePackage.ChunkSize - 7, 33)), "Cross-block seek changed bytes");
        stream.Seek(-17, SeekOrigin.End); var tail = new byte[17]; stream.ReadExactly(tail); Assert(tail.AsSpan().SequenceEqual(bytes.AsSpan(bytes.Length - 17)), "EOF seek changed bytes");
    } watch.Stop();
    using (var partial = package.OpenStream(entry, GameResourcePackage.ChunkSize - 9, 66)) {
        var segment = new byte[66]; partial.ReadExactly(segment); Assert(segment.AsSpan().SequenceEqual(bytes.AsSpan(GameResourcePackage.ChunkSize - 9, 66)), "Range changed bytes"); Assert(partial.ReadByte() == -1, "Range escaped boundary");
    }
    using (var empty = package.OpenStream(package.Find("assets/empty.bin")!)) Assert(empty.ReadByte() == -1, "Empty resource failed");
    Assert(package.Find("missing") == null, "Missing path did not fail");
    Console.WriteLine($"PASS: exact byte round trip and seek, Chinese paths, zero-byte entry; read {watch.ElapsedMilliseconds} ms, write {writeMs} ms.");
}
var ranges = new[] { ("bytes=0-99",0L,100L), ("bytes=100-",100L,900L), ("bytes=-200",800L,200L), ("bytes=900-5000",900L,100L), ("bytes=-5000",0L,1000L) };
foreach (var (header,start,count) in ranges) Assert(GameResourceRequest.ParseRange(header,1000) is { } range && range.Start == start && range.Count == count && range.Partial, "Range parser: " + header);
foreach (string invalid in new[]{"bytes=1000-","bytes=2-1","bytes=-0","bytes=0-1,4-5","bytes=+2-3","bad","bytes=999999999999999999999999-"}) Assert(GameResourceRequest.ParseRange(invalid,1000)==null,"Invalid range accepted");
Assert(GameResourceRequest.ParseRange(null,0) is {Count:0,Partial:false},"Empty GET failed");
foreach (string invalid in new[]{"../outside","assets/../outside","/absolute","assets\\outside","C:/outside","assets//x","assets/./x","assets/\0x"}) Denied(()=>GameResourcePackage.NormalizePath(invalid),"Unsafe path accepted");

byte[] original = File.ReadAllBytes(first);
foreach (int offset in new[] {0,16,44,56,72,original.Length-1}) {
    var changed=(byte[])original.Clone(); changed[offset]^=1; string file=Path.Combine(root,"tampered-"+offset+".vrgdata");File.WriteAllBytes(file,changed);
    Denied(()=>GameResourcePackage.Open(file).Dispose(),"Modified header/index accepted at "+offset);
}
foreach (int offset in new[]{104+12,104+28}) {
    var changed=(byte[])original.Clone();changed[offset]^=1;string file=Path.Combine(root,"asset-tampered-"+offset+".vrgdata");File.WriteAllBytes(file,changed);
    using var package=GameResourcePackage.Open(file);Denied(()=>{using var stream=package.OpenStream(package.Find("project.json")!);stream.ReadByte();},"Modified resource accepted");
}
var moved=(byte[])original.Clone();int stride=GameResourcePackage.ChunkSize+28;
using(var package=GameResourcePackage.Open(first)) {
    int offset=(int)package.Find(name)!.Offset; var block=moved.AsSpan(offset,stride).ToArray(); moved.AsSpan(offset+stride,stride).CopyTo(moved.AsSpan(offset,stride));block.CopyTo(moved,offset+stride);
}
string shuffled=Path.Combine(root,"shuffled.vrgdata");File.WriteAllBytes(shuffled,moved);using(var package=GameResourcePackage.Open(shuffled))Denied(()=>{using var stream=package.OpenStream(package.Find(name)!);stream.ReadByte();},"Swapped blocks accepted");
ProtectedBuildConstants.Identity="wrong build";Denied(()=>GameResourcePackage.Open(first).Dispose(),"Wrong identity accepted");ProtectedBuildConstants.Identity="test identity A";
File.WriteAllBytes(Path.Combine(root,"truncated.vrgdata"),original[..^1]);Denied(()=>GameResourcePackage.Open(Path.Combine(root,"truncated.vrgdata")).Dispose(),"Truncated package accepted");
var closedPackage=GameResourcePackage.Open(first);var closedStream=closedPackage.OpenStream(closedPackage.Find(name)!);closedPackage.Dispose();bool closed=false;try{closedStream.ReadByte();}catch(ObjectDisposedException){closed=true;}Assert(closed,"Closed package kept serving");
Assert(!Directory.EnumerateFiles(root,"*",SearchOption.AllDirectories).Any(p=>p.EndsWith(".glb")||p.EndsWith(".tmp")),"Loose assets or temporary package leaked");
File.WriteAllText(Path.Combine(root,"checks.json"),JsonSerializer.Serialize(new{ok=true,writeMs,checks=new[]{"randomized ciphertext and encrypted names","exact roundtrip and bounded block seeking","range and suffix requests","modified headers, ciphertext, index, swapped chunks and wrong identity rejected","unsafe paths and truncated package rejected","no loose or temporary assets"}},new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine("PASS: all resource package protection checks.");
