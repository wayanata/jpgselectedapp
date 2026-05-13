import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drive selections",
  description: "Pick photos from Google Drive for your photographer",
  /**
   * Favicon: `app/icon.svg`.
   * Apple touch: static `app/apple-icon.png` (required for OpenNext — never use edge `apple-icon.tsx`).
   * Safari also probes `public/apple-touch-icon.png` at the site root.
   */
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "Drive selections",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#faf6ef] text-stone-900 font-sans">
        {children}
      </body>
    </html>
  );
}
