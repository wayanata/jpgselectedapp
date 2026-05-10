/**
 * Remove Next.js webpack disk cache so Cloudflare Workers Builds' post-step
 * (Pages-style 25 MiB file check) does not see .next/cache/.../0.pack.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

await rm(join(process.cwd(), ".next/cache"), { recursive: true, force: true }).catch(
  () => {},
);
