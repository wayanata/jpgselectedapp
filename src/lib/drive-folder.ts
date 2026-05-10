/** Accept raw folder ID or full Google Drive folder URL. */
export function parseDriveFolderId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const fromUrl = t.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9_-]+$/.test(t)) return t;
  return null;
}
