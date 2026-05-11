import { Providers } from "@/components/Providers";

/**
 * NextAuth SessionProvider only under this group so public pages (/pick, /p)
 * never call /api/auth/session (avoids HTML 500 noise and JSON parse errors there).
 */
export default function WithSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
