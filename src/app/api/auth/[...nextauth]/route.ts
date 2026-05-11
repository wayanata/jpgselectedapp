import { handlers } from "@/auth";
import type { NextRequest } from "next/server";
import { readProcessEnv } from "@/lib/read-env";

function logAuthFailure(method: string, err: unknown) {
  console.error(`[api/auth] ${method} failed`, err);
}

function authErrorBody(err: unknown) {
  const base = {
    error:
      "Authentication handler failed. Inspect Worker logs (e.g. npx wrangler tail) and verify AUTH_SECRET, AUTH_URL, and Google OAuth variables on the Worker.",
  };
  if (readProcessEnv("DEBUG_AUTH_ENV") !== "1") {
    return base;
  }
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  return {
    ...base,
    debug: {
      message,
      stack,
      hint:
        message.includes("URL") || message.includes("Invalid URL")
          ? "AUTH_URL / NEXTAUTH_URL must be a full URL like https://your-app.workers.dev (no spaces, include https://)."
          : undefined,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    return await handlers.GET(request);
  } catch (err) {
    logAuthFailure("GET", err);
    return Response.json(authErrorBody(err), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlers.POST(request);
  } catch (err) {
    logAuthFailure("POST", err);
    return Response.json(authErrorBody(err), { status: 500 });
  }
}
