# Race Scraping Refactor — Design Spec

**Date:** 2026-03-17
**Status:** Approved by user

---

## Problem Summary

The current race scraping system has several interrelated bugs:

1. **Cronjob stage calculation is incorrect** — The cron calculates which stage to scrape by counting days since the race start date (`diffDays + 1`). This breaks for races with a prologue (day 0 = prologue, not stage 1) and for races with rest days.

2. **Exclusion logic is duplicated and inconsistent** — `shouldExcludeRace()` exists in two places with different lists. `race-status/route.ts` has ~30 extra excluded slugs that the cron does not know about.

3. **Race configuration is hardcoded** — `totalStages`, `hasPrologue`, `isSingleDay`, and excluded slugs are stored as large in-code dictionaries (`KNOWN_RACE_STAGES`, `RACES_WITH_PROLOGUE`, etc.). These cannot be edited from the UI.

4. **GC Details panel shows no riders** — Clicking "Details" on a General Classification stage shows an empty riders panel. The scraper stores GC rider data in `generalClassification` rows; the field that holds the place/rank may differ from what the detail API expects.

5. **Race calendar must be manually triggered** — There is no automatic cron to refresh the race calendar from ProCyclingStats at the start of each season.

---

## Solution Overview

Full refactor: move all race configuration into Firestore, unify exclusion logic into a shared utility, fix the cron stage calculation using the `stages` subcollection as primary source, fix the GC Details bug, and add an automated race calendar cron.

---

## Firestore Schema Changes

### Race document (`races/{slug}_{year}`)

Add the following fields (all editable via the admin UI):

| Field | Type | Description |
|-------|------|-------------|
| `totalStages` | `number` | Number of regular (numbered) stages, excluding prologue |
| `hasPrologue` | `boolean` | Whether the race has a prologue (stage 0) |
| `isSingleDay` | `boolean` | Whether this is a one-day race |
| `excludeFromScraping` | `boolean` | Explicit opt-out for scraping (replaces `EXCLUDED_RACE_SLUGS`) |

Existing fields remain unchanged: `name`, `slug`, `year`, `startDate`, `endDate`, `classification`.

---

## Components

### 1. Shared Race Filter Utility — `lib/utils/race-filters.ts`

Extract and consolidate the `shouldExcludeRace(name, classification, slug, excludeFromScraping?: boolean)` function into a single shared module. The function signature adds an optional fourth argument `excludeFromScraping` — if `true`, it immediately returns `true` without checking name/classification patterns. Both `race-status/route.ts` and `scrape-todays-races/route.ts` import from this module. The `excludeFromScraping` field check stays at the call site (after reading the race document from Firestore) and is passed as the fourth argument.

The unified version uses the more complete logic from `race-status/route.ts` (word-boundary regex matching for classification codes, full `WOMEN_NAME_KEYWORDS` list).

`EXCLUDED_RACE_SLUGS` is **removed from both files**. Races are excluded via the `excludeFromScraping` field in Firestore instead.

### 2. One-time Migration — `POST /api/admin/migrate-race-config`

Admin-only API endpoint that reads the hardcoded lists from the code and writes the corresponding values to each existing Firestore race document.

**Idempotency:** The endpoint only writes a field if it is currently absent (`=== undefined` or `=== null`) in the document. It never overwrites a field that is already set. This means running it twice is safe — the second run is a no-op for any race that was already migrated.

Writes per race (only if field is absent):
- `totalStages` ← `KNOWN_RACE_STAGES[slug]` or `1` if not in list
- `hasPrologue` ← `RACES_WITH_PROLOGUE.has(slug)`
- `isSingleDay` ← `KNOWN_SINGLE_DAY_RACES.has(slug) || isSingleDayRaceBySlug(slug)`
- `excludeFromScraping` ← `EXCLUDED_RACE_SLUGS.has(slug)`

Uses batched writes. Returns a summary of how many documents were updated vs skipped.

Triggered once from the admin UI via a "Migrate race config" button. The button shows a confirmation dialog.

### 3. Race Config API — `POST /api/admin/race-config`

Admin-only endpoint to update the four config fields for a single race:

**Request body:**
```json
{
  "userId": "...",
  "raceId": "tour-de-france_2026",
  "totalStages": 21,
  "hasPrologue": false,
  "isSingleDay": false,
  "excludeFromScraping": false
}
```

Uses `{ merge: true }` in Firestore to update only the provided fields.

### 4. Admin UI — Race Card Edit Form

In `RaceManagementDashboard`, each `RaceCard` gets a **"Config"** button in the card header. Clicking it toggles an inline config form below the race header showing:

- **Etappes** (number input, `totalStages`)
- **Heeft proloog** (checkbox, `hasPrologue`)
- **Eendagswedstrijd** (checkbox, `isSingleDay`)
- **Uitsluiten van scraping** (checkbox, `excludeFromScraping`)

A Save button calls `POST /api/admin/race-config`. Changes reflect immediately in the card display.

**Excluded races discoverability:** Races with `excludeFromScraping: true` are still shown in the admin UI but with a visual "Excluded" badge. They are not hidden from the list. This ensures an admin can find and re-enable them via the Config form.

