# Game Config Zod Schemas Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create Zod validation schemas for all 12 game config types and replace `config: z.any()` in `createGameSchema` / `updateGameSchema` with structural per-gameType validation.

**Architecture:** Create `lib/game-configs/` with one schema file per game type — TypeScript types inferred via `z.infer<>`. Shared sub-schemas (auctionPeriod, slipstreamRace, countingRace, timestamp) live in `shared.ts`. `lib/game-configs/index.ts` exports a `gameConfigSchemas` map keyed by game type. `createGameSchema` gains a `.superRefine()` that validates `config` against the correct schema for the given `gameType`. Existing `lib/types/games.ts` interfaces are NOT modified — this plan adds validation only, not a type system refactor.

**Tech Stack:** Zod ^3.25.76, TypeScript, Vitest (node environment)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/game-configs/shared.ts` | **Create** | `timestampSchema`, `auctionStatusSchema`, `auctionPeriodSchema`, `slipstreamRaceSchema`, `countingRaceSchema` |
| `lib/game-configs/auctioneer.ts` | **Create** | `auctioneerConfigSchema` |
| `lib/game-configs/slipstream.ts` | **Create** | `slipstreamConfigSchema` |
| `lib/game-configs/last-man-standing.ts` | **Create** | `lastManStandingConfigSchema` |
| `lib/game-configs/poisoned-cup.ts` | **Create** | `poisonedCupConfigSchema` |
| `lib/game-configs/nations-cup.ts` | **Create** | `nationsCupConfigSchema` |
| `lib/game-configs/rising-stars.ts` | **Create** | `risingStarsConfigSchema` |
| `lib/game-configs/country-roads.ts` | **Create** | `countryRoadsConfigSchema` |
| `lib/game-configs/worldtour-manager.ts` | **Create** | `worldTourManagerConfigSchema` |
| `lib/game-configs/fan-flandrien.ts` | **Create** | `fanFlandrienConfigSchema` |
| `lib/game-configs/full-grid.ts` | **Create** | `fullGridConfigSchema` |
| `lib/game-configs/marginal-gains.ts` | **Create** | `marginalGainsConfigSchema` |
| `lib/game-configs/f1-prediction.ts` | **Create** | `f1PredictionConfigSchema` |
| `lib/game-configs/index.ts` | **Create** | All re-exports + `gameConfigSchemas` map + `GameConfigInput` union type |
| `lib/validation/schemas.ts` | **Modify** | Replace `config: z.any()` with `z.unknown()` + `.superRefine()` |
| `tests/unit/game-config-schemas.test.ts` | **Create** | Unit tests for all schemas + integration test for createGameSchema |

---

## Chunk 1: Schema files

---

### Task 1: Shared sub-schemas

**Files:**
- Create: `lib/game-configs/shared.ts`
- Test: `tests/unit/game-config-schemas.test.ts` (add first describe blocks)

**Context:**
- `AUCTION_STATUSES = ['pending', 'active', 'closed', 'finalized']` from `lib/types/games.ts`
- `SLIPSTREAM_RACE_STATUSES = ['upcoming', 'locked', 'finished']` from `lib/types/games.ts`
- `timestampSchema` accepts both ISO datetime strings (from API clients) and Firestore-serialized `{ seconds, nanoseconds }` objects — both representations appear in JSON payloads

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/game-config-schemas.test.ts
import { describe, it, expect } from 'vitest';
import {
  timestampSchema,
  auctionStatusSchema,
  auctionPeriodSchema,
  countingRaceSchema,
  slipstreamRaceSchema,
} from '@/lib/game-configs/shared';

describe('timestampSchema', () => {
  it('accepts ISO datetime string', () => {
    expect(() => timestampSchema.parse('2026-01-01T00:00:00.000Z')).not.toThrow();
  });
  it('accepts Firestore-serialized object', () => {
    expect(() => timestampSchema.parse({ seconds: 1234567890, nanoseconds: 0 })).not.toThrow();
  });
  it('rejects non-datetime string', () => {
    expect(() => timestampSchema.parse('not-a-date')).toThrow();
  });
  it('rejects plain number', () => {
    expect(() => timestampSchema.parse(1234567890)).toThrow();
  });
});

describe('auctionStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const s of ['pending', 'active', 'closed', 'finalized']) {
      expect(() => auctionStatusSchema.parse(s)).not.toThrow();
    }
  });
  it('rejects unknown status', () => {
    expect(() => auctionStatusSchema.parse('unknown')).toThrow();
  });
});

describe('auctionPeriodSchema', () => {
  const valid = {
    name: 'Period 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-07T00:00:00.000Z',
    status: 'pending' as const,
  };
  it('parses valid period', () => {
    expect(() => auctionPeriodSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid status', () => {
    expect(() => auctionPeriodSchema.parse({ ...valid, status: 'unknown' })).toThrow();
  });
  it('rejects missing required fields', () => {
    expect(() => auctionPeriodSchema.parse({ name: 'Period 1' })).toThrow();
  });
});

describe('countingRaceSchema', () => {
  const valid = { raceId: 'r1', raceSlug: 'tdf-2026', raceName: 'Tour de France' };
  it('parses valid counting race', () => {
    expect(() => countingRaceSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid pointsScale', () => {
    expect(() => countingRaceSchema.parse({ ...valid, pointsScale: 5 })).toThrow();
  });
  it('rejects missing raceId', () => {
    expect(() => countingRaceSchema.parse({ raceSlug: 'tdf', raceName: 'TdF' })).toThrow();
  });
});

describe('slipstreamRaceSchema', () => {
  const valid = {
    raceId: 'r1',
    raceSlug: 'tdf-2026',
    raceName: 'Tour de France',
    raceDate: '2026-07-01T00:00:00.000Z',
    pickDeadline: '2026-06-30T12:00:00.000Z',
    status: 'upcoming' as const,
    order: 1,
  };
  it('parses valid slipstream race', () => {
    expect(() => slipstreamRaceSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid status', () => {
    expect(() => slipstreamRaceSchema.parse({ ...valid, status: 'invalid' })).toThrow();
  });
  it('rejects missing order', () => {
    const { order: _, ...rest } = valid;
    expect(() => slipstreamRaceSchema.parse(rest)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/game-config-schemas.test.ts 2>&1 | tail -5
```

