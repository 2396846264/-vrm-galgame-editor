// Keep UTF-16 offsets compatible with saved documents and existing MCP clients.
export function readDocumentSource(document, args = {}) {
  const text = document.text;
  const requestedOffset = Number(args.offset);
  const requestedLength = Number(args.length);
  let offset = Math.min(text.length, Math.max(0, Math.floor(requestedOffset) || 0));
  const length = Number.isFinite(requestedLength)
    ? Math.min(24000, Math.max(1, Math.floor(requestedLength) || 12000))
    : 12000;
  const splitsPair = at => at > 0 && at < text.length
    && text.charCodeAt(at - 1) >= 0xd800 && text.charCodeAt(at - 1) <= 0xdbff
    && text.charCodeAt(at) >= 0xdc00 && text.charCodeAt(at) <= 0xdfff;
  if (splitsPair(offset)) offset--;
  let nextOffset = Math.min(text.length, offset + length);
  // A one-unit request must still make progress when it starts on an emoji.
  if (splitsPair(nextOffset)) nextOffset += nextOffset - offset === 1 ? 1 : -1;
  return {id: document.id, name: document.name, text: text.slice(offset, nextOffset),
    offset, nextOffset, total: text.length, complete: nextOffset === text.length};
}
