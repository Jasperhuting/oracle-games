/**
 * Playwright Test Fixtures for Authentication
 *
 * These fixtures provide authenticated page contexts for tests.
 * Based on the Cypress custom commands we had before.
 */
import { test as base, expect, Browser, StorageState } from '@playwright/test';

// Test users (matching auth_export/accounts.json)
export const TEST_USERS = {
  user: {
    email: 'user@test.com',
    password: 'user123',
    uid: 'Y7MFuREIU16WK8XYvLXFVbbs4NoB'
  },
  user2: {
    email: 'user2@test.com',
    password: 'user123',
    uid: 'HZxMI3NzAUk98k84F3uQht7qJZP2'
  },
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    uid: 'Xt3G7IfyjOOkFDC3LCBCjF5HXKnv'
  }
};

type AuthFixtures = {
  authenticatedPage: any;
  authenticatedAsUser2: any;
  authenticatedAsAdmin: any;
};

let userStorageState: StorageState | null = null;
let user2StorageState: StorageState | null = null;
let adminStorageState: StorageState | null = null;

async function getAuthenticatedStorageState(
  browser: Browser,
  user: { email: string; password: string },
  cachedState: StorageState | null
): Promise<StorageState> {
  if (cachedState) return cachedState;

  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user);
  const state = await context.storageState();
  await context.close();
  return state;
}

/**
 * Extended test with authentication fixtures
 *
 * Usage:
 * ```typescript
 * test('my test', async ({ authenticatedPage }) => {
 *   // Page is already logged in as user@test.com
 *   await authenticatedPage.goto('/games')
 * })
 * ```
 */
export const test = base.extend<AuthFixtures>({
  // Default authenticated page (user@test.com)
  authenticatedPage: async ({ browser }: any, use: any) => {
    userStorageState = await getAuthenticatedStorageState(browser, TEST_USERS.user, userStorageState);
    const context = await browser.newContext({ storageState: userStorageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Authenticated as user2@test.com
  authenticatedAsUser2: async ({ browser }: any, use: any) => {
    user2StorageState = await getAuthenticatedStorageState(browser, TEST_USERS.user2, user2StorageState);
    const context = await browser.newContext({ storageState: user2StorageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Authenticated as admin@test.com
  authenticatedAsAdmin: async ({ browser }: any, use: any) => {
    adminStorageState = await getAuthenticatedStorageState(browser, TEST_USERS.admin, adminStorageState);
    const context = await browser.newContext({ storageState: adminStorageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

/**
 * Helper function to login as a specific user
 */
async function loginAs(page: any, user: { email: string; password: string }) {
  await page.goto('/login');

  // Wait for login form to be visible
  await page.waitForSelector('[data-testid="login-email-input"]', {
    timeout: 10000
  });

  // Fill in credentials
  await page.getByTestId('login-email-input').fill(user.email);
  await page.getByTestId('login-password-input').fill(user.password);

  // Submit form
  await page.getByTestId('login-submit-button').click();

  // Wait for navigation to /home after successful login
  await page.waitForURL(/\/home/, {
    timeout: 15000
  });

  // Log successful login
  console.log(`✓ Logged in as ${user.email}`);
}

/**
 * Helper function to clear Firestore emulator data
 * Only works when connected to emulator!
 */
export async function clearFirestore() {
  const response = await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/oracle-games-b6af6/databases/(default)/documents',
    {
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    console.warn('Warning: Failed to clear Firestore emulator');
  } else {
    console.log('✓ Cleared Firestore emulator data');
  }
}

export { expect };
