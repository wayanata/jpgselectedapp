import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { readProcessEnv } from "@/lib/read-env";

// Auth.js defaults are AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET only; support GOOGLE_CLIENT_* too (see env.example).
const googleClientId =
  process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";

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

const googleProvider = Google({
  clientId: googleClientId,
  clientSecret: googleClientSecret,
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
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  ...(usePrismaAdapter()
    ? { adapter: PrismaAdapter(prisma) }
    : { session: { strategy: "jwt" } }),
  trustHost: true,
  providers: [googleProvider],
  callbacks: sessionCallback,
}));

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
