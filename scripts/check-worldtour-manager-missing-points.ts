import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const WORLDTOUR_MANAGER_GAME_ID = 'mGzPZfIOb2gAyEu0i6t6';
const MARGINAL_GAINS_GAME_ID = 'tG5QrMUSMBsbqfKa36Ii';

async function checkMissingPoints() {
  console.log('=== CHECK WORLDTOUR MANAGER MISSING POINTS ===\n');

  // Check which game to analyze
  const gameIdToCheck = process.argv.includes('--marginal-gains')
    ? MARGINAL_GAINS_GAME_ID
    : WORLDTOUR_MANAGER_GAME_ID;
  const gameName = gameIdToCheck === MARGINAL_GAINS_GAME_ID ? 'Marginal Gains' : 'WorldTour Manager';

  // Get all playerTeams for the game
  const wtmPlayerTeams = await db.collection('playerTeams')
    .where('gameId', '==', gameIdToCheck)
    .get();

  console.log(`${gameName} has ${wtmPlayerTeams.docs.length} playerTeams\n`);

  // Build a map of riderNameId -> max points from ANY game (reference)
  // This tells us what points each rider SHOULD have
  const allPlayerTeams = await db.collection('playerTeams').get();

  const riderMaxPoints = new Map<string, {
    maxPoints: number;
    maxBreakdownCount: number;
    referenceGameId: string;
    breakdown: any[];
  }>();

  for (const doc of allPlayerTeams.docs) {
    const data = doc.data();
    const riderNameId = data.riderNameId;
    const pointsScored = data.pointsScored || 0;
    const breakdown = data.pointsBreakdown || [];
    const breakdownCount = Array.isArray(breakdown) ? breakdown.length : 0;

    const current = riderMaxPoints.get(riderNameId);
    if (!current || breakdownCount > current.maxBreakdownCount) {
      riderMaxPoints.set(riderNameId, {
        maxPoints: pointsScored,
        maxBreakdownCount: breakdownCount,
        referenceGameId: data.gameId,
        breakdown: breakdown,
      });
    }
  }

  // Check each WorldTour Manager playerTeam
  const missingPoints: Array<{
    docId: string;
    riderNameId: string;
    riderName: string;
    currentPoints: number;
    expectedPoints: number;
    missingBreakdown: any[];
  }> = [];

  for (const doc of wtmPlayerTeams.docs) {
    const data = doc.data();
    const riderNameId = data.riderNameId;
    const currentPoints = data.pointsScored || 0;
    const currentBreakdown = data.pointsBreakdown || [];
    const currentBreakdownCount = Array.isArray(currentBreakdown) ? currentBreakdown.length : 0;

    const reference = riderMaxPoints.get(riderNameId);

    if (reference && reference.maxBreakdownCount > currentBreakdownCount) {
      // Find which breakdown entries are missing
      const currentRaces = new Set(
        Array.isArray(currentBreakdown)
          ? currentBreakdown.map((b: any) => `${b.raceSlug}|${b.stage}`)
          : []
      );

      const missingBreakdown = reference.breakdown.filter(
        (b: any) => !currentRaces.has(`${b.raceSlug}|${b.stage}`)
      );

      if (missingBreakdown.length > 0) {
        missingPoints.push({
          docId: doc.id,
          riderNameId,
          riderName: data.riderName || riderNameId,
          currentPoints,
          expectedPoints: reference.maxPoints,
          missingBreakdown,
        });
      }
    }
  }

  console.log(`Found ${missingPoints.length} playerTeams with missing points\n`);

  if (missingPoints.length > 0) {
    // Group by missing race
    const byRace = new Map<string, number>();
    for (const item of missingPoints) {
      for (const b of item.missingBreakdown) {
        const key = `${b.raceSlug}|${b.stage}`;
        byRace.set(key, (byRace.get(key) || 0) + 1);
      }
    }

    console.log('Missing races summary:');
    for (const [race, count] of byRace) {
      console.log(`  ${race}: ${count} riders missing`);
    }

    console.log('\nSample missing entries (first 10):');
    for (const item of missingPoints.slice(0, 10)) {
      console.log(`\n  ${item.riderName} (${item.riderNameId}):`);
      console.log(`    Current: ${item.currentPoints} pts`);
      console.log(`    Expected: ${item.expectedPoints} pts`);
      console.log(`    Missing: ${item.missingBreakdown.map((b: any) => `${b.raceSlug}|${b.stage}: ${b.total}pts`).join(', ')}`);
    }
  }

  return missingPoints;
}

checkMissingPoints().catch(console.error);
