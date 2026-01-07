/**
 * Test script for retire-with-refund functionality
 *
 * Usage:
 *   npx tsx scripts/test-retire-with-refund.ts <riderNameId> [--execute]
 *
 * Examples:
 *   npx tsx scripts/test-retire-with-refund.ts tadej-pogacar          # Dry run only
 *   npx tsx scripts/test-retire-with-refund.ts tadej-pogacar --execute # Actually execute
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env');
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
}

const db = getFirestore();
const YEAR = '2026';

interface AffectedParticipant {
  participantId: string;
  gameId: string;
  gameName: string;
  userId: string;
  playername: string;
  pricePaid: number;
  playerTeamDocId: string;
  currentSpentBudget: number;
  currentRosterSize: number;
}

async function testRetireWithRefund(riderNameId: string, execute: boolean = false) {
  console.log('='.repeat(60));
  console.log(`TEST: Retire with Refund`);
  console.log(`Rider: ${riderNameId}`);
  console.log(`Mode: ${execute ? '🔴 EXECUTE (will make changes!)' : '🟢 DRY RUN (no changes)'}`);
  console.log('='.repeat(60));
  console.log('');

  // 1. Find the rider (try by document ID first, then by nameID field)
  console.log('1. Looking up rider...');

  let riderDocId: string | null = null;
  let riderData: FirebaseFirestore.DocumentData | undefined;

  // First try by document ID
  const riderDocById = await db.collection(`rankings_${YEAR}`).doc(riderNameId).get();
  if (riderDocById.exists) {
    riderDocId = riderDocById.id;
    riderData = riderDocById.data();
  } else {
    // Try by nameID field
    const riderSnapshot = await db.collection(`rankings_${YEAR}`)
      .where('nameID', '==', riderNameId)
      .limit(1)
      .get();

    if (!riderSnapshot.empty) {
      riderDocId = riderSnapshot.docs[0].id;
      riderData = riderSnapshot.docs[0].data();
    }
  }

  if (!riderDocId || !riderData) {
    console.error(`   ❌ Rider not found: ${riderNameId}`);
    return;
  }

  const actualNameId = riderData.nameID || riderNameId;
  console.log(`   ✅ Found rider: ${riderData.name} (doc ID: ${riderDocId}, nameID: ${actualNameId})`);
  console.log(`   Current retired status: ${riderData.retired || false}`);
  console.log('');

  // 2. Find all playerTeams with this rider
  console.log('2. Finding playerTeams with this rider...');
  const playerTeamsSnapshot = await db.collection('playerTeams')
    .where('riderNameId', '==', actualNameId)
    .where('active', '==', true)
    .get();

  console.log(`   Found ${playerTeamsSnapshot.size} active playerTeams`);
  console.log('');

  if (playerTeamsSnapshot.empty) {
    console.log('   No participants have this rider in their team.');
    console.log('   The rider will simply be marked as retired (no refunds needed).');
    return;
  }

  // 3. Get details for each affected participant
  console.log('3. Gathering participant details...');
  const affectedParticipants: AffectedParticipant[] = [];
  const gameIds = new Set<string>();

  for (const ptDoc of playerTeamsSnapshot.docs) {
    const ptData = ptDoc.data();
    gameIds.add(ptData.gameId);
  }

  // Get game names
  const gamesMap = new Map<string, string>();
  for (const gameId of gameIds) {
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (gameDoc.exists) {
      gamesMap.set(gameId, gameDoc.data()?.name || gameId);
    }
  }

  for (const ptDoc of playerTeamsSnapshot.docs) {
    const ptData = ptDoc.data();
    const { gameId, userId, pricePaid = 0 } = ptData;

    // Get participant info
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!participantSnapshot.empty) {
      const participantDoc = participantSnapshot.docs[0];
      const participantData = participantDoc.data();

      affectedParticipants.push({
        participantId: participantDoc.id,
        gameId,
        gameName: gamesMap.get(gameId) || gameId,
        userId,
        playername: participantData.playername || userId,
        pricePaid,
        playerTeamDocId: ptDoc.id,
        currentSpentBudget: participantData.spentBudget || 0,
        currentRosterSize: participantData.rosterSize || 0,
      });
    }
  }

  // 4. Display summary
  console.log('');
  console.log('='.repeat(60));
  console.log('AFFECTED PARTICIPANTS:');
  console.log('='.repeat(60));
  console.log('');

  let totalRefund = 0;
  for (const p of affectedParticipants) {
    console.log(`📋 ${p.playername}`);
    console.log(`   Game: ${p.gameName}`);
    console.log(`   Price Paid: €${p.pricePaid}`);
    console.log(`   Current spentBudget: €${p.currentSpentBudget} → €${Math.max(0, p.currentSpentBudget - p.pricePaid)}`);
    console.log(`   Current rosterSize: ${p.currentRosterSize} → ${Math.max(0, p.currentRosterSize - 1)}`);
    console.log('');
    totalRefund += p.pricePaid;
  }

  console.log('='.repeat(60));
  console.log(`TOTAL: ${affectedParticipants.length} participants, €${totalRefund} refund`);
  console.log('='.repeat(60));
  console.log('');

  // 5. Execute if requested
  if (execute) {
    console.log('🔴 EXECUTING CHANGES...');
    console.log('');

    for (const p of affectedParticipants) {
      try {
        // Deactivate playerTeam
        await db.collection('playerTeams').doc(p.playerTeamDocId).update({
          active: false,
          removedAt: new Date(),
          removalReason: 'rider_retired_with_refund',
        });
        console.log(`   ✅ Deactivated playerTeam for ${p.playername}`);

        // Update participant
        const newSpentBudget = Math.max(0, p.currentSpentBudget - p.pricePaid);
        const newRosterSize = Math.max(0, p.currentRosterSize - 1);

        await db.collection('gameParticipants').doc(p.participantId).update({
          spentBudget: newSpentBudget,
          rosterSize: newRosterSize,
          rosterComplete: false,
        });
        console.log(`   ✅ Refunded €${p.pricePaid} to ${p.playername}`);
      } catch (error) {
        console.error(`   ❌ Error processing ${p.playername}:`, error);
      }
    }

    // Mark rider as retired
    await db.collection(`rankings_${YEAR}`).doc(riderDocId).update({
      retired: true,
      updatedAt: new Date(),
    });
    console.log('');
    console.log(`   ✅ Marked rider as retired`);

    console.log('');
    console.log('🎉 DONE! All changes have been applied.');
  } else {
    console.log('🟢 DRY RUN COMPLETE - No changes made.');
    console.log('');
    console.log('To execute these changes, run:');
    console.log(`   npx tsx scripts/test-retire-with-refund.ts ${riderNameId} --execute`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const riderNameId = args[0];
const execute = args.includes('--execute');

if (!riderNameId) {
  console.log('Usage: npx tsx scripts/test-retire-with-refund.ts <riderNameId> [--execute]');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/test-retire-with-refund.ts tadej-pogacar');
  console.log('  npx tsx scripts/test-retire-with-refund.ts tadej-pogacar --execute');
  process.exit(1);
}

testRetireWithRefund(riderNameId, execute)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
