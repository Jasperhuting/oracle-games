# Oracle Games - E2E Testing met Playwright

✅ **Status**: Volledig operationeel - Alle 15 tests slagen!

## 🎯 Overzicht

Dit project gebruikt **Playwright** voor end-to-end testing. Tests draaien tegen Firebase emulators om de productie database schoon te houden.

### Waarom Playwright?

- ✅ Werkt op macOS 15.6.1 (Cypress niet)
- ✅ Sneller en moderner
- ✅ Betere debugging tools
- ✅ Built-in test UI
- ✅ Parallel execution
- ✅ Cross-browser support

## 🚀 Quick Start

### Lokaal Draaien

```bash
# Terminal 1: Start Firebase emulators
npm run emulators

# Terminal 2: Start Next.js in emulator mode
npm run dev:emulator

# Terminal 3: Seed test data (eenmalig)
npm run seed:test-data

# Terminal 4: Run tests
npm run test:e2e          # Headless mode
npm run test:e2e:ui       # Interactive UI mode (AANBEVOLEN!)
npm run test:e2e:headed   # Headed mode (zie browser)
npm run test:e2e:debug    # Debug mode
```

### Snelste Methode (Interactief)

```bash
# Start alles en open Playwright UI
npm run test:e2e:ui
```

Dan klik je in de Playwright UI op de tests die je wilt draaien!

## 📊 Test Coverage

### ✅ Geïmplementeerd (15 tests)

#### Basic Tests (4 tests) - `tests/e2e/basic.spec.ts`
- ✅ Homepage loading
- ✅ Login page navigation
- ✅ Form elements validation
- ✅ Firebase emulator connection

#### Login Tests (7 tests) - `tests/e2e/login.spec.ts`
- ✅ Login form elements display
- ✅ Invalid credentials error
- ✅ Successful login (regular user)
- ✅ Successful login (admin)
- ✅ Authenticated page fixture
- ✅ Stay logged in checkbox
- ✅ Data-testid attributes

#### Verification Tests (4 tests) - `tests/e2e/verification.spec.ts`
- ✅ Test data is seeded
- ✅ Games page accessible
- ✅ Inbox accessible
- ✅ Auction page accessible

### 🔲 Nog Te Implementeren (45+ tests)

- Games tests (10 tests)
- Auction tests - Auctioneer (15 tests)
- Auction tests - WorldTour Manager (12 tests)
- Lineup tests (8 tests)
- Inbox tests (8 tests)

**Planning**: Zie [CYPRESS_TEST_PLAN.md](CYPRESS_TEST_PLAN.md) voor details

## 📁 Project Structuur

```
oracle-games/
├── tests/
│   ├── e2e/                    # Test files
│   │   ├── basic.spec.ts      ✅ (4 tests)
│   │   ├── login.spec.ts      ✅ (7 tests)
│   │   └── verification.spec.ts ✅ (4 tests)
│   └── fixtures/
│       └── auth.ts            # Authentication fixtures
├── scripts/
│   └── seed-test-data.ts      ✅ Test data seeding
├── playwright.config.ts       ✅ Playwright config
├── playwright-report/         # HTML test reports (gitignored)
├── test-results/             # Test artifacts (gitignored)
└── .github/workflows/
    └── playwright-tests.yml   ✅ CI/CD pipeline
```

## 🔧 Test Data

### Test Users (in emulator)

```typescript
// Regular user
email: 'user@test.com'
password: 'user123'

// Second user
email: 'user2@test.com'
password: 'user123'

// Admin user
email: 'admin@test.com'
password: 'admin123'
```

### Seeded Data

Run `npm run seed:test-data` om de volgende test data te seeden:

- 3 test games (auctioneer, worldtour-manager, registration)
- 3 game participants
- 3 riders (Pogačar, Vingegaard, Evenepoel)
- 4 bids (won, active, outbid)
- 2 player teams
- 3 messages

## ✍️ Tests Schrijven

### Basic Test

