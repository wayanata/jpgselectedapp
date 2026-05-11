import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-amber-800/90">
          Drive selections
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Clients pick from your Drive folder. You review on a private board.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-stone-600">
          You (the photographer) sign in once and paste a Drive folder link per
          job. Your client gets a simple link — no Google login on their side —
          browses that folder, and their picks show up for you on a separate
          photographer link.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/studio"
          className="group rounded-2xl border border-stone-200 bg-white/80 p-6 shadow-sm transition hover:border-amber-300/80 hover:bg-white"
        >
          <h2 className="text-lg font-medium text-stone-900 group-hover:text-amber-900">
            I&apos;m the photographer
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Sign in with Google (your Drive), create a job with a folder link,
            then share the client pick link.
          </p>
        </Link>
        <div className="rounded-2xl border border-stone-200 bg-white/60 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-stone-900">I&apos;m selecting photos</h2>
          <p className="mt-2 text-sm text-stone-600">
            Use the pick link your photographer sends you (looks like{" "}
            <span className="font-mono text-stone-800">/pick/…</span>). No Google
            sign-in required.
          </p>
        </div>
      </div>
    </main>
  );
}
