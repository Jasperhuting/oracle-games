// browser-helper.ts
import type { Viewport } from "puppeteer-core";

/**
 * Launch a Puppeteer browser instance optimized for Vercel/serverless environments
 * Uses @sparticuz/chromium in production and regular puppeteer locally
 */
export async function launchBrowser() {
  const isProduction =
    process.env.NODE_ENV === "production" || !!process.env.VERCEL;

  const viewport: Viewport = {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  };

  if (isProduction) {
    const puppeteer = await import("puppeteer-core");
    const chromium = (await import("@sparticuz/chromium-min")).default;

    // Set font config to prevent font-related issues
    chromium.setGraphicsMode = false;

    // Fetch Chromium binary from GitHub CDN (required for Vercel)
    // Vercel runs on x64 architecture
    const executablePath = await chromium.executablePath(
      `https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar`
    );

    return puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: viewport,
      executablePath,
      headless: true,
    });
  }

  // Local development: use full puppeteer (bundles Chromium)
  const puppeteer = await import("puppeteer");

  return puppeteer.launch({
    headless: true,
    defaultViewport: viewport,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}