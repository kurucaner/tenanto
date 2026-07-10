import type { NextConfig } from "next";

import packageJson from "./package.json";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  htmlLimitedBots: /.*/,
  output: "standalone",
  reactStrictMode: true,
  redirects: async () => [
    { destination: "/platform", permanent: true, source: "/whitepaper" },
    { destination: "/privacy-policy", permanent: true, source: "/privacy" },
    { destination: "/terms-of-service", permanent: true, source: "/terms" },
  ],
  transpilePackages: ["@shared"],
};

export default nextConfig;
