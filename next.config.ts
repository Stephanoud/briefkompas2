import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/extract-decision-meta": ["node_modules/pdf-parse/**/*"],
  },
};

export default nextConfig;
