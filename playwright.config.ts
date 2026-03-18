import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

// Use the npm binary that lives alongside the node that's running playwright.
// This avoids "npm: command not found" when running from a restricted shell
// (e.g. CI or Claude Code's Bash tool where /opt/homebrew/bin is not in PATH).
const npmBin = path.join(path.dirname(process.execPath), 'npm');

// Ensure node, npm, firebase CLI and Java are all in PATH for child processes.
// Turbopack spawns node workers for PostCSS; without node in PATH it panics.
const enrichedPath = [
  path.dirname(process.execPath),
  '/opt/homebrew/bin',
  '/opt/homebrew/opt/openjdk@21/bin',
  path.join(os.homedir(), '.npm-global/bin'),
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  process.env.PATH ?? '',
].join(':');

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
    command: `"${npmBin}" run dev:emulator:test`,
    url: 'http://localhost:3310',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    // Provide PATH so Turbopack can spawn node workers for PostCSS processing.
    env: { ...process.env, PATH: enrichedPath } as Record<string, string>,
  },
});
