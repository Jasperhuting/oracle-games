# RFC #13: Decompose Bidding Monolith — BiddableRider + BiddingStrategy

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated logic from the 2400-line bidding monolith into three tested pure modules, making bid validation testable without rendering a component.

**Architecture:** Three pure utility files are added under `lib/bidding/`: `teamUtils.ts` (shared predicates), `buildBiddableRiders.ts` (rider enrichment), and `BiddingStrategy.ts` (validation). All three have zero React / Firestore dependencies. Page and component files are updated to import from these modules. No runtime behaviour changes — purely a refactor.

**Tech Stack:** TypeScript, Vitest (tests in `tests/unit/`), React 19, Next.js 16. Test command: `yarn test`. Imports use `@/` aliases (configured in tsconfig).

**Scope note:** This plan covers RFC tasks 1–3 (pure-function extractions). The AuctionProvider/useAuction() context refactor (RFC tasks 4–6) is a separate follow-up plan.

---

## Chunk 1: Team utilities and rider enrichment

### Task 1: Extract `isProTourTeamClass()` and `normalizeTeamKey()` to shared module

The same two functions exist identically in three places and need a single source of truth:
- `app/games/[gameId]/auction/page.tsx` lines 1025–1039
- `components/Bidding.tsx` lines 113–124 (`isProTourTeamClass` only — `normalizeTeamKey` is not there)
- `app/api/games/[gameId]/bids/place/route.ts` lines 11–25

**Files:**
- Create: `lib/bidding/teamUtils.ts`
- Create: `tests/unit/bidding-utils.test.ts`
- Modify: `components/Bidding.tsx` (remove local def lines 113–124, add import)
- Modify: `app/api/games/[gameId]/bids/place/route.ts` (remove local defs lines 11–25, add import)
- Modify: `app/games/[gameId]/auction/page.tsx` (remove local defs lines 1025–1039, add import)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/bidding-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isProTourTeamClass, normalizeTeamKey } from '@/lib/bidding/teamUtils';

describe('isProTourTeamClass', () => {
  it('returns true for "prt"', () => {
    expect(isProTourTeamClass('prt')).toBe(true);
  });
  it('returns true for "ProTeam" (case-insensitive)', () => {
    expect(isProTourTeamClass('ProTeam')).toBe(true);
  });
  it('returns true for "pro team" with space', () => {
    expect(isProTourTeamClass('pro team')).toBe(true);
  });
  it('returns true for "protour"', () => {
    expect(isProTourTeamClass('protour')).toBe(true);
  });
  it('returns true for "pro tour"', () => {
    expect(isProTourTeamClass('pro tour')).toBe(true);
  });
  it('returns true for "pro"', () => {
    expect(isProTourTeamClass('pro')).toBe(true);
  });
  it('returns false for "PCT" (continental team)', () => {
    expect(isProTourTeamClass('PCT')).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(isProTourTeamClass(undefined)).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isProTourTeamClass('')).toBe(false);
  });
  it('trims leading/trailing whitespace', () => {
    expect(isProTourTeamClass('  prt  ')).toBe(true);
  });
});

