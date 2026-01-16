# Slipstream Game - Test Scenarios

## Overview
This document outlines test scenarios for verifying the Slipstream game implementation.

## Automated Tests

### Unit Tests (Vitest)
Located in `tests/unit/slipstreamCalculation.test.ts`

Run with:
```bash
npm test                  # Run all unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

**Covered scenarios:**
- Time parsing (MM:SS, HH:MM:SS, same time, edge cases)
- Time formatting
- Time loss calculation (winner, finishers, DNF penalty)
- Green jersey points calculation
- Missed pick penalty
- Standings sorting (Yellow Jersey, Green Jersey)
- Ranking calculation with ties
- Deadline helpers

### E2E Tests (Playwright)
Located in `tests/e2e/slipstream.spec.ts`

Run with:
```bash
npm run test:e2e          # Run all e2e tests
npm run test:e2e:ui       # With UI
npm run test:e2e:headed   # In headed browser
```

**Covered scenarios:**
- Page navigation and loading
- Filter tab URL persistence
- Race selection
- Rider selection and search
- User stats display
- Standings (Yellow/Green Jersey tabs)
- Pick submission UI
- Deadline display
- Admin features

---

## Test Scenarios

### 1. Pick maken (Submit a Pick)
**Scenario:** User selects a rider for an upcoming race

**Steps:**
1. Navigate to `/games/{gameId}/slipstream`
2. Select an upcoming race from the race picker
3. Search and select a rider
4. Click "Submit Pick"

**Expected Results:**
- Pick is saved to `stagePicks` collection in Firestore
- Response includes `pickId`, `usedRiders` array
- Participant's `slipstreamData.usedRiders` is updated
- Participant's `slipstreamData.picksCount` increments
- Activity logged to `activityLogs`

**API Call:**
```bash
POST /api/games/{gameId}/slipstream/pick
{
  "userId": "user123",
  "raceSlug": "milano-sanremo",
  "riderId": "tadej-pogacar",
  "riderName": "Tadej Pogačar"
}
```

---

### 2. Deadline check (Deadline Validation)
**Scenario:** User tries to submit pick after deadline has passed

**Steps:**
1. Wait until race deadline passes (or mock time)
2. Try to submit a pick for that race

**Expected Results:**
- API returns 400 error: "Pick deadline has passed for this race"
- No changes to Firestore
- UI shows race as "locked"

**Verification Query:**
```javascript
// Check race status in calendar endpoint
GET /api/games/{gameId}/slipstream/calendar?userId={userId}
// Response should show deadlinePassed: true for the race
```

---

### 3. Unieke renner (Unique Rider Validation)
**Scenario:** User tries to pick the same rider twice

**Steps:**
1. Submit pick with rider A for race 1
2. Try to submit pick with rider A for race 2

**Expected Results:**
- Second request returns 400 error: "This rider has already been used"
- `slipstreamData.usedRiders` contains rider A only once

**Verification:**
```javascript
// Check participant's used riders
const participant = await db.collection('gameParticipants')
  .where('gameId', '==', gameId)
  .where('userId', '==', userId)
  .get();
  
