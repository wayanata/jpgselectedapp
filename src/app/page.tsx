import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400/90">
          Drive selections
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Choose photos from Google Drive. Your photographer sees the same list.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-400">
          Customers sign in, browse their Drive, and mark images for editing.
          Photographers open a private link to review picks and sort them into
          folders for workflow — without needing access to the customer&apos;s
          Drive (links open in Google when allowed).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/customer"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-amber-500/40 hover:bg-zinc-900"
        >
          <h2 className="text-lg font-medium text-white group-hover:text-amber-200">
            I&apos;m selecting photos
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in with Google and create a selection set from your Drive.
          </p>
        </Link>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-lg font-medium text-white">I&apos;m the photographer</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Open the link your client sends you (looks like{" "}
            <span className="font-mono text-zinc-300">/p/…</span>). Bookmark it;
            no Google login required on your side.
          </p>
        </div>
      </div>
    </main>
  );
}
