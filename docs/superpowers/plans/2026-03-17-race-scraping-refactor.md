# Race Scraping Refactor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all race configuration (totalStages, hasPrologue, isSingleDay, excludeFromScraping) from hardcoded TypeScript constants into Firestore, fix the cronjob stage calculation, fix the GC Details panel bug, unify exclusion logic into a shared utility, and add an automated race calendar cron.

**Architecture:** Shared types in `lib/types/race-status.ts` and shared filter logic in `lib/utils/race-filters.ts` provide the foundation. A one-time migration endpoint populates Firestore from the existing hardcoded lists. Once data is in Firestore, the race-status API and scrape cron read config from the database. The cron uses the `stages` subcollection for exact stage-date matching before falling back to date arithmetic.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Firestore (firebase-admin), Vitest, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-03-17-race-scraping-refactor-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/types/race-status.ts` | Shared `StageStatus`, `RaceStatus`, `RaceStatusResponse` types |
| Create | `lib/utils/race-filters.ts` | Shared `shouldExcludeRace()` utility |
| Create | `tests/unit/race-filters.test.ts` | Unit tests for the filter utility |
| Modify | `app/api/admin/stage-status/route.ts` | Fix GC Details empty-riders bug |
| Create | `app/api/admin/race-config/route.ts` | Update 4 config fields per race |
| Create | `app/api/admin/migrate-race-config/route.ts` | One-time migration from hardcoded lists to Firestore |
| Modify | `app/api/admin/race-status/route.ts` | Remove hardcoded lists, read config from Firestore |
| Modify | `components/admin/RaceManagementDashboard.tsx` | Add Config form to each race card |
| Modify | `app/api/cron/scrape-todays-races/route.ts` | Fix stage calc, read config from Firestore |
| Create | `app/api/cron/scrape-race-calendar/route.ts` | Calendar auto-scrape cron |
| Modify | `vercel.json` | Add new cron schedule |

---

## Chunk 1: Foundation — Shared Types and Filter Utility

### Task 1: Create shared types file

**Files:**
- Create: `lib/types/race-status.ts`

- [ ] **Step 1: Create `lib/types/race-status.ts`**

```typescript
// lib/types/race-status.ts
// Shared types used by race-status API and admin dashboard.
// No server-only imports — safe to use in 'use client' components.

export interface StageStatus {
  stageNumber: number | string;
  status: 'scraped' | 'pending' | 'failed' | 'empty';
  scrapedAt: string | null;
  riderCount: number;
  hasValidationErrors: boolean;
  validationWarnings: number;
  docId: string;
  stageDate: string | null;
}

export interface RaceStatus {
  raceSlug: string;
  raceName: string;
  year: number;
  totalStages: number;
  scrapedStages: number;
  failedStages: number;
  pendingStages: number;
  hasStartlist: boolean;
  startlistRiderCount: number;
  lastScrapedAt: string | null;
  hasValidationErrors: boolean;
  isSingleDay: boolean;
  hasPrologue: boolean;
  stages: StageStatus[];
  startDate: string | null;
  endDate: string | null;
  raceStatus: 'upcoming' | 'in-progress' | 'finished' | 'unknown';
  classification: string | null;
  excludeFromScraping: boolean;
}

export interface RaceStatusResponse {
  races: RaceStatus[];
  summary: {
    totalRaces: number;
    racesWithData: number;
    totalStagesScraped: number;
    totalStagesFailed: number;
    validationErrors: number;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "oracle-games" && yarn build 2>&1 | head -30
```

Expected: No errors related to `lib/types/race-status.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/types/race-status.ts
git commit -m "feat: add shared race-status types"
```

---

### Task 2: Create shared race filter utility

**Files:**
- Create: `lib/utils/race-filters.ts`
- Create: `tests/unit/race-filters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/race-filters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldExcludeRace } from '@/lib/utils/race-filters';

describe('shouldExcludeRace', () => {
  describe('explicit excludeFromScraping flag', () => {
    it('returns true when excludeFromScraping is true', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT', 'tour-de-france', true)).toBe(true);
    });

    it('returns false for normal race when flag is false', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT', 'tour-de-france', false)).toBe(false);
    });
  });

