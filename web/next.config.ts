import type { NextConfig } from "next";

// cacheComponents is off: every page and route here reads live chain state per request, so the routes declare
// `dynamic = "force-dynamic"` and run on the Node runtime.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
