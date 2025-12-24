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
    const chromium = (await import("@sparticuz/chromium")).default;

    // Set font config to prevent font-related issues
    chromium.setGraphicsMode = false;

    return puppeteer.launch({
      args: [...chromium.args, '--disable-gpu', '--single-process'],
      executablePath:
        process.env.CHROME_EXECUTABLE_PATH ?? (await chromium.executablePath("/tmp")),
      headless: true, // <- set explicitly (TS-safe)
      defaultViewport: viewport,
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