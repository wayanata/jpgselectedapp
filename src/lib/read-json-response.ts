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
  } catch {
    throw new Error(
      `Server did not return JSON (HTTP ${res.status}). Check your connection or try again.`
    );
  }
}
