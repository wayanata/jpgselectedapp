/**
 * Fails the build if Wrangler’s bundled worker does not include Prisma’s WASM as a
 * relative `./<hash>-query_compiler_bg.wasm` import. Older or misconfigured bundles
 * leave production stuck on readAll('/bundle/node_modules/.prisma/client/...') and
 * OAuth fails with AdapterError.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, ".open-next", "_wrangler_upload_check");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

execSync(`npx wrangler deploy --dry-run --outdir "${out}"`, {
  cwd: root,
  stdio: "inherit",
});

const workerPath = join(out, "worker.js");
if (!existsSync(workerPath)) {
  console.error("assert-wrangler-prisma-wasm: missing worker.js from wrangler --outdir");
  process.exit(1);
}

const worker = readFileSync(workerPath, "utf8");
const hashedRelative = /\.\/[a-f0-9]{40}-query_compiler_bg\.wasm/;
if (!hashedRelative.test(worker)) {
  console.error(
    "assert-wrangler-prisma-wasm: bundled worker.js must contain import of ./<40-hex>-query_compiler_bg.wasm.\n" +
      "Without it, Prisma on Cloudflare often fails with readAll '/bundle/node_modules/.prisma/client/query_compiler_bg.wasm'.\n" +
      "Check wrangler.jsonc (e.g. find_additional_modules, CompiledWasm rules) matches this repo."
  );
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
console.log("assert-wrangler-prisma-wasm: OK (Prisma WASM is a relative import in the Worker bundle)");
