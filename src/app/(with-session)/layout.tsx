import { auth } from "@/auth";
import { Providers } from "@/components/Providers";

/**
 * NextAuth SessionProvider only under this group so public pages (/pick, /p)
 * never call /api/auth/session (avoids HTML 500 noise and JSON parse errors there).
 *
 * Server `auth()` passes the session into SessionProvider when the cookie is present
 * so OAuth return navigations show as signed-in immediately.
 */
export default async function WithSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <Providers session={session ?? undefined}>{children}</Providers>
  );
}
