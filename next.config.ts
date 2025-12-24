import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mark puppeteer as external for server components
  // This works for both Webpack and Turbopack
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    "puppeteer-core", "@sparticuz/chromium"
  ],
  outputFileTracingIncludes: {
    "/app/api/**": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
