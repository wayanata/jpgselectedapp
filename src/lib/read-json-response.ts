/**
 * Parse fetch Response as JSON. Cloudflare / proxies sometimes return an empty body
 * on errors — `res.json()` then throws "Unexpected end of JSON input".
 */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      `Empty response from server (HTTP ${res.status}). Try again in a moment.`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const detail = e instanceof Error ? e.message : "parse error";
    throw new Error(
      `Server did not return valid JSON (HTTP ${res.status}): ${detail}`
    );
  }
}
