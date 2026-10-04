// Read only the VRM's embedded image; no mesh decoding or portrait rendering.
export function embeddedVrmThumbnail(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) return null;
  let doc, binary;
  for (let at = 12; at + 8 <= buffer.byteLength;) {
    const length = view.getUint32(at, true), type = view.getUint32(at + 4, true);
    at += 8;
    if (at + length > buffer.byteLength) throw new Error('VRM 数据不完整');
    if (type === 0x4e4f534a) doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, at, length)));
    if (type === 0x004e4942) binary = new Uint8Array(buffer, at, length);
    at += length;
  }
  const meta0 = doc?.extensions?.VRM?.meta;
  const index = doc?.extensions?.VRMC_vrm?.meta?.thumbnailImage ?? doc?.textures?.[meta0?.texture]?.source;
  const image = doc?.images?.[index];
  if (!image) return null;
  if (Number.isInteger(image.bufferView)) {
    const slice = doc.bufferViews?.[image.bufferView];
    const start = slice?.byteOffset || 0, length = slice?.byteLength;
    if (!binary || slice?.buffer !== 0 || !Number.isInteger(length) || start < 0 || start + length > binary.length) return null;
    return new Blob([binary.slice(start, start + length)], { type: image.mimeType || 'image/png' });
  }
  if (image.uri?.startsWith('data:image/')) {
    const [header, data] = image.uri.split(',');
    if (!header.endsWith(';base64') || data === undefined) return null;
    return new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: header.slice(5, -7) });
  }
  return null;
}

export function internalPortrait(project, item) {
  return Boolean(item.internalPortrait || item.generatedPortrait || item.folderId === 'auto-character-portraits' ||
    project.assetFolders?.some(f => f.id === item.folderId && f.hidden));
}
