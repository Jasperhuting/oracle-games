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

async function findUniqueWTMRiders() {
  console.log('=== FIND UNIQUE WORLDTOUR MANAGER RIDERS ===\n');

  // Get all playerTeams
  const allPlayerTeams = await db.collection('playerTeams').get();
  console.log(`Total playerTeams: ${allPlayerTeams.size}\n`);

  // Collect riders per game
  const wtmRiders = new Set<string>();
  const otherGamesRiders = new Set<string>();

  for (const doc of allPlayerTeams.docs) {
    const data = doc.data();
    const riderNameId = data.riderNameId;
    const gameId = data.gameId;

    if (gameId === WORLDTOUR_MANAGER_GAME_ID) {
      wtmRiders.add(riderNameId);
    } else {
      otherGamesRiders.add(riderNameId);
    }
  }

  console.log(`WorldTour Manager riders: ${wtmRiders.size}`);
  console.log(`Other games riders: ${otherGamesRiders.size}\n`);

  // Find riders unique to WTM
  const uniqueToWTM: string[] = [];
  for (const rider of wtmRiders) {
    if (!otherGamesRiders.has(rider)) {
      uniqueToWTM.push(rider);
    }
  }

  console.log(`=== RIDERS ONLY IN WORLDTOUR MANAGER ===\n`);
  console.log(`Found ${uniqueToWTM.length} riders unique to WorldTour Manager:\n`);

  // Sort alphabetically
  uniqueToWTM.sort();

  for (const rider of uniqueToWTM) {
    console.log(`  - ${rider}`);
  }

  // Also show which participants have these unique riders
  console.log(`\n=== DETAILS ===\n`);

  for (const rider of uniqueToWTM) {
    const docs = allPlayerTeams.docs.filter(
      (d) => d.data().riderNameId === rider && d.data().gameId === WORLDTOUR_MANAGER_GAME_ID
    );

    console.log(`${rider}:`);
    for (const doc of docs) {
      const data = doc.data();
      console.log(`  - Participant: ${data.participantId}, Points: ${data.pointsScored || 0}`);
    }
  }
}

findUniqueWTMRiders().catch(console.error);
