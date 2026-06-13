import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@applyflow/ui", "@applyflow/shared"],
  async redirects() {
    return [
      // Redirect non-www to www (permanent 301)
      {
        source: "/:path*",
        has: [{ type: "host", value: "applyflow.in" }],
        destination: "https://www.applyflow.in/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "lh3.googleusercontent.com" },
      { hostname: "media.licdn.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
