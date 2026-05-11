import { NextResponse } from "next/server";
import { readProcessEnv } from "@/lib/read-env";

/**
 * Temporary diagnostics: set Worker variable DEBUG_AUTH_ENV=1, open this URL once,
 * fix any `false` flags, then remove DEBUG_AUTH_ENV. Does not expose secret values.
 */
export async function GET() {
  if (readProcessEnv("DEBUG_AUTH_ENV") !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  const checks = {
    AUTH_SECRET: !!(
      readProcessEnv("AUTH_SECRET") ?? readProcessEnv("NEXTAUTH_SECRET")
    ),
    AUTH_GOOGLE_ID: !!(
      readProcessEnv("AUTH_GOOGLE_ID") ?? readProcessEnv("GOOGLE_CLIENT_ID")
    ),
    AUTH_GOOGLE_SECRET: !!(
      readProcessEnv("AUTH_GOOGLE_SECRET") ??
      readProcessEnv("GOOGLE_CLIENT_SECRET")
    ),
    AUTH_URL: !!(
      readProcessEnv("AUTH_URL") ?? readProcessEnv("NEXTAUTH_URL")
    ),
    DATABASE_URL: !!readProcessEnv("DATABASE_URL"),
    AUTH_USE_PRISMA_ADAPTER:
      readProcessEnv("AUTH_USE_PRISMA_ADAPTER") === "1",
  };

  const adapterNeedsDb = checks.AUTH_USE_PRISMA_ADAPTER;
  const ok =
    checks.AUTH_SECRET &&
    checks.AUTH_GOOGLE_ID &&
    checks.AUTH_GOOGLE_SECRET &&
    checks.AUTH_URL &&
    (!adapterNeedsDb || checks.DATABASE_URL);

  return NextResponse.json({
    ok,
    checks,
    nextSteps: ok
      ? [
          "Variables look present. If sign-in still fails, check Google Cloud redirect URI and wrangler tail logs.",
        ]
      : [
          "In Cloudflare → Worker → Variables: set every item that is false (Secrets for AUTH_SECRET and Google secret).",
          "AUTH_URL must be https://YOUR-SUBDOMAIN.workers.dev (no trailing slash).",
          "Google Console → redirect URI: https://YOUR-SUBDOMAIN.workers.dev/api/auth/callback/google",
          "Redeploy after changes. Turn off DEBUG_AUTH_ENV when done.",
        ],
  });
}