Expected: FAIL — `@/lib/game-configs/shared` not found.

- [ ] **Step 3: Create `lib/game-configs/shared.ts`**

```typescript
// lib/game-configs/shared.ts
import { z } from 'zod';
import { AUCTION_STATUSES, SLIPSTREAM_RACE_STATUSES } from '@/lib/types/games';

/**
 * Accepts a Firestore Timestamp serialized to JSON ({ seconds, nanoseconds })
 * or an ISO 8601 datetime string. Both representations appear in API JSON payloads.
 */
export const timestampSchema = z.union([
  z.string().datetime(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
]);

export const auctionStatusSchema = z.enum(AUCTION_STATUSES);

export const countingRaceSchema = z.object({
  raceId: z.string(),
  raceSlug: z.string(),
  raceName: z.string(),
  pointsScale: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  restDays: z.array(z.number().int()).optional(),
  mountainPointsMultiplier: z.number().positive().optional(),
  sprintPointsMultiplier: z.number().positive().optional(),
});

export const auctionPeriodSchema = z.object({
  name: z.string().min(1),
  startDate: timestampSchema,
  endDate: timestampSchema,
  finalizeDate: timestampSchema.optional(),
  status: auctionStatusSchema,
  top200Only: z.boolean().optional(),
  neoProfsRequired: z.number().int().nonnegative().optional(),
  neoProfsMaxPoints: z.number().nonnegative().optional(),
  neoProfsMaxBudget: z.number().nonnegative().optional(),
});

export const slipstreamRaceSchema = z.object({
  raceId: z.string(),
  raceSlug: z.string(),
  raceName: z.string(),
  raceDate: timestampSchema,
  pickDeadline: timestampSchema,
  status: z.enum(SLIPSTREAM_RACE_STATUSES),
  order: z.number().int().nonnegative(),
});

export type CountingRace = z.infer<typeof countingRaceSchema>;
export type AuctionPeriod = z.infer<typeof auctionPeriodSchema>;
export type SlipstreamRace = z.infer<typeof slipstreamRaceSchema>;
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/game-config-schemas.test.ts 2>&1 | tail -5
```

Expected: 13 tests PASS.

