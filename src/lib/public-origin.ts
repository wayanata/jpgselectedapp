import { readProcessEnv } from "@/lib/read-env";

/** Public site origin for absolute links (Auth.js base URL). Uses runtime env reads for Workers. */
export function getPublicOrigin(): string {
  const url =
    readProcessEnv("AUTH_URL") ??
    readProcessEnv("NEXTAUTH_URL") ??
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}
