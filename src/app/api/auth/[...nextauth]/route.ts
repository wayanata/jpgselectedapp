import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

function logAuthFailure(method: string, err: unknown) {
  console.error(`[api/auth] ${method} failed`, err);
}

export async function GET(request: NextRequest) {
  try {
    return await handlers.GET(request);
  } catch (err) {
    logAuthFailure("GET", err);
    return Response.json(
      {
        error:
          "Authentication handler failed. Inspect Worker logs (e.g. npx wrangler tail) and verify AUTH_SECRET, AUTH_URL, and Google OAuth variables on the Worker.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlers.POST(request);
  } catch (err) {
    logAuthFailure("POST", err);
    return Response.json(
      {
        error:
          "Authentication handler failed. Inspect Worker logs (e.g. npx wrangler tail) and verify AUTH_SECRET, AUTH_URL, and Google OAuth variables on the Worker.",
      },
      { status: 500 },
    );
  }
}
