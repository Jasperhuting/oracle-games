# Participant Teams Migration - Fix pricePaid Field

## Problem
When auctions were finalized, riders added to participants' teams were stored with the field name `amount` instead of `pricePaid`. This caused the auction page to show `0` or undefined for sold rider prices because it was looking for the `pricePaid` field.

## Solution

### 1. Fixed Future Auctions
**File:** `/app/api/games/[gameId]/bids/finalize/route.ts` (line 169)

Changed the field name from `amount` to `pricePaid` when adding riders to participant team arrays:

```typescript
// Before
amount: bid.amount,

// After
pricePaid: bid.amount,
```

This ensures all future auction finalizations will use the correct field name.

### 2. Migration for Existing Data
Created a migration endpoint and admin UI to fix existing sold riders:

**Files Created:**
- `/app/api/games/[gameId]/migrate-participant-teams/route.ts` - Migration API endpoint
- `/components/DataMigrationsTab.tsx` - Admin UI for running migrations
- Updated `/app/admin/page.tsx` - Added "Data Migrations" tab

## How to Use the Migration

1. Go to the Admin Dashboard (`/admin`)
2. Click on the "Data Migrations" tab
3. Enter the Game ID (you can find this in the game URL or games list)
4. Click "Run Migration"
5. The migration will:
   - Find all participants in that game
   - Check if their team arrays have the old `amount` field
   - Rename `amount` to `pricePaid` for all riders
   - Skip participants that don't need migration
6. Refresh the auction page to see the updated prices

## What the Migration Does

The migration:
- ✅ Renames `amount` → `pricePaid` in participant team arrays
- ✅ Preserves all other rider data
- ✅ Skips participants that don't need migration
- ✅ Provides detailed results (updated, skipped, errors)
- ✅ Safe to run multiple times (idempotent)

## Example Result

```json
{
  "success": true,
  "message": "Migration completed",
  "updated": 5,
  "skipped": 2,
  "total": 7
}
```

## Notes

- The TypeScript errors in `finalize/route.ts` (lines 115-116) are pre-existing and unrelated to this fix
- Future auctions will automatically use `pricePaid` - no migration needed
- The migration is safe to run on games that have already been migrated (it will skip them)
