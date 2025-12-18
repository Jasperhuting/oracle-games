/**
 * Rollback Script: Undo Period 2 Finalization
 *
 * This script undoes the accidental finalization of Period 2 bids that happened on Dec 18, 2025
 * Period 2 should not be finalized until Dec 19, 2025 at 22:01
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('/Users/jasperhuting/Documents/projecten/oracle games/backend-motia/service-account-key.json', 'utf8')
);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

const GAME_ID = 'xLbOq9mbPf6XJMIvzp2R'; // Auction Master (Season) - Division 1
const PERIOD_2_START = new Date('2025-12-16T00:00:00.000Z');

async function rollbackPeriod2() {
  console.log('🔄 Starting Period 2 rollback...');

  // Step 1: Find all bids from Period 2 (after Dec 16, 2025)
  console.log('\n📋 Step 1: Finding Period 2 bids...');
  const allBidsSnapshot = await db.collection('bids')
    .where('gameId', '==', GAME_ID)
    .get();

  const period2Bids = allBidsSnapshot.docs.filter(doc => {
    const bidData = doc.data();
    const bidAt = bidData.bidAt?.toDate?.() || new Date(bidData.bidAt);
    return bidAt >= PERIOD_2_START;
  });

  console.log(`Found ${period2Bids.length} Period 2 bids`);

  // Group by status
  const wonBids = period2Bids.filter(doc => doc.data().status === 'won');
  const lostBids = period2Bids.filter(doc => doc.data().status === 'lost');

  console.log(`  - ${wonBids.length} won bids`);
  console.log(`  - ${lostBids.length} lost bids`);

  // Step 2: Collect affected riders and users
  const affectedRiders = new Set<string>();
  const affectedUsers = new Set<string>();

  wonBids.forEach(doc => {
    const bidData = doc.data();
    affectedRiders.add(bidData.riderNameId);
    affectedUsers.add(bidData.userId);
  });

  console.log(`\n👥 Affected: ${affectedUsers.size} users, ${affectedRiders.size} riders`);

  // Step 3: Reset all Period 2 bids to "active"
  console.log('\n🔄 Step 2: Resetting bids to active...');
  const batch1 = db.batch();
  let count = 0;

  for (const bidDoc of period2Bids) {
    batch1.update(bidDoc.ref, { status: 'active' });
    count++;

    if (count % 500 === 0) {
      await batch1.commit();
      console.log(`  Processed ${count} bids...`);
    }
  }

  if (count % 500 !== 0) {
    await batch1.commit();
  }
  console.log(`✅ Reset ${count} bids to active`);

  // Step 4: Remove Period 2 riders from teams and refund budget
  console.log('\n💰 Step 3: Removing riders from teams and refunding budget...');

  for (const userId of affectedUsers) {
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!participantSnapshot.empty) {
      const participantDoc = participantSnapshot.docs[0];
      const participantData = participantDoc.data();

      const currentTeam = participantData.team || [];
      const currentSpentBudget = participantData.spentBudget || 0;

      // Find Period 2 riders (those acquired recently)
      // We'll identify them by checking if they were won in our wonBids list
      const period2RiderIds = wonBids
        .filter(doc => doc.data().userId === userId && doc.data().status === 'won')
        .map(doc => doc.data().riderNameId);

      const period2RidersInTeam = currentTeam.filter((rider: any) =>
        period2RiderIds.includes(rider.riderNameId)
      );

      if (period2RidersInTeam.length === 0) {
        console.log(`  User ${userId}: No Period 2 riders to remove`);
        continue;
      }

      // Calculate refund amount
      const refundAmount = period2RidersInTeam.reduce((sum: number, rider: any) =>
        sum + (rider.pricePaid || 0), 0
      );

      // Remove Period 2 riders from team
      const newTeam = currentTeam.filter((rider: any) =>
        !period2RiderIds.includes(rider.riderNameId)
      );

      const newSpentBudget = currentSpentBudget - refundAmount;

      console.log(`  User ${userId}:`);
      console.log(`    - Removing ${period2RidersInTeam.length} riders`);
      console.log(`    - Refunding €${refundAmount}`);
      console.log(`    - Budget: €${currentSpentBudget} → €${newSpentBudget}`);

      await participantDoc.ref.update({
        team: newTeam,
        spentBudget: newSpentBudget,
        rosterSize: newTeam.length,
      });
    }
  }

  // Step 5: Delete Period 2 PlayerTeam documents
  console.log('\n🗑️  Step 4: Deleting Period 2 PlayerTeam documents...');

  const playerTeamsSnapshot = await db.collection('playerTeams')
    .where('gameId', '==', GAME_ID)
    .get();

  const batch2 = db.batch();
  let deletedCount = 0;

  for (const doc of playerTeamsSnapshot.docs) {
    const data = doc.data();
    const acquiredAt = data.acquiredAt?.toDate?.() || new Date(data.acquiredAt);

    // Delete if acquired after Period 2 started
    if (acquiredAt >= PERIOD_2_START) {
      batch2.delete(doc.ref);
      deletedCount++;
      console.log(`  Deleting PlayerTeam: ${data.riderName} for user ${data.userId}`);
    }
  }

  await batch2.commit();
  console.log(`✅ Deleted ${deletedCount} PlayerTeam documents`);

  console.log('\n✅ Rollback complete!');
  console.log('\nSummary:');
  console.log(`  - Reset ${period2Bids.length} bids to active`);
  console.log(`  - Updated ${affectedUsers.size} user teams`);
  console.log(`  - Deleted ${deletedCount} PlayerTeam documents`);
  console.log('\n⚠️  Next steps:');
  console.log('  1. Verify the data looks correct in Firebase');
  console.log('  2. Update Period 1 status to "finalized" in Firebase manually');
  console.log('  3. Deploy the fixed finalize API that respects auctionPeriodName');
}

// Run the rollback
rollbackPeriod2().catch(console.error);
