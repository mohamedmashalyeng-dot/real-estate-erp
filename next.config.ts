import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the database driver out of the server bundle.
  serverExternalPackages: ["mariadb"],
  typedRoutes: false,
};

export default nextConfig;
