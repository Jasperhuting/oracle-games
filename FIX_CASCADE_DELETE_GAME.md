# Fix: Cascade Delete - Voltooid ✅

## Problemen

### 1. Game Deletion
Wanneer een game werd verwijderd, bleef alle gerelateerde data achter in de database:
- ❌ Bids bleven bestaan
- ❌ Game participants bleven bestaan
- ❌ Player teams bleven bestaan
- ❌ Leagues bleven bestaan
- ❌ Stage picks bleven bestaan
- ❌ Draft picks bleven bestaan

Dit leidde tot:
- Vervuilde database met orphaned data
- Mogelijke errors bij queries
- Verwarring voor gebruikers

### 2. Participant Leaving Game
Wanneer een gebruiker een game verliet, bleven hun bids en playerTeams achter:
- ❌ Bids bleven bestaan
- ❌ Player teams bleven bestaan

Dit leidde tot:
- Orphaned bids zonder participant
- Orphaned player teams zonder participant
- Mogelijke errors in punten berekening

## Oplossingen

### 1. Update Game DELETE Endpoint ✅
**Bestand**: `/app/api/games/[gameId]/route.ts`

**Wat is toegevoegd**:
De DELETE endpoint verwijdert nu **alle** gerelateerde data in de juiste volgorde:

1. **Bids** - Alle biedingen voor dit game
2. **Game Participants** - Alle deelnemers
3. **Player Teams** - Alle team documenten
4. **Leagues** - Alle leagues binnen dit game
5. **Stage Picks** - Alle stage picks (Carry Me Home, Fan Flandrien)
6. **Draft Picks** - Alle draft picks (Poisoned Cup, Rising Stars)
7. **Game** - Het game document zelf

### Deletion Flow

```
DELETE /api/games/{gameId}?adminUserId={userId}
    ↓
1. Verify admin access
    ↓
2. Get game data (for logging)
    ↓
3. Delete all bids
    ↓
4. Delete all participants
    ↓
5. Delete all player teams
    ↓
6. Delete all leagues
    ↓
7. Delete all stage picks
    ↓
8. Delete all draft picks
    ↓
9. Delete game document
    ↓
10. Log activity with stats
    ↓
Return success + deletion stats
```

## Code Implementation

```typescript
// Track what we delete for logging
const deletionStats = {
  bids: 0,
  participants: 0,
  playerTeams: 0,
  leagues: 0,
  stagePicks: 0,
  draftPicks: 0,
};

// 1. Delete all bids
const bidsSnapshot = await db.collection('bids')
  .where('gameId', '==', gameId)
  .get();

for (const bidDoc of bidsSnapshot.docs) {
  await bidDoc.ref.delete();
  deletionStats.bids++;
}

// ... same pattern for all other collections

// Finally, delete the game itself
await db.collection('games').doc(gameId).delete();
```

## Response Format

**Success Response**:
```json
{
  "success": true,
  "message": "Game and all related data deleted successfully",
  "deletionStats": {
    "bids": 15,
    "participants": 8,
    "playerTeams": 64,
    "leagues": 2,
    "stagePicks": 0,
    "draftPicks": 0
  }
}
```

**Error Response**:
```json
{
  "error": "Failed to delete game",
  "details": "Unauthorized - Admin access required"
}
```

## Logging

Alle deletions worden uitgebreid gelogd:

**Console Logs**:
```
[DELETE_GAME] Starting deletion of game game-123 and all related data
[DELETE_GAME] Deleting bids...
[DELETE_GAME] Deleted 15 bids
[DELETE_GAME] Deleting participants...
[DELETE_GAME] Deleted 8 participants
[DELETE_GAME] Deleting player teams...
[DELETE_GAME] Deleted 64 player teams
[DELETE_GAME] Deleting leagues...
[DELETE_GAME] Deleted 2 leagues
[DELETE_GAME] Deleting stage picks...
[DELETE_GAME] Deleted 0 stage picks
[DELETE_GAME] Deleting draft picks...
[DELETE_GAME] Deleted 0 draft picks
[DELETE_GAME] Deleting game document...
[DELETE_GAME] Deletion complete: { bids: 15, participants: 8, playerTeams: 64, leagues: 2, stagePicks: 0, draftPicks: 0 }
```

