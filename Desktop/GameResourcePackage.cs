using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace VRMGalgame;

// Offline asset protection: the player necessarily owns the decoding runtime.
// This prevents loose-file copying, not extraction by a modified runtime.
internal sealed class GameResourcePackage : IDisposable
{
    internal const string FileName = "game.vrgdata";
    internal const int ChunkSize = 1024 * 1024;
    private const int HeaderSize = 104;
    private const int BlockOverhead = 28;
    private const int MaxIndexBytes = 32 * 1024 * 1024;
    private static readonly byte[] Magic = "VRGDATA1"u8.ToArray();
    private readonly string filename;
    private readonly byte[] key;
    private readonly byte[] packageId;
    private readonly Dictionary<string, Entry> entries;
    private readonly List<WeakReference<ResourceStream>> streams = [];
    private bool disposed;
    internal sealed record Entry(string Path, string Id, long Offset, long Length);
    internal sealed record Source(string Path, string? File, byte[]? Bytes = null);

    private GameResourcePackage(string filename, byte[] key, byte[] packageId, Dictionary<string, Entry> entries)
    { this.filename = filename; this.key = key; this.packageId = packageId; this.entries = entries; }

    // Domain-separated key wrapping uses the native build identity. No resource
    // key or password is sent to JavaScript or written to game.config.json.
    private static byte[] WrappingKey() => SHA256.HashData(Encoding.UTF8.GetBytes(
        "VRMGalgame/game-resource-envelope/v1\0" + ProtectedBuildConstants.ArchivePassword()));