console.log(participant.docs[0].data().slipstreamData.usedRiders);
// Should contain riderId only once
```

---

### 4. Resultaat berekening (Result Calculation)
**Scenario:** Calculate results after race finishes

**Steps:**
1. Ensure picks exist for a race
2. Call calculate-results endpoint with stage results

**Expected Results:**
- Each pick updated with `timeLostSeconds`, `timeLostFormatted`
- Green jersey points calculated for top 10 finishers
- Participant totals updated (`totalTimeLostSeconds`, `totalGreenJerseyPoints`)
- Race status changed to "finished"
- All picks for race marked as `locked: true`

**API Call:**
```bash
POST /api/games/{gameId}/slipstream/calculate-results
{
  "raceSlug": "milano-sanremo",
  "stageResults": [
    { "nameID": "tadej-pogacar", "place": 1, "timeDifference": "" },
    { "nameID": "mathieu-van-der-poel", "place": 2, "timeDifference": "0:15" },
    { "nameID": "wout-van-aert", "place": 3, "timeDifference": "0:15" },
    // ... more riders
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "summary": {
    "participantsProcessed": 10,
    "picksWithResults": 8,
    "missedPicks": 2,
    "dnfPenalties": 0
  },
  "results": [...]
}
```

---

### 5. Straftijd (Penalty Time)
**Scenario:** User misses pick deadline or rider DNFs

**Sub-scenarios:**

#### 5a. Missed Pick
**Steps:**
1. Don't submit pick for a race
2. Run calculate-results after race

**Expected Results:**
- Penalty pick created with `isPenalty: true`, `penaltyReason: 'missed_pick'`
- Time = last finisher's gap + penalty minutes (default 1 min)
- `slipstreamData.missedPicksCount` increments

#### 5b. Rider DNF/DNS
**Steps:**
1. Submit pick with rider who doesn't finish
2. Run calculate-results (rider not in results)

**Expected Results:**
- Pick updated with `isPenalty: true`, `penaltyReason: 'dnf'`
- Time = last finisher's gap + penalty minutes

**Verification:**
```javascript
// Check for penalty picks
const penaltyPicks = await db.collection('stagePicks')
  .where('gameId', '==', gameId)
  .where('isPenalty', '==', true)
  .get();
```

---

### 6. Klassementen (Standings)
**Scenario:** Verify correct sorting for Yellow and Green jerseys

**Steps:**
1. Create game with multiple participants
2. Submit picks and calculate results for several races
3. Fetch standings

**API Call:**
```bash
GET /api/games/{gameId}/slipstream/standings
```

**Expected Results - Yellow Jersey (Gele Trui):**
- Sorted by `totalTimeLostSeconds` ascending (lowest time = rank 1)
- Ties handled correctly (same rank for equal times)
- Gap to leader calculated correctly

**Expected Results - Green Jersey (Groene Trui):**
- Sorted by `totalGreenJerseyPoints` descending (highest points = rank 1)
- Points: 1st=10, 2nd=9, 3rd=8, ... 10th=1
- Only top 10 finishers get points

**Verification:**
```javascript
// Yellow Jersey: lower time = better
standings.yellowJersey.forEach((entry, i) => {
  if (i > 0) {
    assert(entry.value >= standings.yellowJersey[i-1].value);
  }
});

// Green Jersey: higher points = better
standings.greenJersey.forEach((entry, i) => {
  if (i > 0) {
    assert(entry.value <= standings.greenJersey[i-1].value);
  }
});
```

---

## Integration Tests

### 7. saveRaceResult Integration
**Scenario:** Verify automatic Slipstream calculation when race result is saved

**Steps:**
1. Create Slipstream game with race in `countingRaces`
2. Submit picks for that race
3. Call `saveRaceResult` API

**Expected Results:**
- Race result saved to Firestore
- Slipstream calculate-results automatically triggered
- All participant picks processed
- Standings updated

**Verification:**
```bash
POST /api/saveRaceResult
{
  "userId": "adminUserId",
  "raceSlug": "milano-sanremo_2026",
  "year": 2026
}

# Response should include:
{
  "success": true,
  "slipstreamGamesProcessed": 1
}
```

---

## Manual Testing Checklist

- [ ] Create new Slipstream game with 25 races
- [ ] Join game as participant
- [ ] Submit pick for upcoming race
- [ ] Verify pick appears in MyPicksOverview
- [ ] Verify rider added to usedRiders
- [ ] Try to pick same rider again (should fail)
- [ ] Wait for deadline to pass
- [ ] Verify pick is locked
- [ ] Admin: Calculate results
- [ ] Verify time loss calculated
- [ ] Verify green jersey points (if top 10)
- [ ] Check Yellow Jersey standings
- [ ] Check Green Jersey standings
- [ ] Verify deadline countdown works
- [ ] Test missed pick penalty

---

## Firestore Collections Reference

### stagePicks
```javascript
{
  gameId: string,
  userId: string,
  playername: string,
  raceSlug: string,
  stageNumber: string | number,
  riderId: string | null,
  riderName: string | null,
  pickedAt: Timestamp,
  locked: boolean,
  // After calculation:
  timeLostSeconds: number,
  timeLostFormatted: string,
  greenJerseyPoints: number,
  riderFinishPosition: number,
  isPenalty: boolean,
  penaltyReason: 'dnf' | 'dns' | 'dsq' | 'missed_pick',
  processedAt: Timestamp
}
```

### gameParticipants.slipstreamData
```javascript
{
  totalTimeLostSeconds: number,
  totalGreenJerseyPoints: number,
  usedRiders: string[],
  picksCount: number,
  missedPicksCount: number,
  yellowJerseyRanking: number,
  greenJerseyRanking: number
}
```

### games.config (SlipstreamConfig)
```javascript
{
  allowReuse: false,
  countingRaces: SlipstreamRace[],
  penaltyMinutes: number,
  pickDeadlineMinutes: number,
  greenJerseyPoints: Record<number, number>
}
```
