"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, { title: string; body: string }> = {
  Configuration: {
    title: "Auth configuration problem",
    body:
      "Often: AUTH_SECRET missing on the Worker, AUTH_URL not set to your real origin (https://….workers.dev), or Google OAuth redirect URI mismatch. If you use AUTH_USE_PRISMA_ADAPTER=1, DATABASE_URL must be set and migrations applied. Check Cloudflare → Worker → Variables and Google Cloud Console → Credentials.",
  },
  AccessDenied: {
    title: "Access denied",
    body: "You do not have permission to sign in with this account.",
  },
  Verification: {
    title: "Link expired or already used",
    body: "The sign-in link is no longer valid. Try signing in again.",
  },
  OAuthSignin: {
    title: "Could not start Google sign-in",
    body: "Check AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (or GOOGLE_CLIENT_*) on the Worker and that the OAuth client is a “Web application” type.",
  },
  OAuthCallback: {
    title: "OAuth callback failed",
    body:
      "Google did not return a valid token. Confirm the authorized redirect URI is exactly https://YOUR_HOST/api/auth/callback/google and matches AUTH_URL.",
  },
  OAuthAccountNotLinked: {
    title: "Account not linked",
    body: "This email is already used with a different sign-in method.",
  },
  Callback: {
    title: "Sign-in failed",
    body: "Something went wrong during the callback. Check Worker logs (wrangler tail) for details.",
  },
  Default: {
    title: "Sign-in error",
    body: "Something went wrong. You can try again from the studio.",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error") ?? "Default";
  const { title, body } = useMemo(() => {
    const known = MESSAGES[code];
    if (known) return known;
    return {
      title: `${MESSAGES.Default.title} (${code})`,
      body: MESSAGES.Default.body,
    };
  }, [code]);

  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-stone-900">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-4 text-stone-600">{body}</p>
      <p className="mt-6 text-xs text-stone-500">
        Error code: <code className="text-stone-700">{code}</code>
      </p>
      <Link
        href="/studio"
        className="mt-10 inline-block rounded-xl bg-white px-5 py-3 text-sm font-medium text-zinc-900 shadow hover:bg-zinc-100"
      >
        Back to studio
      </Link>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-stone-500">
          Loading…
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