```typescript
import { test, expect } from '@playwright/test';

test('should load page', async ({ page }) => {
  await page.goto('/games');
  await expect(page.locator('body')).toBeVisible();
});
```

### Met Authenticatie

```typescript
import { test, expect } from '../fixtures/auth';

test('should access protected page', async ({ authenticatedPage }) => {
  // authenticatedPage is al ingelogd als user@test.com
  await authenticatedPage.goto('/games');
  await expect(authenticatedPage).toHaveURL(/\/games/);
});
```

### Data-testid Pattern

Gebruik consistent `data-testid` in components:

```tsx
// Component
<button data-testid="auction-bid-button">Bid</button>

// Test
await page.getByTestId('auction-bid-button').click();
```

Naming pattern: `[feature]-[element]-[action]`

## 🎨 Playwright UI Mode

De **Interactive UI mode** is de beste manier om tests te ontwikkelen:

```bash
npm run test:e2e:ui
```

Features:
- 🎯 Click to run specific tests
- 👀 Watch mode (auto-rerun on changes)
- 🐛 Time travel debugging
- 📸 Screenshots at every step
- 🎬 Video recording
- 📊 Network requests inspector

## 🐛 Debugging

### Debug een specifieke test

```bash
npm run test:e2e:debug -- tests/e2e/login.spec.ts
```

### Bekijk laatste test report

```bash
npm run test:e2e:report
```

### Playwright Inspector

```bash
# Set breakpoint in test:
await page.pause();  // Debugger stopt hier
```

## 📈 CI/CD

Tests draaien automatisch in GitHub Actions bij push/PR.

Workflow: `.github/workflows/playwright-tests.yml`

**Wat gebeurt er:**
1. Checkout code
2. Install dependencies + Playwright browsers
3. Start Firebase emulators
4. Seed test data
5. Start Next.js server
6. Run all tests
7. Upload reports on failure

**Artifacts bij failure:**
- HTML test report
- Screenshots
- Videos
- Logs

## 🔍 Troubleshooting

### Tests falen lokaal?

```bash
# Check of emulators draaien
curl http://127.0.0.1:4000  # Emulator UI
curl http://127.0.0.1:8080  # Firestore

# Check of Next.js draait
curl http://localhost:3210

# Herstart alles
pkill -f firebase
pkill -f next
npm run emulators
npm run dev:emulator
```

### Playwright browser issues?

```bash
# Reinstall browsers
npx playwright install --force chromium
```

### Test data niet zichtbaar?

```bash
# Re-seed test data
npm run seed:test-data

# Check in emulator UI
open http://127.0.0.1:4000
```

## 📚 Documentatie

- [PLAYWRIGHT_MIGRATION_GUIDE.md](PLAYWRIGHT_MIGRATION_GUIDE.md) - Waarom we migreerden van Cypress
- [CYPRESS_TEST_PLAN.md](CYPRESS_TEST_PLAN.md) - Originele test plan (nog steeds relevant)
- [TESTING_SUMMARY.md](TESTING_SUMMARY.md) - Historische Cypress setup
- [Playwright Docs](https://playwright.dev) - Officiële documentatie

## 🎯 Volgende Stappen

1. **Add data-testid to components**
   - PlayerCard, PlayerRow
   - JoinableGamesTab
   - ActionPanel
   - Bid modal

2. **Implement games tests** (10 tests)
   - Load, filter, join games

3. **Implement auction tests** (27 tests)
   - Auctioneer: 15 tests
   - WorldTour Manager: 12 tests

4. **Setup coverage reporting**
   - Istanbul/nyc integration
   - Coverage thresholds

## ✅ Success Metrics

- [x] Playwright setup & running
- [x] All 15 tests passing
- [x] Seed script functional
- [x] Werkt op macOS 15.6.1
- [x] CI/CD pipeline configured
- [ ] Games tests (0/10)
- [ ] Auction tests (0/27)
- [ ] 70%+ code coverage

---

**Total Tests:**
- Implemented: **15 ✅**
- Planned: **60+ 🔲**
- Target: 70-80 tests

**Last Updated**: 13 december 2025
