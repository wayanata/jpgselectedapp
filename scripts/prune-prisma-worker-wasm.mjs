/**
 * OpenNext copies all generated files under `.prisma/client/`, including
 * `query_engine_bg.wasm`, which is not used with `engineType = "client"` +
 * Neon HTTP adapter (only `query_compiler_bg.wasm` is). Removing it keeps the
 * gzipped Worker under Cloudflare Free’s 3 MiB limit.
 */
import { readdir, unlink } from "node:fs/promises";
import { join, sep } from "node:path";

const prismaClientMarker = `.prisma${sep}client${sep}`;

const drop = new Set(["query_engine_bg.wasm", "query_engine_bg.js"]);

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
    else if (drop.has(e.name) && p.includes(prismaClientMarker)) {
      await unlink(p);
    }
  }
}

await walk(join(process.cwd(), ".open-next", "server-functions"));
