"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/client-fetch-json";

type Folder = {
  id: string;
  name: string;
  sortOrder: number;
};

type SelFile = {
  id: string;
  name: string;
  driveFileId: string;
  mimeType?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  folderId?: string | null;
  folder?: Folder | null;
};

type Job = {
  id: string;
  title: string;
  customerToken: string;
  updatedAt: string;
  finishedAt?: string | null;
  selections: SelFile[];
  folders: Folder[];
};

export function PhotographerBoard({ slug }: { slug: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFolder, setNewFolder] = useState("");
  const [busy, setBusy] = useState(false);
  /** Inline feedback — never replaces the whole board */
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkFolderId, setBulkFolderId] = useState<string>("");
  const [downloadingZip, setDownloadingZip] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { res, data } = await fetchApiJson<{ error?: string; job?: Job }>(
        `/api/public/jobs/${slug}`
      );
      if (!res.ok) throw new Error(data.error ?? "Not found");
      if (!data.job) throw new Error("Invalid response");
      setJob(data.job);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error");
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const foldersSorted = useMemo(
    () => [...(job?.folders ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [job?.folders]
  );

  const selectionIds = useMemo(
    () => job?.selections.map((s) => s.id) ?? [],
    [job?.selections]
  );

  const allSelected =
    selectionIds.length > 0 &&
    selectionIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectionIds));
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolder.trim()) return;
    if (job?.finishedAt) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const { res, data } = await fetchApiJson<{
        error?: string;
        folder?: { name: string };
      }>(`/api/public/jobs/${slug}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolder.trim() }),
      });
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewFolder("");
      await load();
      setActionSuccess(
        `Folder “${data.folder?.name ?? newFolder.trim()}” added. Assign photos with the row menu or bulk move below.`
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not add folder");
    } finally {
      setBusy(false);
    }
  }

  async function assignFolder(fileId: string, folderId: string | null) {
    if (job?.finishedAt) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const { res, data } = await fetchApiJson<{ error?: string; file: SelFile }>(
        `/api/public/jobs/${slug}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedFileId: fileId, folderId }),
        }
      );
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setJob((prev) => {
        if (!prev) return prev;
        const selections = prev.selections.map((s) =>
          s.id === fileId ? { ...s, ...data.file, folder: data.file.folder } : s
        );
        return { ...prev, selections };
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not update folder");
    } finally {
      setBusy(false);
    }
  }

  async function bulkMoveToFolder() {
    if (job?.finishedAt) return;
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const folderId = bulkFolderId === "" ? null : bulkFolderId;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const results: SelFile[] = [];
      for (const fileId of ids) {
        const { res, data } = await fetchApiJson<{
          error?: string;
          file: SelFile;
        }>(`/api/public/jobs/${slug}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedFileId: fileId, folderId }),
        });
        if (!res.ok) throw new Error(data.error ?? "Failed");
        results.push(data.file);
      }
      const byId = new Map(results.map((f) => [f.id, f]));
      setJob((prev) => {
        if (!prev) return prev;
        const selections = prev.selections.map((s) => {
          const u = byId.get(s.id);
          return u ? { ...s, ...u, folder: u.folder } : s;
        });
        return { ...prev, selections };
      });
      setSelectedIds(new Set());
      const label =
        folderId === null
          ? "Unsorted"
          : foldersSorted.find((f) => f.id === folderId)?.name ?? "folder";
      setActionSuccess(`Moved ${ids.length} image(s) to “${label}”.`);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Bulk move failed — try again"
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip(ids: string[]) {
    if (ids.length === 0) return;
    setDownloadingZip(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/public/jobs/${slug}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/zip, application/json",
        },
        body: JSON.stringify({ selectedFileIds: ids }),
        cache: "no-store",
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Download failed");
        }
        const t = await res.text();
        throw new Error(t.slice(0, 200) || `HTTP ${res.status}`);
      }
      if (!ct.includes("zip") && !ct.includes("octet-stream")) {
        const t = await res.text();
        throw new Error(t.slice(0, 160) || "Unexpected response");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe =
        job?.title.replace(/[/\\?*:|"<>]/g, "_").trim().slice(0, 48) ||
        "selections";
      a.download = `${safe}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setActionSuccess(
        `Downloading ZIP with ${ids.length} file${ids.length === 1 ? "" : "s"} (from your Google Drive).`
      );
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Could not build download"
      );
    } finally {
      setDownloadingZip(false);
    }
  }

  if (loading && !job) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-stone-500">
        Loading…
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-red-800">{loadError ?? "Job not found"}</p>
      </div>
    );
  }

  const jobLocked = !!job.finishedAt;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {actionSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p>{actionSuccess}</p>
            <button
              type="button"
              onClick={() => setActionSuccess(null)}
              className="shrink-0 text-xs text-emerald-800 underline hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p>{actionError}</p>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="shrink-0 text-xs text-red-800 underline hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-stone-200 pb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-800">
          Photographer view
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">{job.title}</h1>
        <p className="mt-2 text-sm text-stone-500">
          Last updated {new Date(job.updatedAt).toLocaleString()} ·{" "}
          {job.selections.length} file
          {job.selections.length === 1 ? "" : "s"}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/pick/${encodeURIComponent(job.customerToken)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100"
          >
            Open client pick page
          </Link>
          <button
            type="button"
            className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-800 hover:bg-stone-100"
            onClick={() => {
              const url = `${window.location.origin}/pick/${job.customerToken}`;
              void navigator.clipboard.writeText(url).then(
                () => {
                  setActionSuccess("Client pick link copied to clipboard.");
                  setActionError(null);
                },
                () => {
                  setActionError("Could not copy link — copy it manually from the address bar after opening.");
                }
              );
            }}
          >
            Copy client pick link
          </button>
        </div>
        {jobLocked && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <p className="font-medium">Job closed</p>
            <p className="mt-1 text-amber-900">
              This session is marked finished in Studio. You can still download
              ZIPs; adding folders and moving images into workflow buckets is
              disabled.
            </p>
          </div>
        )}
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-stone-900">Workflow folders</h2>
        <p className="mt-1 text-sm text-stone-500">
          Organize client picks into buckets (e.g. “Retouch”, “Print”, “Rejected”).
          This does not move files in Google Drive — it&apos;s for your studio
          workflow only.
        </p>
        <form onSubmit={addFolder} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder name"
            disabled={jobLocked}
            className="min-w-[200px] flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !newFolder.trim() || jobLocked}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add folder"}
          </button>
        </form>

        {foldersSorted.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {foldersSorted.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-stone-200 bg-white/90 px-3 py-1.5 text-sm text-stone-700"
              >
                {f.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium text-stone-900">Selected images</h2>

        {job.selections.length > 0 && (
          <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-white/70 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <p className="text-sm text-stone-600">
                <span className="font-medium text-stone-800">
                  {selectedIds.size}
                </span>{" "}
                selected — move or download:
              </p>
              <select
                value={bulkFolderId}
                onChange={(e) => setBulkFolderId(e.target.value)}
                disabled={busy || downloadingZip || jobLocked}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Unsorted</option>
                {foldersSorted.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={
                  busy ||
                  downloadingZip ||
                  selectedIds.size === 0 ||
                  jobLocked
                }
                onClick={() => void bulkMoveToFolder()}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
              >
                Move selected
              </button>
              <button
                type="button"
                disabled={busy || downloadingZip || selectedIds.size === 0}
                onClick={() =>
                  void downloadZip([...selectedIds])
                }
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-40"
              >
                {downloadingZip ? "Preparing ZIP…" : "Download selected (ZIP)"}
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  downloadingZip ||
                  job.selections.length === 0
                }
                onClick={() =>
                  void downloadZip(job.selections.map((s) => s.id))
                }
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-40"
              >
                Download all (ZIP)
              </button>
            </div>
            <p className="text-xs text-stone-500">
              ZIP is built from your Google Drive files (up to 60 files, ~95 MiB
              total). Requires your Google account to still have access to the
              gallery folder.
            </p>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white/80 shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-100/90 text-xs uppercase text-stone-600">
              <tr>
                <th className="w-10 px-2 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={busy || downloadingZip || selectionIds.length === 0}
                    title="Select all"
                    className="rounded border-stone-400 bg-white"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Preview</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Folder</th>
                <th className="px-4 py-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {job.selections.map((file) => (
                <tr key={file.id} className="bg-white/60">
                  <td className="px-2 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(file.id)}
                      onChange={() => toggleSelect(file.id)}
                      disabled={busy || downloadingZip}
                      aria-label={`Select ${file.name}`}
                      className="rounded border-stone-400 bg-white"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-stone-100">
                      {file.thumbnailLink ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.thumbnailLink}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-stone-500">
                          —
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-stone-800">
                      {file.name}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      Drive ID: {file.driveFileId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={busy || downloadingZip || jobLocked}
                      value={file.folderId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        void assignFolder(file.id, v === "" ? null : v);
                      }}
                      className="w-full max-w-[200px] rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">Unsorted</option>
                      {foldersSorted.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {file.webViewLink ? (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-800 hover:underline"
                      >
                        Google Drive
                      </a>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {job.selections.length === 0 && (
          <p className="mt-8 text-center text-stone-500">
            No images selected yet. Ask your client to save their selection from
            the pick link.
          </p>
        )}
      </section>
    </div>
  );
}
