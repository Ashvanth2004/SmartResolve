import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gzip/brotli compression for all responses
  compress: true,
  // no X-Powered-By header (smaller headers, better hygiene)
  poweredByHeader: false,
  reactStrictMode: true,
  // tree-shake icon imports so only used icons ship to devices
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
