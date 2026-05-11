import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { readProcessEnv } from "@/lib/read-env";

/**
 * PrismaAdapter only when explicitly enabled, using runtime env reads (see `read-env.ts`).
 */
function usePrismaAdapter(): boolean {
  if (readProcessEnv("SKIP_PRISMA_ADAPTER") === "1") return false;
  if (readProcessEnv("AUTH_USE_PRISMA_ADAPTER") !== "1") return false;
  const url = readProcessEnv("DATABASE_URL");
  if (!url || url.trim() === "") return false;
  return true;
}

function googleProvider() {
  // Must use readProcessEnv: plain process.env.* can be inlined at build time (empty in CI),
  // so Workers never see AUTH_SECRET / Google keys at runtime → MissingSecret → HTTP 500.
  const clientId =
    readProcessEnv("AUTH_GOOGLE_ID") ?? readProcessEnv("GOOGLE_CLIENT_ID") ?? "";
  const clientSecret =
    readProcessEnv("AUTH_GOOGLE_SECRET") ??
    readProcessEnv("GOOGLE_CLIENT_SECRET") ??
    "";
  return Google({
    clientId,
    clientSecret,
    authorization: {
      params: {
        scope:
          "openid email profile https://www.googleapis.com/auth/drive.readonly",
        prompt: "consent",
        access_type: "offline",
        response_type: "code",
      },
    },
  });
}

const sessionCallback = {
  session({
    session,
    user,
    token,
  }: {
    session: DefaultSession & { user: DefaultSession["user"] & { id?: string } };
    user?: { id: string };
    token?: { sub?: string };
  }) {
    if (user) {
      session.user.id = user.id;
    } else if (token?.sub) {
      session.user.id = token.sub;
    }
    return session;
  },
};

/** Lazy config so each Auth invocation sees current env. */
export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  secret:
    readProcessEnv("AUTH_SECRET") ?? readProcessEnv("NEXTAUTH_SECRET") ?? "",
  ...(usePrismaAdapter()
    ? { adapter: PrismaAdapter(prisma) }
    : { session: { strategy: "jwt" } }),
  trustHost: true,
  // Default Auth.js HTML uses Preact SSR; on Workers it can misbehave. `Configuration`
  // also maps to HTTP 500 on /api/auth/error — redirect to an App Router page instead.
  pages: {
    signIn: "/studio",
    error: "/auth/error",
  },
  providers: [googleProvider()],
  callbacks: sessionCallback,
}));

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
