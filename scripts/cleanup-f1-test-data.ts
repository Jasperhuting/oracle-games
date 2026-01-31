/**
 * Script to clean up F1 test/mockup data
 * Run with: npx ts-node scripts/cleanup-f1-test-data.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const f1Db = getFirestore(app, 'oracle-games-f1');

async function cleanupTestData() {
  console.log('Starting F1 test data cleanup...\n');

  // 1. Update race 2026_01 status to "upcoming"
  console.log('1. Updating race 2026_01 status to "upcoming"...');
  await f1Db.collection('races').doc('2026_01').update({
    status: 'upcoming',
  });
  console.log('   Done!\n');

  // 2. Delete test predictions (test_user_001 through test_user_010)
  console.log('2. Deleting test predictions...');
  const testPredictionsSnapshot = await f1Db.collection('predictions')
    .where('userId', '>=', 'test_user_')
    .where('userId', '<', 'test_user_~')
    .get();

  let deletedPredictions = 0;
  for (const doc of testPredictionsSnapshot.docs) {
    await doc.ref.delete();
    deletedPredictions++;
    console.log(`   Deleted prediction: ${doc.id}`);
  }
  console.log(`   Total predictions deleted: ${deletedPredictions}\n`);

  // 3. Delete test standings (test_user_001 through test_user_010)
  console.log('3. Deleting test standings...');
  const testStandingsSnapshot = await f1Db.collection('standings')
    .where('userId', '>=', 'test_user_')
    .where('userId', '<', 'test_user_~')
    .get();

  let deletedStandings = 0;
  for (const doc of testStandingsSnapshot.docs) {
    await doc.ref.delete();
    deletedStandings++;
    console.log(`   Deleted standing: ${doc.id}`);
  }
  console.log(`   Total standings deleted: ${deletedStandings}\n`);

  // 4. Delete real user's standing for race 1 (will be recalculated when race actually happens)
  console.log('4. Deleting real user standings for race 1...');
  const realUserStandingsSnapshot = await f1Db.collection('standings')
    .where('season', '==', 2026)
    .get();

  let deletedRealStandings = 0;
  for (const doc of realUserStandingsSnapshot.docs) {
    // Skip if it's a test user (already deleted above)
    if (doc.data().userId?.startsWith('test_user_')) continue;
    await doc.ref.delete();
    deletedRealStandings++;
    console.log(`   Deleted standing: ${doc.id}`);
  }
  console.log(`   Total real user standings deleted: ${deletedRealStandings}\n`);

  // 5. Unlock real user predictions for race 1 (since race hasn't happened)
  console.log('5. Unlocking real user predictions for race 1...');
  const realUserPredictionsSnapshot = await f1Db.collection('predictions')
    .where('raceId', '==', '2026_01')
    .get();

  let unlockedPredictions = 0;
  for (const doc of realUserPredictionsSnapshot.docs) {
    // Skip if it's a test user (already deleted above)
    if (doc.data().userId?.startsWith('test_user_')) continue;
    await doc.ref.update({
      isLocked: false,
    });
    unlockedPredictions++;
    console.log(`   Unlocked prediction: ${doc.id}`);
  }
  console.log(`   Total predictions unlocked: ${unlockedPredictions}\n`);

  console.log('Cleanup complete!');
}

cleanupTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error during cleanup:', error);
    process.exit(1);
  });
