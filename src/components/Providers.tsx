"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

/**
 * Pass `session` from `await auth()` in the server layout when logged in so the
 * studio hydrates as authenticated after OAuth (avoids a stuck “Continue with Google”).
 * When there is no session, omit the prop (`undefined`) — do not pass `null`, or the
 * client may skip the initial `/api/auth/session` fetch (next-auth SessionProvider).
 */
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  /** Present only when the server saw a valid session cookie */
  session?: Session;
}) {
  return (
    <SessionProvider session={session ?? undefined}>{children}</SessionProvider>
  );
}