  describe('classification-based exclusion', () => {
    it('returns true for WWT classification (Women WorldTour)', () => {
      expect(shouldExcludeRace('Tour Femmes', '2.WWT', 'tour-femmes')).toBe(true);
    });

    it('returns true for WE classification (Women Elite)', () => {
      expect(shouldExcludeRace('Some Race', '1.WE', 'some-race')).toBe(true);
    });

    it('returns true for MU classification (Men Under-23)', () => {
      expect(shouldExcludeRace('Giro U23', '2.MU', 'giro-u23')).toBe(true);
    });

    it('returns true for MJ classification (Men Junior)', () => {
      expect(shouldExcludeRace('Race MJ', '1.MJ', 'race-mj')).toBe(true);
    });

    it('returns true for WU classification (Women Under-23)', () => {
      expect(shouldExcludeRace('Race WU', '1.WU', 'race-wu')).toBe(true);
    });

    it('returns true for WJ classification (Women Junior)', () => {
      expect(shouldExcludeRace('Race WJ', '1.WJ', 'race-wj')).toBe(true);
    });

    it('returns false for normal 2.UWT race', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT', 'tour-de-france')).toBe(false);
    });

    it('returns false for 1.Pro race', () => {
      expect(shouldExcludeRace('Paris-Tours', '1.Pro', 'paris-tours')).toBe(false);
    });

    it('handles null classification', () => {
      expect(shouldExcludeRace('Tour de France', null, 'tour-de-france')).toBe(false);
    });
  });

  describe('name-based exclusion (women keywords)', () => {
    it('returns true for WOMEN in name', () => {
      expect(shouldExcludeRace('Tour of Women', '2.1', 'tour-of-women')).toBe(true);
    });

    it('returns true for DAMES in name', () => {
      expect(shouldExcludeRace('Omloop der Dames', '1.1', 'omloop-der-dames')).toBe(true);
    });

    it('returns true for LADIES in name', () => {
      expect(shouldExcludeRace('Ladies Tour', '2.1', 'ladies-tour')).toBe(true);
    });

    it('returns true for FEMMES in name', () => {
      expect(shouldExcludeRace('Tour des Femmes', '2.Pro', 'tour-des-femmes')).toBe(true);
    });

    it('returns true for women keyword in slug', () => {
      expect(shouldExcludeRace('Some Race', '1.1', 'some-race-women')).toBe(true);
    });
  });

  describe('word boundary matching for classification codes in name', () => {
    it('does not match MU inside a longer word (AMU)', () => {
      // "AMUNDSEN" contains "MU" but should not be flagged
      expect(shouldExcludeRace('Grand Prix Amundsen', '1.1', 'gp-amundsen')).toBe(false);
    });

    it('matches MU as standalone token in name (neutral classification)', () => {
      // Use a neutral classification to isolate the word-boundary name check
      expect(shouldExcludeRace('Giro MU 2025', '2.1', 'giro-mu-2025')).toBe(true);
    });
  });

  describe('optional arguments', () => {
    it('works without slug argument', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT')).toBe(false);
    });

    it('works without slug and excludeFromScraping arguments', () => {
      expect(shouldExcludeRace('Tour Femmes', '2.WWT')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "oracle-games" && yarn test tests/unit/race-filters.test.ts 2>&1
```

Expected: FAIL — `Cannot find module '@/lib/utils/race-filters'`

- [ ] **Step 3: Create `lib/utils/race-filters.ts`**

```typescript
// lib/utils/race-filters.ts
// Shared race exclusion logic used by race-status API and scrape crons.

const UNWANTED_CLASSIFICATIONS = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'] as const;

const WOMEN_NAME_KEYWORDS = [
  'WOMEN',
  'WOMAN',
  'FEMINA',
  'FEMINAS',
  'FEMENINA',
  'FEMENINO',
  'FEMME',
  'FEMMES',
  'DAMES',
  'LADIES',
  'FEMALE',
] as const;

/**
 * Returns true if a race should be excluded from scraping and admin display.
 *
 * @param name - Race display name
 * @param classification - PCS classification string (e.g. "2.UWT", "1.WE")
 * @param slug - Race slug (optional)
 * @param excludeFromScraping - Explicit Firestore flag; if true, always exclude
 */
export function shouldExcludeRace(
  name: string,
  classification: string | null,
  slug?: string,
  excludeFromScraping?: boolean,
): boolean {
  if (excludeFromScraping === true) return true;

  const cls = (classification || '').trim();
  const nameUpper = name.toUpperCase();
  const clsUpper = cls.toUpperCase();
  const slugUpper = (slug || '').toUpperCase();

  // Word-boundary check: MU inside "AMUNDSEN" should NOT match
  const hasUnwantedClassToken = (value: string): boolean =>
    UNWANTED_CLASSIFICATIONS.some(code => {
      const pattern = new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`);
      return pattern.test(value);
    });

  const hasUnwantedInName = hasUnwantedClassToken(nameUpper);
  // WWT is already in UNWANTED_CLASSIFICATIONS so no separate check is needed
  const hasUnwantedInClassification = UNWANTED_CLASSIFICATIONS.some(
    unwanted => clsUpper.includes(unwanted),
  );
  const hasWomenInName = WOMEN_NAME_KEYWORDS.some(k => nameUpper.includes(k));
  const hasWomenInSlug = WOMEN_NAME_KEYWORDS.some(k => slugUpper.includes(k));

  return (
    hasUnwantedInName ||
    hasUnwantedInClassification ||
    hasWomenInName ||
    hasWomenInSlug
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "oracle-games" && yarn test tests/unit/race-filters.test.ts 2>&1
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/race-filters.ts tests/unit/race-filters.test.ts
git commit -m "feat: add shared shouldExcludeRace utility with tests"
```

---

## Chunk 2: GC Details Bug Fix

### Task 3: Fix empty sampleRiders for General Classification

The `loadDetails` call for a GC stage hits `/api/admin/stage-status?type=tour-gc`. The `sampleRiders` array comes out empty because the `place` field extraction only checks `row.place` but GC documents may use `row.rank` or `row.position`.

**Files:**
- Modify: `app/api/admin/stage-status/route.ts:160-185`

- [ ] **Step 1: Open the file and locate the sampleRiders loop**

In `app/api/admin/stage-status/route.ts`, find the loop starting at the comment `// Extract sample riders` (around line 159). The current `place` extraction is:

```typescript
const placeRaw = row.place;
```

- [ ] **Step 2: Update `place` extraction to check multiple field names**

Replace the `place` extraction lines (from `const placeRaw` through the `if (!Number.isFinite(place) || place <= 0) return;` guard):

Old:
```typescript
    const placeRaw = row.place;
    const place = typeof placeRaw === 'number' ? placeRaw : Number(placeRaw);
    if (!Number.isFinite(place) || place <= 0) return;
```

New:
```typescript
    // GC documents may use 'rank' or 'position' instead of 'place'.
    // Note: before deploying, verify the actual field name by reading a real
    // 'tour-gc' Firestore document. Add additional fallbacks if needed.
    const placeRaw = row.place ?? row.rank ?? row.position;
    const place = typeof placeRaw === 'number' ? placeRaw : Number(placeRaw);
    if (!Number.isFinite(place) || place <= 0) return;
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
cd "oracle-games" && yarn build 2>&1 | grep -E "error|Error" | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/stage-status/route.ts
git commit -m "fix: show riders in GC Details panel by checking rank/position fields"
```

---

## Chunk 3: Race Config API and Migration Endpoint

### Task 4: Create race-config API

**Files:**
- Create: `app/api/admin/race-config/route.ts`

- [ ] **Step 1: Create `app/api/admin/race-config/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/race-config
 * Updates the four editable config fields for a single race document.
 *
 * Body: { userId, raceId, totalStages, hasPrologue, isSingleDay, excludeFromScraping }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, raceId, totalStages, hasPrologue, isSingleDay, excludeFromScraping } = body;

    if (!userId || !raceId) {
      return NextResponse.json({ error: 'userId and raceId are required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    // Build only the fields that were explicitly provided
    const update: Record<string, unknown> = {};
    if (typeof totalStages === 'number') update.totalStages = totalStages;
    if (typeof hasPrologue === 'boolean') update.hasPrologue = hasPrologue;
    if (typeof isSingleDay === 'boolean') update.isSingleDay = isSingleDay;
    if (typeof excludeFromScraping === 'boolean') update.excludeFromScraping = excludeFromScraping;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    update.configUpdatedAt = new Date().toISOString();

    await db.collection('races').doc(raceId).set(update, { merge: true });

    return NextResponse.json({ success: true, raceId, updated: update });
  } catch (error) {
    console.error('[race-config] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update race config', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Test manually**

Start dev server (`yarn dev`) and call the endpoint from the browser console or curl:

```bash
curl -X POST http://localhost:3210/api/admin/race-config \
  -H "Content-Type: application/json" \
  -d '{"userId":"<your-admin-uid>","raceId":"tour-de-france_2026","totalStages":21,"hasPrologue":false,"isSingleDay":false,"excludeFromScraping":false}'
```

Expected: `{ "success": true, "raceId": "tour-de-france_2026", "updated": { ... } }`

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/race-config/route.ts
git commit -m "feat: add race-config API to update totalStages/hasPrologue/isSingleDay/excludeFromScraping"
```

---

### Task 5: Create migration endpoint

This is a one-time endpoint that reads all Firestore race documents and writes the four config fields where they are absent. It embeds a snapshot of the hardcoded data that currently lives in `race-status/route.ts`.

**Files:**
- Create: `app/api/admin/migrate-race-config/route.ts`

- [ ] **Step 1: Create `app/api/admin/migrate-race-config/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/migrate-race-config
 *
 * One-time migration: reads all race documents for a given year and writes
 * totalStages, hasPrologue, isSingleDay, excludeFromScraping if not already set.
 *
 * Safe to run multiple times — only writes absent fields.
 * Body: { userId, year }
 */

// Snapshot of KNOWN_RACE_STAGES from race-status/route.ts
const KNOWN_RACE_STAGES: Record<string, number> = {
  'tour-de-france': 21,
  'giro-d-italia': 21,
  'vuelta-a-espana': 21,
  'paris-nice': 8,
  'tirreno-adriatico': 7,
  'volta-a-catalunya': 7,
  'dauphine': 8,
  'tour-de-suisse': 8,
  'tour-de-pologne': 7,
  'renewi-tour': 5,
  'deutschland-tour': 4,
  'tour-down-under': 6,
  'tour-de-romandie': 5,
  'tour-of-the-alps': 5,
  'itzulia-basque-country': 6,
  'tour-of-oman': 5,
  'uae-tour': 7,
  'arctic-race-of-norway': 4,
  'czech-tour': 4,
  'alula-tour': 5,
  '4-jours-de-dunkerque': 5,
  'dookola-mazowsza': 4,
  'kreiz-breizh-elites': 3,
  'acht-van-bladel2': 3,
  'anna-vasa-race': 3,
  'course-cycliste-de-solidarnosc': 4,
  'course-de-la-paix-u23': 4,
  'cote-d-or-classic-juniors': 2,
  'trofej-umag': 1,
  'tour-of-albania': 5,
  'tour-of-turkey': 8,
  'tour-de-langkawi': 8,
  'tour-of-guangxi': 6,
  'tour-of-britain': 6,
  'volta-a-portugal-em-bicicleta': 11,
  'tour-of-norway': 4,
  'tour-of-austria': 5,
  'tour-of-denmark': 5,
  'tour-of-slovenia': 5,
  'tour-of-sweden': 3,
  'tour-of-belgium': 5,
  'vuelta-a-andalucia-ruta-ciclista-del-sol': 5,
  'région-pays-de-la-loire-tour': 4,
  'tour-of-hainan': 5,
  'presidential-cycling-tour-of-turkiye': 8,
  'tour-de-hongrie': 5,
  'boucles-de-la-mayenne-crédit-mutuel': 3,
  'ethias-tour-de-wallonie': 5,
  'baloise-belgium-tour': 5,
  'vuelta-al-tachira': 10,
  'pune-grand-tour': 4,
  'tour-of-sharjah': 5,
  'tour-de-taiwan': 5,
  'the-princess-maha-chakri-sirindhorns-cup-tour-of-thailand': 6,
  'bakukhankendi-azerbaijan-cycling-race': 5,
  'flèche-du-sud': 5,
  'grande-prémio-internacional-beiras-e-serra-da-estrela': 3,
  'la-route-doccitanie-cic': 4,
  'tour-of-istanbul': 3,
  'il-giro-dabruzzo': 4,
  'tour-of-holland': 5,
  'jamaica-international-cycling-classic': 3,
  'tour-dalgérie': 10,
  'tour-du-bénin': 6,
  'tour-de-mauritanie': 7,
  'tour-alsace': 5,
  'tour-of-kosovo': 3,
  'tour-of-bulgaria': 5,
  'tour-of-romania': 5,
  'tour-darménie': 4,
  'tour-de-serbie': 4,
  'giro-della-valle-daosta-mont-blanc': 5,
  'giro-del-trentino': 5,
  'tour-de-luxembourg': 5,
  'tour-de-normandie': 6,
  'tour-du-var': 3,
  'vuelta-a-burgos': 5,
  'vuelta-a-castilla-y-leon': 3,
  'vuelta-al-pais-vasco': 6,
  'vuelta-a-uruguay': 8,
  'vuelta-a-venezuela': 8,
  'etoile-de-besseges': 5,
  'volta-comunitat-valenciana': 5,
  'setmana-ciclista-valenciana': 4,
  'tour-cycliste-international-la-provence': 3,
  'ruta-del-sol': 5,
  'volta-ao-algarve': 5,
  'tour-of-rwanda': 8,
  'giro-di-sardegna': 5,
  'istrian-spring-tour': 3,
  'circuit-des-ardennes': 3,
  'ronde-de-loise': 5,
  'tour-of-malopolska': 3,
  'course-cycliste-de-solidarnosc-et-des-champions-olympiques': 5,
  'tour-of-rhodes': 4,
};

// Snapshot of RACES_WITH_PROLOGUE
const RACES_WITH_PROLOGUE = new Set([
  'tour-down-under',
  'tour-de-romandie',
  'tour-de-suisse',
  'pune-grand-tour',
  'santos-tour-down-under',
  'deutschland-tour',
]);

// Snapshot of KNOWN_SINGLE_DAY_RACES
const KNOWN_SINGLE_DAY_RACES = new Set([
  'milano-sanremo', 'ronde-van-vlaanderen', 'paris-roubaix',
  'liege-bastogne-liege', 'il-lombardia', 'amstel-gold-race',
  'la-flèche-wallonne', 'strade-bianche', 'gent-wevelgem',
  'omloop-het-nieuwsblad', 'kuurne-brussel-kuurne', 'dwars-door-vlaanderen',
  'eschborn-frankfurt', 'cyclassics-hamburg', 'gp-quebec', 'gp-montreal',
  'classic-brugge-de-panne', 'copenhagen-sprint', 'world-championship',
  'world-championship-itt', 'world-championship-me', 'classique-dunkerque',
  'coppa-bernocchi', 'antwerp-port-epic', 'a-travers-les-hauts-de-france',
  'alpes-gresivaudan-classic', 'andorra-morabanc-classica',
  'boucles-de-l-aulne', 'cholet-pays-de-loire', 'chrono-des-nations',
  'circuit-de-wallonie', 'circuito-de-getxo', 'clasica-jaen-paraiso-interior',
  'clasica-terres-de-l-ebre', 'circuit-des-xi-villes',
  'grand-prix-longitudinal-del-norte', 'grote-prijs-jean-pierre-monsere',
  'heist-op-den-berg', 'la-classique-morbihan', 'la-classique-puisaye-forterre',
  'la-poly-normande', 'la-roue-tourangelle', 'la-route-des-geants',
  'classic-grand-besancon-doubs', 'classic-var', 'classica-camp-de-morvedre',
  'coppa-agostoni', 'coppa-montes-gran-premio-della-resistenza',
  'ruta-de-la-ceramica-gran-premio-castellon', 'trofeo-calvia', 'deia-trophy',
  'trofeo-pollenca-port-d-andratx', 'trofeo-ses-salines-felanitx',
  'gp-d-ouverture', 'great-ocean-road-race', 'trofeo-palma', 'muscat-classic',
  'alanya-cup', 'albani-classic-fyen-rundt', 'arno-wallaard-memorial',
  'beskid-classic', 'boucle-de-l-artois', 'circuito-del-porto-trofeo-arvedi',
  'clasica-pascua', 'classic-annemasse-agglo', 'classic-loire-atlantique',
  'classique-of-mauritius', 'de-hive-slag-om-woensdrecht', 'dhofar-classic',
  'dorpenomloop-rucphen', 'due-giorni-marchigiana-gp-santa-rita',
  'dwars-door-wingene', 'east-midlands-international-cicle-classic',
  'fleche-ardennaise', 'giro-del-medio-brenta', 'gp-adria-mobil',
  'gp-antalya', 'gp-brda-collio', 'gp-cerami', 'gp-czech-republic',
  'gp-gippingen', 'gp-kranj', 'grand-prix-de-fourmies', 'gp-slovenian-istria',
  'grand-prix-vorarlberg', 'halle-ingooigem', 'heistse-pijl',
  'kattekoers-herentals', 'la-drome-classic', 'la-picto-charentaise',
  'le-samyn', 'memorial-marco-pantani', 'nokere-koerse',
  'omloop-van-het-houtland', 'paris-tours', 'porec-classic',
  'ronde-van-drenthe', 'ronde-van-limburg', 'ronde-van-overijssel',
  'ster-van-zwolle', 'syedra-ancient-city', 'tour-de-la-mirabelle',
  'trofej-umag', 'trofeo-alcide-degasperi', 'trofeo-citta-di-brescia',
  'trofeo-citta-di-castelfidardo', 'trofeu-da-arrabida',
  'visegrad-4-bicycle-race-gp-hungary', 'visegrad-4-bicycle-race-gp-polski-via-odra',
  'visegrad-4-bicycle-race-gp-slovakia', 'youngster-coast-challenge',
  'asian-championships-me', 'asian-continental-championships-mixed-relay-ttt',
  'grand-prix-alaiye1', 'tour-des-alpes-maritimes-et-du-var', 'nc-philippines-itt',
  'faun-ardeche-classic', 'grand-prix-pedalia', 'visit-south-aegean-gp',
  'region-on-dodecanese-gp', 'gp-samyn', 'trofeo-laigueglia',
  'grand-prix-apollon-temple-me', 'le-tour-des-100-communes', 'rhodes-gp',
  'gp-de-la-ville-de-lillers', 'porec-trophy', 'popolarissima',
  'vuelta-ciclista-a-la-region-de-murcia',
]);

// Single-day patterns (slug contains these)
const KNOWN_SINGLE_DAY_PATTERNS = ['nc-', 'national-championships', '-itt', '-time-trial'];

// Snapshot of EXCLUDED_RACE_SLUGS
const EXCLUDED_RACE_SLUGS = new Set([
  'vuelta-el-salvador', 'trofeo-felanitx-femina', 'grand-prix-el-salvador',
  'grand-prix-san-salvador', 'trofeo-palma-femina', 'trofeo-binissalem-andratx',
  'race-torquay', 'grand-prix-de-oriente', 'pionera-race-we',
  'aveiro-region-champions-classic', 'grand-prix-alaiye', 'clasica-de-almeria-we',
  'kuurne-brussel-kuurne-juniors', 'omloop-van-het-hageland',
  'biwase-tour-of-vietnam', 'grand-prix-apollon-temple-we',
  'gran-premi-les-franqueses-kh7', 'biwase-cup', 'gp-oetingen',
  'trofeo-da-moreno-piccolo-trofeo-alfredo-binda', 'le-tour-de-filipinas',
  'asian-cycling-championships-mj2', 'asian-cycling-championships-wu23',
]);

function isSingleDayBySlug(slug: string): boolean {
  if (KNOWN_SINGLE_DAY_RACES.has(slug)) return true;
  return KNOWN_SINGLE_DAY_PATTERNS.some(p => slug.includes(p));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, year } = body;

    if (!userId || !year) {
      return NextResponse.json({ error: 'userId and year are required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    const snapshot = await db.collection('races').where('year', '==', Number(year)).get();

    let updated = 0;
    let skipped = 0;

    // Process in batches of 400 (Firestore limit is 500 per batch)
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const slug = data.slug || doc.id.replace(`_${year}`, '');

      // Only write fields that are absent (undefined or null)
      const update: Record<string, unknown> = {};

      if (data.totalStages == null) {
        update.totalStages = KNOWN_RACE_STAGES[slug] ?? (isSingleDayBySlug(slug) ? 1 : 1);
      }
      if (data.hasPrologue == null) {
        update.hasPrologue = RACES_WITH_PROLOGUE.has(slug);
      }
      if (data.isSingleDay == null) {
        update.isSingleDay = isSingleDayBySlug(slug);
      }
      if (data.excludeFromScraping == null) {
        update.excludeFromScraping = EXCLUDED_RACE_SLUGS.has(slug);
      }

      if (Object.keys(update).length === 0) {
        skipped++;
        continue;
      }

      batch.set(doc.ref, update, { merge: true });
      batchCount++;
      updated++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      year,
      total: snapshot.size,
      updated,
      skipped,
      message: `Migration complete: ${updated} updated, ${skipped} already had config`,
    });
  } catch (error) {
    console.error('[migrate-race-config] Error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "oracle-games" && yarn build 2>&1 | grep -E "error TS" | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/migrate-race-config/route.ts
git commit -m "feat: add one-time migration endpoint for race config"
```

---

## Chunk 4: Race Status API Refactor

### Task 6: Update race-status/route.ts to read from Firestore

This is the largest change. Remove all hardcoded lists and read `totalStages`, `hasPrologue`, `isSingleDay`, and `excludeFromScraping` from the Firestore race document. Export `RaceStatus` types from `lib/types/race-status.ts`.

**Files:**
- Modify: `app/api/admin/race-status/route.ts`

- [ ] **Step 1: Replace the top of the file — remove hardcoded constants, add shared imports**

At the top of `app/api/admin/race-status/route.ts`, **remove** the following blocks entirely:
- The 3 interface definitions (`StageStatus`, `RaceStatus`, `RaceStatusResponse`) — replace with import
- `KNOWN_RACE_STAGES` constant (lines ~51–209)
- `RACES_WITH_PROLOGUE` constant (~212–220)
- `KNOWN_SINGLE_DAY_PATTERNS` constant (~222–230)
- `UNWANTED_CLASSIFICATIONS` constant (~232)
- `WOMEN_NAME_KEYWORDS` constant (~235–247)
- `EXCLUDED_RACE_SLUGS` constant (~249–277)
- The `shouldExcludeRace` function definition (~283–323)
- `KNOWN_SINGLE_DAY_RACES` constant (~325–477)
- `isSingleDayRaceBySlug` function (~482–489)

Replace with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { type ScraperDataKey } from '@/lib/firebase/scraper-service';
import { shouldExcludeRace } from '@/lib/utils/race-filters';
import type { StageStatus, RaceStatus, RaceStatusResponse } from '@/lib/types/race-status';
```

- [ ] **Step 2: Update `raceConfigs` map type and population**

Find the `raceConfigs` map declaration (around line 527). Change its value type to include `hasPrologue`:

Old type:
```typescript
const raceConfigs = new Map<string, {
  name: string;
  totalStages: number;
  isSingleDay: boolean;
  startDate: string | null;
  endDate: string | null;
  classification: string | null;
}>();
```

New type:
```typescript
const raceConfigs = new Map<string, {
  name: string;
  totalStages: number;
  isSingleDay: boolean;
  hasPrologue: boolean;
  startDate: string | null;
  endDate: string | null;
  classification: string | null;
  excludeFromScraping: boolean;
}>();
```

- [ ] **Step 3: Update the `racesSnapshot.docs.forEach` loop that populates `raceConfigs`**

Find the loop that calls `raceConfigs.set(slug, { ... })` (around line 556). Update it to:

1. Read `hasPrologue`, `isSingleDay`, `totalStages`, and `excludeFromScraping` from Firestore
2. Pass `data.excludeFromScraping` to `shouldExcludeRace` as the fourth argument
3. Use `data.hasPrologue ?? false` and `data.isSingleDay ?? false`

Old section (the `shouldExcludeRace` call and `raceConfigs.set`):
```typescript
      if (shouldExcludeRace(name, classification, slug)) {
        return;
      }
      // ...
      raceConfigs.set(slug, {
        name: data.name || slug,
        totalStages: data.totalStages || data.stages || 1,
        isSingleDay: data.isSingleDay ?? false,
        startDate,
        endDate: data.endDate || null,
        classification,
      });
```

New:
```typescript
      const excludeFromScraping = data.excludeFromScraping === true;
      if (shouldExcludeRace(name, classification, slug, excludeFromScraping)) {
        return;
      }
      // ...
      raceConfigs.set(slug, {
        name: data.name || slug,
        totalStages: data.totalStages ?? data.stages ?? 1,
        isSingleDay: data.isSingleDay ?? false,
        hasPrologue: data.hasPrologue ?? false,
        startDate,
        endDate: data.endDate || null,
        classification,
        excludeFromScraping,
      });
```

- [ ] **Step 4: Update Code Path A — `raceMap.forEach` (races with scraper data)**

Find the `raceMap.forEach` block (around line 767). In it, find the `isSingleDay` and `hasPrologue` derivation lines (~782–789):

Old:
```typescript
      const isSingleDay = raceConfig?.isSingleDay ||
        isSingleDayRaceBySlug(raceSlug) ||
        (hasResultDoc && !hasStageDocs);

      const hasPrologueScrapedData = docs.some(d => d.key.type === 'stage' && d.key.stage === 0);
      const hasPrologue = hasPrologueScrapedData || RACES_WITH_PROLOGUE.has(raceSlug);
```

New (read from raceConfig, keep document-type inference as last fallback):
```typescript
      const isSingleDay = raceConfig?.isSingleDay ||
        (hasResultDoc && !hasStageDocs);

      const hasPrologueScrapedData = docs.some(d => d.key.type === 'stage' && d.key.stage === 0);
      const hasPrologue = hasPrologueScrapedData || (raceConfig?.hasPrologue ?? false);
```

Also find the `numberedStages` determination block in this path (~793–808):

Old:
```typescript
      } else if (KNOWN_RACE_STAGES[raceSlug]) {
        numberedStages = KNOWN_RACE_STAGES[raceSlug];
```

Remove that `else if` branch — `raceConfig.totalStages` is now populated from Firestore via migration. If it's still `1` for an unknown race that's multi-stage, the admin can fix it via the Config form. New version keeps only:

```typescript
      if (isSingleDay) {
        numberedStages = 1;
      } else if (raceConfig?.totalStages && raceConfig.totalStages > 1) {
        numberedStages = raceConfig.totalStages;
      } else {
        // Infer from scraped stages as last resort
        const maxStage = Math.max(
          ...docs
            .filter(d => d.key.type === 'stage' && typeof d.key.stage === 'number')
            .map(d => d.key.stage as number),
          0,
        );
        numberedStages = maxStage > 0 ? maxStage : 1;
      }
```

- [ ] **Step 5: Update Code Path B — `raceConfigs.forEach` (races without scraper data)**

Find the second loop `raceConfigs.forEach` (around line 1040). Update the `isSingleDay` and `hasPrologue` lines:

Old (~1044–1045):
```typescript
      const isSingleDay = config.isSingleDay || isSingleDayRaceBySlug(raceSlug);
      const hasPrologue = RACES_WITH_PROLOGUE.has(raceSlug);
```

New:
```typescript
      const isSingleDay = config.isSingleDay;
      const hasPrologue = config.hasPrologue;
```

Also update the `numberedStages` block in this path to remove the `KNOWN_RACE_STAGES` lookup:

Old:
```typescript
      } else if (KNOWN_RACE_STAGES[raceSlug]) {
        numberedStages = KNOWN_RACE_STAGES[raceSlug];
```

Remove that branch; just keep:
```typescript
      if (isSingleDay) {
        numberedStages = 1;
      } else if (config.totalStages > 1) {
        numberedStages = config.totalStages;
      } else {
        numberedStages = 1;
      }
```

- [ ] **Step 6: Update `races.push(...)` calls to include `excludeFromScraping`**

Both `races.push` calls (in code path A around line 1014, and in code path B around line 1129) need `excludeFromScraping` added:

Code path A — add to the object:
```typescript
        excludeFromScraping: raceConfig?.excludeFromScraping ?? false,
```

Code path B — add to the object:
```typescript
        excludeFromScraping: config.excludeFromScraping,
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "oracle-games" && yarn build 2>&1 | grep -E "error TS" | head -30
```

Fix any TypeScript errors before proceeding. Common issues: the `RaceStatus` type exported from `lib/types/race-status.ts` must match what the route builds. If the route was previously exporting the interface, update any import sites.

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/race-status/route.ts
git commit -m "refactor: race-status reads config from Firestore, removes hardcoded lists"
```

---

## Chunk 5: Admin UI — Race Config Form

### Task 7: Update RaceManagementDashboard with config editing

**Files:**
- Modify: `components/admin/RaceManagementDashboard.tsx`

- [ ] **Step 1: Update the imports at the top of the file**

Replace the local interface definitions with imports from shared types:

Remove the `StageStatus`, `RaceStatus`, `RaceStatusResponse` interface blocks at the top of `RaceManagementDashboard.tsx` (lines 8–50).

Add:
```typescript
import type { StageStatus, RaceStatus, RaceStatusResponse } from '@/lib/types/race-status';
```

- [ ] **Step 2: Add a `RaceConfigForm` component before the `RaceCard` component**

Insert this new component (before the `RaceCard` function definition):

```typescript
function RaceConfigForm({
  race,
  userId,
  onSaved,
}: {
  race: RaceStatus;
  userId: string;
  onSaved: () => void;
}) {
  const [totalStages, setTotalStages] = useState(race.totalStages);
  const [hasPrologue, setHasPrologue] = useState(race.hasPrologue);
  const [isSingleDay, setIsSingleDay] = useState(race.isSingleDay);
  const [excludeFromScraping, setExcludeFromScraping] = useState(race.excludeFromScraping);
  const [saving, setSaving] = useState(false);

  // Derive the Firestore document ID: {slug}_{year}
  const raceId = `${race.raceSlug}_${race.year}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/race-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, raceId, totalStages, hasPrologue, isSingleDay, excludeFromScraping }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success('Config saved');
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t bg-blue-50 px-4 py-3 space-y-3">
      <h4 className="text-sm font-semibold text-blue-900">Race configuratie</h4>
      <div className="flex flex-wrap gap-4 items-end">
        <label className="flex flex-col text-sm gap-1">
          <span className="text-gray-600">Etappes</span>
          <input
            type="number"
            min={1}
            max={30}
            value={totalStages}
            onChange={e => setTotalStages(parseInt(e.target.value, 10))}
            className="border rounded px-2 py-1 w-20 text-sm"
            disabled={isSingleDay}
          />
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={hasPrologue}
            onChange={e => setHasPrologue(e.target.checked)}
            disabled={isSingleDay}
          />
          <span>Heeft proloog</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isSingleDay}
            onChange={e => {
              setIsSingleDay(e.target.checked);
              if (e.target.checked) setHasPrologue(false);
            }}
          />
          <span>Eendagswedstrijd</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={excludeFromScraping}
            onChange={e => setExcludeFromScraping(e.target.checked)}
          />
          <span className="text-orange-700">Uitsluiten van scraping</span>
        </label>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Opslaan...' : 'Opslaan'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `RaceCard` to show the Config button and form**

In the `RaceCard` function, add state for the config form:

```typescript
  const [configOpen, setConfigOpen] = useState(false);
```

In the card header row (the `<div className="px-4 py-3 bg-gray-50 ...">` div), add a Config button alongside the expand toggle. Add it before `<span className="text-gray-400">{expanded ? '▲' : '▼'}</span>`:

```typescript
          <Button
            size="sm"
            variant="secondary"
            ghost
            onClick={e => { e.stopPropagation(); setConfigOpen(c => !c); }}
          >
            Config
          </Button>
```

Also add an "Excluded" badge in the header when `race.excludeFromScraping` is true. After the existing badge checks (e.g. `isFullyScraped`), add:

```typescript
          {race.excludeFromScraping && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">
              Uitgesloten
            </span>
          )}
```

At the bottom of the `RaceCard` return, after the expanded content div, add:

```typescript
      {configOpen && (
        <RaceConfigForm
          race={race}
          userId={userId}
          onSaved={() => { setConfigOpen(false); onRefresh(); }}
        />
      )}
```

- [ ] **Step 4: Add Migration button and Sync Calendar button to the dashboard header**

In `RaceManagementDashboard`, add two admin action buttons to the header area. Find the `<div className="flex items-center gap-4">` in the header and add after the existing Refresh button:

```typescript
          <Button
            variant="secondary"
            outline
            onClick={async () => {
              if (!confirm(`Migrate race config for ${year}? Only writes absent fields.`)) return;
              try {
                const res = await fetch('/api/admin/migrate-race-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, year }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                toast.success(data.message);
                fetchData();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Migration failed');
              }
            }}
          >
            Migrate config
          </Button>
          <Button
            variant="secondary"
            outline
            onClick={async () => {
              if (!confirm(`Sync race calendar from PCS for ${year}?`)) return;
              try {
                const res = await fetch('/api/admin/sync-race-calendar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, year }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                toast.success(data.message || 'Calendar synced');
                fetchData();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Sync failed');
              }
            }}
          >
            Sync kalender
          </Button>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "oracle-games" && yarn build 2>&1 | grep -E "error TS" | head -30
```

Fix any type errors before proceeding.

- [ ] **Step 6: Commit**

```bash
git add components/admin/RaceManagementDashboard.tsx
git commit -m "feat: add race config form and migration/sync buttons to admin races page"
```

---

## Chunk 6: Cron Fixes and Calendar Cron

### Task 8: Fix scrape-todays-races stage calculation

**Files:**
- Modify: `app/api/cron/scrape-todays-races/route.ts`

- [ ] **Step 1: Replace local `shouldExcludeRace` and `EXCLUDED_RACE_SLUGS` with shared import**

At the top of the file, find and **remove**:
- `const EXCLUDED_RACE_SLUGS: Set<string> = new Set([...])` (~lines 38–48)
- The local `shouldExcludeRace` function definition (~lines 54–83)
- `const UNWANTED_CLASSIFICATIONS = [...]` (~line 22)
- `const WOMEN_NAME_KEYWORDS = [...]` (~lines 23–35)

Add at the top of the file (after existing imports):
```typescript
import { shouldExcludeRace } from '@/lib/utils/race-filters';
```

- [ ] **Step 2: Update the race loop to read config from Firestore**

In the main `for (const raceDoc of racesSnapshot.docs)` loop, find the section that reads race data. Add extraction of the new fields and update the `shouldExcludeRace` call:

Old:
```typescript
      if (shouldExcludeRace(raceName, classification, raceSlug)) {
        skipped.push(`${raceSlug} (excluded by filters)`);
        continue;
      }
```

New:
```typescript
      const excludeFromScraping = raceData.excludeFromScraping === true;
      if (shouldExcludeRace(raceName, classification, raceSlug, excludeFromScraping)) {
        if (excludeFromScraping) excludedByFlag++;
        skipped.push(`${raceSlug} (excluded by filters)`);
        continue;
      }
```

Also add `let excludedByFlag = 0;` near the top of the try block (after `let queuedJobs = 0;`).

- [ ] **Step 3: Read `hasPrologue` and `isSingleDay` from race document**

Find the `const isSingleDay = !!raceData.isSingleDay || startStr === endStr;` line (around line 230). Replace:

Old:
```typescript
      const isSingleDay = !!raceData.isSingleDay || startStr === endStr;
```

New:
```typescript
      const isSingleDay = raceData.isSingleDay === true || startStr === endStr;
      const hasPrologue = raceData.hasPrologue === true;
```

- [ ] **Step 4: Fix stage number calculation for multi-stage races**

Find the multi-stage `else` block (around line 278). Replace the stage number calculation with subcollection-primary logic:

Old:
```typescript
        const stageOffset = diffDays(startStr, targetDate);
        const stageNumber = stageOffset + 1;
```

New:
```typescript
        // Primary: look up exact stage date in 'stages' subcollection
        let stageNumber: number | null = null;
        const stagesSubSnap = await raceDoc.ref.collection('stages').get();
        for (const stageDoc of stagesSubSnap.docs) {
          const stageData = stageDoc.data();
          // parseDateOnly expects string — guard against null/undefined with ?? ''
          const rawDate: string =
            stageData.date ?? stageData.stageDate ?? stageData.raceDate ?? stageData.startDate ?? '';
          const stageDate = rawDate ? parseDateOnly(rawDate) : null;
          if (stageDate === targetDate && typeof stageData.stage === 'number') {
            stageNumber = stageData.stage as number;
            break;
          }
        }

        // Fallback: date-offset formula with prologue awareness
        if (stageNumber === null) {
          const stageOffset = diffDays(startStr, targetDate);
          stageNumber = hasPrologue ? stageOffset : stageOffset + 1;
        }
```

**Important notes for the implementer:**

- `stageNumber === 0` is the prologue. The prologue uses `type: 'stage'` with `stage: 0`. Verify before implementing that `hasExistingScrape` handles `stage === 0` correctly — open `lib/firebase/scraper-service.ts`, find `generateDocumentId`, and confirm it generates a valid document ID when `stage` is `0` (not falsy-skipped). The `createJob` call below expects a numeric stage and `0` is valid.

- The `parseDateOnly` function (line ~88 of the cron file) has signature `(dateStr: string): string | null`. The guard `?? ''` above ensures we never pass `null` to it. An empty string will return `null` from `parseDateOnly`, which is the correct no-match result.

- [ ] **Step 5: Update the Telegram message — replace `EXCLUDED_RACE_SLUGS.size`**

Find the Telegram message construction (around line 483). Replace:

Old:
```typescript
    `🧹 Excluded slugs: ${EXCLUDED_RACE_SLUGS.size}`,
```

New:
```typescript
    `🧹 Uitgesloten via vlag: ${excludedByFlag}`,
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "oracle-games" && yarn build 2>&1 | grep -E "error TS" | head -30
```

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/scrape-todays-races/route.ts
git commit -m "fix: use stages subcollection for stage number lookup, respect hasPrologue, read config from Firestore"
```

---

### Task 9: Create race calendar cron and admin trigger

**Files:**
- Create: `app/api/cron/scrape-race-calendar/route.ts`
- Create: `app/api/admin/sync-race-calendar/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `app/api/cron/scrape-race-calendar/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getRacesPuppeteer } from '@/lib/scraper/getRacesPuppeteer';
import { sendTelegramMessage } from '@/lib/telegram';

const TIME_ZONE = 'Europe/Amsterdam';

// Fields that should NOT be overwritten if already set in Firestore
const PROTECTED_FIELDS = ['totalStages', 'hasPrologue', 'isSingleDay', 'excludeFromScraping'];

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const isAuthorized = (authHeader && authHeader === expectedAuth) || vercelCronHeader === '1';

  if (!isAuthorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const year = new Date().getFullYear();
  return scrapeCalendar(year);
}

export async function scrapeCalendar(year: number): Promise<Response> {
  try {
    const db = getServerFirebase();
    const racesData = await getRacesPuppeteer(year);

    let added = 0;
    let updated = 0;
    let errors = 0;

    for (const race of racesData.races) {
      try {
        const docId = `${race.slug}_${year}`;
        const ref = db.collection('races').doc(docId);

        // Read existing document to avoid overwriting protected fields
        const existing = await ref.get();
        const existingData = existing.data() || {};

        // Build update from only the safe-to-overwrite scraped fields.
        // Do NOT spread the entire race object — if the scraper ever returns
        // a field that collides with a protected name it would silently overwrite it.
        const update: Record<string, unknown> = {
          name: race.name,
          slug: race.slug,
          startDate: race.startDate,
          endDate: race.endDate,
          classification: race.classification,
          country: race.country,
          year,
          updatedAt: new Date().toISOString(),
          scrapedAt: racesData.scrapedAt,
          source: racesData.source,
        };

        // Preserve protected config fields if they are already set in Firestore
        for (const field of PROTECTED_FIELDS) {
          if (existingData[field] != null) {
            update[field] = existingData[field];
          }
        }

        await ref.set(update, { merge: true });

        if (existing.exists) {
          updated++;
        } else {
          added++;
        }
      } catch {
        errors++;
      }
    }

    const message = [
      `📅 <b>Race Calendar Sync</b> (${year})`,
      '',
      `✅ Toegevoegd: ${added}`,
      `🔄 Bijgewerkt: ${updated}`,
      `❌ Fouten: ${errors}`,
      `📋 Totaal gescraped: ${racesData.count}`,
      `⏰ ${new Date().toLocaleString('nl-NL', { timeZone: TIME_ZONE })}`,
    ].join('\n');

    await sendTelegramMessage(message, { parse_mode: 'HTML' });

    return Response.json({ success: true, year, added, updated, errors, total: racesData.count });
  } catch (error) {
    console.error('[scrape-race-calendar] Error:', error);
    return Response.json(
      { error: 'Calendar scrape failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create `app/api/admin/sync-race-calendar/route.ts`** (manual trigger)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { scrapeCalendar } from '@/app/api/cron/scrape-race-calendar/route';

/**
 * POST /api/admin/sync-race-calendar
 * Admin-triggered race calendar sync (same logic as the cron, but with user auth).
 *
 * Body: { userId, year }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, year } = await request.json();

    if (!userId || !year) {
      return NextResponse.json({ error: 'userId and year are required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    return scrapeCalendar(Number(year));
  } catch (error) {
    console.error('[sync-race-calendar] Error:', error);
    return NextResponse.json(
      { error: 'Calendar sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Add cron schedule to `vercel.json`**

In `vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/scrape-race-calendar",
  "schedule": "0 9 * 1 *"
}
```

**Note on schedule:** `0 9 * 1 *` = every day in January at 09:00. This is intentional — the user wants automatic sync only at the start of the season (January). Running daily throughout January handles last-minute calendar additions and survives individual deployment failures. For the rest of the year, use the "Sync kalender" button on `/admin/races`.

Also add a `maxDuration` entry in `functions`:

```json
"app/api/cron/scrape-race-calendar/**/*.ts": {
  "maxDuration": 300,
  "memory": 3008
},
"app/api/admin/sync-race-calendar/**/*.ts": {
  "maxDuration": 300,
  "memory": 3008
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "oracle-games" && yarn build 2>&1 | grep -E "error TS" | head -30
```

- [ ] **Step 5: Run full test suite**

```bash
cd "oracle-games" && yarn test
```

Expected: All unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/scrape-race-calendar/route.ts app/api/admin/sync-race-calendar/route.ts vercel.json
git commit -m "feat: add automated race calendar cron and manual sync endpoint"
```

---

## Post-implementation Checklist

After all tasks are complete, run through these before calling it done:

- [ ] **Run migration** — open `/admin/races`, click "Migrate config" for each year you have races (2024, 2025, 2026). Verify the Firestore `races` collection has `totalStages`, `hasPrologue`, `isSingleDay`, and `excludeFromScraping` on documents.

- [ ] **Verify GC Details** — on `/admin/races`, expand a multi-stage race that has a General Classification scraped. Click "Details" on the GC row. Confirm riders appear.

- [ ] **Verify Config form** — click "Config" on a race card. Change `totalStages` and save. Confirm the value is persisted in Firestore.

- [ ] **Verify exclusion** — check "Uitsluiten van scraping" on a race and save. Reload the page. The race should show an "Uitgesloten" badge but still be visible.

- [ ] **Test cron dry-run** — call `GET /api/cron/scrape-todays-races?dryRun=true` with the correct auth header. Confirm the output shows correct stage numbers (especially for races with prologues).

- [ ] **Verify build** — `yarn build` completes without TypeScript errors.

- [ ] **Verify tests** — `yarn test` all pass.
