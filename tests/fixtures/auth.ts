/**
 * Playwright Test Fixtures for Authentication
 *
 * These fixtures provide authenticated page contexts for tests.
 * Based on the Cypress custom commands we had before.
 */
import { test as base, expect } from '@playwright/test';

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
  authenticatedPage: async ({ page }: any, use: any) => {
    await loginAs(page, TEST_USERS.user);
    await use(page);
  },

  // Authenticated as user2@test.com
  authenticatedAsUser2: async ({ page }: any, use: any) => {
    await loginAs(page, TEST_USERS.user2);
    await use(page);
  },

  // Authenticated as admin@test.com
  authenticatedAsAdmin: async ({ page }: any, use: any) => {
    await loginAs(page, TEST_USERS.admin);
    await use(page);
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