**Activity Log**:
```javascript
{
  action: 'GAME_DELETED',
  userId: 'admin-123',
  userEmail: 'admin@example.com',
  userName: 'Admin User',
  details: {
    gameId: 'game-123',
    gameName: 'Auctioneer - Tour de France 2025',
    gameType: 'auctioneer',
    deletionStats: {
      bids: 15,
      participants: 8,
      playerTeams: 64,
      leagues: 2,
      stagePicks: 0,
      draftPicks: 0
    }
  },
  timestamp: '2025-12-04T15:48:00.000Z'
}
```

## Collections Affected

### 1. `bids`
**Query**: `where('gameId', '==', gameId)`
**Why**: All bids are specific to a game

### 2. `gameParticipants`
**Query**: `where('gameId', '==', gameId)`
**Why**: Participants only exist within a game context

### 3. `playerTeams`
**Query**: `where('gameId', '==', gameId)`
**Why**: Player teams are game-specific

### 4. `leagues`
**Query**: `where('gameId', '==', gameId)`
**Why**: Leagues are created within a specific game

### 5. `stagePicks`
**Query**: `where('gameId', '==', gameId)`
**Why**: Stage picks are game-specific (Carry Me Home, Fan Flandrien)

### 6. `draftPicks`
**Query**: `where('gameId', '==', gameId)`
**Why**: Draft picks are game-specific (Poisoned Cup, Rising Stars)

### 2. Update Leave Game DELETE Endpoint ✅
**Bestand**: `/app/api/games/[gameId]/join/route.ts`

**Wat is toegevoegd**:
De DELETE endpoint (leave game) verwijdert nu ook alle gerelateerde data van de gebruiker:

1. **Bids** - Alle biedingen van deze gebruiker voor dit game
2. **Player Teams** - Alle team documenten van deze gebruiker voor dit game
3. **Participant** - Het participant document

**Deletion Flow**:
```
DELETE /api/games/{gameId}/join?userId={userId}
    ↓
1. Verify game allows leaving (not active/completed)
    ↓
2. Find participant
    ↓
3. Delete all user's bids for this game
    ↓
4. Delete all user's player teams for this game
    ↓
5. Delete participant
    ↓
6. Decrement player count (if not pending)
    ↓
7. Log activity with stats
    ↓
Return success + deletion stats
```

**Response Format**:
```json
{
  "success": true,
  "message": "Successfully left the game and removed all related data",
  "deletionStats": {
    "bids": 5,
    "playerTeams": 8
  }
}
```

**Logging**:
```
[LEAVE_GAME] User user-123 leaving game game-456
[LEAVE_GAME] Deleting bids...
[LEAVE_GAME] Deleted 5 bids
[LEAVE_GAME] Deleting player teams...
[LEAVE_GAME] Deleted 8 player teams
[LEAVE_GAME] Deleting participant...
[LEAVE_GAME] User user-123 successfully left game game-456: { bids: 5, playerTeams: 8 }
```

## Required Firestore Indexes

Make sure these indexes exist in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "bids",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gameParticipants",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "playerTeams",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "leagues",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "stagePicks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "draftPicks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "bids",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "playerTeams",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gameId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Note**: The composite indexes (gameId + userId) are needed for the leave game functionality.

## Testing Checklist

### Game Deletion Testing

### Before Testing
- [ ] Backup your database (if production)
- [ ] Create a test game with:
  - [ ] Multiple participants
  - [ ] Some bids
  - [ ] Some player teams
  - [ ] A league or two

