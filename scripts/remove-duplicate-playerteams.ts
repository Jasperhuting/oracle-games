/**
 * Script to remove duplicate PlayerTeam documents
 *
 * This script finds and removes duplicate playerTeams documents where the same user
 * has multiple entries for the same rider in the same game.
 *
 * It keeps the OLDEST entry (earliest acquiredAt) and removes the newer duplicates.
 */

// Load environment variables first, before any Firebase imports
import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env.local');
    console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });

  console.log('✅ Firebase Admin initialized');
}

const db = getFirestore();

interface PlayerTeam {
  id: string;
  gameId: string;
  userId: string;
  riderNameId: string;
  riderName: string;
  pricePaid: number;
  acquiredAt: any;
  acquisitionType: string;
}

async function removeDuplicatePlayerTeams(gameId?: string, dryRun: boolean = true) {
  console.log('=== Remove Duplicate PlayerTeams ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will delete duplicates)'}`);
  console.log(`GameId filter: ${gameId || 'ALL GAMES'}`);
  console.log('');

  // Build query
  let query = db.collection('playerTeams');
  if (gameId) {
    query = query.where('gameId', '==', gameId) as any;
  }

  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} total playerTeams documents`);

  // Group by gameId + userId + riderNameId
  const groups = new Map<string, PlayerTeam[]>();

  snapshot.docs.forEach(doc => {
    const data = doc.data() as PlayerTeam;
    const key = `${data.gameId}_${data.userId}_${data.riderNameId}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push({
      ...data,
      id: doc.id,
    });
  });

  console.log(`Found ${groups.size} unique combinations`);

  // Find duplicates
  const duplicateGroups = Array.from(groups.entries()).filter(([_, docs]) => docs.length > 1);
  console.log(`Found ${duplicateGroups.length} groups with duplicates`);
  console.log('');

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  // Process duplicates
  let totalDuplicatesToRemove = 0;
  const deletionPlan: Array<{key: string; toKeep: PlayerTeam; toDelete: PlayerTeam[]}> = [];

  for (const [key, docs] of duplicateGroups) {
    const [gameId, userId, riderNameId] = key.split('_');

    // Sort by acquiredAt (oldest first)
    docs.sort((a, b) => {
      const timeA = a.acquiredAt?.toDate?.() || new Date(a.acquiredAt);
      const timeB = b.acquiredAt?.toDate?.() || new Date(b.acquiredAt);
      return timeA.getTime() - timeB.getTime();
    });

    const toKeep = docs[0];
    const toDelete = docs.slice(1);

    deletionPlan.push({ key, toKeep, toDelete });
    totalDuplicatesToRemove += toDelete.length;

    console.log(`Duplicate found for: ${toKeep.riderName} (gameId: ${gameId})`);
    console.log(`  User: ${userId}`);
    console.log(`  Total entries: ${docs.length}`);
    console.log(`  Keeping: ${toKeep.id} (acquired: ${toKeep.acquiredAt?.toDate?.() || toKeep.acquiredAt})`);
    console.log(`  Deleting: ${toDelete.map(d => `${d.id} (${d.acquiredAt?.toDate?.() || d.acquiredAt})`).join(', ')}`);
    console.log('');
  }

  console.log(`Total duplicates to remove: ${totalDuplicatesToRemove}`);
  console.log('');

  // Summary by game
  const gameStats = new Map<string, { gameName: string; count: number; riders: Set<string> }>();
  for (const { key, toDelete } of deletionPlan) {
    const [gameId] = key.split('_');
    const riderName = toDelete[0].riderName;

    if (!gameStats.has(gameId)) {
      gameStats.set(gameId, { gameName: toDelete[0].riderName, count: 0, riders: new Set() });
    }
    const stats = gameStats.get(gameId)!;
    stats.count += toDelete.length;
    stats.riders.add(riderName);
  }

  console.log('=== SUMMARY BY GAME ===');
  for (const [gameId, stats] of gameStats) {
    console.log(`Game ${gameId}:`);
    console.log(`  Total duplicates to remove: ${stats.count}`);
    console.log(`  Unique riders affected: ${stats.riders.size}`);
  }
  console.log('');

  if (!dryRun) {
    console.log('⚠️  STARTING DELETION...');

    const batch = db.batch();
    let batchCount = 0;
    let totalDeleted = 0;

    for (const { toDelete } of deletionPlan) {
      for (const doc of toDelete) {
        batch.delete(db.collection('playerTeams').doc(doc.id));
        batchCount++;
        totalDeleted++;

        // Firestore batch limit is 500
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  Committed batch (deleted ${totalDeleted} so far)`);
          batchCount = 0;
        }
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  Committed final batch`);
    }

    console.log(`✅ Deleted ${totalDeleted} duplicate documents`);
  } else {
    console.log('ℹ️  DRY RUN - No changes made. Run with --live to actually delete duplicates.');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const gameIdArg = args.find(arg => !arg.startsWith('--'));
const isLive = args.includes('--live');

removeDuplicatePlayerTeams(gameIdArg, !isLive)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
