import { randomUUID } from "crypto";
import type { GoToOptions, Page, Viewport } from "puppeteer-core";
import { getServerFirebase } from "@/lib/firebase/server";

const DEFAULT_VIEWPORT: Viewport = {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const isProduction =
  process.env.NODE_ENV === "production" || !!process.env.VERCEL;

const SCRAPER_LOCK_COLLECTION = "runtimeLocks";
const LOCK_TTL_MS = parsePositiveInt(
  process.env.SCRAPER_BROWSER_LOCK_TTL_MS,
  2 * 60 * 1000
);
const LOCK_REFRESH_INTERVAL_MS = Math.max(
  10 * 1000,
  Math.min(30 * 1000, Math.floor(LOCK_TTL_MS / 3))
);
const LOCK_ACQUIRE_TIMEOUT_MS = parsePositiveInt(
  process.env.SCRAPER_BROWSER_ACQUIRE_TIMEOUT_MS,
  90 * 1000
);
const MAX_CONCURRENT_BROWSERS = parsePositiveInt(
  process.env.SCRAPER_MAX_CONCURRENT_BROWSERS,
  isProduction ? 2 : 4
);
const SHARED_BROWSER_IDLE_MS = parsePositiveInt(
  process.env.SCRAPER_BROWSER_IDLE_MS,
  30 * 1000
);
const NAVIGATION_TIMEOUT_MS = parsePositiveInt(
  process.env.SCRAPER_NAVIGATION_TIMEOUT_MS,
  45 * 1000
);
const WAIT_FOR_SELECTOR_TIMEOUT_MS = parsePositiveInt(
  process.env.SCRAPER_SELECTOR_TIMEOUT_MS,
  20 * 1000
);

let executablePathPromise: Promise<string> | null = null;
type BrowserLike = {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
  disconnect: () => Promise<void>;
  on: (event: "disconnected", listener: () => void) => unknown;
  connected: boolean;
};

let sharedBrowserPromise: Promise<BrowserLike> | null = null;
let sharedBrowserInstance: BrowserLike | null = null;
let sharedBrowserUsers = 0;
let idleCloseTimer: NodeJS.Timeout | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ScrapeLease = {
  token: string;
  slotId: string;
  release: () => Promise<void>;
};

function startLeaseHeartbeat(params: {
  ref: FirebaseFirestore.DocumentReference;
  token: string;
}) {
  const db = getServerFirebase();
  const timer = setInterval(() => {
    void db.runTransaction(async (transaction) => {
      const snap = await transaction.get(params.ref);
      const data = snap.data() as { token?: string } | undefined;

      if (!snap.exists || data?.token !== params.token) {
        return;
      }

      transaction.set(
        params.ref,
        {
          expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
          lastRefreshedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }).catch((error) => {
      console.warn("[scraper] Failed to refresh scraper lease heartbeat:", error);
    });
  }, LOCK_REFRESH_INTERVAL_MS);

  timer.unref?.();
  return () => clearInterval(timer);
}

async function acquireScrapeLease(): Promise<ScrapeLease> {
  const db = getServerFirebase();
  const token = randomUUID();
  const startedAt = Date.now();

  while (Date.now() - startedAt < LOCK_ACQUIRE_TIMEOUT_MS) {
    for (let i = 0; i < MAX_CONCURRENT_BROWSERS; i++) {
      const slotId = `scraper-browser-slot-${i}`;
      const ref = db.collection(SCRAPER_LOCK_COLLECTION).doc(slotId);
      const acquired = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.data() as
          | {
              token?: string;
              expiresAt?: string;
            }
          | undefined;

        const expiresAt = data?.expiresAt ? Date.parse(data.expiresAt) : NaN;
        const isExpired = !Number.isFinite(expiresAt) || expiresAt <= Date.now();

        if (snap.exists && data?.token && !isExpired) {
          return false;
        }

        transaction.set(
          ref,
          {
            token,
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
          },
          { merge: true }
        );
        return true;
      });

      if (acquired) {
        const stopHeartbeat = startLeaseHeartbeat({ ref, token });

        return {
          token,
          slotId,
          release: async () => {
            stopHeartbeat();
            await db.runTransaction(async (transaction) => {
              const snap = await transaction.get(ref);
              const data = snap.data() as { token?: string } | undefined;
              if (!snap.exists || data?.token !== token) {
                return;
              }
              transaction.delete(ref);
            });
          },
        };
      }
    }

    await delay(500);
  }

  throw new Error(
    `Timed out waiting for scraper capacity after ${LOCK_ACQUIRE_TIMEOUT_MS}ms`
  );
}

async function resolveExecutablePath(): Promise<string | undefined> {
  if (!isProduction) {
    return undefined;
  }

  if (!executablePathPromise) {
    executablePathPromise = (async () => {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      chromium.setGraphicsMode = false;
      return chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar"
      );
    })();
  }

  return executablePathPromise;
}