- [ ] **Step 5: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "game-configs"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "lib/game-configs/shared.ts" "tests/unit/game-config-schemas.test.ts"
git commit -m "feat: add shared game config sub-schemas (timestamp, auctionPeriod, slipstreamRace, countingRace)"
```

---

### Task 2: All 12 game config schemas + index

**Files:**
- Create: `lib/game-configs/auctioneer.ts`
- Create: `lib/game-configs/slipstream.ts`
- Create: `lib/game-configs/last-man-standing.ts`
- Create: `lib/game-configs/poisoned-cup.ts`
- Create: `lib/game-configs/nations-cup.ts`
- Create: `lib/game-configs/rising-stars.ts`
- Create: `lib/game-configs/country-roads.ts`
- Create: `lib/game-configs/worldtour-manager.ts`
- Create: `lib/game-configs/fan-flandrien.ts`
- Create: `lib/game-configs/full-grid.ts`
- Create: `lib/game-configs/marginal-gains.ts`
- Create: `lib/game-configs/f1-prediction.ts`
- Create: `lib/game-configs/index.ts`
- Test: `tests/unit/game-config-schemas.test.ts` (append the rest of the describe blocks)

**Context:**
- All 12 schemas are plain `z.object({...})` — no `gameType` discriminant inside the config. The discriminant lives at the `Game` level, not inside `config`. The `gameConfigSchemas` map in `index.ts` bridges them.
- `countingRaces` field appears in multiple configs as `(string | CountingRace)[]` — use `z.union([z.string(), countingRaceSchema])`
- `greenJerseyPoints: Record<number, number>` — JSON object keys are always strings, so use `z.record(z.number())` (validates `Record<string, number>`)
- `riderValues: Record<string, number>` — same: `z.record(z.number())`

- [ ] **Step 1: Add failing tests for all 12 schemas**

Append to `tests/unit/game-config-schemas.test.ts`:

```typescript
// append after existing tests
import {
  auctioneerConfigSchema,
  slipstreamConfigSchema,
  lastManStandingConfigSchema,
  poisonedCupConfigSchema,
  nationsCupConfigSchema,
  risingStarsConfigSchema,
  countryRoadsConfigSchema,
  worldTourManagerConfigSchema,
  fanFlandrienConfigSchema,
  fullGridConfigSchema,
  marginalGainsConfigSchema,
  f1PredictionConfigSchema,
  gameConfigSchemas,
} from '@/lib/game-configs';

