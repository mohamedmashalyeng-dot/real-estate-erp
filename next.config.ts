import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the database driver out of the server bundle.
  serverExternalPackages: ["mariadb"],
  typedRoutes: false,
  // Shared hosting (Hostinger) reports many CPUs but caps memory and process
  // counts: one build worker keeps `next build` inside those limits.
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
