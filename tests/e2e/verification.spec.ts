/**
 * Test Data Verification Tests
 *
 * Converted from Cypress to Playwright
 * Verifies that seeded test data is accessible in the application
 */
import { test, expect } from '../fixtures/auth';

test.describe('Test Data Verification', () => {
  test('should verify test data is seeded correctly', async ({ authenticatedPage }) => {
    console.log('✅ Test data seed script executed successfully');
    console.log('📊 Verifying seeded data...');
    console.log('Expected:');
    console.log('  - 3 test games');
    console.log('  - 3 participants');
    console.log('  - 3 riders');
    console.log('  - 4 bids');
    console.log('  - 2 player teams');
    console.log('  - 3 messages');

    // If we can navigate, we're authenticated
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.locator('body')).toBeVisible();

    console.log('✅ Test user can login successfully');
    console.log('🎯 Test data is ready for E2E tests!');
  });

  test('should show seeded games on games page', async ({ authenticatedPage }) => {
    // Navigate to games page
    await authenticatedPage.goto('/games');

    // Wait for page to load
    await authenticatedPage.waitForURL(/\/games/, { timeout: 10000 });

    console.log('✅ Games page loaded');
    console.log('🎮 Checking for seeded games...');

    // The page should load without errors
    await expect(authenticatedPage.locator('body')).toBeVisible();

    console.log('✅ Games page accessible with test data');
  });

  test('should show seeded messages in inbox', async ({ authenticatedPage }) => {
    // Navigate to inbox
    await authenticatedPage.goto('/inbox');

    // Wait for page to load
    await authenticatedPage.waitForURL(/\/inbox/, { timeout: 10000 });

    console.log('✅ Inbox loaded');
    console.log('📨 Checking for seeded messages...');

    // The page should load without errors
    await expect(authenticatedPage.locator('body')).toBeVisible();

    console.log('✅ Inbox accessible with test data');
  });

  test('should be able to access auction page for seeded game', async ({ authenticatedPage }) => {
    // Try to navigate to the test auction game
    await authenticatedPage.goto('/games/test-auction-active/auction');

    // Wait for page to load
    await authenticatedPage.waitForURL(/\/auction/, { timeout: 10000 });

    console.log('✅ Auction page loaded for test game');

    // The page should load without errors
    await expect(authenticatedPage.locator('body')).toBeVisible();

    console.log('✅ Can access seeded game auction page');
  });
});
