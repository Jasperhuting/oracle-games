/**
 * Script to sync game participants to F1 participants collection
 * Run with: npx ts-node scripts/sync-f1-participants.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

// Main database (oracle-games)
const db = getFirestore(app);

// F1 database (oracle-games-f1)
const f1Db = getFirestore(app, 'oracle-games-f1');

const GAME_ID = 'DeyPaxhoheF3v4qIwUs1';

function createParticipantDocId(userId: string, season: number): string {
  return `${userId}_${season}`;
}

async function syncParticipants() {
  console.log(`Syncing participants from game ${GAME_ID} to F1 database...\n`);

  // 1. Get the game to find the season
  const gameDoc = await db.collection('games').doc(GAME_ID).get();
  if (!gameDoc.exists) {
    console.error('Game not found!');
    return;
  }

  const gameData = gameDoc.data();
  const season = gameData?.year || 2026;
  console.log(`Game: ${gameData?.name}`);
  console.log(`Season: ${season}`);
  console.log(`Game Type: ${gameData?.gameType}\n`);

  // 2. Get all participants from the gameParticipants collection
  const participantsSnapshot = await db
    .collection('gameParticipants')
    .where('gameId', '==', GAME_ID)
    .get();

  console.log(`Found ${participantsSnapshot.docs.length} participants in gameParticipants collection\n`);

  // 3. Get existing F1 participants to avoid duplicates
  const existingF1Participants = await f1Db
    .collection('participants')
    .where('season', '==', season)
    .get();

  const existingUserIds = new Set(existingF1Participants.docs.map(doc => doc.data().userId));
  console.log(`Existing F1 participants for season ${season}: ${existingUserIds.size}\n`);

  // 4. Sync each participant
  let created = 0;
  let skipped = 0;

  for (const participantDoc of participantsSnapshot.docs) {
    const participant = participantDoc.data();
    const userId = participant.userId || participant.oddsId || participantDoc.id;

    if (existingUserIds.has(userId)) {
      console.log(`  Skipping ${participant.playerName || userId} - already exists`);
      skipped++;
      continue;
    }

    // Get user info from users collection
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const displayName = participant.playerName || userData?.playername || userData?.name || 'Anonymous';

    const f1ParticipantDocId = createParticipantDocId(userId, season);

    await f1Db.collection('participants').doc(f1ParticipantDocId).set({
      userId,
      gameId: GAME_ID,
      season,
      displayName,
      joinedAt: participant.joinedAt || new Date(),
      status: 'active',
    });

    console.log(`  Created F1 participant: ${displayName} (${userId})`);
    created++;
  }

  console.log(`\nSync complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
}

syncParticipants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error during sync:', error);
    process.exit(1);
  });