describe('auctioneerConfigSchema', () => {
  const valid = {
    budget: 500,
    maxRiders: 20,
    auctionPeriods: [],
    auctionStatus: 'pending',
  };
  it('parses valid config', () => {
    expect(() => auctioneerConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects negative budget', () => {
    expect(() => auctioneerConfigSchema.parse({ ...valid, budget: -1 })).toThrow();
  });
  it('rejects missing auctionStatus', () => {
    const { auctionStatus: _, ...rest } = valid;
    expect(() => auctioneerConfigSchema.parse(rest)).toThrow();
  });
});

describe('slipstreamConfigSchema', () => {
  const valid = {
    allowReuse: false,
    countingRaces: [],
    penaltyMinutes: 10,
    pickDeadlineMinutes: 60,
    greenJerseyPoints: { '1': 10, '2': 8 },
  };
  it('parses valid config', () => {
    expect(() => slipstreamConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects allowReuse: true', () => {
    expect(() => slipstreamConfigSchema.parse({ ...valid, allowReuse: true })).toThrow();
  });
  it('rejects negative penaltyMinutes', () => {
    expect(() => slipstreamConfigSchema.parse({ ...valid, penaltyMinutes: -1 })).toThrow();
  });
});

describe('lastManStandingConfigSchema', () => {
  const valid = { budget: 1000, teamSize: 5, eliminationSchedule: 'per-stage' };
  it('parses valid config', () => {
    expect(() => lastManStandingConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid eliminationSchedule', () => {
    expect(() => lastManStandingConfigSchema.parse({ ...valid, eliminationSchedule: 'weekly' })).toThrow();
  });
});

describe('poisonedCupConfigSchema', () => {
  const valid = {
    teamSize: 8,
    budget: 1000,
    draftOrder: ['uid1', 'uid2'],
    currentDraftRound: 1,
    currentDraftPick: 'uid1',
    snakeDraft: true,
  };
  it('parses valid config', () => {
    expect(() => poisonedCupConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing snakeDraft', () => {
    const { snakeDraft: _, ...rest } = valid;
    expect(() => poisonedCupConfigSchema.parse(rest)).toThrow();
  });
});

describe('nationsCupConfigSchema', () => {
  const valid = { regions: ['BE', 'NL', 'FR'] };
  it('parses valid config', () => {
    expect(() => nationsCupConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects empty regions array', () => {
    // Empty array is valid (no min constraint) but missing regions is not
    expect(() => nationsCupConfigSchema.parse({})).toThrow();
  });
});

describe('risingStarsConfigSchema', () => {
  const valid = {
    teamSize: 5,
    draftOrder: ['uid1'],
    currentDraftRound: 0,
    currentDraftPick: 'uid1',
  };
  it('parses valid config', () => {
    expect(() => risingStarsConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects non-integer teamSize', () => {
    expect(() => risingStarsConfigSchema.parse({ ...valid, teamSize: 2.5 })).toThrow();
  });
});

describe('countryRoadsConfigSchema', () => {
  const valid = { poolCount: 3, pools: ['pool-a', 'pool-b', 'pool-c'] };
  it('parses valid config', () => {
    expect(() => countryRoadsConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects zero poolCount', () => {
    expect(() => countryRoadsConfigSchema.parse({ ...valid, poolCount: 0 })).toThrow();
  });
});

describe('worldTourManagerConfigSchema', () => {
  const valid = { budget: 2000, minRiders: 5, maxRiders: 10 };
  it('parses valid config', () => {
    expect(() => worldTourManagerConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing maxRiders', () => {
    const { maxRiders: _, ...rest } = valid;
    expect(() => worldTourManagerConfigSchema.parse(rest)).toThrow();
  });
});

describe('fanFlandrienConfigSchema', () => {
  const valid = { predictionsPerRace: 3, races: ['roubaix', 'flandres'] };
  it('parses valid config', () => {
    expect(() => fanFlandrienConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects zero predictionsPerRace', () => {
    expect(() => fanFlandrienConfigSchema.parse({ ...valid, predictionsPerRace: 0 })).toThrow();
  });
});

describe('fullGridConfigSchema', () => {
  const valid = {
    budget: 5000,
    maxRiders: 30,
    riderValues: { 'riderA': 100 },
    selectionStatus: 'open',
  };
  it('parses valid config', () => {
    expect(() => fullGridConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid selectionStatus', () => {
    expect(() => fullGridConfigSchema.parse({ ...valid, selectionStatus: 'pending' })).toThrow();
  });
  it('rejects negative riderValue', () => {
    expect(() => fullGridConfigSchema.parse({ ...valid, riderValues: { 'riderA': -1 } })).toThrow();
  });
});

describe('marginalGainsConfigSchema', () => {
  const valid = { teamSize: 6, currentYear: 2026 };
  it('parses valid config', () => {
    expect(() => marginalGainsConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing currentYear', () => {
    expect(() => marginalGainsConfigSchema.parse({ teamSize: 6 })).toThrow();
  });
});

describe('f1PredictionConfigSchema', () => {
  const valid = { season: 2026, registrationOpen: true };
  it('parses valid config', () => {
    expect(() => f1PredictionConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects non-positive season', () => {
    expect(() => f1PredictionConfigSchema.parse({ ...valid, season: 0 })).toThrow();
  });
  it('accepts optional registrationDeadline as ISO string', () => {
    expect(() =>
      f1PredictionConfigSchema.parse({ ...valid, registrationDeadline: '2026-03-01T00:00:00.000Z' })
    ).not.toThrow();
  });
});

describe('gameConfigSchemas', () => {
  it('has an entry for every game type', () => {
    const expectedTypes = [
      'auctioneer', 'slipstream', 'last-man-standing', 'poisoned-cup',
      'nations-cup', 'rising-stars', 'country-roads', 'worldtour-manager',
      'fan-flandrien', 'full-grid', 'marginal-gains', 'f1-prediction',
    ];
    for (const type of expectedTypes) {
      expect(gameConfigSchemas).toHaveProperty(type);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/game-config-schemas.test.ts 2>&1 | tail -5
```

Expected: FAIL — `@/lib/game-configs` not found.

- [ ] **Step 3: Create all 12 schema files**

**`lib/game-configs/auctioneer.ts`:**
```typescript
import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema, countingRaceSchema } from './shared';

export const auctioneerConfigSchema = z.object({
  budget: z.number().positive(),
  maxRiders: z.number().int().positive(),
  auctionPeriods: z.array(auctionPeriodSchema),
  auctionStatus: auctionStatusSchema,
  maxMinimumBid: z.number().positive().optional(),
  allowSharedRiders: z.boolean().optional(),
  maxOwnersPerRider: z.number().int().positive().optional(),
  countingRaces: z.array(z.union([z.string(), countingRaceSchema])).optional(),
  countingClassifications: z.array(z.string()).optional(),
});

export type AuctioneerConfigInput = z.infer<typeof auctioneerConfigSchema>;
```

**`lib/game-configs/slipstream.ts`:**
```typescript
import { z } from 'zod';
import { slipstreamRaceSchema } from './shared';

export const slipstreamConfigSchema = z.object({
  allowReuse: z.literal(false),
  countingRaces: z.array(slipstreamRaceSchema),
  penaltyMinutes: z.number().nonnegative(),
  pickDeadlineMinutes: z.number().nonnegative(),
  // JSON object keys are always strings; Record<number, number> at TS level
  greenJerseyPoints: z.record(z.number().nonnegative()),
});

export type SlipstreamConfigInput = z.infer<typeof slipstreamConfigSchema>;
```

**`lib/game-configs/last-man-standing.ts`:**
```typescript
import { z } from 'zod';

export const lastManStandingConfigSchema = z.object({
  budget: z.number().positive(),
  teamSize: z.number().int().positive(),
  eliminationSchedule: z.enum(['per-stage', 'per-race']),
});

export type LastManStandingConfigInput = z.infer<typeof lastManStandingConfigSchema>;
```

**`lib/game-configs/poisoned-cup.ts`:**
```typescript
import { z } from 'zod';

export const poisonedCupConfigSchema = z.object({
  teamSize: z.number().int().positive(),
  budget: z.number().positive(),
  draftOrder: z.array(z.string()),
  currentDraftRound: z.number().int().nonnegative(),
  currentDraftPick: z.string(),
  snakeDraft: z.boolean(),
});

export type PoisonedCupConfigInput = z.infer<typeof poisonedCupConfigSchema>;
```

**`lib/game-configs/nations-cup.ts`:**
```typescript
import { z } from 'zod';

export const nationsCupConfigSchema = z.object({
  regions: z.array(z.string().min(1)),
  budgetPerRegion: z.number().positive().optional(),
});

export type NationsCupConfigInput = z.infer<typeof nationsCupConfigSchema>;
```

**`lib/game-configs/rising-stars.ts`:**
```typescript
import { z } from 'zod';

export const risingStarsConfigSchema = z.object({
  teamSize: z.number().int().positive(),
  draftOrder: z.array(z.string()),
  currentDraftRound: z.number().int().nonnegative(),
  currentDraftPick: z.string(),
});

export type RisingStarsConfigInput = z.infer<typeof risingStarsConfigSchema>;
```

**`lib/game-configs/country-roads.ts`:**
```typescript
import { z } from 'zod';

export const countryRoadsConfigSchema = z.object({
  poolCount: z.number().int().positive(),
  pools: z.array(z.string()),
});

export type CountryRoadsConfigInput = z.infer<typeof countryRoadsConfigSchema>;
```

**`lib/game-configs/worldtour-manager.ts`:**
```typescript
import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema } from './shared';

export const worldTourManagerConfigSchema = z.object({
  budget: z.number().positive(),
  minRiders: z.number().int().positive(),
  maxRiders: z.number().int().positive(),
  minNeoPros: z.number().int().nonnegative().optional(),
  maxNeoProPoints: z.number().nonnegative().optional(),
  maxNeoProAge: z.number().int().positive().optional(),
  auctionPeriods: z.array(auctionPeriodSchema).optional(),
  auctionStatus: auctionStatusSchema.optional(),
});

export type WorldTourManagerConfigInput = z.infer<typeof worldTourManagerConfigSchema>;
```

**`lib/game-configs/fan-flandrien.ts`:**
```typescript
import { z } from 'zod';

export const fanFlandrienConfigSchema = z.object({
  predictionsPerRace: z.number().int().positive(),
  races: z.array(z.string()),
});

export type FanFlandrienConfigInput = z.infer<typeof fanFlandrienConfigSchema>;
```

**`lib/game-configs/full-grid.ts`:**
```typescript
import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema, countingRaceSchema } from './shared';

export const fullGridConfigSchema = z.object({
  budget: z.number().positive(),
  maxRiders: z.number().int().positive(),
  riderValues: z.record(z.number().nonnegative()),
  selectionStatus: z.enum(['open', 'closed']),
  countingRaces: z.array(z.union([z.string(), countingRaceSchema])).optional(),
  auctionPeriods: z.array(auctionPeriodSchema).optional(),
  auctionStatus: auctionStatusSchema.optional(),
});

export type FullGridConfigInput = z.infer<typeof fullGridConfigSchema>;
```

**`lib/game-configs/marginal-gains.ts`:**
```typescript
import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema } from './shared';

export const marginalGainsConfigSchema = z.object({
  teamSize: z.number().int().positive(),
  currentYear: z.number().int().positive(),
  auctionPeriods: z.array(auctionPeriodSchema).optional(),
  auctionStatus: auctionStatusSchema.optional(),
});

export type MarginalGainsConfigInput = z.infer<typeof marginalGainsConfigSchema>;
```

**`lib/game-configs/f1-prediction.ts`:**
```typescript
import { z } from 'zod';
import { timestampSchema } from './shared';

export const f1PredictionConfigSchema = z.object({
  season: z.number().int().positive(),
  registrationOpen: z.boolean(),
  registrationDeadline: timestampSchema.optional(),
  maxParticipants: z.number().int().positive().optional(),
});

export type F1PredictionConfigInput = z.infer<typeof f1PredictionConfigSchema>;
```

- [ ] **Step 4: Create `lib/game-configs/index.ts`**

```typescript
// lib/game-configs/index.ts
import { z } from 'zod';
import { GAME_TYPES } from '@/lib/types/games';

export * from './shared';
export * from './auctioneer';
export * from './slipstream';
export * from './last-man-standing';
export * from './poisoned-cup';
export * from './nations-cup';
export * from './rising-stars';
export * from './country-roads';
export * from './worldtour-manager';
export * from './fan-flandrien';
export * from './full-grid';
export * from './marginal-gains';
export * from './f1-prediction';

import { auctioneerConfigSchema } from './auctioneer';
import { slipstreamConfigSchema } from './slipstream';
import { lastManStandingConfigSchema } from './last-man-standing';
import { poisonedCupConfigSchema } from './poisoned-cup';
import { nationsCupConfigSchema } from './nations-cup';
import { risingStarsConfigSchema } from './rising-stars';
import { countryRoadsConfigSchema } from './country-roads';
import { worldTourManagerConfigSchema } from './worldtour-manager';
import { fanFlandrienConfigSchema } from './fan-flandrien';
import { fullGridConfigSchema } from './full-grid';
import { marginalGainsConfigSchema } from './marginal-gains';
import { f1PredictionConfigSchema } from './f1-prediction';

/**
 * Lookup map: game type → Zod schema for that game's config.
 * Used in createGameSchema to validate `config` based on the sibling `gameType` field.
 */
export const gameConfigSchemas = {
  'auctioneer': auctioneerConfigSchema,
  'slipstream': slipstreamConfigSchema,
  'last-man-standing': lastManStandingConfigSchema,
  'poisoned-cup': poisonedCupConfigSchema,
  'nations-cup': nationsCupConfigSchema,
  'rising-stars': risingStarsConfigSchema,
  'country-roads': countryRoadsConfigSchema,
  'worldtour-manager': worldTourManagerConfigSchema,
  'fan-flandrien': fanFlandrienConfigSchema,
  'full-grid': fullGridConfigSchema,
  'marginal-gains': marginalGainsConfigSchema,
  'f1-prediction': f1PredictionConfigSchema,
} satisfies Record<typeof GAME_TYPES[number], z.ZodSchema>;

export type GameConfigInput =
  | z.infer<typeof auctioneerConfigSchema>
  | z.infer<typeof slipstreamConfigSchema>
  | z.infer<typeof lastManStandingConfigSchema>
  | z.infer<typeof poisonedCupConfigSchema>
  | z.infer<typeof nationsCupConfigSchema>
  | z.infer<typeof risingStarsConfigSchema>
  | z.infer<typeof countryRoadsConfigSchema>
  | z.infer<typeof worldTourManagerConfigSchema>
  | z.infer<typeof fanFlandrienConfigSchema>
  | z.infer<typeof fullGridConfigSchema>
  | z.infer<typeof marginalGainsConfigSchema>
  | z.infer<typeof f1PredictionConfigSchema>;
```

- [ ] **Step 5: Run tests — all should pass**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/game-config-schemas.test.ts 2>&1 | tail -5
```

Expected: all tests PASS (roughly 50 tests total across all describes).

- [ ] **Step 6: Verify TypeScript — no errors in new files**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "game-configs"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add lib/game-configs/ tests/unit/game-config-schemas.test.ts
git commit -m "feat: add Zod schemas for all 12 game config types"
```

---

## Chunk 2: Fix the validation bug

---

### Task 3: Fix `config: z.any()` in API validation schemas

**Files:**
- Modify: `lib/validation/schemas.ts`
- Test: `tests/unit/game-config-schemas.test.ts` (append integration tests)

**Context:**
- `createGameSchema` at `lib/validation/schemas.ts:24` — has `config: z.any()` and includes `gameType: gameTypeSchema`
- `updateGameSchema` at `lib/validation/schemas.ts:45` — has `config: z.any().optional()` and does NOT include `gameType`
- For `createGameSchema`: use `.superRefine()` to validate `config` against the schema for the given `gameType`
- For `updateGameSchema`: change `z.any().optional()` → `z.unknown().optional()` (stricter TypeScript type, no structural validation since `gameType` is not part of updates)
- `z.unknown()` forces callers to narrow the type before use — better than `z.any()` which silently allows everything

**Read `lib/validation/schemas.ts` before editing it.**

- [ ] **Step 1: Add failing integration tests**

Append to `tests/unit/game-config-schemas.test.ts`:

```typescript
// append at end of file
import { createGameSchema } from '@/lib/validation/schemas';

describe('createGameSchema config validation', () => {
  const base = {
    adminUserId: 'admin1',
    name: 'Test Game',
    gameType: 'auctioneer',
    year: 2026,
    raceType: 'classics',   // RACE_TYPES = ['season', 'grand-tour', 'classics', 'single-race']
    bidding: false,
  };

  it('accepts valid auctioneer config', () => {
    const config = {
      budget: 500,
      maxRiders: 20,
      auctionPeriods: [],
      auctionStatus: 'pending',
    };
    expect(() => createGameSchema.parse({ ...base, config })).not.toThrow();
  });

  it('rejects invalid auctioneer config — negative budget', () => {
    const config = { budget: -1, maxRiders: 20, auctionPeriods: [], auctionStatus: 'pending' };
    expect(() => createGameSchema.parse({ ...base, config })).toThrow();
  });

  it('rejects config missing required fields for gameType', () => {
    expect(() => createGameSchema.parse({ ...base, config: {} })).toThrow();
  });

  it('accepts valid last-man-standing config', () => {
    const config = { budget: 1000, teamSize: 5, eliminationSchedule: 'per-stage' };
    expect(() =>
      createGameSchema.parse({ ...base, gameType: 'last-man-standing', config })
    ).not.toThrow();
  });

  it('rejects invalid last-man-standing config', () => {
    const config = { budget: 1000, teamSize: 5, eliminationSchedule: 'invalid-value' };
    expect(() =>
      createGameSchema.parse({ ...base, gameType: 'last-man-standing', config })
    ).toThrow();
  });

  it('surfaces config errors at config.* path (not root)', () => {
    const config = { budget: -1, maxRiders: 20, auctionPeriods: [], auctionStatus: 'pending' };
    const result = createGameSchema.safeParse({ ...base, config });
    expect(result.success).toBe(false);
    if (!result.success) {
      const configErrors = result.error.errors.filter(e => e.path[0] === 'config');
      expect(configErrors.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/game-config-schemas.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|config validation"
```

Expected: the `createGameSchema config validation` describe block fails — currently `config: z.any()` accepts anything.

- [ ] **Step 3: Read `lib/validation/schemas.ts`**

Read the full file before editing. Note:
- The exact line where `config: z.any()` appears in `createGameSchema`
- The exact line where `config: z.any().optional()` appears in `updateGameSchema`
- The existing imports at the top (to know where to add the new import)

- [ ] **Step 4: Modify `lib/validation/schemas.ts`**

Add import at the top (after existing imports):
```typescript
import { gameConfigSchemas } from '@/lib/game-configs';
```

In `createGameSchema`, change `config: z.any()` to `config: z.unknown()` and chain `.superRefine()` onto the schema:

```typescript
// Before:
export const createGameSchema = z.object({
  adminUserId: z.string().min(1),
  name: z.string().min(1),
  gameType: gameTypeSchema,
  year: z.number().int().min(2020).max(2100),
  raceType: raceTypeSchema,
  raceSlug: z.string().optional(),
  status: gameStatusSchema.optional(),
  registrationOpenDate: z.string().datetime().optional(),
  registrationCloseDate: z.string().datetime().optional(),
  division: z.string().optional(),
  divisionLevel: z.number().int().positive().optional(),
  divisionCount: z.number().int().positive().optional(),
  maxPlayers: z.number().int().positive().optional(),
  minPlayers: z.number().int().positive().optional(),
  eligibleTeams: z.array(z.string()).optional(),
  eligibleRiders: z.array(z.string()).optional(),
  bidding: z.boolean(),
  config: z.any(),
});

// After:
export const createGameSchema = z.object({
  adminUserId: z.string().min(1),
  name: z.string().min(1),
  gameType: gameTypeSchema,
  year: z.number().int().min(2020).max(2100),
  raceType: raceTypeSchema,
  raceSlug: z.string().optional(),
  status: gameStatusSchema.optional(),
  registrationOpenDate: z.string().datetime().optional(),
  registrationCloseDate: z.string().datetime().optional(),
  division: z.string().optional(),
  divisionLevel: z.number().int().positive().optional(),
  divisionCount: z.number().int().positive().optional(),
  maxPlayers: z.number().int().positive().optional(),
  minPlayers: z.number().int().positive().optional(),
  eligibleTeams: z.array(z.string()).optional(),
  eligibleRiders: z.array(z.string()).optional(),
  bidding: z.boolean(),
  config: z.unknown(),
}).superRefine((data, ctx) => {
  const schema = gameConfigSchemas[data.gameType as keyof typeof gameConfigSchemas];
  if (!schema) return;
  const result = schema.safeParse(data.config);
  if (!result.success) {
    for (const err of result.error.errors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err.message,
        path: ['config', ...err.path],
      });
    }
  }
});
```

In `updateGameSchema`, change `config: z.any().optional()` to `config: z.unknown().optional()`:
```typescript
// Before:
config: z.any().optional(),

// After (no superRefine — gameType not present in update schema):
config: z.unknown().optional(),
```

**Note:** Do NOT modify any other fields in either schema. The existing `.passthrough()` on `updateGameSchema` stays as-is.

- [ ] **Step 5: Run tests — all should pass**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/game-config-schemas.test.ts 2>&1 | tail -5
```

Expected: all tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run 2>&1 | tail -5
```

Expected: all existing tests still pass.

- [ ] **Step 7: Verify TypeScript — no new errors introduced**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output, or only pre-existing errors that were present before this change. If new errors appear referencing `config` typed as `unknown` (e.g. `Type 'unknown' is not assignable to 'AuctioneerConfig'`), the calling code is relying on the old `any` type — fix those by narrowing the type at the call site or casting appropriately.

- [ ] **Step 8: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "lib/validation/schemas.ts" "tests/unit/game-config-schemas.test.ts"
git commit -m "fix: replace config: z.any() with per-gameType Zod validation in createGameSchema"
```

---

## Notes for implementor

- **`lib/types/games.ts` is NOT modified** in this plan. The existing `AuctioneerConfig`, `SlipstreamConfig`, etc. interfaces remain untouched. The new `*ConfigInput` types (inferred from Zod schemas) are separate and live in `lib/game-configs/`. Type guard replacement is a follow-up.
- **`raceType` values**: Valid values are `['season', 'grand-tour', 'classics', 'single-race']` (from `lib/types/games.ts`). The test uses `'classics'`.
- **`updateGameSchema` limitation**: Config validation is not added to `updateGameSchema` because `gameType` is not part of that schema. This can be addressed in a follow-up by adding `gameType: gameTypeSchema.optional()` to `updateGameSchema` and a conditional `superRefine`.
- **Client-only imports**: Only import `z.infer<>` types (compile-time erased) in client components — not schema objects (runtime Zod code). API routes and server-side code can import schemas freely.
- **`satisfies` on `gameConfigSchemas`**: If TypeScript complains about the `satisfies Record<typeof GAME_TYPES[number], z.ZodSchema>` constraint, the error will tell you which game type is missing. Fix by ensuring all 12 entries are present.
