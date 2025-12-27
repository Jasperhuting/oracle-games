/**
 * Script to remove a user (participant) from a game completely
 *
 * This script:
 * 1. Removes the gameParticipant entry
 * 2. Sets all playerTeams entries to active: false (makes riders available again)
 * 3. Removes all bids (or sets them to 'lost' status)
 * 4. Updates game playerCount
 *
 * Usage:
 *   # Dry run (preview changes, no actual modifications)
 *   npm run tsx scripts/remove-user-from-game.ts <gameId> <userId>
 *
 *   # Live mode (actually make changes)
 *   npm run tsx scripts/remove-user-from-game.ts <gameId> <userId> --live
 *
 * Examples:
 *   # Preview removing a user from a game
 *   npm run tsx scripts/remove-user-from-game.ts game123 user456
 *
 *   # Actually remove the user (live mode)
 *   npm run tsx scripts/remove-user-from-game.ts game123 user456 --live
 */

// Load environment variables first, before any Firebase imports
import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
  pricePaid?: number;
  acquiredAt: any;
  acquisitionType: string;
  active: boolean;
  pointsScored: number;
}

interface Bid {
  id: string;
  gameId: string;
  userId: string;
  riderNameId: string;
  riderName?: string;
  amount: number;
  status: 'active' | 'outbid' | 'won' | 'lost';
}

interface GameParticipant {
  id: string;
  gameId: string;
  userId: string;
  playername: string;
  budget?: number;
  spentBudget?: number;
  rosterSize: number;
  totalPoints: number;
}

interface Game {
  id: string;
  name: string;
  playerCount: number;
}

