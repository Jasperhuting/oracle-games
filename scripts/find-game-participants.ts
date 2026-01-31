/**
 * Script to find game participants
 * Run with: npx ts-node scripts/find-game-participants.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore(app);

const GAME_ID = 'DeyPaxhoheF3v4qIwUs1';

async function findParticipants() {
  console.log(`Finding participants for game ${GAME_ID}...\n`);

  // Check gameParticipants collection
  console.log('Checking gameParticipants collection...');
  const gameParticipants = await db
    .collection('gameParticipants')
    .where('gameId', '==', GAME_ID)
    .get();
  console.log(`  Found ${gameParticipants.docs.length} in gameParticipants\n`);

  if (gameParticipants.docs.length > 0) {
    console.log('Participants:');
    for (const doc of gameParticipants.docs) {
      const data = doc.data();
      console.log(`  - ${data.playerName || data.userId} (userId: ${data.userId || data.oddsId})`);
    }
    return gameParticipants.docs;
  }

  // Check participants collection at root
  console.log('Checking participants collection...');
  const participants = await db
    .collection('participants')
    .where('gameId', '==', GAME_ID)
    .get();
  console.log(`  Found ${participants.docs.length} in participants\n`);

  if (participants.docs.length > 0) {
    console.log('Participants:');
    for (const doc of participants.docs) {
      const data = doc.data();
      console.log(`  - ${data.playerName || data.userId} (userId: ${data.userId || data.oddsId})`);
    }
    return participants.docs;
  }

  // List all collections to find where participants might be
  console.log('\nListing all root collections:');
  const collections = await db.listCollections();
  for (const collection of collections) {
    console.log(`  - ${collection.id}`);
  }

  return [];
}

findParticipants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
