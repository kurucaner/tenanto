import type { NextConfig } from "next";

import packageJson from "./package.json";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shared"],
  output: "standalone",
  htmlLimitedBots: /.*/,
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
