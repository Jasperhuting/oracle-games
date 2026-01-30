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

interface PointsBreakdownEntry {
  raceSlug?: string;
  total?: number;
  stageResult?: number;
}

interface PlayerTeamData {
  docId: string;
  gameId: string;
  participantId: string;
  pointsScored: number;
  races: Set<string>;
  breakdown: PointsBreakdownEntry[];
}

async function checkPointsConsistency() {
  console.log('=== CHECK PLAYERTEAM POINTS CONSISTENCY ===\n');

  const snapshot = await db.collection('playerTeams').get();
  console.log(`Checking ${snapshot.size} playerTeams...\n`);

  // Group by riderNameId
  const riderGroups = new Map<string, PlayerTeamData[]>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const riderNameId = data.riderNameId || 'unknown';
    const pointsBreakdown = data.pointsBreakdown || [];

    // Use raceSlug + stage as unique identifier
    const races = new Set<string>();
    if (Array.isArray(pointsBreakdown)) {
      for (const entry of pointsBreakdown) {
        if (entry.raceSlug) {
          const key = entry.stage ? `${entry.raceSlug}|${entry.stage}` : entry.raceSlug;
          races.add(key);
        }
      }
    }

    const playerTeamData: PlayerTeamData = {
      docId: doc.id,
      gameId: data.gameId || 'Unknown',
      participantId: data.participantId || 'Unknown',
      pointsScored: data.pointsScored || 0,
      races,
      breakdown: pointsBreakdown,
    };

    const list = riderGroups.get(riderNameId) || [];
    list.push(playerTeamData);
    riderGroups.set(riderNameId, list);
  }

  console.log(`Found ${riderGroups.size} unique riders\n`);

  // Check each rider group for inconsistencies
  const inconsistentRiders: Array<{
    riderNameId: string;
    allRaces: string[];
    documents: Array<{
      docId: string;
      gameId: string;
      pointsScored: number;
      missingRaces: string[];
      hasRaces: string[];
    }>;
  }> = [];

  for (const [riderNameId, documents] of riderGroups) {
    // Get all unique races across all documents for this rider
    const allRaces = new Set<string>();
    for (const doc of documents) {
      for (const race of doc.races) {
        allRaces.add(race);
      }
    }

    // Skip if no races at all
    if (allRaces.size === 0) continue;

    // Check if any document is missing races
    const docsWithMissingRaces: Array<{
      docId: string;
      gameId: string;
      pointsScored: number;
      missingRaces: string[];
      hasRaces: string[];
    }> = [];

    for (const doc of documents) {
      const missingRaces: string[] = [];
      for (const race of allRaces) {
        if (!doc.races.has(race)) {
          missingRaces.push(race);
        }
      }

      if (missingRaces.length > 0) {
        docsWithMissingRaces.push({
          docId: doc.docId,
          gameId: doc.gameId,
          pointsScored: doc.pointsScored,
          missingRaces,
          hasRaces: Array.from(doc.races),
        });
      }
    }

    if (docsWithMissingRaces.length > 0) {
      inconsistentRiders.push({
        riderNameId,
        allRaces: Array.from(allRaces),
        documents: docsWithMissingRaces,
      });
    }
  }

  // Report results
  console.log(`=== RESULTS ===\n`);
  console.log(`Riders with inconsistent breakdown: ${inconsistentRiders.length}`);

  if (inconsistentRiders.length > 0) {
    console.log(`\n--- INCONSISTENT RIDERS ---\n`);

    for (const rider of inconsistentRiders) {
      console.log(`\n${rider.riderNameId}:`);
      console.log(`  All races this rider should have: ${rider.allRaces.join(', ')}`);
      console.log(`  Documents missing races: ${rider.documents.length}`);

      for (const doc of rider.documents.slice(0, 10)) {
        console.log(`\n  - Doc: ${doc.docId}`);
        console.log(`    Game: ${doc.gameId}`);
        console.log(`    Current points: ${doc.pointsScored}`);
        console.log(`    Has races: ${doc.hasRaces.length > 0 ? doc.hasRaces.join(', ') : '(none)'}`);
        console.log(`    MISSING: ${doc.missingRaces.join(', ')}`);
      }

      if (rider.documents.length > 10) {
        console.log(`\n  ... and ${rider.documents.length - 10} more documents`);
      }
    }

    // Summary table
    console.log(`\n\n=== SUMMARY TABLE ===\n`);
    console.log('Rider | Missing Docs | Missing Races');
    console.log('------|--------------|---------------');
    for (const rider of inconsistentRiders.slice(0, 50)) {
      const missingRaces = new Set<string>();
      for (const doc of rider.documents) {
        for (const race of doc.missingRaces) {
          missingRaces.add(race);
        }
      }
      console.log(`${rider.riderNameId} | ${rider.documents.length} | ${Array.from(missingRaces).join(', ')}`);
    }

    if (inconsistentRiders.length > 50) {
      console.log(`\n... and ${inconsistentRiders.length - 50} more riders`);
    }
  } else {
    console.log('\nAll riders are consistent! Every playerTeam has the same races in pointsBreakdown.');
  }
}

checkPointsConsistency().catch(console.error);
