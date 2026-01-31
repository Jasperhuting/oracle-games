/**
 * Script to check subleagues and their members
 * Run with: npx ts-node scripts/check-subleagues.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

// F1 database (oracle-games-f1)
const f1Db = getFirestore(app, 'oracle-games-f1');

async function checkSubLeagues() {
  console.log('Checking F1 SubLeagues...\n');

  // Get all subLeagues
  const subLeaguesSnapshot = await f1Db.collection('subLeagues').get();
  console.log(`Found ${subLeaguesSnapshot.docs.length} subLeagues\n`);

  // Get all participants for comparison
  const participantsSnapshot = await f1Db.collection('participants').where('season', '==', 2026).get();
  const participantUserIds = new Set(participantsSnapshot.docs.map(doc => doc.data().userId));
  console.log(`Found ${participantUserIds.size} F1 participants for season 2026\n`);

  for (const doc of subLeaguesSnapshot.docs) {
    const subLeague = doc.data();
    console.log(`\n=== SubLeague: ${subLeague.name} (${doc.id}) ===`);
    console.log(`  Code: ${subLeague.code}`);
    console.log(`  Season: ${subLeague.season}`);
    console.log(`  Created by: ${subLeague.createdBy}`);
    console.log(`  Members (${subLeague.memberIds?.length || 0}):`);

    if (subLeague.memberIds && subLeague.memberIds.length > 0) {
      for (const memberId of subLeague.memberIds) {
        const isParticipant = participantUserIds.has(memberId);
        console.log(`    - ${memberId} ${isParticipant ? '✓ (is F1 participant)' : '✗ (NOT a F1 participant)'}`);
      }
    } else {
      console.log('    (no members)');
    }
  }

  // Show all participants for reference
  console.log('\n\n=== All F1 Participants ===');
  for (const doc of participantsSnapshot.docs) {
    const p = doc.data();
    console.log(`  - ${p.displayName} (${p.userId})`);
  }
}

checkSubLeagues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
