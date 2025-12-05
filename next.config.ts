import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mark puppeteer as external for server components
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
  ],
  webpack: (config, { isServer }) => {
    // Exclude puppeteer from client-side bundles
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'puppeteer': false,
        'puppeteer-core': false,
        'puppeteer-extra': false,
        'puppeteer-extra-plugin-stealth': false,
      };
    }
    return config;
  },
};

export default nextConfig;
