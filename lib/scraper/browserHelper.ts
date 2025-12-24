/**
 * Launch a Puppeteer browser instance optimized for Vercel/serverless environments
 * Uses @sparticuz/chromium-min in production and regular puppeteer locally
 */
export async function launchBrowser() {
  // Check if we're in a production/Vercel environment
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

  if (isProduction) {
    try {
      // Use puppeteer-core with @sparticuz/chromium for Vercel
      const puppeteer = await import('puppeteer-core');
      const chromium = (await import('@sparticuz/chromium-min')).default;
      
      // Define browser arguments
      const browserArgs = [
        '--hide-scrollbars',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--no-first-run',
        '--disable-accelerated-2d-canvas',
        '--disable-features=site-per-process'
      ];

      // Get the executable path
      const executablePath = process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath();
      
      return await puppeteer.launch({
        args: browserArgs,
        defaultViewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        },
        executablePath,
        headless: true,
      });
    } catch (error) {
      console.error('Error launching browser in production:', error);
      throw error;
    }
  } else {
    // Use regular puppeteer locally for development
    const puppeteer = await import('puppeteer');

    return await puppeteer.launch({
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