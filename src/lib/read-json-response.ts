/**
 * Parse fetch Response as JSON. Cloudflare / caches sometimes return an empty body
 * or an HTML error page — avoid `res.json()` so we never throw the opaque
 * "Unexpected end of JSON input" from the browser's Response.json().
 */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(
      `Empty response from server (HTTP ${res.status}). The API may have crashed or timed out — try again or check Worker logs.`
    );
  }

  const lower = trimmed.slice(0, 64).toLowerCase();
  if (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    lower.startsWith("<head")
  ) {
    throw new Error(
      `Got a web page instead of API data (HTTP ${res.status}). Usually a wrong URL, a deploy/routing issue, or a sign-in redirect. Open the same path in a new tab and confirm you see JSON, not HTML.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (e) {
    const detail = e instanceof Error ? e.message : "parse error";
    const preview = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
    throw new Error(
      `Server did not return valid JSON (HTTP ${res.status}): ${detail}. Body starts with: ${preview.replace(/\s+/g, " ")}`
    );
  }
}
