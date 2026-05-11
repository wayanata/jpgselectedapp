import { prisma } from "@/lib/prisma";
import { readProcessEnv } from "@/lib/read-env";

function oauthCredentials() {
  const clientId =
    readProcessEnv("GOOGLE_CLIENT_ID") ?? readProcessEnv("AUTH_GOOGLE_ID") ?? "";
  const clientSecret =
    readProcessEnv("GOOGLE_CLIENT_SECRET") ??
    readProcessEnv("AUTH_GOOGLE_SECRET") ??
    "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
}

type GoogleAccountRow = {
  id: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
};

async function loadGoogleAccount(userId: string): Promise<GoogleAccountRow> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      id: true,
      refresh_token: true,
      access_token: true,
      expires_at: true,
    },
  });
  if (!account?.refresh_token && !account?.access_token) {
    throw new Error(
      "No Google token stored. Sign out and sign in again to grant Drive access."
    );
  }
  return account;
}

type TokenRefreshResponse = {
  access_token: string;
  expires_in: number;
};

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = oauthCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Google OAuth refresh failed (${res.status}): ${text.slice(0, 240)}`
    );
  }
  if (!text.trim()) {
    throw new Error("Google OAuth refresh: empty response body");
  }
  try {
    return JSON.parse(text) as TokenRefreshResponse;
  } catch {
    throw new Error("Google OAuth refresh: response was not JSON");
  }
}

async function getValidAccessToken(account: GoogleAccountRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const skewSec = 120;
  if (
    account.access_token &&
    account.expires_at != null &&
    account.expires_at > now + skewSec
  ) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    throw new Error(
      "Access token expired and no refresh token. Sign in again with Drive access."
    );
  }
  const refreshed = await refreshAccessToken(account.refresh_token);
  const expiresAt = now + refreshed.expires_in;
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      expires_at: expiresAt,
    },
  });
  return refreshed.access_token;
}

async function driveJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Drive API error (${res.status}): ${text.slice(0, 320)}`);
  }
  if (!text.trim()) {
    throw new Error(`Drive API: empty response (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Drive API: invalid JSON (${res.status})`);
  }
}

async function driveFilesGetParents(fileId: string, accessToken: string) {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  );
  url.searchParams.set("fields", "parents");
  url.searchParams.set("supportsAllDrives", "true");
  return driveJson<{ parents?: string[] }>(url.toString(), accessToken);
}

export type DriveListData = {
  nextPageToken?: string;
  files?: Array<{
    id: string;
    name: string;
    mimeType: string;
    thumbnailLink?: string;
    webViewLink?: string;
    iconLink?: string;
    size?: string;
  }>;
};

async function driveFilesList(
  folderId: string,
  pageToken: string | undefined,
  accessToken: string
): Promise<DriveListData> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `'${folderId}' in parents and trashed = false`
  );
  url.searchParams.set(
    "fields",
    "nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, iconLink, size)"
  );
  url.searchParams.set("pageSize", "60");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  url.searchParams.set("orderBy", "folder,name_natural");
  return driveJson<DriveListData>(url.toString(), accessToken);
}

async function isFolderUnderRoot(
  accessToken: string,
  folderId: string,
  rootFolderId: string
): Promise<boolean> {
  let current: string | undefined = folderId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current === rootFolderId) return true;
    const meta = await driveFilesGetParents(current, accessToken);
    const parents = meta.parents ?? [];
    if (parents.includes(rootFolderId)) return true;
    if (parents.length === 0) return false;
    current = parents[0];
  }
  return false;
}

export async function listDriveChildren(
  userId: string,
  folderId: string,
  pageToken?: string
) {
  const account = await loadGoogleAccount(userId);
  const accessToken = await getValidAccessToken(account);
  return driveFilesList(folderId, pageToken, accessToken);
}

