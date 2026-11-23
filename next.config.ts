import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ],
    }];
  },
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
