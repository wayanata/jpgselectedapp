import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  // Let OpenNext’s esbuild pass resolve @prisma/client with the `workerd` condition.
  // Without this, webpack inlines the Node query-engine binary and Workers fail at runtime.
  // @see https://opennext.js.org/cloudflare/howtos/db
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "@prisma/adapter-neon",
  ],
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
      // Avoid multi‑MiB `.next/cache/webpack/**.pack` files; Workers Builds runs a
      // Pages-style asset check that rejects files > 25 MiB anywhere under output.
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
