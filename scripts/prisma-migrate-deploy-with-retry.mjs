#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` with retries for transient Neon / Postgres errors
 * (e.g. P1002 advisory lock timeout when the pooler is slow or another deploy holds the lock).
 *
 * Cloudflare Workers Builds deploy step example:
 *   node scripts/prisma-migrate-deploy-with-retry.mjs && npm run deploy
 */
import { spawn } from "node:child_process";

const MAX_ATTEMPTS = Number.parseInt(process.env.PRISMA_MIGRATE_MAX_ATTEMPTS ?? "6", 10);
const BASE_DELAY_MS = Number.parseInt(process.env.PRISMA_MIGRATE_RETRY_BASE_MS ?? "4000", 10);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runMigrate() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function shouldRetry(attempt, exitCode) {
  if (exitCode === 0) return false;
  if (attempt >= MAX_ATTEMPTS) return false;
  return true;
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const code = await runMigrate();
    if (code === 0) {
      process.exit(0);
    }
    console.error(
      `[prisma-migrate-deploy-with-retry] attempt ${attempt}/${MAX_ATTEMPTS} failed (exit ${code})`
    );
    if (!shouldRetry(attempt, code)) break;
    const waitMs = BASE_DELAY_MS * attempt;
    console.error(`[prisma-migrate-deploy-with-retry] waiting ${waitMs}ms before retry…`);
    await delay(waitMs);
  }
  console.error(
    "[prisma-migrate-deploy-with-retry] giving up. For Neon P1002 advisory locks, try a direct (non-pooler) DATABASE_URL for migrate, or avoid parallel deploys."
  );
  process.exit(1);
}

await main();
