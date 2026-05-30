import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow remote thumbnails from TeraBox CDNs (best-effort wildcard)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.terabox.com" },
      { protocol: "https", hostname: "**.1024tera.com" },
      { protocol: "https", hostname: "**.4funbox.com" },
      { protocol: "https", hostname: "**.mirrobox.com" },
      { protocol: "https", hostname: "data.1024tera.com" },
    ],
  },
  // Stream extraction is server-only; mark heavy native deps external if needed
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
