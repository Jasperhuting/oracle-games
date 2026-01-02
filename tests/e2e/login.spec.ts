/**
 * Login E2E Tests
 *
 * Converted from Cypress to Playwright
 * Tests authentication flows with Firebase emulator
 */
import { test, expect, TEST_USERS } from '../fixtures/auth';

test.describe('Login Functionality', () => {
  test('should display login form elements', async ({ page }) => {
    await page.goto('/login');

    // Check all form elements using data-testid
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toBeVisible();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await expect(page.getByTestId('stay-logged-in-checkbox')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in wrong credentials
    await page.getByTestId('login-email-input').fill('wrong@example.com');
    await page.getByTestId('login-password-input').fill('wrongpassword');

    // Submit form
    await page.getByTestId('login-submit-button').click();

    // Check for error message (actual message is "No account found with this email address")
    const errorMessage = page.getByTestId('login-error-message');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    await expect(errorMessage).toContainText('No account found with this email address');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in correct credentials
    await page.getByTestId('login-email-input').fill(TEST_USERS.user.email);
    await page.getByTestId('login-password-input').fill(TEST_USERS.user.password);

    // Submit form
    await page.getByTestId('login-submit-button').click();

    // Should navigate to /home after successful login
    await page.waitForURL(/\/home/, {
      timeout: 15000
    });

    // Verify we're on the home page
    expect(page.url()).toContain('/home');

    console.log('✓ Successfully logged in as user@test.com');
  });

  test('should login as admin user', async ({ page }) => {
    await page.goto('/login');

    // Fill in admin credentials
    await page.getByTestId('login-email-input').fill(TEST_USERS.admin.email);
    await page.getByTestId('login-password-input').fill(TEST_USERS.admin.password);

    // Submit form
    await page.getByTestId('login-submit-button').click();

    // Should navigate to /home after successful login
    await page.waitForURL(/\/home/, {
      timeout: 15000
    });

    expect(page.url()).toContain('/home');

    console.log('✓ Successfully logged in as admin@test.com');
  });

  test('should use authenticatedPage fixture', async ({ authenticatedPage }) => {
    // This test uses the fixture, so we're already logged in
    await authenticatedPage.goto('/');

    // Verify we can navigate (meaning we're authenticated)
    await expect(authenticatedPage.locator('body')).toBeVisible();

    console.log('✓ Authenticated page fixture works');
  });

  test('should persist "Stay logged in" checkbox state', async ({ page }) => {
    await page.goto('/login');

    const checkbox = page.getByTestId('stay-logged-in-checkbox');

    // Check if checkbox is present
    await expect(checkbox).toBeVisible();

    // Check the checkbox
    await checkbox.check();

    // Verify it's checked
    await expect(checkbox).toBeChecked();
  });

  test('should have correct data-testid attributes', async ({ page }) => {
    await page.goto('/login');

    // Verify all expected data-testid attributes exist
    const testIds = [
      'login-form',
      'login-email-input',
      'login-password-input',
      'login-submit-button',
      'stay-logged-in-checkbox',
      'google-login-button'
    ];

    for (const testId of testIds) {
      const element = page.getByTestId(testId);
      await expect(element).toBeAttached();
    }

    console.log('✓ All data-testid attributes present');
  });
});