async function removeUserFromGame(
  gameId: string,
  userId: string,
  dryRun: boolean = true
) {
  console.log('=== Remove User from Game ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will remove user)'}`);
  console.log(`GameId: ${gameId}`);
  console.log(`UserId: ${userId}`);
  console.log('');

  // Step 1: Get game info
  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    console.error('❌ Game not found');
    process.exit(1);
  }
  const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
  console.log(`Game: ${game.name}`);
  console.log(`Current player count: ${game.playerCount}`);
  console.log('');

  // Step 2: Get participant info
  const participantSnapshot = await db
    .collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (participantSnapshot.empty) {
    console.error('❌ Participant not found in this game');
    process.exit(1);
  }

  const participantDoc = participantSnapshot.docs[0];
  const participant = { id: participantDoc.id, ...participantDoc.data() } as GameParticipant;
  console.log(`Found participant: ${participant.playername}`);
  console.log(`Budget: ${participant.budget || 0}`);
  console.log(`Spent budget: ${participant.spentBudget || 0}`);
  console.log(`Roster size: ${participant.rosterSize}`);
  console.log(`Total points: ${participant.totalPoints}`);
  console.log('');

  // Step 3: Get all player teams (both active and inactive)
  const playerTeamsSnapshot = await db
    .collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const playerTeams = playerTeamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerTeam));
  const activePlayerTeams = playerTeams.filter(pt => pt.active);
  const inactivePlayerTeams = playerTeams.filter(pt => !pt.active);

  console.log(`Player teams:`);
  console.log(`  - Active: ${activePlayerTeams.length}`);
  console.log(`  - Inactive: ${inactivePlayerTeams.length}`);
  console.log(`  - Total: ${playerTeams.length}`);

  if (playerTeams.length > 0) {
    console.log('');
    console.log('All riders to be removed:');
    playerTeams.forEach(pt => {
      console.log(`  - ${pt.riderName} (${pt.riderNameId}): ${pt.pricePaid || 0} credits, ${pt.pointsScored} points ${pt.active ? '[ACTIVE]' : '[INACTIVE]'}`);
    });
  }
  console.log('');

  // Step 4: Get all bids
  const bidsSnapshot = await db
    .collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const bids = bidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bid));
  const wonBids = bids.filter(b => b.status === 'won');
  const activeBids = bids.filter(b => b.status === 'active');
  const otherBids = bids.filter(b => b.status !== 'won' && b.status !== 'active');

  console.log(`Bids:`);
  console.log(`  - Won: ${wonBids.length}`);
  console.log(`  - Active: ${activeBids.length}`);
  console.log(`  - Other (outbid/lost): ${otherBids.length}`);
  console.log(`  - Total: ${bids.length}`);
  console.log('');

  // Step 5: Check for stage picks or other related data
  const stagePicksSnapshot = await db
    .collection('stagePicks')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  console.log(`Stage picks: ${stagePicksSnapshot.size}`);
  console.log('');

  // Step 6: Summary
  console.log('=== SUMMARY ===');
  console.log(`Participant to DELETE: 1`);
  console.log(`PlayerTeams to DELETE: ${playerTeams.length} (${activePlayerTeams.length} active, ${inactivePlayerTeams.length} inactive)`);
  console.log(`Bids to DELETE: ${bids.length} (${wonBids.length} won, ${activeBids.length} active, ${otherBids.length} other)`);
  console.log(`Stage picks to DELETE: ${stagePicksSnapshot.size}`);
  console.log(`Game player count: ${game.playerCount} → ${game.playerCount - 1}`);
  console.log('');

  if (!dryRun) {
    console.log('⚠️  STARTING REMOVAL...');
    console.log('');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 500;

    const commitBatch = async () => {
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✓ Committed batch (${batchCount} operations)`);
        batch = db.batch();
        batchCount = 0;
      }
    };

    // 1. Delete ALL playerTeams (both active and inactive)
    console.log('1. Deleting ALL playerTeams...');
    for (const pt of playerTeams) {
      const ref = db.collection('playerTeams').doc(pt.id);
      batch.delete(ref);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await commitBatch();
    }
    await commitBatch();

    // 2. Delete ALL bids (won, active, and other)
    console.log('2. Deleting ALL bids...');
    for (const bid of bids) {
      const ref = db.collection('bids').doc(bid.id);
      batch.delete(ref);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await commitBatch();
    }
    await commitBatch();

    // 3. Delete stage picks
    console.log('3. Deleting stage picks...');
    for (const doc of stagePicksSnapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) await commitBatch();
    }
    await commitBatch();

    // 4. Delete participant
    console.log('4. Deleting participant...');
    batch.delete(db.collection('gameParticipants').doc(participantDoc.id));
    batchCount++;
    await commitBatch();

    // 5. Update game playerCount
    console.log('5. Updating game player count...');
    batch.update(db.collection('games').doc(gameId), {
      playerCount: FieldValue.increment(-1)
    });
    batchCount++;
    await commitBatch();

    // 6. Trigger cache invalidation
    console.log('6. Triggering cache invalidation...');
    await db.collection('system').doc('cacheInvalidation').set({
      lastInvalidated: FieldValue.serverTimestamp(),
      reason: 'User removed from game (CLI)',
      gameId,
      userId,
    }, { merge: true });

    console.log('');
    console.log('✅ User successfully removed from game');
    console.log('');
    console.log('Summary:');
    console.log(`  - ${playerTeams.length} playerTeams DELETED`);
    console.log(`  - ${bids.length} bids DELETED`);
    console.log(`  - ${stagePicksSnapshot.size} stage picks DELETED`);
    console.log(`  - 1 participant DELETED`);
    console.log(`  - Game player count decremented`);
    console.log('');
    console.log('⚠️  IMPORTANT: Refresh your browser (F5) to see the updated data!');
    console.log('   The cache is stored in sessionStorage and needs manual refresh.');
  } else {
    console.log('ℹ️  DRY RUN - No changes made. Run with --live to actually remove the user.');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ Usage: npm run tsx scripts/remove-user-from-game.ts <gameId> <userId> [--live]');
  console.error('');
  console.error('Examples:');
  console.error('  npm run tsx scripts/remove-user-from-game.ts game123 user456');
  console.error('  npm run tsx scripts/remove-user-from-game.ts game123 user456 --live');
  process.exit(1);
}

const gameId = args[0];
const userId = args[1];
const isLive = args.includes('--live');

removeUserFromGame(gameId, userId, !isLive)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
