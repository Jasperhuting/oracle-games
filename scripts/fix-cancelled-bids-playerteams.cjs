/**
 * Fix script: Clean up playerTeams for cancelled bids and add replacement riders
 *
 * Problem: When the previous fix script removed cancelled riders from teams, it didn't:
 * 1. Remove/deactivate the playerTeams documents for cancelled riders
 * 2. Add the replacement riders that users selected after cancelling
 *
 * Solution:
 * 1. Get all BID_CANCELLED activity logs for the game
 * 2. For each cancelled bid, check if there's still an active playerTeams doc
 * 3. If yes and there's no current "won" bid, set active: false on that playerTeams doc
 * 4. Check if user placed a new bid right after cancelling (within a few minutes)
 * 5. If that new bid has status cancelled_overflow, it should have been the replacement
 * 6. Add that rider to the team and activate their playerTeams doc
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

async function fixCancelledBidsPlayerTeams() {
  console.log('='.repeat(60));
  console.log('Fix PlayerTeams for Cancelled Bids');
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

  console.log(`Found ${cancelledLogsSnapshot.size} cancelled bid logs`);

  // Group cancelled bids by user with timestamp
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
      amount: data.details?.amount,
    });
  });

  console.log(`Found ${cancelledByUser.size} users with cancelled bids`);
  console.log('');

  // Step 2: For each user, check playerTeams and find replacements
  console.log('Step 2: Checking playerTeams and finding replacements...');

  const playerTeamsToDeactivate = []; // { docId, userId, riderNameId, riderName }
  const ridersToAdd = []; // { userId, userName, riderNameId, riderName, amount, participantId }

  for (const [userId, cancelledRiders] of cancelledByUser) {
    // Get user's current won bids
    const wonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    const wonRiderIds = new Set(wonBidsSnapshot.docs.map(doc => doc.data().riderNameId));

    // Get user's cancelled_overflow bids (these could be replacements)
    const overflowBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .where('status', '==', 'cancelled_overflow')
      .get();

    const overflowBids = overflowBidsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      bidAt: doc.data().bidAt?.toDate?.() || new Date(doc.data().bidAt),
    }));

    // Get user's participant doc
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) continue;

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();
    const currentTeam = participantData.team || [];
    const currentTeamRiderIds = new Set(currentTeam.map(r => r.riderNameId));

    // Check each cancelled rider
    for (const cancelled of cancelledRiders) {
      // Check if there's still an active playerTeams doc for this cancelled rider
      const playerTeamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', GAME_ID)
        .where('userId', '==', userId)
        .where('riderNameId', '==', cancelled.riderNameId)
        .limit(1)
        .get();

      if (!playerTeamSnapshot.empty) {
        const playerTeamDoc = playerTeamSnapshot.docs[0];
        const playerTeamData = playerTeamDoc.data();

        // If active and no won bid exists, we need to deactivate
        if (playerTeamData.active && !wonRiderIds.has(cancelled.riderNameId)) {
          console.log(`  ✗ ${cancelled.userName}: ${cancelled.riderName} - playerTeams still active (NEEDS DEACTIVATION)`);
          playerTeamsToDeactivate.push({
            docId: playerTeamDoc.id,
            docRef: playerTeamDoc.ref,
            userId,
            userName: cancelled.userName,
            riderNameId: cancelled.riderNameId,
            riderName: cancelled.riderName,
            pricePaid: playerTeamData.pricePaid || 0,
          });

          // Look for a replacement bid placed shortly after the cancel
          // (within 5 minutes)
          const fiveMinutesAfterCancel = new Date(cancelled.cancelledAt.getTime() + 5 * 60 * 1000);

          const potentialReplacements = overflowBids.filter(bid => {
            return bid.bidAt >= cancelled.cancelledAt &&
                   bid.bidAt <= fiveMinutesAfterCancel &&
                   !currentTeamRiderIds.has(bid.riderNameId) &&
                   !wonRiderIds.has(bid.riderNameId);
          });

          if (potentialReplacements.length > 0) {
            // Take the first replacement (closest in time to the cancel)
            potentialReplacements.sort((a, b) => a.bidAt - b.bidAt);
            const replacement = potentialReplacements[0];

            // Check if this replacement is not already being added for another cancel
            const alreadyAdding = ridersToAdd.some(r =>
              r.userId === userId && r.riderNameId === replacement.riderNameId
            );

            if (!alreadyAdding) {
              console.log(`    → Found replacement: ${replacement.riderName} (bid at ${replacement.bidAt.toISOString()})`);
              ridersToAdd.push({
                participantId: participantDoc.id,
                participantRef: participantDoc.ref,
                userId,
                userName: cancelled.userName || participantData.playername,
                riderNameId: replacement.riderNameId,
                riderName: replacement.riderName,
                riderTeam: replacement.riderTeam || '',
                jerseyImage: replacement.jerseyImage || '',
                amount: replacement.amount,
                bidId: replacement.id,
                cancelledRiderName: cancelled.riderName,
                cancelledAmount: cancelled.amount,
              });

              // Mark this overflow bid as used so we don't use it twice
              const idx = overflowBids.indexOf(replacement);
              if (idx > -1) overflowBids.splice(idx, 1);
            }
          }
        }
      }
    }
  }

  // Deduplicate
  const uniqueDeactivations = [];
  const seenDeactivations = new Set();
  for (const item of playerTeamsToDeactivate) {
    const key = item.docId;
    if (!seenDeactivations.has(key)) {
      seenDeactivations.add(key);
      uniqueDeactivations.push(item);
    }
  }

  const uniqueAdditions = [];
  const seenAdditions = new Set();
  for (const item of ridersToAdd) {
    const key = `${item.userId}_${item.riderNameId}`;
    if (!seenAdditions.has(key)) {
      seenAdditions.add(key);
      uniqueAdditions.push(item);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Found ${uniqueDeactivations.length} playerTeams to deactivate`);
  console.log(`Found ${uniqueAdditions.length} replacement riders to add`);
  console.log('='.repeat(60));

  if (uniqueDeactivations.length === 0 && uniqueAdditions.length === 0) {
    console.log('No changes needed. Done!');
    return;
  }

  // Print summary
  if (uniqueDeactivations.length > 0) {
    console.log('');
    console.log('PlayerTeams to deactivate:');
    uniqueDeactivations.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.userName}: ${item.riderName} (paid: ${item.pricePaid})`);
    });
  }

  if (uniqueAdditions.length > 0) {
    console.log('');
    console.log('Replacement riders to add:');
    uniqueAdditions.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.userName}: ${item.riderName} (replacing ${item.cancelledRiderName}, cost: ${item.amount})`);
    });
  }

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN - No changes made. Set DRY_RUN = false to apply fixes.');
    return;
  }

  // Step 3: Apply changes
  console.log('');
  console.log('Step 3: Applying changes...');

  let deactivateSuccess = 0;
  let deactivateError = 0;
  let addSuccess = 0;
  let addError = 0;

  // Deactivate playerTeams
  for (const item of uniqueDeactivations) {
    try {
      await item.docRef.update({ active: false });
      console.log(`  ✓ Deactivated playerTeams for ${item.userName}: ${item.riderName}`);
      deactivateSuccess++;
    } catch (error) {
      console.error(`  ✗ Error deactivating playerTeams for ${item.userName}: ${item.riderName}:`, error.message);
      deactivateError++;
    }
  }

  // Add replacement riders - group by participant
  const additionsByParticipant = new Map();
  for (const item of uniqueAdditions) {
    if (!additionsByParticipant.has(item.participantId)) {
      additionsByParticipant.set(item.participantId, {
        participantRef: item.participantRef,
        userId: item.userId,
        userName: item.userName,
        riders: [],
      });
    }
    additionsByParticipant.get(item.participantId).riders.push(item);
  }

  for (const [participantId, data] of additionsByParticipant) {
    try {
      // Get current participant data
      const participantDoc = await data.participantRef.get();
      const participantData = participantDoc.data();
      const currentTeam = participantData.team || [];
      const currentSpentBudget = participantData.spentBudget || 0;

      // Add new riders to team
      const newRiders = data.riders.map(rider => ({
        riderNameId: rider.riderNameId,
        riderName: rider.riderName,
        riderTeam: rider.riderTeam,
        jerseyImage: rider.jerseyImage,
        pricePaid: rider.amount,
        acquiredAt: admin.firestore.Timestamp.now(),
      }));

      const newTeam = [...currentTeam, ...newRiders];
      const additionalCost = data.riders.reduce((sum, r) => sum + r.amount, 0);
      const newSpentBudget = currentSpentBudget + additionalCost;

      // Update participant
      await data.participantRef.update({
        team: newTeam,
        spentBudget: newSpentBudget,
        rosterSize: newTeam.length,
      });

      // Create/update playerTeams documents and update bid status
      for (const rider of data.riders) {
        // Check if playerTeams doc exists
        const existingPT = await db.collection('playerTeams')
          .where('gameId', '==', GAME_ID)
          .where('userId', '==', data.userId)
          .where('riderNameId', '==', rider.riderNameId)
          .limit(1)
          .get();

        if (!existingPT.empty) {
          // Update existing doc to active
          await existingPT.docs[0].ref.update({ active: true });
        } else {
          // Create new playerTeams doc
          await db.collection('playerTeams').add({
            gameId: GAME_ID,
            userId: data.userId,
            riderNameId: rider.riderNameId,
            acquiredAt: admin.firestore.Timestamp.now(),
            acquisitionType: 'selection',
            pricePaid: rider.amount,
            riderName: rider.riderName,
            riderTeam: rider.riderTeam,
            riderCountry: '',
            jerseyImage: rider.jerseyImage,
            active: true,
            benched: false,
            pointsScored: 0,
            stagesParticipated: 0,
          });
        }

        // Update bid status from cancelled_overflow to won
        await db.collection('bids').doc(rider.bidId).update({ status: 'won' });
      }

      console.log(`  ✓ Added ${data.riders.length} rider(s) to ${data.userName}'s team`);
      addSuccess += data.riders.length;
    } catch (error) {
      console.error(`  ✗ Error adding riders to ${data.userName}'s team:`, error.message);
      addError += data.riders.length;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  PlayerTeams deactivated: ${deactivateSuccess} (errors: ${deactivateError})`);
  console.log(`  Replacement riders added: ${addSuccess} (errors: ${addError})`);
  console.log('='.repeat(60));
}

// Run the script
fixCancelledBidsPlayerTeams()
  .then(() => {
    console.log('');
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
