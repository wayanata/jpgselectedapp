/**
 * Cloudflare Pages / Workers Builds validates output dirs with a 25 MiB cap per file.
 * Strip server .map files, then delete `.next` so Workers Builds' Pages-style
 * validator never sees multi‑MiB webpack packs under `.next/cache`.
 */
import { readdir, rm, unlink } from "node:fs/promises";
import { join } from "node:path";

const roots = [".open-next", ".next"];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.name.endsWith(".map")) await unlink(p).catch(() => {});
  }
}

for (const r of roots) await walk(r);

await rm(join(process.cwd(), ".next"), { recursive: true, force: true }).catch(() => {});
