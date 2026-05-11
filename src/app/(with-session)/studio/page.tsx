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
      <div className="flex min-h-[50vh] items-center justify-center text-stone-500">
        Loading…
      </div>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20">
        <h1 className="text-2xl font-semibold text-stone-900">Photographer studio</h1>
        <p className="mt-3 text-stone-600">
          Sign in with the Google account that owns your Drive galleries. You
          connect once here; clients only need the pick link you send them — no
          Google login on their side.
        </p>
        <button
          type="button"
          onClick={() =>
            void signIn("google", {
              callbackUrl: "/studio",
            })
          }
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
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-700">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">Studio</h1>
          <p className="mt-1 text-sm text-stone-500">
            Signed in as {session.user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Sign out
        </button>
      </div>

      <form
        onSubmit={createJob}
        className="mt-10 rounded-xl border border-stone-200 bg-white/80 p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium text-stone-900">New selection job</h2>
        <p className="mt-2 text-sm text-stone-500">
          Paste your Google Drive folder link (or the folder ID). Clients will
          browse inside this folder only.
        </p>
        <label className="mt-4 block text-sm text-stone-600">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
          />
        </label>
        <label className="mt-4 block text-sm text-stone-600">
          Drive folder URL or ID
          <input
            value={driveFolderId}
            onChange={(e) => setDriveFolderId(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400"
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
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      )}

      <div className="mt-12">
        <h2 className="text-lg font-medium text-stone-900">Your jobs</h2>
        {loading && (
          <p className="mt-4 text-sm text-stone-500">Loading…</p>
        )}
        <ul className="mt-6 space-y-4">
          {jobs.map((job) => (
            <li
              key={job.id}
              className={`rounded-xl border bg-white/80 p-4 shadow-sm ${
                job.finishedAt
                  ? "border-stone-300 opacity-90"
                  : "border-stone-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-900">{job.title}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {job._count.selections} selection(s) · Updated{" "}
                    {new Date(job.updatedAt).toLocaleString()}
                  </p>
                  {job.finishedAt ? (
                    <p className="mt-2 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                      Finished ·{" "}
                      {new Date(job.finishedAt).toLocaleString()}
                    </p>
                  ) : (
                    <p className="mt-2 inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
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
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-800 hover:bg-stone-100 disabled:opacity-40"
                    >
                      {jobActionId === job.id ? "…" : "Reopen"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={jobActionId !== null}
                      onClick={() => void setJobFinished(job.id, true)}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                    >
                      {jobActionId === job.id ? "…" : "Mark finished"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={jobActionId !== null}
                    onClick={() => void deleteJob(job.id, job.title)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-800 hover:bg-red-50 disabled:opacity-40"
                  >
                    {jobActionId === job.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-500">
                    Client pick link (no Google login)
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs text-amber-900">
                      {job.pickUrl}
                    </code>
                    <Link
                      href={`/pick/${encodeURIComponent(job.customerToken)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="rounded border border-stone-300 px-2 py-1 text-[10px] text-stone-600 hover:bg-stone-100"
                      onClick={() =>
                        navigator.clipboard.writeText(job.pickUrl).catch(() => {})
                      }
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-500">
                    Your board (sort picks)
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs text-stone-700">
                      {job.photographerUrl}
                    </code>
                    <Link
                      href={`/p/${encodeURIComponent(job.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-stone-300 px-2 py-1 text-[10px] font-medium text-stone-800 hover:bg-stone-100"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="rounded border border-stone-300 px-2 py-1 text-[10px] text-stone-600 hover:bg-stone-100"
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
          <p className="mt-6 text-center text-sm text-stone-500">
            No jobs yet. Create one above.
          </p>
        )}
      </div>
    </main>
  );
}
