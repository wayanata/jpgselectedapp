"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function isImage(entry: { mimeType?: string | null; name?: string | null }) {
  if (entry.mimeType?.startsWith("image/")) return true;
  const name = entry.name?.toLowerCase() ?? "";
  return /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(name);
}

function entryPreviewSrc(customerToken: string, entry: DriveEntry): string | null {
  if (entry.thumbnailLink) return entry.thumbnailLink;
  if (!isImage(entry)) return null;
  return `/api/pick/${encodeURIComponent(customerToken)}/preview?fileId=${encodeURIComponent(entry.id)}`;
}

/** Full-resolution image URL (always proxied; grid may still use Drive thumbnails). */
function fullPreviewSrc(customerToken: string, entry: DriveEntry): string | null {
  if (!isImage(entry)) return null;
  return `/api/pick/${encodeURIComponent(customerToken)}/preview?fileId=${encodeURIComponent(entry.id)}`;
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
  const [fullPreviewEntry, setFullPreviewEntry] = useState<DriveEntry | null>(null);
  const pickPreviewBlobRef = useRef<string | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [fullPreviewBlobUrl, setFullPreviewBlobUrl] = useState<string | null>(null);
  const [fullPreviewPhase, setFullPreviewPhase] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [fullPreviewLoadError, setFullPreviewLoadError] = useState<string | null>(null);

  const fullPreviewUrl = useMemo(
    () => (fullPreviewEntry ? fullPreviewSrc(customerToken, fullPreviewEntry) : null),
    [fullPreviewEntry, customerToken]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document.body only exists after mount; avoids SSR/hydration mismatch for createPortal
    setPortalEl(document.body);
  }, []);

  function revokePickPreviewBlob() {
    if (pickPreviewBlobRef.current) {
      URL.revokeObjectURL(pickPreviewBlobRef.current);
      pickPreviewBlobRef.current = null;
    }
  }

  useEffect(() => {
    if (!fullPreviewUrl || !fullPreviewEntry) {
      revokePickPreviewBlob();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset preview UI when dialog closes
      setFullPreviewBlobUrl(null);
      setFullPreviewPhase("idle");
      setFullPreviewLoadError(null);
      return;
    }

    let cancelled = false;
    setFullPreviewPhase("loading");
    setFullPreviewLoadError(null);
    revokePickPreviewBlob();
    setFullPreviewBlobUrl(null);

    void (async () => {
      try {
        const res = await fetch(fullPreviewUrl, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const ct = res.headers.get("content-type") ?? "";
        if (!res.ok) {
          const text = await res.text();
          let msg = `Could not load preview (${res.status})`;
          try {
            const j = JSON.parse(text) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            if (text.trim()) msg = text.trim().slice(0, 200);
          }
          if (!cancelled) {
            setFullPreviewPhase("error");
            setFullPreviewLoadError(msg);
          }
          return;
        }
        if (!ct.startsWith("image/")) {
          if (!cancelled) {
            setFullPreviewPhase("error");
            setFullPreviewLoadError("Preview is not an image response.");
          }
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        pickPreviewBlobRef.current = url;
        setFullPreviewBlobUrl(url);
        setFullPreviewPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setFullPreviewPhase("error");
          setFullPreviewLoadError(e instanceof Error ? e.message : "Load failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      revokePickPreviewBlob();
    };
  }, [fullPreviewEntry, fullPreviewUrl]);

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
      return isImage(e);
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

  useEffect(() => {
    if (!fullPreviewEntry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullPreviewEntry(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullPreviewEntry]);

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
      <div className="flex min-h-[40vh] items-center justify-center text-stone-500">
        Loading job…
      </div>
    );
  }

  return (
    <>
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            ← Home
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-stone-900">{jobTitle}</h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">
            Browse the gallery folder your photographer set up. Tap thumbnails to
            select images, then save. Use the expand control on a thumbnail for a
            full-screen preview. No Google sign-in required on your side.
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
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-medium">This job is closed</p>
          <p className="mt-1 text-amber-900">
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
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-red-200 bg-red-50 text-red-950"
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
        <div className="mt-8 rounded-xl border border-stone-200 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Photographer review link
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg bg-stone-100 px-3 py-2 text-sm text-amber-900">
              {photographerUrl}
            </code>
            <button
              type="button"
              className="rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100"
              onClick={() =>
                navigator.clipboard.writeText(photographerUrl).catch(() => {})
              }
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Send this to your photographer when you&apos;re ready — they sort picks
            without needing your Google account.
          </p>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 border-b border-stone-200 pb-4">
        <span className="text-sm text-stone-500">Path:</span>
        <button
          type="button"
          className="text-sm text-amber-800 hover:underline"
          onClick={() => setCrumbs([])}
        >
          Gallery folder
        </button>
        {crumbs.map((c, i) => (
          <span key={c.id} className="flex items-center gap-2 text-sm">
            <span className="text-stone-400">/</span>
            <button
              type="button"
              className={
                i === crumbs.length - 1
                  ? "text-stone-900"
                  : "text-stone-600 hover:text-stone-900"
              }
              onClick={() => setCrumbs((prev) => prev.slice(0, i + 1))}
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={imagesOnly}
            onChange={(e) => setImagesOnly(e.target.checked)}
            className="rounded border-stone-400 bg-white"
          />
          Hide non-images in this folder
        </label>
        {loadingDrive && (
          <span className="text-sm text-stone-500">Loading…</span>
        )}
      </div>

      {driveError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {driveError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleEntries.map((entry) => {
          const folder = isFolder(entry.mimeType);
          const picked = !folder && !!selected[entry.id];
          const previewSrc = folder ? null : entryPreviewSrc(customerToken, entry);
          const canFullPreview = !folder && !!fullPreviewSrc(customerToken, entry);
          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                folder
                  ? enterFolder({ id: entry.id, name: entry.name })
                  : toggleFile(entry)
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (folder) enterFolder({ id: entry.id, name: entry.name });
                else toggleFile(entry);
              }}
              className={`group flex flex-col overflow-hidden rounded-xl border text-left transition outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                picked
                  ? "border-amber-500 ring-1 ring-amber-500/40"
                  : "border-stone-200 hover:border-stone-400"
              } ${jobLocked && !folder ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
            >
              <div className="relative aspect-square bg-stone-100">
                {folder ? (
                  <div className="flex h-full items-center justify-center text-4xl">
                    📁
                  </div>
                ) : previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-500">
                    No preview
                  </div>
                )}
                {canFullPreview && (
                  <button
                    type="button"
                    aria-label="View full size"
                    title="View full size"
                    className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white/95 text-sm text-stone-700 shadow-sm hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullPreviewEntry(entry);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </button>
                )}
                {!folder && (
                  <span
                    className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                      picked
                        ? "bg-amber-500 text-zinc-950"
                        : "border border-stone-300 bg-white/95 text-stone-500"
                    }`}
                  >
                    {picked ? "✓" : "+"}
                  </span>
                )}
              </div>
              <div className="border-t border-stone-200 bg-white/90 p-2">
                <p className="truncate text-xs font-medium text-stone-800">
                  {entry.name}
                </p>
                {folder && (
                  <p className="text-[10px] text-stone-500">Open folder</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {listToken && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={loadingDrive}
            onClick={() => fetchPage(listToken)}
            className="rounded-xl border border-stone-300 px-6 py-2 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Load more in this folder
          </button>
        </div>
      )}

    </div>
    {portalEl &&
      fullPreviewEntry &&
      createPortal(
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Full image preview"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 text-white">
            <p className="min-w-0 truncate text-sm font-medium">{fullPreviewEntry.name}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              onClick={() => setFullPreviewEntry(null)}
            >
              Close
            </button>
          </div>
          <div
            role="presentation"
            className="mt-3 flex min-h-0 flex-1 cursor-zoom-out flex-col items-center justify-center gap-4 p-2"
            onClick={() => setFullPreviewEntry(null)}
          >
            {fullPreviewPhase === "loading" && (
              <p className="text-sm text-white/90">Loading preview…</p>
            )}
            {fullPreviewPhase === "error" && fullPreviewLoadError && (
              <p className="max-w-lg text-center text-sm text-red-200">{fullPreviewLoadError}</p>
            )}
            {fullPreviewPhase === "ready" && fullPreviewBlobUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fullPreviewBlobUrl}
                alt={fullPreviewEntry.name}
                className="max-h-[min(85vh,calc(100vh-6rem))] w-auto max-w-full object-contain"
                onClick={(e) => e.stopPropagation()}
                onError={() => {
                  setFullPreviewPhase("error");
                  setFullPreviewLoadError(
                    "This image format may not be supported in your browser (for example some HEIC files)."
                  );
                }}
              />
            )}
          </div>
        </div>,
        portalEl
      )}
    </>
  );
}
