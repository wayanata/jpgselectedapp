import { google } from "googleapis";
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

export async function getDriveClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.refresh_token && !account?.access_token) {
    throw new Error(
      "No Google token stored. Sign out and sign in again to grant Drive access."
    );
  }
  const { clientId, clientSecret } = oauthCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    refresh_token: account.refresh_token ?? undefined,
    access_token: account.access_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/** Walk parents until rootFolderId — ensures folderId lives under the job folder tree. */
export async function isFolderUnderRoot(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  rootFolderId: string
): Promise<boolean> {
  let current: string | undefined = folderId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current === rootFolderId) return true;
    const meta = (await drive.files.get({
      fileId: current,
      fields: "parents",
      supportsAllDrives: true,
    })) as { data: { parents?: string[] | null } };
    const parents = meta.data.parents ?? [];
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
  const drive = await getDriveClient(userId);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      "nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, iconLink, size)",
    pageSize: 60,
    pageToken,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: "folder,name_natural",
  });
  return res.data;
}

/** List children only when folderId is under rootFolderId (photographer’s Drive). */
export async function listDriveChildrenScoped(
  photographerUserId: string,
  rootFolderId: string,
  folderId: string,
  pageToken?: string
) {
  const drive = await getDriveClient(photographerUserId);
  const allowed =
    folderId === rootFolderId ||
    (await isFolderUnderRoot(drive, folderId, rootFolderId));
  if (!allowed) {
    throw new Error("Folder is outside this job’s Drive folder.");
  }
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      "nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, iconLink, size)",
    pageSize: 60,
    pageToken,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: "folder,name_natural",
  });
  return res.data;
}

export function isFolder(mimeType?: string | null) {
  return mimeType === "application/vnd.google-apps.folder";
}

export function isImageMime(mimeType?: string | null) {
  return !!mimeType?.startsWith("image/");
}