/** List children only when folderId is under rootFolderId (photographer’s Drive). */
export async function listDriveChildrenScoped(
  photographerUserId: string,
  rootFolderId: string,
  folderId: string,
  pageToken?: string
) {
  const account = await loadGoogleAccount(photographerUserId);
  const accessToken = await getValidAccessToken(account);
  const allowed =
    folderId === rootFolderId ||
    (await isFolderUnderRoot(accessToken, folderId, rootFolderId));
  if (!allowed) {
    throw new Error("Folder is outside this job’s Drive folder.");
  }
  return driveFilesList(folderId, pageToken, accessToken);
}

export function isFolder(mimeType?: string | null) {
  return mimeType === "application/vnd.google-apps.folder";
}

export function isImageMime(mimeType?: string | null) {
  return !!mimeType?.startsWith("image/");
}

export async function getPhotographerDriveAccessToken(
  photographerUserId: string
): Promise<string> {
  const account = await loadGoogleAccount(photographerUserId);
  return getValidAccessToken(account);
}

/** Metadata for a Drive file (download / scope checks). */
export async function getDriveFileMeta(
  accessToken: string,
  fileId: string
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
}> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  );
  url.searchParams.set("fields", "id,name,mimeType,parents,size");
  url.searchParams.set("supportsAllDrives", "true");
  return driveJson(url.toString(), accessToken);
}

/**
 * Ensures the file lives under the job root folder (same scope as browse).
 */
export async function assertDriveFileInJobTree(
  accessToken: string,
  driveFileId: string,
  rootFolderId: string
): Promise<{ name: string; mimeType: string; size?: string }> {
  const meta = await getDriveFileMeta(accessToken, driveFileId);
  if (meta.mimeType === "application/vnd.google-apps.folder") {
    throw new Error("Cannot download a folder");
  }
  const parents = meta.parents ?? [];
  let ok = false;
  for (const p of parents) {
    if (p === rootFolderId) {
      ok = true;
      break;
    }
    if (await isFolderUnderRoot(accessToken, p, rootFolderId)) {
      ok = true;
      break;
    }
  }
  if (!ok) {
    throw new Error("File is outside this job’s Drive folder.");
  }
  return { name: meta.name, mimeType: meta.mimeType, size: meta.size };
}

/** Raw bytes for a Drive file (binary or exported Google Workspace file). */
export async function fetchDriveFileBytes(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<Uint8Array> {
  if (mimeType === "application/vnd.google-apps.folder") {
    throw new Error("Cannot download folders");
  }
  const googleApps =
    mimeType.startsWith("application/vnd.google-apps.") &&
    mimeType !== "application/vnd.google-apps.folder";

  if (googleApps) {
    let exportMime = "application/pdf";
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
      exportMime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (mimeType === "application/vnd.google-apps.presentation") {
      exportMime = "application/pdf";
    } else if (mimeType === "application/vnd.google-apps.drawing") {
      exportMime = "image/png";
    } else if (mimeType === "application/vnd.google-apps.document") {
      exportMime = "application/pdf";
    }
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export`
    );
    url.searchParams.set("mimeType", exportMime);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(
        `Drive export failed (${res.status}): ${t.slice(0, 160)}`
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  );
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      `Drive download failed (${res.status}): ${t.slice(0, 160)}`
    );
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Safe filename inside a ZIP (preserves extension when missing). */
export function zipEntryFilename(originalName: string, mimeType: string): string {
  const cleaned = originalName.replace(/[/\\?*:|"<>]/g, "_").trim() || "file";
  const capped = cleaned.slice(0, 160);
  if (/\.[a-zA-Z0-9]{2,8}$/.test(capped)) return capped;
  if (mimeType.startsWith("image/jpeg")) return `${capped}.jpg`;
  if (mimeType.startsWith("image/png")) return `${capped}.png`;
  if (mimeType.startsWith("image/webp")) return `${capped}.webp`;
  if (mimeType.startsWith("image/gif")) return `${capped}.gif`;
  if (mimeType.startsWith("video/")) return `${capped}.mp4`;
  if (mimeType === "application/pdf") return `${capped}.pdf`;
  return capped;
}
