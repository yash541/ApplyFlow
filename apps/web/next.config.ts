import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@applyflow/ui", "@applyflow/shared"],
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
