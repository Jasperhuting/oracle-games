import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Oracle Games E2E Tests
 *
 * Tests run against Firebase emulators on:
 * - Auth: http://127.0.0.1:9099
 * - Firestore: http://127.0.0.1:8080
 * - Next.js: http://localhost:3210
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Global setup/teardown: starts Firebase emulator + seeds test data
  globalSetup: './tests/globalSetup.ts',
  globalTeardown: './tests/globalTeardown.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL — port 3310 is the isolated test server (dev:emulator:test)
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3310',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot only on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 10000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Next.js dev server (emulator mode, port 3310) before tests.
  // reuseExistingServer: true → if test:e2e:full already started the server,
  // Playwright uses it instead of spawning a new one.
  webServer: {
    command: 'npm run dev:emulator:test',
    url: 'http://localhost:3310',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
