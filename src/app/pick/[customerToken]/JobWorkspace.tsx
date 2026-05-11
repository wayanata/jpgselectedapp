"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApiJson } from "@/lib/client-fetch-json";

type DriveEntry = {
  id: string;
  name: string;
  mimeType?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  iconLink?: string | null;
};

type Crumb = { id: string; name: string };

type SelectedMap = Record<
  string,
  {
    driveFileId: string;
    name: string;
    mimeType?: string | null;
    thumbnailLink?: string | null;
    webViewLink?: string | null;
    iconLink?: string | null;
  }
>;

function isFolder(mime?: string | null) {
  return mime === "application/vnd.google-apps.folder";
}

function isImage(mime?: string | null) {
  return !!mime?.startsWith("image/");
}

export function JobWorkspace({ customerToken }: { customerToken: string }) {
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const folderId =
    crumbs.length && rootFolderId
      ? crumbs[crumbs.length - 1].id
      : rootFolderId ?? "";

  const [listToken, setListToken] = useState<string | undefined>();
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SelectedMap>({});
  const [imagesOnly, setImagesOnly] = useState(true);

  const [jobTitle, setJobTitle] = useState("");
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [photographerUrl, setPhotographerUrl] = useState<string | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const saveBannerRef = useRef<HTMLDivElement>(null);

  const loadJob = useCallback(async () => {
    setLoadingJob(true);
    try {
      const { res, data } = await fetchApiJson<{
        error?: string;
        job?: {
          title: string;
          finishedAt?: string | null;
          selections?: Array<{
            driveFileId: string;
            name: string;
            mimeType?: string | null;
            thumbnailLink?: string | null;
            webViewLink?: string | null;
            iconLink?: string | null;
          }>;
        };
        photographerUrl?: string | null;
        driveFolderId?: string;
      }>(`/api/pick/${customerToken}/job`);
      if (!res.ok) throw new Error(data.error ?? "Could not load job");
      if (!data.job) throw new Error("Invalid response");
      setJobTitle(data.job.title);
      setFinishedAt(data.job.finishedAt ?? null);
      setPhotographerUrl(data.photographerUrl ?? null);
      setRootFolderId(data.driveFolderId ?? null);
      const next: SelectedMap = {};
      for (const s of data.job.selections ?? []) {
        next[s.driveFileId] = {
          driveFileId: s.driveFileId,
          name: s.name,
          mimeType: s.mimeType,
          thumbnailLink: s.thumbnailLink,
          webViewLink: s.webViewLink,
          iconLink: s.iconLink,
        };
      }
      setSelected(next);
    } catch (e) {
      setDriveError(e instanceof Error ? e.message : "Error loading job");
    } finally {
      setLoadingJob(false);
    }
  }, [customerToken]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const fetchPage = useCallback(
    async (token?: string) => {
      if (!rootFolderId || !folderId) return;
      setLoadingDrive(true);
      setDriveError(null);
      try {
        const params = new URLSearchParams({
          jobToken: customerToken,
          folderId,
        });
        if (token) params.set("pageToken", token);
        const { res, data } = await fetchApiJson<{
          error?: string;
          files?: DriveEntry[];
          nextPageToken?: string;
        }>(`/api/drive/browse?${params}`);
        if (!res.ok) throw new Error(data.error ?? "Drive request failed");
        const files = (data.files ?? []) as DriveEntry[];
        setEntries((prev) => (token ? [...prev, ...files] : files));
        setListToken(data.nextPageToken ?? undefined);
      } catch (e) {
        setDriveError(e instanceof Error ? e.message : "Drive error");
      } finally {
        setLoadingDrive(false);
      }
    },
    [customerToken, folderId, rootFolderId]
  );

  useEffect(() => {
    if (!rootFolderId) return;
    setEntries([]);
    setListToken(undefined);
    void fetchPage();
  }, [folderId, rootFolderId, fetchPage]);

  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      if (isFolder(e.mimeType)) return true;
      if (!imagesOnly) return true;
      return isImage(e.mimeType);
    });
  }, [entries, imagesOnly]);

  function enterFolder(c: Crumb) {
    setCrumbs((prev) => [...prev, c]);
  }

  async function saveSelections() {
    if (finishedAt) return;
    setSaving(true);
    setSaveFeedback(null);
    try {
      const files = Object.values(selected);
      const { res, data } = await fetchApiJson<{
        error?: string;
        selections?: unknown[];
      }>(`/api/pick/${customerToken}/selections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const n = data.selections?.length ?? files.length;
      setSaveFeedback({
        kind: "success",
        text: `Saved ${n} image${n === 1 ? "" : "s"}. Your photographer can see them on their board.`,
      });
    } catch (e) {
      setSaveFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (saveFeedback?.kind !== "success") return;
    saveBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [saveFeedback]);

  function toggleFile(entry: DriveEntry) {
    if (finishedAt) return;
    if (isFolder(entry.mimeType)) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[entry.id]) delete next[entry.id];
      else {
        next[entry.id] = {
          driveFileId: entry.id,
          name: entry.name,
          mimeType: entry.mimeType,
          thumbnailLink: entry.thumbnailLink,
          webViewLink: entry.webViewLink,
          iconLink: entry.iconLink,
        };
      }
      return next;
    });
  }

  const selectedCount = Object.keys(selected).length;
  const jobLocked = !!finishedAt;

  if (loadingJob) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading job…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Home
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">{jobTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Browse the gallery folder your photographer set up. Tap thumbnails to
            select images, then save. No Google sign-in required on your side.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={saving || jobLocked}
            onClick={() => void saveSelections()}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : `Save selection (${selectedCount})`}
          </button>
        </div>
      </div>

      {jobLocked && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-amber-800/60 bg-amber-950/35 px-4 py-3 text-sm text-amber-100"
        >
          <p className="font-medium">This job is closed</p>
          <p className="mt-1 text-amber-100/90">
            Your photographer marked this session finished. You can still browse
            the gallery, but you can&apos;t change your selection.
          </p>
        </div>
      )}

      {saveFeedback && (
        <div
          ref={saveBannerRef}
          role={saveFeedback.kind === "success" ? "status" : "alert"}
          aria-live="polite"
          className={`mt-6 rounded-xl border px-4 py-4 text-sm ${
            saveFeedback.kind === "success"
              ? "border-emerald-700/70 bg-emerald-950/50 text-emerald-100"
              : "border-red-800/70 bg-red-950/40 text-red-100"
          }`}
        >
          <p className="font-medium">
            {saveFeedback.kind === "success" ? "All set" : "Could not save"}
          </p>
          <p className="mt-1 text-balance opacity-95">{saveFeedback.text}</p>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            className="mt-3 text-xs underline opacity-90 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {photographerUrl && (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Photographer review link
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg bg-zinc-950 px-3 py-2 text-sm text-amber-200/90">
              {photographerUrl}
            </code>
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              onClick={() =>
                navigator.clipboard.writeText(photographerUrl).catch(() => {})
              }
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Send this to your photographer when you&apos;re ready — they sort picks
            without needing your Google account.
          </p>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-4">
        <span className="text-sm text-zinc-500">Path:</span>
        <button
          type="button"
          className="text-sm text-amber-400/90 hover:underline"
          onClick={() => setCrumbs([])}
        >
          Gallery folder
        </button>
        {crumbs.map((c, i) => (
          <span key={c.id} className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600">/</span>
            <button
              type="button"
              className={
                i === crumbs.length - 1
                  ? "text-white"
                  : "text-zinc-400 hover:text-white"
              }
              onClick={() => setCrumbs((prev) => prev.slice(0, i + 1))}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={imagesOnly}
            onChange={(e) => setImagesOnly(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900"
          />
          Hide non-images in this folder
        </label>
        {loadingDrive && (
          <span className="text-sm text-zinc-600">Loading…</span>
        )}
      </div>

      {driveError && (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {driveError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleEntries.map((entry) => {
          const folder = isFolder(entry.mimeType);
          const picked = !folder && !!selected[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() =>
                folder
                  ? enterFolder({ id: entry.id, name: entry.name })
                  : toggleFile(entry)
              }
              className={`group flex flex-col overflow-hidden rounded-xl border text-left transition ${
                picked
                  ? "border-amber-500 ring-1 ring-amber-500/40"
                  : "border-zinc-800 hover:border-zinc-600"
              } ${jobLocked && !folder ? "cursor-not-allowed opacity-90" : ""}`}
            >
              <div className="relative aspect-square bg-zinc-900">
                {folder ? (
                  <div className="flex h-full items-center justify-center text-4xl">
                    📁
                  </div>
                ) : entry.thumbnailLink ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.thumbnailLink}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                    No preview
                  </div>
                )}
                {!folder && (
                  <span
                    className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                      picked
                        ? "bg-amber-500 text-zinc-950"
                        : "border border-zinc-600 bg-zinc-950/80 text-zinc-400"
                    }`}
                  >
                    {picked ? "✓" : "+"}
                  </span>
                )}
              </div>
              <div className="border-t border-zinc-800 p-2">
                <p className="truncate text-xs font-medium text-zinc-200">
                  {entry.name}
                </p>
                {folder && (
                  <p className="text-[10px] text-zinc-500">Open folder</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {listToken && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={loadingDrive}
            onClick={() => fetchPage(listToken)}
            className="rounded-xl border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Load more in this folder
          </button>
        </div>
      )}
    </div>
  );
}
