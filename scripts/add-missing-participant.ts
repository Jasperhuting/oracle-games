/**
 * Script to add missing participant to F1 database
 * Run with: npx ts-node scripts/add-missing-participant.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

// Main database
const db = getFirestore(app);

// F1 database
const f1Db = getFirestore(app, 'oracle-games-f1');

const MISSING_USER_ID = 'susJrdCk7KPOGdxM5JI9WfThW1o2';
const GAME_ID = 'DeyPaxhoheF3v4qIwUs1';
const SEASON = 2026;

function createParticipantDocId(userId: string, season: number): string {
  return `${userId}_${season}`;
}

async function addMissingParticipant() {
  console.log(`Adding missing participant ${MISSING_USER_ID} to F1 database...\n`);

  // Check if already exists
  const docId = createParticipantDocId(MISSING_USER_ID, SEASON);
  const existingDoc = await f1Db.collection('participants').doc(docId).get();

  if (existingDoc.exists) {
    console.log('Participant already exists!');
    return;
  }

  // Get user info
  const userDoc = await db.collection('users').doc(MISSING_USER_ID).get();
  const userData = userDoc.data();
  const displayName = userData?.playername || userData?.name || userData?.email || 'Anonymous';

  console.log(`User info: ${displayName}`);

  // Create participant
  await f1Db.collection('participants').doc(docId).set({
    userId: MISSING_USER_ID,
    gameId: GAME_ID,
    season: SEASON,
    displayName,
    joinedAt: new Date(),
    status: 'active',
  });

  console.log(`\nCreated F1 participant: ${displayName} (${MISSING_USER_ID})`);
}

addMissingParticipant()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
