import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // SQLite writes to prisma/dev.db must not trigger dev-server recompiles mid-request.
  webpack(config, { dev }) {
    if (dev) config.watchOptions = { ...config.watchOptions, ignored: ["**/node_modules/**", "**/.git/**", "**/prisma/*.db*"] };
    return config;
  },
};

export default nextConfig;
