#!/usr/bin/env node
import { spawn } from "node:child_process";
import { applyPrismaMigrateEnvDefaults } from "./apply-prisma-migrate-env-defaults.mjs";

applyPrismaMigrateEnvDefaults();

const child = spawn("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
child.on("close", (code) => process.exit(code ?? 1));
child.on("error", () => process.exit(1));
