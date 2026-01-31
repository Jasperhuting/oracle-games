/**
 * Script to check public subleagues in F1 database
 * Run with: npx ts-node scripts/check-public-subleagues.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

// F1 database (oracle-games-f1)
const f1Db = getFirestore(app, 'oracle-games-f1');

async function checkPublicSubLeagues() {
  console.log('Checking all SubLeagues in F1 database...\n');

  // Get all subLeagues
  const allSnapshot = await f1Db.collection('subLeagues').get();
  console.log(`Total subLeagues: ${allSnapshot.docs.length}\n`);

  for (const doc of allSnapshot.docs) {
    const data = doc.data();
    console.log(`=== ${data.name} (${doc.id}) ===`);
    console.log(`  isPublic: ${data.isPublic}`);
    console.log(`  season: ${data.season}`);
    console.log(`  code: ${data.code}`);
    console.log(`  members: ${data.memberIds?.length || 0}`);
    console.log(`  pending: ${data.pendingMemberIds?.length || 0}`);
    console.log(`  description: ${data.description || '(none)'}`);
    console.log('');
  }

  // Check specifically for public ones
  console.log('\n=== Public SubLeagues (isPublic === true) ===');
  const publicSnapshot = await f1Db
    .collection('subLeagues')
    .where('isPublic', '==', true)
    .get();

  console.log(`Found ${publicSnapshot.docs.length} public subleagues`);
  publicSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.name} (season: ${data.season})`);
  });

  // Check with season filter
  console.log('\n=== Public SubLeagues (isPublic === true AND season === 2026) ===');
  const publicSeasonSnapshot = await f1Db
    .collection('subLeagues')
    .where('isPublic', '==', true)
    .where('season', '==', 2026)
    .get();

  console.log(`Found ${publicSeasonSnapshot.docs.length} public subleagues for 2026`);
  publicSeasonSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.name}`);
  });
}

checkPublicSubLeagues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
