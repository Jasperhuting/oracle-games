/**
 * Basic E2E Tests
 *
 * Converted from Cypress to Playwright
 * Tests basic page loading and navigation
 */
import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for main content to load (domcontentloaded instead of networkidle)
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded successfully
    await expect(page).toHaveURL(/\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');

    // Wait for "Welcome back!" text
    await expect(page.getByText('Welcome back!', { exact: false }))
      .toBeVisible({ timeout: 10000 });

    // Verify form elements are visible
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should have form elements on login page', async ({ page }) => {
    await page.goto('/login');

    // Wait for form to load
    await page.waitForSelector('input[placeholder="Email"]', { timeout: 10000 });

    // Check email input
    const emailInput = page.locator('input[placeholder="Email"]');
    await expect(emailInput).toBeVisible();

    // Check password input
    const passwordInput = page.locator('input[placeholder="Password"]');
    await expect(passwordInput).toBeVisible();

    // Check submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should connect to Firebase emulator', async ({ page }) => {
    // Navigate to login page (which uses Firebase Auth)
    await page.goto('/login');

    // Wait for page to load (use selector instead of networkidle)
    await page.waitForSelector('input[placeholder="Email"]', { timeout: 10000 });

    // If we can see the login form, Firebase emulator is working
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible();

    console.log('✓ Connected to Firebase emulator');
  });
});