    internal static void Write(string destination, IEnumerable<Source> sources, byte[]? envelopeKey = null)
    {
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        byte[] key = RandomNumberGenerator.GetBytes(32), id = RandomNumberGenerator.GetBytes(16);
        byte[] prefix = RandomNumberGenerator.GetBytes(8), plain = new byte[ChunkSize], cipher = new byte[ChunkSize];
        byte[] tag = new byte[16], nonce = new byte[12];
        var index = new List<Entry>(); var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        uint sequence = 0;
        try
        {
            using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (var aes = new AesGcm(key, 16))
            {
                output.Write(new byte[HeaderSize]);
                foreach (var source in sources)
                {
                    string path = NormalizePath(source.Path);
                    if (!paths.Add(path) || index.Count >= 100_000) throw new InvalidDataException("重复或过多的资源路径。");
                    using Stream input = source.Bytes != null ? new MemoryStream(source.Bytes, false) : File.OpenRead(source.File!);
                    long length = input.Length; byte[] fileId = RandomNumberGenerator.GetBytes(16);
                    index.Add(new Entry(path, Convert.ToBase64String(fileId), output.Position, length));
                    long remaining = length;
                    for (long chunk = 0; remaining > 0; chunk++)
                    {
                        int count = (int)Math.Min(ChunkSize, remaining); input.ReadExactly(plain.AsSpan(0, count));
                        NextNonce(prefix, ref sequence, nonce);
                        aes.Encrypt(nonce, plain.AsSpan(0, count), cipher.AsSpan(0, count), tag, BlockContext(id, fileId, chunk, count));
                        output.Write(nonce); output.Write(tag); output.Write(cipher.AsSpan(0, count)); remaining -= count;
                    }
                    if (input.ReadByte() != -1) throw new IOException("打包期间素材被修改，请重新导出。");
                }
                byte[] indexBytes = JsonSerializer.SerializeToUtf8Bytes(index);
                if (indexBytes.Length > MaxIndexBytes) throw new InvalidDataException("游戏资源清单过大。");
                var header = new byte[HeaderSize]; Magic.CopyTo(header, 0);
                BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(8), 1);
                BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(12), ChunkSize);
                BinaryPrimitives.WriteInt64LittleEndian(header.AsSpan(16), output.Position);
                BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(24), indexBytes.Length);
                id.CopyTo(header, 28);
                RandomNumberGenerator.Fill(header.AsSpan(44, 12));
                byte[] wrapping = envelopeKey?.ToArray() ?? WrappingKey();
                try { using var envelope = new AesGcm(wrapping, 16); envelope.Encrypt(header.AsSpan(44, 12), key, header.AsSpan(72, 32), header.AsSpan(56, 16), header.AsSpan(0, 44)); }
                finally { CryptographicOperations.ZeroMemory(wrapping); }
                NextNonce(prefix, ref sequence, nonce);
                byte[] encryptedIndex = new byte[indexBytes.Length];
                aes.Encrypt(nonce, indexBytes, encryptedIndex, tag, header);
                output.Write(nonce); output.Write(tag); output.Write(encryptedIndex);
                CryptographicOperations.ZeroMemory(indexBytes);
                output.Position = 0; output.Write(header); output.Flush(true);
            }
            File.Move(temporary, destination, overwrite: false);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key); CryptographicOperations.ZeroMemory(plain);
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    private static void NextNonce(byte[] prefix, ref uint sequence, byte[] nonce)
    {
        if (sequence == uint.MaxValue) throw new InvalidDataException("资源分段过多。");
        prefix.CopyTo(nonce, 0); BinaryPrimitives.WriteUInt32BigEndian(nonce.AsSpan(8), ++sequence);
    }
    private static byte[] BlockContext(byte[] packageId, byte[] fileId, long chunk, int count)
    {
        byte[] context = new byte[44]; packageId.CopyTo(context, 0); fileId.CopyTo(context, 16);
        BinaryPrimitives.WriteInt64LittleEndian(context.AsSpan(32), chunk);
        BinaryPrimitives.WriteInt32LittleEndian(context.AsSpan(40), count); return context;
    }

    internal static GameResourcePackage Open(string filename)
    {
        byte[] key = new byte[32];
        try
        {
            using var input = File.OpenRead(filename); byte[] header = new byte[HeaderSize]; input.ReadExactly(header);
            long offset = BinaryPrimitives.ReadInt64LittleEndian(header.AsSpan(16));
            int indexLength = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(24));
            if (!header.AsSpan(0, 8).SequenceEqual(Magic) || BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(8)) != 1 ||
                BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(12)) != ChunkSize || offset < HeaderSize ||
                indexLength < 2 || indexLength > MaxIndexBytes || offset > input.Length - BlockOverhead ||
                input.Length - offset - BlockOverhead != indexLength) throw new InvalidDataException();
            byte[] wrapping = WrappingKey();
            try { using var envelope = new AesGcm(wrapping, 16); envelope.Decrypt(header.AsSpan(44, 12), header.AsSpan(72, 32), header.AsSpan(56, 16), key, header.AsSpan(0, 44)); }
            finally { CryptographicOperations.ZeroMemory(wrapping); }
            input.Position = offset; byte[] nonce = new byte[12], tag = new byte[16], cipher = new byte[indexLength], plain = new byte[indexLength];
            input.ReadExactly(nonce); input.ReadExactly(tag); input.ReadExactly(cipher);
            List<Entry> index;
            try { using var aes = new AesGcm(key, 16); aes.Decrypt(nonce, cipher, tag, plain, header); index = JsonSerializer.Deserialize<List<Entry>>(plain) ?? throw new InvalidDataException(); }
            finally { CryptographicOperations.ZeroMemory(plain); }
            if (index.Count == 0 || index.Count > 100_000) throw new InvalidDataException();
            var entries = new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase); long next = HeaderSize;
            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (var entry in index)
            {
                if (NormalizePath(entry.Path) != entry.Path || Convert.FromBase64String(entry.Id).Length != 16 || !ids.Add(entry.Id) ||
                    entry.Length < 0 || entry.Offset != next || !entries.TryAdd(entry.Path, entry)) throw new InvalidDataException();
                long chunks = entry.Length / ChunkSize + (entry.Length % ChunkSize == 0 ? 0 : 1);
                next = checked(next + entry.Length + chunks * BlockOverhead);
                if (next > offset) throw new InvalidDataException();
            }
            if (next != offset || !entries.ContainsKey("project.json")) throw new InvalidDataException();
            return new GameResourcePackage(Path.GetFullPath(filename), key, header.AsSpan(28, 16).ToArray(), entries);
        }
        catch (Exception error) when (error is InvalidDataException or IOException or CryptographicException or JsonException or FormatException or ArgumentException or OverflowException)
        {
            CryptographicOperations.ZeroMemory(key);
            throw new InvalidDataException("游戏资源包缺失、损坏或与程序不匹配。请重新解压完整游戏包。", error);
        }
    }

    internal static string NormalizePath(string path)
    {
        if (string.IsNullOrEmpty(path) || path.Length > 4096 || path.StartsWith('/') || path.Contains('\\') ||
            path.Contains(':') || path.Contains('\0') || path.Split('/').Any(part => part is "" or "." or ".."))
            throw new InvalidDataException("资源路径无效。");
        return path;
    }
    internal Entry? Find(string path) { ObjectDisposedException.ThrowIf(disposed, this); return entries.GetValueOrDefault(path); }
    internal Stream OpenStream(Entry entry, long start = 0, long? count = null)
    {
        lock (streams)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            long size = count ?? entry.Length - start;
            if (start < 0 || size < 0 || start > entry.Length || size > entry.Length - start) throw new ArgumentOutOfRangeException(nameof(start));
            var stream = new ResourceStream(this, entry, start, size);
            streams.RemoveAll(reference => !reference.TryGetTarget(out _)); streams.Add(new(stream)); return stream;
        }
    }
    internal byte[] ReadSmallFile(string path)
    {
        var entry = Find(path) ?? throw new FileNotFoundException();
        if (entry.Length > MaxIndexBytes) throw new InvalidDataException("游戏剧情清单过大。");
        using var stream = OpenStream(entry); byte[] bytes = new byte[(int)entry.Length]; stream.ReadExactly(bytes); return bytes;
    }
    public void Dispose()
    {
        lock (streams)
        {
            if (disposed) return; disposed = true;
            foreach (var reference in streams) if (reference.TryGetTarget(out var stream)) stream.Dispose();
            streams.Clear(); CryptographicOperations.ZeroMemory(key);
        }
    }

    // One authenticated block of plaintext per response, never a temporary file.
    // Seek reads only the required blocks, including large videos and models.
    private sealed class ResourceStream : Stream
    {
        private readonly GameResourcePackage owner;
        private readonly Entry entry;
        private readonly byte[] fileId;
        private readonly long start, length;
        private FileStream? input;
        private AesGcm? aes;
        private readonly byte[] plain, cipher, nonce = new byte[12], tag = new byte[16];
        private long position, loaded = -1;
        private bool closed;
        private readonly object gate = new();
        internal ResourceStream(GameResourcePackage owner, Entry entry, long start, long length)
        {
            this.owner = owner; this.entry = entry; this.start = start; this.length = length; fileId = Convert.FromBase64String(entry.Id);
            int capacity=(int)Math.Min(ChunkSize,entry.Length);plain=new byte[capacity];cipher=new byte[capacity];
        }
        ~ResourceStream() { Dispose(false); }
        public override bool CanRead => !closed;
        public override bool CanSeek => !closed;
        public override bool CanWrite => false;
        public override long Length => length;
        public override long Position { get => position; set => Seek(value, SeekOrigin.Begin); }
        public override int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));
        public override int Read(Span<byte> buffer)
        {
            lock (gate)
            {
                ObjectDisposedException.ThrowIf(closed || owner.disposed, this);
                int read = 0;
                while (read < buffer.Length && position < length)
                {
                    long absolute = start + position, chunk = absolute / ChunkSize;
                    if (loaded != chunk)
                    {
                        input ??= new FileStream(owner.filename, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.RandomAccess);
                        aes ??= new AesGcm(owner.key, 16);
                        int bytes = (int)Math.Min(ChunkSize, entry.Length - chunk * ChunkSize);
                        input.Position = entry.Offset + chunk * (ChunkSize + BlockOverhead);
                        input.ReadExactly(nonce); input.ReadExactly(tag); input.ReadExactly(cipher.AsSpan(0, bytes));
                        CryptographicOperations.ZeroMemory(plain); loaded = -1;
                        aes.Decrypt(nonce, cipher.AsSpan(0, bytes), tag, plain.AsSpan(0, bytes), BlockContext(owner.packageId, fileId, chunk, bytes));
                        loaded = chunk;
                    }
                    int inside = (int)(absolute % ChunkSize);
                    int take = (int)Math.Min(Math.Min(buffer.Length - read, ChunkSize - inside), length - position);
                    plain.AsSpan(inside, take).CopyTo(buffer.Slice(read, take)); position += take; read += take;
                }
                if (position == length) ReleaseBuffers();
                return read;
            }
        }
        public override long Seek(long offset, SeekOrigin origin)
        {
            lock (gate)
            {
                ObjectDisposedException.ThrowIf(closed, this);
                long next = checked((origin == SeekOrigin.Begin ? 0 : origin == SeekOrigin.Current ? position : origin == SeekOrigin.End ? length : throw new ArgumentException()) + offset);
                if (next < 0 || next > length) throw new IOException("资源读取位置无效。");
                return position = next;
            }
        }
        private void ReleaseBuffers() { input?.Dispose(); input = null; aes?.Dispose(); aes = null; loaded = -1; CryptographicOperations.ZeroMemory(plain); }
        protected override void Dispose(bool disposing)
        {
            lock (gate) { if (closed) return; closed = true; ReleaseBuffers(); }
            base.Dispose(disposing); if (disposing) GC.SuppressFinalize(this);
        }
        public override void Flush() { }
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
