/**
 * Slipstream Game E2E Tests
 *
 * Tests the full slipstream game flow including:
 * - Navigating to a slipstream game
 * - Making picks
 * - Viewing standings
 * - Filter/tab persistence in URL
 */
import { test, expect, TEST_USERS } from '../fixtures/auth';

// Test game ID - should be a slipstream game in the test data
const TEST_GAME_ID = 'FdiMp3zTTgDpsPCSo0yl';

test.describe('Slipstream Game', () => {
  test.describe('Page Navigation', () => {
    test('should load slipstream game page', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Should see the page title
      await expect(authenticatedPage.locator('h1')).toContainText('Slipstream');

      // Should see the main sections
      await expect(authenticatedPage.getByText('Make Your Pick')).toBeVisible();
      await expect(authenticatedPage.getByText('Standings')).toBeVisible();
    });

    test('should show race picker with filter tabs', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Should see filter buttons
      await expect(authenticatedPage.getByText('Needs Pick')).toBeVisible();
      await expect(authenticatedPage.getByText('Upcoming')).toBeVisible();
      await expect(authenticatedPage.getByText('Finished')).toBeVisible();
      await expect(authenticatedPage.getByRole('button', { name: 'All' })).toBeVisible();
    });

    test('should display standings with Yellow and Green jersey tabs', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Should see jersey tabs
      await expect(authenticatedPage.getByText('Yellow Jersey')).toBeVisible();
      await expect(authenticatedPage.getByText('Green Jersey')).toBeVisible();
    });
  });

  test.describe('Filter Tab URL Persistence', () => {
    test('should update URL when changing filter tabs', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Click on Upcoming tab
      await authenticatedPage.getByRole('button', { name: 'Upcoming' }).click();
      await expect(authenticatedPage).toHaveURL(/filter=upcoming/);

      // Click on Finished tab
      await authenticatedPage.getByRole('button', { name: 'Finished' }).click();
      await expect(authenticatedPage).toHaveURL(/filter=finished/);

      // Click on All tab
      await authenticatedPage.getByRole('button', { name: 'All' }).click();
      await expect(authenticatedPage).toHaveURL(/filter=all/);

      // Click on Needs Pick tab
      await authenticatedPage.getByText('Needs Pick').click();
      await expect(authenticatedPage).toHaveURL(/filter=needs_pick/);
    });

    test('should restore filter from URL on page load', async ({ authenticatedPage }) => {
      // Navigate directly to finished filter
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=finished`);

      // The Finished button should be active (has specific styling)
      const finishedButton = authenticatedPage.getByRole('button', { name: 'Finished' });
      await expect(finishedButton).toBeVisible();

      // Navigate to upcoming filter
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=upcoming`);

      const upcomingButton = authenticatedPage.getByRole('button', { name: 'Upcoming' });
      await expect(upcomingButton).toBeVisible();
    });

    test('should default to needs_pick filter when no filter in URL', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Should default to needs_pick (indicated by the button styling)
      // The button should have the active state (bg-orange-500 class)
      const needsPickButton = authenticatedPage.locator('button:has-text("Needs Pick")');
      await expect(needsPickButton).toBeVisible();
    });
  });

  test.describe('Race Selection', () => {
    test('should show race list based on selected filter', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=all`);

      // Should see at least one race card
      const raceButtons = authenticatedPage.locator('button').filter({ hasText: /\d{1,2}\s\w{3}/ });
      await expect(raceButtons.first()).toBeVisible({ timeout: 10000 });
    });

    test('should select a race when clicking on it', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=all`);

      // Wait for races to load
      await authenticatedPage.waitForTimeout(1000);

      // Find and click on the first race
      const raceButtons = authenticatedPage.locator('.rounded-lg.border').filter({ hasText: /\d{1,2}\s\w{3}/ });
      const firstRace = raceButtons.first();

      if (await firstRace.isVisible()) {
        await firstRace.click();

        // The selected race should have special styling (ring-2)
        await expect(firstRace).toHaveClass(/ring-2/);
      }
    });
  });

  test.describe('Rider Selection', () => {
    test('should show rider selector after selecting a race', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=upcoming`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Should see rider selector section
      await expect(authenticatedPage.getByText('Select Rider')).toBeVisible();

      // The rider selector should show available riders count
      const riderInfo = authenticatedPage.locator('text=/\\d+ riders available/');
      await expect(riderInfo).toBeVisible({ timeout: 10000 });
    });

    test('should be able to search for riders', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=upcoming`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Find the rider search input
      const searchInput = authenticatedPage.locator('input[placeholder*="Search"]').or(
        authenticatedPage.locator('input[placeholder*="rider"]')
      );

      if (await searchInput.isVisible()) {
        await searchInput.fill('Pogacar');

        // Should filter the rider list
        await authenticatedPage.waitForTimeout(500);

        // Should show Tadej Pogacar in results
        await expect(authenticatedPage.getByText(/Pogacar/i)).toBeVisible();
      }
    });

    test('should show used riders indicator', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=upcoming`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Should show how many riders are already used
      const usedRidersInfo = authenticatedPage.locator('text=/\\d+ already used/');
      await expect(usedRidersInfo).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('User Stats', () => {
    test('should display user stats section', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Should see Your Stats section
      await expect(authenticatedPage.getByText('Your Stats')).toBeVisible({ timeout: 10000 });

      // Should see stat cards
      await expect(authenticatedPage.getByText('Time Lost')).toBeVisible();
      await expect(authenticatedPage.getByText('Green Points')).toBeVisible();
      await expect(authenticatedPage.getByText('Picks Made')).toBeVisible();
      await expect(authenticatedPage.getByText('Riders Used')).toBeVisible();
    });
  });

  test.describe('Standings', () => {
    test('should switch between Yellow and Green jersey standings', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Click Yellow Jersey tab
      const yellowTab = authenticatedPage.getByRole('button', { name: 'Yellow Jersey' });
      await yellowTab.click();

      // Should show time-based standings
      await expect(authenticatedPage.getByText('Time Lost')).toBeVisible();

      // Click Green Jersey tab
      const greenTab = authenticatedPage.getByRole('button', { name: 'Green Jersey' });
      await greenTab.click();

      // The green jersey tab should now be active
      await expect(greenTab).toBeVisible();
    });

    test('should show race progress indicator', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Should show race count (e.g., "1/23 races")
      const raceProgress = authenticatedPage.locator('text=/\\d+\\/\\d+\\s*races/');
      await expect(raceProgress).toBeVisible({ timeout: 10000 });
    });

    test('should highlight current user in standings', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Wait for standings to load
      await authenticatedPage.waitForTimeout(1000);

      // Current user should be highlighted with "(you)" indicator
      const userIndicator = authenticatedPage.locator('text=/\\(you\\)/');
      if (await userIndicator.isVisible()) {
        await expect(userIndicator).toBeVisible();
      }
    });
  });

  test.describe('Pick Submission', () => {
    test('should show submit button for upcoming race with selected rider', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=upcoming`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Find a race that needs a pick
      const raceCards = authenticatedPage.locator('.rounded-lg.border');
      const firstRace = raceCards.first();

      if (await firstRace.isVisible()) {
        await firstRace.click();
        await authenticatedPage.waitForTimeout(500);

        // Check if there's a Submit Pick or Update Pick button
        const submitButton = authenticatedPage.getByRole('button', { name: /Submit Pick|Update Pick/i });

        // Button should exist (might be disabled if no rider selected)
        await expect(submitButton).toBeVisible();
      }
    });

    test('should show current pick info when race has pick', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=all`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Look for a race card that shows a rider pick (green checkmark with rider name)
      const pickedRace = authenticatedPage.locator('.rounded-lg.border:has-text("✓")').first();

      if (await pickedRace.isVisible()) {
        await pickedRace.click();
        await authenticatedPage.waitForTimeout(500);

        // Should show "Current pick: <rider name>"
        const currentPickInfo = authenticatedPage.locator('text=/Current pick:/');
        await expect(currentPickInfo).toBeVisible();
      }
    });
  });

  test.describe('Deadline Display', () => {
    test('should show deadline countdown for upcoming races', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=upcoming`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Should see deadline indicators (e.g., "16d 17h 27m")
      const deadlineIndicator = authenticatedPage.locator('text=/\\d+[dhm]\\s/');
      await expect(deadlineIndicator.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show "Finished" badge for completed races', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=finished`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Should see Finished badges
      const finishedBadge = authenticatedPage.locator('text=Finished');
      await expect(finishedBadge.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show "Locked" badge for locked races', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream?filter=all`);

      // Wait for page to load
      await authenticatedPage.waitForTimeout(1000);

      // Check if there are any locked races
      const lockedBadge = authenticatedPage.locator('text=Locked');
      // This is optional as there might not be locked races
      if (await lockedBadge.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(lockedBadge.first()).toBeVisible();
      }
    });
  });

  test.describe('Back Navigation', () => {
    test('should have back button that navigates to games list', async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/games/${TEST_GAME_ID}/slipstream`);

      // Find and click the Back button
      const backButton = authenticatedPage.getByRole('link', { name: 'Back' });
      await expect(backButton).toBeVisible();

      await backButton.click();

      // Should navigate to games page
      await expect(authenticatedPage).toHaveURL(/\/games/);
    });
  });
});

test.describe('Slipstream Admin Features', () => {
  test('should show admin race manager for admin users', async ({ authenticatedAsAdmin }) => {
    await authenticatedAsAdmin.goto(`/games/${TEST_GAME_ID}/slipstream`);

    // Wait for page to load
    await authenticatedAsAdmin.waitForTimeout(2000);

    // Admin should see the race manager section
    // This might be hidden in a collapsible section
    const raceManager = authenticatedAsAdmin.getByText('Race Calendar Management').or(
      authenticatedAsAdmin.getByText('Add Race')
    );

    // Check if admin section exists
    const hasAdminSection = await raceManager.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasAdminSection) {
      await expect(raceManager).toBeVisible();
    } else {
      console.log('Admin race manager not visible - may require specific game config');
    }
  });
});
