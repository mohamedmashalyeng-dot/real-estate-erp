import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pg` is a native-ish module: keep it out of the bundler on the server.
  serverExternalPackages: ["pg"],
  typedRoutes: false,
};

export default nextConfig;
