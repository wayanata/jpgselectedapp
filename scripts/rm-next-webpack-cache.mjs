/**
 * Last-chance removal of `.next` before Workers Builds validates the repo tree
 * (25 MiB cap). OpenNext deploy only needs `.open-next/`.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

await rm(join(process.cwd(), ".next"), { recursive: true, force: true }).catch(() => {});
