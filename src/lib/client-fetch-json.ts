import { readJsonResponse } from "@/lib/read-json-response";

const defaultInit: RequestInit = {
  cache: "no-store",
  headers: { Accept: "application/json" },
};

/**
 * Browser fetch for our API routes: avoids cached HTML error pages and ensures
 * Accept: application/json (some stacks behave better with an explicit Accept).
 */
export async function fetchApiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ res: Response; data: T }> {
  const headers = new Headers(defaultInit.headers as HeadersInit);
  if (init?.headers) {
    const h = new Headers(init.headers);
    h.forEach((v, k) => headers.set(k, v));
  }
  const res = await fetch(input, {
    ...init,
    cache: "no-store",
    headers,
  });
  const data = await readJsonResponse<T>(res);
  return { res, data };
}
