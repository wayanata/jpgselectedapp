import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import { readProcessEnv } from "@/lib/read-env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  neonWsConfigured: boolean | undefined;
};

function isCloudflareWorkerRuntime(): boolean {
  // `WebSocketPair` is specific to Cloudflare Workers runtime.
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== "undefined";
}

/**
 * Neon HTTP adapter (`PrismaNeonHTTP`) rejects transactions — Prisma then fails with
 * "Transactions are not supported in HTTP mode" on many writes (e.g. upsert).
 * WebSocket `Pool` supports transactions and matches Neon’s guidance for Workers.
 *
 * Cloudflare Workers expose global `WebSocket`. Do not `require("ws")` here: bundlers
 * may pull `ws` into the Worker bundle; it depends on Node `net`/`tls` and crashes
 * the Worker at startup (Cloudflare 1101).
 *
 * Local `next dev`: use Node.js 22+ (global WebSocket), or run against Workers preview.
 */
function configureNeonWebSocketsOnce(): void {
  if (globalForPrisma.neonWsConfigured) return;
  globalForPrisma.neonWsConfigured = true;
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error(
      "Neon Pool requires global WebSocket. Use Node.js 22+ for local development, or deploy to Cloudflare Workers."
    );
  }
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

function createPrismaClient(): PrismaClient {
  const url = readProcessEnv("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  configureNeonWebSocketsOnce();
  const adapter = new PrismaNeon({ connectionString: url.trim() });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (isCloudflareWorkerRuntime()) {
    // Avoid sharing Neon/Prisma connection objects across requests in Workers.
    // Cross-request reuse can trigger "Cannot perform I/O on behalf of a different request".
    return createPrismaClient();
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy Prisma client so `next build` / OpenNext can run when CI has no DATABASE_URL.
 * Cloudflare should still set DATABASE_URL on the Worker for runtime.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver === prisma ? client : receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
