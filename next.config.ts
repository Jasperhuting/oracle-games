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
    // Limit image sizes to reduce optimization costs
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
    // Cache optimized images for 60 days
    minimumCacheTTL: 60 * 60 * 24 * 60,
  },
};

export default nextConfig;