**TypeScript types:** The `RaceStatus` interface in `RaceManagementDashboard.tsx` and the one in `race-status/route.ts` are consolidated — the dashboard imports the type from the route (or a shared types file). The `RaceStatus` type is extended with `excludeFromScraping: boolean` so the Config form can pre-populate.

### 5. GC Details Bug Fix

**Location:** `app/api/admin/stage-status/route.ts` — the `sampleRiders` extraction loop.

**Investigation step:** Before implementing, read a real `tour-gc` Firestore document to confirm which field stores the rank/place. The field is expected to be `rank` based on common scraper conventions, but it must be verified.

**Fix:** Update the place extraction to check `row.rank` in addition to `row.place`:
```typescript
const placeRaw = row.place ?? row.rank ?? row.position;
```

This ensures the GC panel shows the top 5 riders regardless of which field name the scraper uses.

### 6. Race Status API Update — `race-status/route.ts`

**Two code paths must both be updated** (reviewer finding):

**Code path A** — races with existing scraper data (`raceMap.forEach`, lines ~782–789):
- Remove calls to `isSingleDayRaceBySlug()` and `RACES_WITH_PROLOGUE.has()`
- Read `isSingleDay` and `hasPrologue` from `raceConfig` (already in the map)

**Code path B** — races without scraper data yet (`raceConfigs.forEach`, lines ~1044–1045):
- Same: remove hardcoded calls, read from `raceConfig`

**`raceConfigs` map type change:** The map currently stores `{ name, totalStages, isSingleDay, startDate, endDate, classification }`. Add `hasPrologue: boolean` to this type so Code path B has access to it.

**Removal of hardcoded artifacts:**
- `KNOWN_RACE_STAGES`
- `RACES_WITH_PROLOGUE`
- `KNOWN_SINGLE_DAY_RACES`
- `KNOWN_SINGLE_DAY_PATTERNS`
- `EXCLUDED_RACE_SLUGS`
- `isSingleDayRaceBySlug()` function

**shouldExcludeRace update:** Replace the local definition with the import from `lib/utils/race-filters.ts`. Pass `data.excludeFromScraping` as the fourth argument at the call site.

### 7. Cronjob Fix — `scrape-todays-races`

**Stage number determination (primary path — stages subcollection):**

For multi-stage races, look up the stage number using the `stages` subcollection of the race Firestore document. The subcollection contains documents with a `date` field and a `stage` number field. Query for a stage with `date == targetDate` to get the exact stage number. This correctly handles rest days and races with non-linear schedules.

**Fallback path (when subcollection lookup returns no match):**

Use date-offset calculation with prologue awareness:
- Read `hasPrologue` from the Firestore race document
- `stageOffset = diffDays(startStr, targetDate)`
- `stageNumber = hasPrologue ? stageOffset : stageOffset + 1`
- Stage 0 (prologue) is triggered when `hasPrologue && stageOffset === 0`

**Other changes:**
- Read `isSingleDay` from Firestore instead of `startStr === endStr`
- Read `excludeFromScraping` from Firestore and skip if `true`
- Import `shouldExcludeRace` from `lib/utils/race-filters.ts`
- Replace `EXCLUDED_RACE_SLUGS.size` in the Telegram message with a count of `excludedByFlag` races encountered during the run (tracked as a local counter)

### 8. Automated Race Calendar Cron — `GET /api/cron/scrape-race-calendar`

New GET endpoint with standard Vercel cron auth (`CRON_SECRET`).

**Schedule in `vercel.json`:** `0 9 * 1 *` (every day in January at 09:00) — this is better than January 1st only because it catches last-minute race additions and survives individual deployment failures.

**Behavior:**
1. Scrape the current year's race calendar from ProCyclingStats using the existing `getRacesPuppeteer` function.
2. For each scraped race, read the existing Firestore document (if any).
3. Build the update object from scraped data (name, startDate, endDate, classification, etc.).
4. **Do not overwrite** `totalStages`, `hasPrologue`, `isSingleDay`, `excludeFromScraping` if they are already set — check each field individually before including in the write.
5. Write with `set({ ...scrapedFields }, { merge: true })`.
6. Send a Telegram message: races added vs updated vs skipped counts.

**Manual trigger:** A "Sync kalender van PCS" button on `/admin/races` that calls this endpoint via a new admin API wrapper (passes `userId` for auth instead of `CRON_SECRET`).

---

## Removed Artifacts

After migration and full rollout, the following are removed from the codebase:

- `KNOWN_RACE_STAGES` (from `race-status/route.ts`)
- `RACES_WITH_PROLOGUE` (from `race-status/route.ts`)
- `KNOWN_SINGLE_DAY_RACES` (from `race-status/route.ts`)
- `KNOWN_SINGLE_DAY_PATTERNS` (from `race-status/route.ts`)
- `EXCLUDED_RACE_SLUGS` (from `race-status/route.ts` and `scrape-todays-races/route.ts`)
- `isSingleDayRaceBySlug()` function (replaced by Firestore field)
- Local `shouldExcludeRace()` definitions (replaced by shared import from `lib/utils/race-filters.ts`)

---

## Out of Scope

- Changing the underlying scraper logic for individual stages/results
- Adding new race types or classification categories
- Points recalculation system changes
