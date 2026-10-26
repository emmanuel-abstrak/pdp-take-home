import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/articles", permanent: false }];
  },
  async rewrites() {
    return {
      fallback: [{ source: "/:path*", destination: "/legacy/:path*" }],
    };
  },
};

export default nextConfig;
