# Playwright Migration Guide

## Why Migrate to Playwright?

Cypress heeft compatibility issues met macOS 15.6.1 (Sequoia). Playwright is een modern alternatief met:

✅ Native support voor macOS 15
✅ Betere performance
✅ Built-in test runner UI
✅ Multiple browser testing (Chromium, Firefox, WebKit)
✅ Better debugging tools
✅ Parallel test execution
✅ Native TypeScript support

## Migration Steps

### 1. Install Playwright

```bash
# Uninstall Cypress
npm uninstall cypress @cypress/code-coverage @cypress/webpack-preprocessor

# Install Playwright
npm install --save-dev @playwright/test
npx playwright install
```

### 2. Create Playwright Config

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3210',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:emulator',
    url: 'http://localhost:3210',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. Convert Test Files

#### Before (Cypress):
```typescript
describe('Login', () => {
  it('should login successfully', () => {
    cy.visit('/login')
    cy.get('[data-testid="login-email-input"]').type('user@test.com')
    cy.get('[data-testid="login-password-input"]').type('user123')
    cy.get('[data-testid="login-submit-button"]').click()
    cy.url().should('not.include', '/login')
  })
})
```

#### After (Playwright):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email-input').fill('user@test.com')
    await page.getByTestId('login-password-input').fill('user123')
    await page.getByTestId('login-submit-button').click()
    await expect(page).not.toHaveURL(/.*login/)
  })
})
```

### 4. Convert Custom Commands to Fixtures

#### Before (Cypress commands):
```typescript
Cypress.Commands.add('loginOrSignup', (email, password) => {
  // login logic
})
```

#### After (Playwright fixtures):
```typescript
// tests/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill('user@test.com');
    await page.getByTestId('login-password-input').fill('user123');
    await page.getByTestId('login-submit-button').click();
    await page.waitForURL(/^(?!.*login)/);
    await use(page);
  },
});
```

### 5. Update NPM Scripts

Update `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

### 6. Update GitHub Actions

Update `.github/workflows/e2e-tests.yml`:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

## Conversion Map

| Cypress | Playwright |
|---------|-----------|
| `cy.visit()` | `page.goto()` |
| `cy.get()` | `page.locator()` |
| `cy.get('[data-testid="x"]')` | `page.getByTestId('x')` |
| `cy.contains()` | `page.getByText()` |
| `.click()` | `.click()` |
| `.type()` | `.fill()` |
| `.should('be.visible')` | `await expect().toBeVisible()` |
| `.should('contain')` | `await expect().toContainText()` |
| `cy.url().should()` | `await expect(page).toHaveURL()` |
| `cy.wait(ms)` | `await page.waitForTimeout(ms)` |
| `cy.intercept()` | `await page.route()` |

## Benefits

### Better Test Reports
Playwright generates beautiful HTML reports with screenshots and traces.

### Better Debugging
- `npx playwright test --debug` - Step through tests
- `npx playwright test --ui` - Interactive UI mode
- Trace viewer for failed tests

### Faster Execution
- Parallel test execution by default
- Faster browser automation
- Better resource management

### Cross-Browser Testing
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

## Estimated Migration Time

- ✅ Setup: 30 minutes
- ✅ Convert 15 existing tests: 2-3 hours
- ✅ Update CI/CD: 30 minutes
- ✅ Testing & validation: 1 hour

**Total: ~4-5 hours**

## Test Data

The existing seed script (`scripts/seed-test-data.ts`) works perfectly with Playwright - no changes needed!

## Next Steps

1. Install Playwright
2. Create config file
3. Convert 1-2 test files as proof of concept
4. Validate in CI/CD
5. Complete migration
6. Archive Cypress files

## Files to Migrate

- `cypress/e2e/basic.cy.ts` → `tests/e2e/basic.spec.ts`
- `cypress/e2e/login.cy.ts` → `tests/e2e/login.spec.ts`
- `cypress/e2e/test-data-verification.cy.ts` → `tests/e2e/verification.spec.ts`

## Files to Remove After Migration

- `cypress/` directory
- `cypress.config.ts`
- Cypress-specific dependencies

## Reference

- [Playwright Documentation](https://playwright.dev)
- [Migration from Cypress](https://playwright.dev/docs/test-runners#cypress)
- [Best Practices](https://playwright.dev/docs/best-practices)