async function createBrowser(): Promise<BrowserLike> {
  if (isProduction) {
    const puppeteer = await import("puppeteer-core");
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const executablePath = await resolveExecutablePath();

    return puppeteer.launch({
      args: [
        ...chromium.args,
        "--hide-scrollbars",
        "--disable-web-security",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-renderer-backgrounding",
        // Prevent Chromium from exposing automation indicators at the browser level
        "--disable-blink-features=AutomationControlled",
      ],
      defaultViewport: DEFAULT_VIEWPORT,
      executablePath,
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    defaultViewport: DEFAULT_VIEWPORT,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
    ],
  });
}

async function closeSharedBrowser() {
  if (idleCloseTimer) {
    clearTimeout(idleCloseTimer);
    idleCloseTimer = null;
  }

  const browser = sharedBrowserInstance;
  sharedBrowserInstance = null;
  sharedBrowserPromise = null;

  if (!browser) {
    return;
  }

  try {
    if (browser.connected) {
      await browser.close();
    }
  } catch (error) {
    console.warn("[scraper] Failed to close shared browser cleanly:", error);
  }
}

function scheduleIdleBrowserClose() {
  if (idleCloseTimer) {
    clearTimeout(idleCloseTimer);
  }

  idleCloseTimer = setTimeout(() => {
    if (sharedBrowserUsers === 0) {
      void closeSharedBrowser();
    }
  }, SHARED_BROWSER_IDLE_MS);
}

async function getSharedBrowser(): Promise<BrowserLike> {
  if (sharedBrowserInstance?.connected) {
    return sharedBrowserInstance;
  }

  if (!sharedBrowserPromise) {
    sharedBrowserPromise = createBrowser()
      .then((browser) => {
        sharedBrowserInstance = browser;
        browser.on("disconnected", () => {
          sharedBrowserInstance = null;
          sharedBrowserPromise = null;
        });
        return browser;
      })
      .catch((error) => {
        sharedBrowserPromise = null;
        sharedBrowserInstance = null;
        throw error;
      });
  }

  return sharedBrowserPromise;
}

async function releaseBrowserLease(
  lease: ScrapeLease,
  forceClose = false
): Promise<void> {
  sharedBrowserUsers = Math.max(0, sharedBrowserUsers - 1);
  await lease.release();

  if (forceClose) {
    await closeSharedBrowser();
    return;
  }

  if (sharedBrowserUsers === 0) {
    scheduleIdleBrowserClose();
  }
}

export async function launchBrowser(): Promise<BrowserLike> {
  const lease = await acquireScrapeLease();
  let browser: BrowserLike | null = null;
  let released = false;

  try {
    if (idleCloseTimer) {
      clearTimeout(idleCloseTimer);
      idleCloseTimer = null;
    }

    browser = await getSharedBrowser();
    sharedBrowserUsers += 1;
  } catch (error) {
    await lease.release();
    throw error;
  }

  const release = async (forceClose = false) => {
    if (released) return;
    released = true;
    await releaseBrowserLease(lease, forceClose);
  };

  return new Proxy(browser, {
    get(target, prop, receiver) {
      if (prop === "close") {
        return async () => release(false);
      }

      if (prop === "disconnect") {
        return async () => release(true);
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function configurePage(page: Page) {
  await page.setViewport(DEFAULT_VIEWPORT);
  await page.setUserAgent(USER_AGENT);
  await page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  await page.setDefaultTimeout(WAIT_FOR_SELECTOR_TIMEOUT_MS);

  // Mask headless browser fingerprinting so Cloudflare treats us as a real browser
  await page.evaluateOnNewDocument(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Spoof plugins (real browsers have plugins)
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ],
    });

    // Spoof languages
    Object.defineProperty(navigator, 'languages', { get: () => ['nl-NL', 'nl', 'en-US', 'en'] });

    // Spoof chrome runtime so sites don't detect missing chrome object
    if (!(window as any).chrome) {
      (window as any).chrome = { runtime: {} };
    }
  });

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (["image", "font", "media"].includes(resourceType)) {
      void request.abort();
      return;
    }
    void request.continue();
  });
}

function isTransientScrapeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return [
    "Navigating frame was detached",
    "Navigation timeout",
    "ERR_INSUFFICIENT_RESOURCES",
    "spawn ETXTBSY",
    "Target closed",
    "Session closed",
    "Protocol error",
    "Timed out waiting for scraper capacity",
  ].some((needle) => message.includes(needle));
}

async function waitForAnySelector(page: Page, selectors: string[]) {
  const pendingSelectors = selectors.filter(Boolean);
  if (pendingSelectors.length === 0) {
    return;
  }

  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < WAIT_FOR_SELECTOR_TIMEOUT_MS) {
    for (const selector of pendingSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`None of the selectors became available: ${pendingSelectors.join(", ")}`);
}

export async function fetchPageHtml(options: {
  url: string;
  selectors: string[];
  noDataTexts?: string[];
  noDataErrorMessage?: string;
  navigationOptions?: GoToOptions;
  logLabel?: string;
  maxAttempts?: number;
}): Promise<string> {
  const {
    url,
    selectors,
    noDataTexts = [],
    noDataErrorMessage,
    navigationOptions,
    logLabel = "scraper",
    maxAttempts = 2,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const browser = await launchBrowser();
    let page: Page | null = null;
    let browserReleased = false;

    try {
      page = await browser.newPage();
      await configurePage(page);

      console.log(`[${logLabel}] Navigating to: ${url} (attempt ${attempt}/${maxAttempts})`);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS,
        ...navigationOptions,
      });

      await waitForAnySelector(page, selectors);
      // Give JS-based challenges (e.g. Cloudflare) time to complete and redirect
      await delay(1500);

      let html = await page.content();
      let bodyText = html.toLowerCase();

      // If Cloudflare challenge is still present, wait up to 4 more seconds for
      // the JS challenge to resolve and the browser to redirect to the real page.
      if (bodyText.includes("just a moment") || bodyText.includes("checking your browser")) {
        await delay(4000);
        html = await page.content();
        bodyText = html.toLowerCase();

        // Still on challenge page after extra wait — treat as availability error
        if (bodyText.includes("just a moment") || bodyText.includes("checking your browser")) {
          throw new Error(
            options.noDataErrorMessage
              ? `${options.noDataErrorMessage} (Cloudflare challenge not resolved)`
              : "Cloudflare challenge not resolved — page not available"
          );
        }
      }

      const matchedNoData = noDataTexts.find((text) =>
        bodyText.includes(text.toLowerCase())
      );

      if (matchedNoData) {
        throw new Error(noDataErrorMessage || matchedNoData);
      }

      return html;
    } catch (error) {
      lastError = error;
      if (page) {
        try {
          await page.close();
        } catch {
          await browser.disconnect();
        }
      }

      await browser.close();
      browserReleased = true;
      if (!isTransientScrapeError(error) || attempt >= maxAttempts) {
        throw error;
      }

      await delay(attempt * 750);
      continue;
    } finally {
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch {
          await browser.disconnect();
          browserReleased = true;
        }
      }

      if (!browserReleased) {
        try {
          await browser.close();
        } catch {
          await browser.disconnect();
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown scrape error");
}

export function classifyScrapeError(error: unknown): {
  message: string;
  category:
    | "resource"
    | "navigation"
    | "timeout"
    | "availability"
    | "validation"
    | "unknown";
  retryable: boolean;
} {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");

  if (message.includes("ERR_INSUFFICIENT_RESOURCES") || message.includes("ETXTBSY")) {
    return { message, category: "resource", retryable: true };
  }

  if (message.includes("Navigating frame was detached")) {
    return { message, category: "navigation", retryable: true };
  }

  if (message.includes("Navigation timeout") || message.includes("timed out")) {
    return { message, category: "timeout", retryable: true };
  }

  if (
    message.includes("No stage results available") ||
    message.includes("No race result available") ||
    message.includes("No startlist available") ||
    message.includes("No tour GC available") ||
    message.includes("No results available") ||
    message.includes("No GC results available") ||
    message.includes("Not started")
  ) {
    return { message, category: "availability", retryable: false };
  }

  if (message.includes("Validation failed")) {
    return { message, category: "validation", retryable: false };
  }

  return { message, category: "unknown", retryable: isTransientScrapeError(error) };
}
