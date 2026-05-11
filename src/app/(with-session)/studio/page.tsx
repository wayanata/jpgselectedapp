"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchApiJson } from "@/lib/client-fetch-json";

type JobRow = {
  id: string;
  title: string;
  slug: string;
  customerToken: string;
  driveFolderId: string;
  updatedAt: string;
  finishedAt: string | null;
  pickUrl: string;
  photographerUrl: string;
  _count: { selections: number };
};

export default function StudioPage() {
  const { data: session, status } = useSession();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("Photo selections");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [jobActionId, setJobActionId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, data } = await fetchApiJson<{
        jobs?: JobRow[];
        error?: string;
      }>("/api/studio/jobs");
      if (!res.ok) throw new Error(data.error ?? "Could not load jobs");
      setJobs(data.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    void loadJobs();
  }, [session, loadJobs]);

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const { res, data } = await fetchApiJson<{ error?: string }>(
        "/api/studio/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, driveFolderId }),
        }
      );
      if (!res.ok) throw new Error(data.error ?? "Could not create job");
      setDriveFolderId("");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function setJobFinished(jobId: string, finished: boolean) {
    setJobActionId(jobId);
    setError(null);
    try {
      const { res, data } = await fetchApiJson<{ error?: string }>(
        `/api/studio/jobs/${jobId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finished }),
        }
      );
      if (!res.ok) throw new Error(data.error ?? "Could not update job");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setJobActionId(null);
    }
  }

  async function deleteJob(jobId: string, title: string) {
    const ok = confirm(
      `Delete “${title}”? This removes picks and workflow folders from the app. Files stay in Google Drive.`
    );
    if (!ok) return;
    setJobActionId(jobId);
    setError(null);
    try {
      const res = await fetch(`/api/studio/jobs/${jobId}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 200) || `HTTP ${res.status}`);
      }
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete job");
    } finally {
      setJobActionId(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20">
        <h1 className="text-2xl font-semibold text-white">Photographer studio</h1>
        <p className="mt-3 text-zinc-400">
          Sign in with the Google account that owns your Drive galleries. You
          connect once here; clients only need the pick link you send them — no
          Google login on their side.
        </p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="mt-8 rounded-xl bg-white px-5 py-3 text-sm font-medium text-zinc-900 shadow hover:bg-zinc-100"
        >
          Continue with Google
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Studio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Signed in as {session.user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </div>

      <form
        onSubmit={createJob}
        className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
      >
        <h2 className="text-lg font-medium text-white">New selection job</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Paste your Google Drive folder link (or the folder ID). Clients will
          browse inside this folder only.
        </p>
        <label className="mt-4 block text-sm text-zinc-400">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-400">
          Drive folder URL or ID
          <input
            value={driveFolderId}
            onChange={(e) => setDriveFolderId(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="mt-6 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create job & links"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-12">
        <h2 className="text-lg font-medium text-white">Your jobs</h2>
        {loading && (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        )}
        <ul className="mt-6 space-y-4">
          {jobs.map((job) => (
            <li
              key={job.id}
              className={`rounded-xl border bg-zinc-900/40 p-4 ${
                job.finishedAt
                  ? "border-zinc-700 opacity-90"
                  : "border-zinc-800"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{job.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {job._count.selections} selection(s) · Updated{" "}
                    {new Date(job.updatedAt).toLocaleString()}
                  </p>
                  {job.finishedAt ? (
                    <p className="mt-2 inline-flex rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2 py-1 text-xs text-emerald-200">
                      Finished ·{" "}
                      {new Date(job.finishedAt).toLocaleString()}
                    </p>
                  ) : (
                    <p className="mt-2 inline-flex rounded-lg border border-amber-900/50 bg-amber-950/30 px-2 py-1 text-xs text-amber-200/90">
                      Active
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.finishedAt ? (
                    <button
                      type="button"
                      disabled={jobActionId !== null}
                      onClick={() => void setJobFinished(job.id, false)}
                      className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {jobActionId === job.id ? "…" : "Reopen"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={jobActionId !== null}
                      onClick={() => void setJobFinished(job.id, true)}
                      className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-950/70 disabled:opacity-40"
                    >
                      {jobActionId === job.id ? "…" : "Mark finished"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={jobActionId !== null}
                    onClick={() => void deleteJob(job.id, job.title)}
                    className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                  >
                    {jobActionId === job.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Client pick link (no Google login)
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs text-amber-200/90">
                      {job.pickUrl}
                    </code>
                    <button
                      type="button"
                      className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
                      onClick={() =>
                        navigator.clipboard.writeText(job.pickUrl).catch(() => {})
                      }
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Your board (sort picks)
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs text-zinc-400">
                      {job.photographerUrl}
                    </code>
                    <button
                      type="button"
                      className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(job.photographerUrl)
                          .catch(() => {})
                      }
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {!loading && jobs.length === 0 && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            No jobs yet. Create one above.
          </p>
        )}
      </div>
    </main>
  );
}
