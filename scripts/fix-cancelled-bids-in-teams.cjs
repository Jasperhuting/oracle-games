/**
 * Fix script: Remove riders from teams that were cancelled by users but ended up in teams anyway
 *
 * Problem: When users cancel bids, the bid is deleted from the database. However, the fix scripts
 * that ran earlier processed bids without knowing about these cancellations. As a result, some
 * riders that users cancelled ended up in their teams anyway.
 *
 * Solution:
 * 1. Get all BID_CANCELLED activity logs for the game
 * 2. For each cancelled bid, check if the rider is in the user's team
 * 3. If the rider is in the team AND there's no current "won" bid for that rider by that user,
 *    remove the rider from the team
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const GAME_ID = 'mGzPZfIOb2gAyEu0i6t6'; // WorldTour Manager
const DRY_RUN = false; // Set to false to actually make changes

async function fixCancelledBidsInTeams() {
  console.log('='.repeat(60));
  console.log('Fix Cancelled Bids in Teams');
  console.log('='.repeat(60));
  console.log(`Game ID: ${GAME_ID}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be made)'}`);
  console.log('');

  // Step 1: Get all BID_CANCELLED activity logs for this game
  console.log('Step 1: Fetching BID_CANCELLED activity logs...');
  const cancelledLogsSnapshot = await db.collection('activityLogs')
    .where('action', '==', 'BID_CANCELLED')
    .where('details.gameId', '==', GAME_ID)
    .get();

  console.log(`Found ${cancelledLogsSnapshot.size} cancelled bids`);

  // Group cancelled bids by user
  const cancelledByUser = new Map();
  cancelledLogsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const userId = data.userId;
    const riderNameId = data.details?.riderNameId;
    const cancelledAt = data.timestamp?.toDate?.() || new Date(data.timestamp);

    if (!userId || !riderNameId) return;

    if (!cancelledByUser.has(userId)) {
      cancelledByUser.set(userId, []);
    }
    cancelledByUser.get(userId).push({
      riderNameId,
      cancelledAt,
      userName: data.userName,
      riderName: data.details?.riderName,
    });
  });

  console.log(`Found ${cancelledByUser.size} users with cancelled bids`);
  console.log('');

  // Step 2: For each user, check if cancelled riders are in their team
  console.log('Step 2: Checking if cancelled riders are in teams...');

  const ridersToRemove = []; // { participantId, participantDoc, userId, userName, riderNameId, riderName }

  for (const [userId, cancelledRiders] of cancelledByUser) {
    // Get user's participant doc
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      console.log(`  User ${userId} (${cancelledRiders[0]?.userName}) has no participant doc, skipping`);
      continue;
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();
    const team = participantData.team || [];

    // Get user's current bids with status "won"
    const wonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    const wonRiderIds = new Set(wonBidsSnapshot.docs.map(doc => doc.data().riderNameId));

    // Check each cancelled rider
    for (const cancelled of cancelledRiders) {
      const riderInTeam = team.find(r => r.riderNameId === cancelled.riderNameId);

      if (riderInTeam) {
        // Rider is in team - check if there's a current "won" bid
        if (wonRiderIds.has(cancelled.riderNameId)) {
          // There's a won bid - user re-selected this rider, this is fine
          console.log(`  ✓ ${cancelled.userName}: ${cancelled.riderName} - cancelled but re-selected (OK)`);
        } else {
          // No won bid - rider should not be in team!
          console.log(`  ✗ ${cancelled.userName}: ${cancelled.riderName} - cancelled but still in team (NEEDS FIX)`);
          ridersToRemove.push({
            participantId: participantDoc.id,
            participantRef: participantDoc.ref,
            userId,
            userName: cancelled.userName || participantData.playername,
            riderNameId: cancelled.riderNameId,
            riderName: cancelled.riderName,
            pricePaid: riderInTeam.pricePaid || 0,
          });
        }
      }
    }
  }

  // Deduplicate riders (same user + same rider should only appear once)
  const uniqueRidersToRemove = [];
  const seenKeys = new Set();
  for (const item of ridersToRemove) {
    const key = `${item.userId}_${item.riderNameId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRidersToRemove.push(item);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Found ${uniqueRidersToRemove.length} unique riders that need to be removed from teams`);
  console.log(`(${ridersToRemove.length} total including duplicates from multiple cancel events)`);
  console.log('='.repeat(60));

  if (uniqueRidersToRemove.length === 0) {
    console.log('No riders need to be removed. Done!');
    return;
  }

  // Print summary
  console.log('');
  console.log('Riders to remove:');
  uniqueRidersToRemove.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.userName}: ${item.riderName} (paid: ${item.pricePaid})`);
  });

  // Replace ridersToRemove with unique list
  ridersToRemove.length = 0;
  ridersToRemove.push(...uniqueRidersToRemove);

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN - No changes made. Set DRY_RUN = false to apply fixes.');
    return;
  }

  // Step 3: Remove riders from teams
  console.log('');
  console.log('Step 3: Removing riders from teams...');

  // Group by participant to batch updates
  const updatesByParticipant = new Map();
  for (const item of ridersToRemove) {
    if (!updatesByParticipant.has(item.participantId)) {
      updatesByParticipant.set(item.participantId, {
        participantRef: item.participantRef,
        ridersToRemove: [],
        totalRefund: 0,
      });
    }
    updatesByParticipant.get(item.participantId).ridersToRemove.push(item.riderNameId);
    updatesByParticipant.get(item.participantId).totalRefund += item.pricePaid;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const [participantId, updates] of updatesByParticipant) {
    try {
      // Get current participant data
      const participantDoc = await updates.participantRef.get();
      const participantData = participantDoc.data();
      const currentTeam = participantData.team || [];
      const currentSpentBudget = participantData.spentBudget || 0;

      // Filter out the riders to remove
      const newTeam = currentTeam.filter(r => !updates.ridersToRemove.includes(r.riderNameId));
      const newSpentBudget = currentSpentBudget - updates.totalRefund;

      // Update participant
      await updates.participantRef.update({
        team: newTeam,
        spentBudget: newSpentBudget,
        rosterSize: newTeam.length,
      });

      // Also remove from playerTeams collection
      for (const riderNameId of updates.ridersToRemove) {
        const playerTeamId = `${GAME_ID}_${participantData.userId}_${riderNameId}`;
        await db.collection('playerTeams').doc(playerTeamId).delete();
      }

      console.log(`  ✓ Updated participant ${participantId}: removed ${updates.ridersToRemove.length} rider(s), refunded ${updates.totalRefund}`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Error updating participant ${participantId}:`, error.message);
      errorCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Participants updated: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total riders removed: ${ridersToRemove.length}`);
  console.log('='.repeat(60));
}

// Run the script
fixCancelledBidsInTeams()
  .then(() => {
    console.log('');
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
