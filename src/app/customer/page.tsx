"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type JobRow = {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  _count: { selections: number };
};

export default function CustomerDashboardPage() {
  const { data: session, status } = useSession();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("Could not load jobs");
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const t = setTimeout(() => {
      void loadJobs();
    }, 0);
    return () => clearTimeout(t);
  }, [session, loadJobs]);

  async function createJob() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Photo selections" }),
      });
      if (!res.ok) throw new Error("Could not create selection");
      const data = await res.json();
      window.location.href = `/customer/job/${data.job.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-semibold text-white">Customer sign-in</h1>
        <p className="mt-3 text-zinc-400">
          Use the Google account where your gallery lives. We request read-only
          Drive access so you can browse and choose images.
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
          <h1 className="text-2xl font-semibold text-white">Your selections</h1>
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

      {error && (
        <p className="mt-6 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={createJob}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          New selection set
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={loadJobs}
          className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <ul className="mt-10 space-y-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/customer/job/${job.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 transition hover:border-zinc-600"
            >
              <div>
                <p className="font-medium text-white">{job.title}</p>
                <p className="text-sm text-zinc-500">
                  {job._count.selections} image
                  {job._count.selections === 1 ? "" : "s"} · Updated{" "}
                  {new Date(job.updatedAt).toLocaleString()}
                </p>
              </div>
              <span className="text-zinc-500">→</span>
            </Link>
          </li>
        ))}
      </ul>

      {!loading && jobs.length === 0 && (
        <p className="mt-10 text-center text-zinc-500">
          No selection sets yet. Create one to browse Drive and pick photos.
        </p>
      )}
    </main>
  );
}
