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
    "@sparticuz/chromium-min"
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.procyclingstats.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.livescore.com',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;
