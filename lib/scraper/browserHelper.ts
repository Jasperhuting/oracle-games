/**
 * Launch a Puppeteer browser instance optimized for Vercel/serverless environments
 * Uses @sparticuz/chromium in production and regular puppeteer locally
 */
export async function launchBrowser() {
  // Check if we're in a production/Vercel environment
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

  if (isProduction) {
    // Use puppeteer-core with @sparticuz/chromium for Vercel
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');
    
    // Set the path to the brotli files
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;
    
    return await puppeteer.default.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
  } else {
    // Use regular puppeteer locally for development
    const puppeteer = await import('puppeteer');

    return await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }
}