describe('normalizeTeamKey', () => {
  it('strips spaces, pipes, and dashes', () => {
    expect(normalizeTeamKey('Team Visma | Lease a Bike')).toBe('teamvismaleaseabike');
  });
  it('lowercases the result', () => {
    expect(normalizeTeamKey('UAE Team Emirates')).toBe('uaeteamemirates');
  });
  it('handles undefined', () => {
    expect(normalizeTeamKey(undefined)).toBe('');
  });
  it('handles empty string', () => {
    expect(normalizeTeamKey('')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn test tests/unit/bidding-utils.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/bidding/teamUtils'"

- [ ] **Step 3: Create `lib/bidding/teamUtils.ts`**

```typescript
/**
 * Returns true if the given team class string denotes a ProTour / WorldTour team.
 * Canonical class strings observed in PCS data.
 * This is the single source of truth — do not duplicate in components or API routes.
 */
export function isProTourTeamClass(teamClass?: string): boolean {
  if (!teamClass) return false;
  const normalized = teamClass.trim().toLowerCase();
  return (
    normalized === 'prt' ||
    normalized === 'proteam' ||
    normalized === 'pro team' ||
    normalized === 'protour' ||
    normalized === 'pro tour' ||
    normalized === 'pro'
  );
}

/**
 * Normalises a team name to a lowercase alphanumeric key for stable comparison.
 * e.g. "Team Visma | Lease a Bike" → "teamvismaleaseabike"
 */
export function normalizeTeamKey(name?: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
yarn test tests/unit/bidding-utils.test.ts
```

Expected: PASS (all 14 tests)

- [ ] **Step 5: Replace local definition in `components/Bidding.tsx`**

Remove lines 113–124:
```typescript
  const isProTourTeamClass = (teamClass?: string) => {
    if (!teamClass) return false;
    const normalized = teamClass.trim().toLowerCase();
    return (
      normalized === 'prt' ||
      normalized === 'proteam' ||
      normalized === 'pro team' ||
      normalized === 'protour' ||
      normalized === 'pro tour' ||
      normalized === 'pro'
    );
  };
```

Add import at the top of `components/Bidding.tsx` (after the existing imports):
```typescript
import { isProTourTeamClass } from '@/lib/bidding/teamUtils';
```

Note: `normalizeTeamKey` is NOT present in `Bidding.tsx` — only `isProTourTeamClass` needs to be replaced here.

- [ ] **Step 6: Replace local definitions in `app/api/games/[gameId]/bids/place/route.ts`**

Remove lines 11–25:
```typescript
const isProTourTeamClass = (teamClass?: string): boolean => {
  if (!teamClass) return false;
  const normalized = teamClass.trim().toLowerCase();
  return (
    normalized === 'prt' ||
    normalized === 'proteam' ||
    normalized === 'pro team' ||
    normalized === 'protour' ||
    normalized === 'pro tour' ||
    normalized === 'pro'
  );
};

const normalizeTeamKey = (name?: string): string =>
  (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
```

Add import after the existing imports at the top of the file:
```typescript
import { isProTourTeamClass, normalizeTeamKey } from '@/lib/bidding/teamUtils';
```

- [ ] **Step 7: Replace local definitions in `app/games/[gameId]/auction/page.tsx`**

Remove lines 1025–1039:
```typescript
  const isProTourTeamClass = (teamClass?: string) => {
    if (!teamClass) return false;
    const normalized = teamClass.trim().toLowerCase();
    return (
      normalized === 'prt' ||
      normalized === 'proteam' ||
      normalized === 'pro team' ||
      normalized === 'protour' ||
      normalized === 'pro tour' ||
      normalized === 'pro'
    );
  };

  const normalizeTeamKey = (name?: string) =>
    (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
```

Add import alongside the existing `@/lib/utils` import line near the top of the file:
```typescript
import { isProTourTeamClass, normalizeTeamKey } from '@/lib/bidding/teamUtils';
```

- [ ] **Step 8: Run full test suite**

```bash
yarn test
```

Expected: All tests pass (8 test files, 145+ tests).

- [ ] **Step 9: Commit**

```bash
git add lib/bidding/teamUtils.ts tests/unit/bidding-utils.test.ts \
  components/Bidding.tsx \
  "app/api/games/[gameId]/bids/place/route.ts" \
  "app/games/[gameId]/auction/page.tsx"
git commit -m "refactor: extract isProTourTeamClass and normalizeTeamKey to lib/bidding/teamUtils"
```

---

### Task 2: Extract `buildBiddableRiders()` pure function

The rider enrichment logic (attaching bid status, sold status, effectiveMinBid) is duplicated in two paths inside `loadAuctionData()` in `page.tsx`:
- **Cache-hit path** (lines ~244–285): same logic, but skips admin `highestBidder` logic
- **Fresh-fetch path** (lines ~414–473): full logic including admin view

Both output a `RiderWithBid[]`. Extract into a single testable pure function.

**Files:**
- Create: `lib/bidding/buildBiddableRiders.ts`
- Modify: `tests/unit/bidding-utils.test.ts` (add tests for this function)
- Modify: `app/games/[gameId]/auction/page.tsx` (replace both enrichment paths)

- [ ] **Step 1: Write failing tests for `buildBiddableRiders`**

Add to `tests/unit/bidding-utils.test.ts` (append after existing tests):

```typescript
import { buildBiddableRiders, type BuildRidersOptions } from '@/lib/bidding/buildBiddableRiders';
import type { Rider } from '@/lib/types/rider';
import type { Bid } from '@/lib/types';

// Minimal Rider fixture — only the fields we care about
const makeRider = (overrides: Partial<Rider> & { nameID: string; points?: number }): Rider =>
  ({ id: overrides.nameID, name: 'Test Rider', ...overrides } as Rider);

// Minimal Bid fixture
const makeBid = (overrides: Partial<Bid> & { riderNameId: string; status: Bid['status']; amount: number }): Bid =>
  ({ id: 'bid-1', userId: 'u1', gameId: 'g1', playername: 'Player', riderName: 'Test', riderTeam: '', jerseyImage: '', ...overrides } as Bid);

describe('buildBiddableRiders', () => {
  const baseOpts: BuildRidersOptions = {
    riders: [],
    userBids: [],
    allBids: [],
    soldRidersMap: new Map(),
    gameType: 'auctioneer',
  };

  it('sets effectiveMinBid to rider points for auctioneer', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: 'pogacar', points: 500 })],
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(500);
  });

  it('caps effectiveMinBid at maxMinimumBid', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: 'pogacar', points: 500 })],
      maxMinimumBid: 300,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(300);
  });

  it('does not cap when points <= maxMinimumBid', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: 'climber', points: 100 })],
      maxMinimumBid: 300,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(100);
  });

  it('uses riderValues for full-grid instead of points', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      gameType: 'full-grid',
      riders: [makeRider({ nameID: 'evenepoel', points: 400 })],
      riderValues: { evenepoel: 12 },
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(12);
  });

  it('attaches active user bid', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: 'pogacar', points: 500 })],
      userBids: [makeBid({ riderNameId: 'pogacar', status: 'active', amount: 600 })],
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].myBid).toBe(600);
    expect(result[0].myBidStatus).toBe('active');
  });

  it('marks rider as sold for auctioneer when in soldRidersMap', () => {
    const sold = new Map([['van-aert', { ownerName: 'Alice', pricePaid: 750 }]]);
    const opts: BuildRidersOptions = {
      ...baseOpts,
      gameType: 'auctioneer',
      riders: [makeRider({ nameID: 'van-aert', points: 700 })],
      soldRidersMap: sold,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].isSold).toBe(true);
    expect(result[0].soldTo).toBe('Alice');
    expect(result[0].pricePaid).toBe(750);
  });

  it('does NOT mark rider as sold for full-grid (selection game)', () => {
    const sold = new Map([['laporte', { ownerName: 'Bob', pricePaid: 8 }]]);
    const opts: BuildRidersOptions = {
      ...baseOpts,
      gameType: 'full-grid',
      riders: [makeRider({ nameID: 'laporte', points: 100 })],
      soldRidersMap: sold,
      riderValues: { laporte: 8 },
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].isSold).toBe(false);
  });

  it('populates highestBid and highestBidder for admins', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: 'vingegaard', points: 400 })],
      allBids: [
        makeBid({ riderNameId: 'vingegaard', status: 'active', amount: 500, playername: 'Bob' }),
        makeBid({ riderNameId: 'vingegaard', status: 'active', amount: 700, playername: 'Alice' }),
      ],
      isAdmin: true,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].highestBid).toBe(700);
    expect(result[0].highestBidder).toBe('Alice');
  });

  it('does NOT expose highestBidder for non-admins', () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: 'vingegaard', points: 400 })],
      allBids: [
        makeBid({ riderNameId: 'vingegaard', status: 'active', amount: 700, playername: 'Alice' }),
      ],
      isAdmin: false,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].highestBidder).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn test tests/unit/bidding-utils.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/bidding/buildBiddableRiders'"

- [ ] **Step 3: Create `lib/bidding/buildBiddableRiders.ts`**

```typescript
import type { Rider } from '@/lib/types/rider';
import type { Bid } from '@/lib/types';
import type { RiderWithBid } from '@/lib/types/pages';

export interface BuildRidersOptions {
  riders: Rider[];
  /** Bids belonging to the current user. */
  userBids: Bid[];
  /** All bids in the game (used for admin highestBid view). */
  allBids: Bid[];
  /** Map of riderNameId → { ownerName, pricePaid } for sold riders. */
  soldRidersMap: Map<string, { ownerName: string; pricePaid: number }>;
  gameType: string;
  /** Maximum cap on effectiveMinBid for auctioneer games. */
  maxMinimumBid?: number;
  /** Admin-set point values per rider for full-grid games. */
  riderValues?: Record<string, number>;
  /** When true, highest bid amount + bidder name are populated (admin view). */
  isAdmin?: boolean;
}

/**
 * Pure function that enriches a list of Riders with auction metadata.
 * Replaces the two duplicated enrichment paths in auction/page.tsx.
 */
export function buildBiddableRiders(opts: BuildRidersOptions): RiderWithBid[] {
  const {
    riders,
    userBids,
    allBids,
    soldRidersMap,
    gameType,
    maxMinimumBid,
    riderValues,
    isAdmin = false,
  } = opts;

  const isFullGrid = gameType === 'full-grid';
  const isBiddingGame = gameType === 'auctioneer';

  return riders.map((rider) => {
    const riderNameId = rider.nameID || rider.id || '';

    const myBid = userBids.find(
      (b) => b.riderNameId === rider.nameID || b.riderNameId === rider.id,
    );

    // Sold status only applies to pure-auction game types
    const soldData = soldRidersMap.get(riderNameId);
    const isSold = isBiddingGame && !!soldData;
    const soldTo = soldData?.ownerName;
    const pricePaid = soldData?.pricePaid;

    const effectiveMinBid = computeEffectiveMinBid(riderNameId, rider.points, {
      isFullGrid,
      riderValues,
      maxMinimumBid,
      gameType,
    });

    let highestBid = 0;
    let highestBidder: string | undefined;

    if (isAdmin) {
      const riderBids = allBids.filter(
        (b) =>
          (b.riderNameId === rider.nameID || b.riderNameId === rider.id) &&
          b.status === 'active',
      );
      if (riderBids.length > 0) {
        const highest = riderBids.reduce((max, bid) =>
          bid.amount > max.amount ? bid : max,
        );
        highestBid = highest.amount;
        highestBidder = highest.playername || '';
      }
    } else {
      if (
        myBid &&
        (myBid.status === 'active' ||
          myBid.status === 'outbid' ||
          myBid.status === 'won')
      ) {
        highestBid = myBid.amount;
      }
    }

    return {
      ...rider,
      highestBid: highestBid || undefined,
      highestBidder,
      myBid: myBid?.amount || undefined,
      myBidStatus: myBid?.status || undefined,
      myBidId: myBid?.id || undefined,
      effectiveMinBid,
      soldTo,
      isSold,
      pricePaid,
    };
  });
}

function computeEffectiveMinBid(
  riderNameId: string,
  rawPoints: number | undefined,
  opts: {
    isFullGrid: boolean;
    riderValues?: Record<string, number>;
    maxMinimumBid?: number;
    gameType: string;
  },
): number {
  // Full-grid uses admin-set values
  if (opts.isFullGrid) {
    return (opts.riderValues || {})[riderNameId] || 0;
  }

  // Use `|| 1` to avoid 0 as minimum — mirrors the original page logic
  const points = rawPoints || 1;

  if (opts.maxMinimumBid && points > opts.maxMinimumBid) {
    return opts.maxMinimumBid;
  }

  return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
yarn test tests/unit/bidding-utils.test.ts
```

Expected: PASS (all 28 tests — 14 from Task 1 + 10 new)

- [ ] **Step 5: Wire `buildBiddableRiders` into `auction/page.tsx`**

Add import near the top of `app/games/[gameId]/auction/page.tsx`:
```typescript
import { buildBiddableRiders } from '@/lib/bidding/buildBiddableRiders';
```

**Replace the cache-hit enrichment path (approximately lines 244–287):**

Find this block (inside `loadAuctionData`, after the `cachedData &&` branch sets state):
```typescript
        // Enhance riders with bid information
        const maxMinBid = cachedData.gameData?.config?.maxMinimumBid;
        const fullGridRiderValues = (cachedData.gameData?.config?.riderValues || {}) as Record<string, number>;
        const isFullGridGame = cachedData.gameData.gameType === 'full-grid';
        const ridersWithBids = riders.map((rider: Rider) => {
          ...
        });

        setAvailableRiders(ridersWithBids);
```

Replace the `ridersWithBids` derivation (keep the `setAvailableRiders` call):
```typescript
        const ridersWithBids = buildBiddableRiders({
          riders,
          userBids,
          allBids: cachedData.allBidsData,
          soldRidersMap,
          gameType: cachedData.gameData.gameType,
          maxMinimumBid: cachedData.gameData?.config?.maxMinimumBid as number | undefined,
          riderValues: (cachedData.gameData?.config?.riderValues || {}) as Record<string, number>,
          isAdmin: false,
        });

        setAvailableRiders(ridersWithBids);
```

**Replace the fresh-fetch enrichment path (approximately lines 414–475):**

Find this block (after `playerTeamsData` is processed into `soldRidersMap`):
```typescript
      // Enhance riders with bid information and sold status
      const maxMinBid = game?.config?.maxMinimumBid;
      const freshFullGridRiderValues = (game?.config?.riderValues || {}) as Record<string, number>;
      const isFreshFullGrid = game?.gameType === 'full-grid';
      const ridersWithBids = riders.map((rider: Rider) => {
        ...
      });

      setAvailableRiders(ridersWithBids);
```

Replace the `ridersWithBids` derivation (keep the `setAvailableRiders` call):
```typescript
      const ridersWithBids = buildBiddableRiders({
        riders,
        userBids,
        allBids: allBidsData,
        soldRidersMap,
        gameType: game.gameType,
        maxMinimumBid: game?.config?.maxMinimumBid as number | undefined,
        riderValues: (game?.config?.riderValues || {}) as Record<string, number>,
        isAdmin: userIsAdmin,
      });

      setAvailableRiders(ridersWithBids);
```

- [ ] **Step 6: Run full test suite**

```bash
yarn test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/bidding/buildBiddableRiders.ts tests/unit/bidding-utils.test.ts \
  "app/games/[gameId]/auction/page.tsx"
git commit -m "refactor: extract buildBiddableRiders pure function, replace duplicated enrichment paths"
```

---

## Chunk 2: BiddingStrategy validation

### Task 3: Extract `BiddingStrategy` — pure bid validation

`handlePlaceBid` in `auction/page.tsx` (lines 630–849) has 8 validation branches that cannot be tested without rendering the component. Extract them as pure functions under `lib/bidding/BiddingStrategy.ts`.

After the refactor, `handlePlaceBid` calls `validateBid(ctx)` instead of doing inline checks. No behaviour changes — same error messages.

**Files:**
- Create: `lib/bidding/BiddingStrategy.ts`
- Modify: `tests/unit/bidding-utils.test.ts` (add validation tests)
- Modify: `app/games/[gameId]/auction/page.tsx` (use `validateBid` in `handlePlaceBid`)

- [ ] **Step 1: Write failing tests for `BiddingStrategy`**

Append to `tests/unit/bidding-utils.test.ts`:

```typescript
import {
  validateBid,
  type BidValidationContext,
} from '@/lib/bidding/BiddingStrategy';

// Minimal RiderWithBid fixture
const makeRiderWithBid = (overrides: Partial<RiderWithBid> & { nameID: string }): RiderWithBid =>
  ({
    id: overrides.nameID,
    name: 'Test Rider',
    points: 100,
    effectiveMinBid: 100,
    isSold: false,
    ...overrides,
  } as RiderWithBid);

// Base validation context — represents a clean state that should pass
const baseCtx: BidValidationContext = {
  rider: makeRiderWithBid({ nameID: 'pogacar' }),
  myBids: [],
  availableRiders: [],
  bidAmount: 150,
  remainingBudget: 10000,
  isUpdatingExistingBid: false,
  isSelectionGame: false,
  isFullGrid: false,
  isTop200Restricted: false,
  maxRiders: undefined,
  proTeamLimit: 4,
  gameType: 'auctioneer',
  config: {},
};

describe('validateBid — sold check', () => {
  it('fails when rider is already sold', () => {
    const ctx = { ...baseCtx, rider: makeRiderWithBid({ nameID: 'sold-rider', isSold: true, soldTo: 'Alice' }) };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Alice');
  });

  it('passes when rider is not sold', () => {
    expect(validateBid(baseCtx).valid).toBe(true);
  });
});

describe('validateBid — top-200 restriction', () => {
  it('fails when top-200 is active and rider rank is > 200', () => {
    const ctx = {
      ...baseCtx,
      isTop200Restricted: true,
      rider: makeRiderWithBid({ nameID: 'low-rank', rank: 250 }),
    };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('passes when top-200 is active and rider rank is exactly 200', () => {
    const ctx = {
      ...baseCtx,
      isTop200Restricted: true,
      rider: makeRiderWithBid({ nameID: 'edge-rider', rank: 200 }),
    };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('passes when top-200 is NOT active regardless of rank', () => {
    const ctx = {
      ...baseCtx,
      isTop200Restricted: false,
      rider: makeRiderWithBid({ nameID: 'low-rank', rank: 999 }),
    };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — bid amount (non-selection games)', () => {
  it('fails when bid is below effectiveMinBid', () => {
    const ctx = {
      ...baseCtx,
      rider: makeRiderWithBid({ nameID: 'pogacar', effectiveMinBid: 300 }),
      bidAmount: 299,
    };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('passes when bid equals effectiveMinBid', () => {
    const ctx = {
      ...baseCtx,
      rider: makeRiderWithBid({ nameID: 'pogacar', effectiveMinBid: 300 }),
      bidAmount: 300,
    };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('skips amount check for selection games', () => {
    const ctx = {
      ...baseCtx,
      isSelectionGame: true,
      rider: makeRiderWithBid({ nameID: 'pogacar', effectiveMinBid: 300 }),
      bidAmount: 0, // would fail for auction, but selection game bypasses this
    };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — team constraint (full-grid)', () => {
  it('fails when user already has a rider from the same team', () => {
    const existingBid = makeBid({ riderNameId: 'other-rider', status: 'active', amount: 8, riderTeam: 'UAE Team Emirates' });
    const ctx = {
      ...baseCtx,
      isFullGrid: true,
      rider: makeRiderWithBid({ nameID: 'new-rider', team: { name: 'UAE Team Emirates' } as any }),
      myBids: [existingBid],
    };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('UAE Team Emirates');
  });

  it('allows selecting the same rider again (updating bid)', () => {
    const existingBid = makeBid({ riderNameId: 'same-rider', status: 'active', amount: 8, riderTeam: 'UAE Team Emirates' });
    const ctx = {
      ...baseCtx,
      isFullGrid: true,
      rider: makeRiderWithBid({ nameID: 'same-rider', team: { name: 'UAE Team Emirates' } as any }),
      myBids: [existingBid],
    };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('skips team constraint for non-full-grid games', () => {
    const existingBid = makeBid({ riderNameId: 'other-rider', status: 'active', amount: 600, riderTeam: 'UAE Team Emirates' });
    const ctx = {
      ...baseCtx,
      isFullGrid: false,
      rider: makeRiderWithBid({ nameID: 'new-rider', team: { name: 'UAE Team Emirates' } as any }),
      myBids: [existingBid],
    };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — maxRiders limit', () => {
  it('fails when at maxRiders and placing a new bid', () => {
    const bids = [
      makeBid({ riderNameId: 'r1', status: 'active', amount: 8 }),
      makeBid({ riderNameId: 'r2', status: 'active', amount: 8 }),
    ];
    const ctx = { ...baseCtx, myBids: bids, maxRiders: 2, isUpdatingExistingBid: false };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('allows updating an existing bid even when at maxRiders', () => {
    const bids = [
      makeBid({ riderNameId: 'r1', status: 'active', amount: 8 }),
      makeBid({ riderNameId: 'r2', status: 'active', amount: 8 }),
    ];
    const ctx = { ...baseCtx, myBids: bids, maxRiders: 2, isUpdatingExistingBid: true };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('passes when below maxRiders', () => {
    const bids = [makeBid({ riderNameId: 'r1', status: 'active', amount: 8 })];
    const ctx = { ...baseCtx, myBids: bids, maxRiders: 5, isUpdatingExistingBid: false };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — budget', () => {
  it('fails when bid exceeds remaining budget', () => {
    const ctx = { ...baseCtx, bidAmount: 1000, remainingBudget: 500 };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('passes when bid equals remaining budget', () => {
    const ctx = { ...baseCtx, bidAmount: 500, remainingBudget: 500 };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('skips budget check for marginal-gains', () => {
    const ctx = { ...baseCtx, gameType: 'marginal-gains', bidAmount: 9999, remainingBudget: 100 };
    expect(validateBid(ctx).valid).toBe(true);
  });
});
```

(Note: `makeRiderWithBid` and `makeBid` are already defined earlier in the test file. The imports `RiderWithBid` needs to be added at the top of the file alongside existing imports.)

Add these imports to the top of `tests/unit/bidding-utils.test.ts`:
```typescript
import type { RiderWithBid } from '@/lib/types/pages';
import {
  validateBid,
  type BidValidationContext,
} from '@/lib/bidding/BiddingStrategy';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn test tests/unit/bidding-utils.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/bidding/BiddingStrategy'"

- [ ] **Step 3: Create `lib/bidding/BiddingStrategy.ts`**

```typescript
import type { Bid } from '@/lib/types';
import type { RiderWithBid } from '@/lib/types/pages';
import { qualifiesAsNeoProf } from '@/lib/utils';
import { isProTourTeamClass, normalizeTeamKey } from './teamUtils';

export type ValidationResult = { valid: true } | { valid: false; error: string };

export interface BidValidationContext {
  rider: RiderWithBid;
  myBids: Bid[];
  availableRiders: RiderWithBid[];
  bidAmount: number;
  remainingBudget: number;
  isUpdatingExistingBid: boolean;
  isSelectionGame: boolean;
  isFullGrid: boolean;
  isTop200Restricted: boolean;
  maxRiders?: number;
  proTeamLimit: number;
  gameType: string;
  config: {
    minRiders?: number;
    maxNeoProPoints?: number;
    maxNeoProAge?: number;
  };
}

/**
 * Runs all applicable validation rules for a bid placement in order.
 * Returns the first failing rule, or { valid: true } if all pass.
 * Pure function — no side effects, no React, no Firestore.
 */
export function validateBid(ctx: BidValidationContext): ValidationResult {
  return (
    checkNotSold(ctx.rider) ??
    checkTop200Restriction(ctx.rider, ctx.isTop200Restricted) ??
    checkBidAmount(ctx.rider, ctx.bidAmount, ctx.isSelectionGame) ??
    checkTeamConstraint(ctx.rider, ctx.myBids, ctx.isFullGrid) ??
    checkProTeamLimit(ctx.rider, ctx.myBids, ctx.availableRiders, ctx.isFullGrid, ctx.proTeamLimit) ??
    checkMaxRiders(ctx.myBids, ctx.maxRiders, ctx.isUpdatingExistingBid) ??
    checkBudget(ctx.bidAmount, ctx.remainingBudget, ctx.gameType) ??
    checkNeoProfRequirement(ctx.rider, ctx.myBids, ctx.availableRiders, ctx.gameType, ctx.config) ?? {
      valid: true,
    }
  );
}

// ---------------------------------------------------------------------------
// Individual rule functions (exported for unit-testing individual rules)
// ---------------------------------------------------------------------------

export function checkNotSold(rider: RiderWithBid): ValidationResult | null {
  if (!rider.isSold) return null;
  return { valid: false, error: `This rider is already sold to ${rider.soldTo}` };
}

export function checkTop200Restriction(
  rider: RiderWithBid,
  isTop200Restricted: boolean,
): ValidationResult | null {
  if (!isTop200Restricted) return null;
  const rank = (rider as any).rank as number | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof rank !== 'number' || rank > 200) {
    // Caller must translate this i18n key (cannot call t() in a pure function)
    return { valid: false, error: 'messages.top2000OnlyError' };
  }
  return null;
}

export function checkBidAmount(
  rider: RiderWithBid,
  bidAmount: number,
  isSelectionGame: boolean,
): ValidationResult | null {
  if (isSelectionGame) return null;
  const effectiveMinBid = rider.effectiveMinBid ?? 0;
  // Match original order: minimum-bid check first, then zero check
  if (Number(bidAmount) < effectiveMinBid) {
    return { valid: false, error: `Bid must be at least ${effectiveMinBid}` };
  }
  if (!bidAmount || bidAmount <= 0) {
    return { valid: false, error: 'Please enter a valid bid amount' };
  }
  return null;
}

export function checkTeamConstraint(
  rider: RiderWithBid,
  myBids: Bid[],
  isFullGrid: boolean,
): ValidationResult | null {
  if (!isFullGrid || !rider.team?.name) return null;
  const riderNameId = rider.nameID || rider.id || '';
  const existingTeamBid = myBids.find(
    (b) =>
      (b.status === 'active' || b.status === 'won') &&
      b.riderTeam === rider.team!.name &&
      b.riderNameId !== riderNameId,
  );
  if (!existingTeamBid) return null;
  return {
    valid: false,
    error: `Je hebt al een renner van ${rider.team.name} geselecteerd (${existingTeamBid.riderName}). Verwijder eerst die selectie.`,
  };
}

export function checkProTeamLimit(
  rider: RiderWithBid,
  myBids: Bid[],
  availableRiders: RiderWithBid[],
  isFullGrid: boolean,
  proTeamLimit: number,
): ValidationResult | null {
  if (!isFullGrid || !rider.team?.name) return null;

  const teamClass =
    (rider.team as any)?.class || (rider.team as any)?.teamClass; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!isProTourTeamClass(teamClass)) return null;

  const teamKey = normalizeTeamKey(rider.team.name);

  const selectedProTeams = new Set<string>();
  myBids
    .filter((b) => b.status === 'active' || b.status === 'won')
    .forEach((b) => {
      const bidRider = availableRiders.find(
        (r) => (r.nameID || r.id) === b.riderNameId,
      );
      const bidTeamName = bidRider?.team?.name || b.riderTeam;
      const bidTeamKey = normalizeTeamKey(bidTeamName);
      const bidTeamClass =
        (bidRider?.team as any)?.class || (bidRider?.team as any)?.teamClass; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (isProTourTeamClass(bidTeamClass) && bidTeamKey) {
        selectedProTeams.add(bidTeamKey);
      }
    });

  if (!selectedProTeams.has(teamKey) && selectedProTeams.size >= proTeamLimit) {
    return {
      valid: false,
      error: `Je mag maximaal ${proTeamLimit} ProTeams selecteren.`,
    };
  }
  return null;
}

export function checkMaxRiders(
  myBids: Bid[],
  maxRiders: number | undefined,
  isUpdatingExistingBid: boolean,
): ValidationResult | null {
  if (!maxRiders || isUpdatingExistingBid) return null;
  const uniqueActive = new Set(
    myBids
      .filter((b) => b.status === 'active' || b.status === 'outbid')
      .map((b) => b.riderNameId),
  );
  if (uniqueActive.size >= maxRiders) {
    return {
      valid: false,
      error: `Maximum number of riders reached (${uniqueActive.size}/${maxRiders}). Cancel a bid to place a new one.`,
    };
  }
  return null;
}

export function checkBudget(
  bidAmount: number,
  remainingBudget: number,
  gameType: string,
): ValidationResult | null {
  // marginal-gains has no budget constraint
  if (gameType === 'marginal-gains') return null;
  if (bidAmount > remainingBudget) {
    return { valid: false, error: 'Bid exceeds your remaining budget' };
  }
  return null;
}

export function checkNeoProfRequirement(
  rider: RiderWithBid,
  myBids: Bid[],
  availableRiders: RiderWithBid[],
  gameType: string,
  config: { minRiders?: number; maxNeoProPoints?: number; maxNeoProAge?: number },
): ValidationResult | null {
  if (gameType !== 'worldtour-manager' && gameType !== 'marginal-gains') return null;

  const minRiders = config.minRiders ?? 27;
  const isThisRiderNeoProf = qualifiesAsNeoProf(rider, config);

  const totalActive = new Set(
    myBids
      .filter((b) => b.status === 'active' || b.status === 'outbid')
      .map((b) => b.riderNameId),
  ).size;

  const currentNeoProfCount = new Set(
    myBids
      .filter((b) => b.status === 'active' || b.status === 'outbid')
      .filter((b) => {
        const bidRider = availableRiders.find(
          (r) => (r.nameID || r.id) === b.riderNameId,
        );
        return bidRider && qualifiesAsNeoProf(bidRider, config);
      })
      .map((b) => b.riderNameId),
  ).size;

  if (totalActive >= minRiders && !isThisRiderNeoProf && currentNeoProfCount === 0) {
    const maxAge = config.maxNeoProAge ?? 21;
    const maxPoints = config.maxNeoProPoints ?? 250;
    return {
      valid: false,
      error: `Om meer dan ${minRiders} renners te hebben, moet je minimaal 1 neoprof in je team hebben (max ${maxAge} jaar oud met max ${maxPoints} punten).`,
    };
  }

  if (isThisRiderNeoProf && config.maxNeoProPoints && (rider.points ?? 0) > config.maxNeoProPoints) {
    return {
      valid: false,
      error: `Deze renner heeft te veel punten (${rider.points}) om als neoprof te kwalificeren. Max toegestaan: ${config.maxNeoProPoints} punten.`,
    };
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
yarn test tests/unit/bidding-utils.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 5: Wire `validateBid` into `handlePlaceBid` in `auction/page.tsx`**

Add import near top of `app/games/[gameId]/auction/page.tsx`:
```typescript
import { validateBid, type BidValidationContext } from '@/lib/bidding/BiddingStrategy';
```

Inside `handlePlaceBid` (around line 630), replace the eight validation branches with a single call.

**Before** (the validation block from the sold check through the neo-prof check, approximately lines 647–782):
```typescript
    // Prevent bidding on sold riders
    if (rider.isSold) { ... return; }
    // When top-200 restriction is active ...
    if (isTop200Restricted) { ... return; }
    // Skip bid validation for selection-based games ...
    if (!isSelectionGame) {
      if (Number(bidAmount) < effectiveMinBid) { ... return; }
      if (!bidAmount || bidAmount <= 0) { ... return; }
    }
    // Full Grid: Check team constraint
    if (isFullGrid && rider.team?.name) { ... return; }
    // Full Grid: Limit ProTeam selections
    if (isFullGrid && rider.team?.name) { ... return; }
    // Check maxRiders limit
    if (maxRiders && activeBidsCount >= maxRiders && !isUpdatingExistingBid) { ... return; }
    // Check budget
    if (!isGameType(game, 'marginal-gains')) {
      if (bidAmount > getRemainingBudget(riderNameId)) { ... return; }
    }
    // WorldTour Manager & Marginal Gains: Check neo-prof requirements
    if (game && (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains')) { ... return; }
```

**After** (replace the entire block of validation branches):
```typescript
    // --- Validate via BiddingStrategy (pure, testable) ---
    const maxRiders = game?.config?.maxRiders || game?.config?.teamSize;
    const validationCtx: BidValidationContext = {
      rider,
      myBids,
      availableRiders,
      bidAmount,
      remainingBudget: getRemainingBudget(riderNameId),
      isUpdatingExistingBid: rider.myBid !== undefined,
      isSelectionGame,
      isFullGrid,
      isTop200Restricted,
      maxRiders,
      proTeamLimit: fullGridProTeamLimit,
      gameType: game?.gameType || '',
      config: {
        minRiders: game?.config?.minRiders,
        maxNeoProPoints: game?.config?.maxNeoProPoints,
        maxNeoProAge: game?.config?.maxNeoProAge,
      },
    };
    const validation = validateBid(validationCtx);
    if (!validation.valid) {
      // messages.* values are i18n keys (top-200 restriction); translate them at the call site
      const errorMsg = validation.error.startsWith('messages.')
        ? t(validation.error as Parameters<typeof t>[0])
        : validation.error;
      setError(errorMsg);
      return;
    }
    // --- End validation ---
```

Note: `getEffectiveMinimumBid` calls in `handlePlaceBid` (lines ~642–645) can now be replaced with `rider.effectiveMinBid ?? 0` since `buildBiddableRiders` already sets this. Specifically:
```typescript
    // For worldtour-manager, marginal-gains, and full-grid, use the rider's effective minimum bid as the price
    const bidAmount = isSelectionGame
      ? (rider.effectiveMinBid ?? 0)
      : parseFloat(bidAmountsRef.current[riderNameId] || '0');

    const effectiveMinBid = rider.effectiveMinBid ?? 0;
```

The `getEffectiveMinimumBid` helper function in `page.tsx` can then be removed entirely since it's no longer called.

- [ ] **Step 6: Run full test suite**

```bash
yarn test
```

Expected: All tests pass.

- [ ] **Step 7: Verify the app still loads (dev server sanity check)**

The app should be running already (from `preview_start`). Open a browser / run:
```bash
curl -s http://localhost:3210 | head -5
```

Expected: HTML returned (no 500 errors).

- [ ] **Step 8: Commit**

```bash
git add lib/bidding/BiddingStrategy.ts tests/unit/bidding-utils.test.ts \
  "app/games/[gameId]/auction/page.tsx"
git commit -m "refactor: extract BiddingStrategy pure validation, wire into handlePlaceBid"
```
