/**
 * Script to check game structure
 * Run with: npx ts-node scripts/check-game-structure.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore(app);

const GAME_ID = 'DeyPaxhoheF3v4qIwUs1';

async function checkGame() {
  console.log(`Checking game ${GAME_ID}...\n`);

  const gameDoc = await db.collection('games').doc(GAME_ID).get();
  const data = gameDoc.data();

  console.log('Game data:');
  console.log(JSON.stringify(data, null, 2));

  // Check subcollections
  const collections = await gameDoc.ref.listCollections();
  console.log('\nSubcollections:', collections.map(c => c.id));

  // Check participants subcollection
  for (const collection of collections) {
    const docs = await collection.limit(5).get();
    console.log(`\n${collection.id} (${docs.docs.length} docs, showing first 5):`);
    for (const doc of docs.docs) {
      console.log(`  - ${doc.id}:`, JSON.stringify(doc.data(), null, 4).substring(0, 200));
    }
  }
}

checkGame()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
