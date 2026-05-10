import { prisma } from "@/lib/prisma";

function oauthCredentials() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? "";
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Google OAuth refresh failed (${res.status}): ${text.slice(0, 240)}`
    );
  }
  return (await res.json()) as TokenRefreshResponse;
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API error (${res.status}): ${text.slice(0, 320)}`);
  }
  return (await res.json()) as T;
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