### Test Deletion
- [ ] Call DELETE endpoint as admin
- [ ] Check response includes deletion stats
- [ ] Verify in Firestore:
  - [ ] Game document is deleted ✅
  - [ ] All bids are deleted ✅
  - [ ] All participants are deleted ✅
  - [ ] All player teams are deleted ✅
  - [ ] All leagues are deleted ✅
  - [ ] All stage picks are deleted ✅
  - [ ] All draft picks are deleted ✅
- [ ] Check activity log was created
- [ ] Verify console logs show correct counts

### Error Cases
- [ ] Try to delete as non-admin (should fail)
- [ ] Try to delete non-existent game (should fail)
- [ ] Try to delete without adminUserId (should fail)

### Leave Game Testing

### Before Testing
- [ ] Create a test game
- [ ] Join the game as a user
- [ ] Place some bids
- [ ] Finalize auction (so playerTeams are created)

### Test Leaving
- [ ] Call DELETE /api/games/{gameId}/join?userId={userId}
- [ ] Check response includes deletion stats
- [ ] Verify in Firestore:
  - [ ] Participant is deleted ✅
  - [ ] User's bids are deleted ✅
  - [ ] User's player teams are deleted ✅
  - [ ] Player count is decremented ✅
- [ ] Check activity log was created
- [ ] Verify console logs show correct counts

### Error Cases
- [ ] Try to leave active/completed game (should fail)
- [ ] Try to leave game you're not in (should fail)
- [ ] Try to leave without userId (should fail)

## Performance Considerations

**For large games** (100+ participants, 1000+ bids):
- Deletion may take several seconds
- Consider adding a loading indicator in UI
- All deletions are sequential to avoid race conditions
- Future optimization: batch deletions (max 500 per batch)

**Estimated deletion time**:
- Small game (10 participants): ~1-2 seconds
- Medium game (50 participants): ~3-5 seconds
- Large game (100+ participants): ~5-10 seconds

## Future Improvements

### 1. Batch Deletions
```typescript
// Instead of deleting one by one
const batch = db.batch();
bidsSnapshot.docs.forEach(doc => {
  batch.delete(doc.ref);
});
await batch.commit();
```

### 2. Soft Delete
- Add `deleted: true` flag instead of hard delete
- Keep data for audit/recovery purposes
- Add cleanup job to permanently delete after X days

### 3. Confirmation Dialog
- Add UI confirmation with deletion stats preview
- Show user what will be deleted before proceeding
- Require typing game name to confirm

### 4. Undo Functionality
- Store deleted data temporarily
- Allow admin to undo deletion within X minutes
- Automatically purge after timeout

## Troubleshooting

### Problem: Deletion fails with "Missing index" error
**Solution**: Deploy the required Firestore indexes (see above)

### Problem: Some data remains after deletion
**Solution**: 
1. Check console logs to see which step failed
2. Verify the gameId is correct in orphaned documents
3. Manually delete remaining documents or re-run deletion

### Problem: Deletion takes too long
**Solution**:
1. Check game size (number of participants/bids)
2. Consider implementing batch deletions
3. Add timeout handling in frontend

### Problem: Permission denied
**Solution**:
1. Verify user is admin
2. Check Firestore security rules
3. Verify adminUserId is correct

## Security

- ✅ Only admins can delete games
- ✅ Admin verification happens before any deletion
- ✅ All deletions are logged with admin details
- ✅ No way to bypass admin check
- ✅ Activity log cannot be deleted by this endpoint

## Summary

The DELETE endpoint now properly cleans up all related data when a game is deleted. This prevents orphaned data and keeps the database clean. All deletions are logged for audit purposes.

**What gets deleted**:
1. ✅ Bids
2. ✅ Participants
3. ✅ Player Teams
4. ✅ Leagues
5. ✅ Stage Picks
6. ✅ Draft Picks
7. ✅ Game

**What stays**:
- ❌ Activity logs (for audit trail)
- ❌ User accounts
- ❌ Race data
- ❌ Rider rankings
