/**
 * Cloudflare Pages rejects static assets over 25 MiB. Next/OpenNext can emit
 * large server .map files; remove them before Pages validates the output.
 */
import { readdir, unlink } from "node:fs/promises";
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
