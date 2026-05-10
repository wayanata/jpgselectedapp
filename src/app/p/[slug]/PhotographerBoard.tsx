"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  updatedAt: string;
  selections: SelFile[];
  folders: Folder[];
};

export function PhotographerBoard({ slug }: { slug: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFolder, setNewFolder] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/jobs/${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Not found");
      setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
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

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolder.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/jobs/${slug}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolder.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewFolder("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function assignFolder(fileId: string, folderId: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/public/jobs/${slug}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedFileId: fileId, folderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setJob((prev) => {
        if (!prev) return prev;
        const selections = prev.selections.map((s) =>
          s.id === fileId ? { ...s, ...data.file, folder: data.file.folder } : s
        );
        return { ...prev, selections };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const foldersSorted = useMemo(
    () => [...(job?.folders ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [job?.folders]
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-red-300">{error ?? "Job not found"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="border-b border-zinc-800 pb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/90">
          Photographer view
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{job.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated {new Date(job.updatedAt).toLocaleString()} ·{" "}
          {job.selections.length} file
          {job.selections.length === 1 ? "" : "s"}
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-white">Workflow folders</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Organize client picks into buckets (e.g. “Retouch”, “Print”, “Rejected”).
          This does not move files in Google Drive — it&apos;s for your studio
          workflow only.
        </p>
        <form onSubmit={addFolder} className="mt-4 flex flex-wrap gap-2">
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder name"
            className="min-w-[200px] flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !newFolder.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Add folder
          </button>
        </form>

        {foldersSorted.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {foldersSorted.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-300"
              >
                {f.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-medium text-white">Selected images</h2>
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Preview</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Folder</th>
                <th className="px-4 py-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {job.selections.map((file) => (
                <tr key={file.id} className="bg-zinc-950/40">
                  <td className="px-4 py-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-zinc-900">
                      {file.thumbnailLink ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.thumbnailLink}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-zinc-600">
                          —
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-zinc-200">
                      {file.name}
                    </p>
                    <p className="truncate text-xs text-zinc-600">
                      Drive ID: {file.driveFileId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={busy}
                      value={file.folderId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        assignFolder(file.id, v === "" ? null : v);
                      }}
                      className="w-full max-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-600 focus:outline-none"
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
                        className="text-emerald-400 hover:underline"
                      >
                        Google Drive
                      </a>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {job.selections.length === 0 && (
          <p className="mt-8 text-center text-zinc-500">
            No images selected yet. Ask your client to save their selection from
            the customer dashboard.
          </p>
        )}
      </section>
    </div>
  );
}
