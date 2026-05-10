import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
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
