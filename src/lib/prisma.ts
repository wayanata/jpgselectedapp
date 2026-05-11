import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import { readProcessEnv } from "@/lib/read-env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  neonWsConfigured: boolean | undefined;
};

/**
 * Neon HTTP adapter (`PrismaNeonHTTP`) rejects transactions — Prisma then fails with
 * "Transactions are not supported in HTTP mode" on many writes (e.g. upsert).
 * WebSocket `Pool` supports transactions and matches Neon’s guidance for Workers.
 *
 * Cloudflare Workers expose global `WebSocket`. Older Node.js releases may not;
 * we fall back to the optional `ws` package for local `next dev`.
 */
function configureNeonWebSocketsOnce(): void {
  if (globalForPrisma.neonWsConfigured) return;
  globalForPrisma.neonWsConfigured = true;
  if (typeof globalThis.WebSocket === "function") {
    neonConfig.webSocketConstructor = globalThis.WebSocket;
    return;
  }
  try {
    // Older Node (local `next dev`): no global WebSocket — use `ws` package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebSocket: NodeWs } = require("ws") as typeof import("ws");
    neonConfig.webSocketConstructor =
      NodeWs as unknown as typeof globalThis.WebSocket;
  } catch {
    throw new Error(
      "Neon driver needs WebSockets. Cloudflare Workers provide global WebSocket. For local development use Node.js 22+, or run npm install ws."
    );
  }
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
