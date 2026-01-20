/**
 * Fix script: Re-process incorrectly cancelled bids
 *
 * Problem: Many bids were marked as cancelled_overflow or cancelled_overbudget
 * but the users actually have room in their teams and budget.
 *
 * Solution:
 * 1. Get all cancelled_overflow and cancelled_overbudget bids
 * 2. For each user, check current team size and budget
 * 3. Process bids in order (oldest first - first come first served)
 * 4. Add bids that fit within limits to the team
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
const MAX_RIDERS = 32;
const MAX_BUDGET = 12000;
const DRY_RUN = false; // Set to false to actually make changes

async function fixIncorrectlyCancelledBids() {
  console.log('='.repeat(60));
  console.log('Fix Incorrectly Cancelled Bids');
  console.log('='.repeat(60));
  console.log(`Game ID: ${GAME_ID}`);
  console.log(`Max Riders: ${MAX_RIDERS}`);
  console.log(`Max Budget: ${MAX_BUDGET}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be made)'}`);
  console.log('');

  // Get all cancelled_overflow bids
  console.log('Fetching cancelled_overflow bids...');
  const overflowBidsSnapshot = await db.collection('bids')
    .where('gameId', '==', GAME_ID)
    .where('status', '==', 'cancelled_overflow')
    .get();

  console.log(`Found ${overflowBidsSnapshot.size} cancelled_overflow bids`);

  // Get all cancelled_overbudget bids
  console.log('Fetching cancelled_overbudget bids...');
  const overbudgetBidsSnapshot = await db.collection('bids')
    .where('gameId', '==', GAME_ID)
    .where('status', '==', 'cancelled_overbudget')
    .get();

  console.log(`Found ${overbudgetBidsSnapshot.size} cancelled_overbudget bids`);
  console.log('');

  // Combine all cancelled bids
  const allCancelledBids = [
    ...overflowBidsSnapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() })),
    ...overbudgetBidsSnapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
  ];

  // Group by user
  const bidsByUser = new Map();
  for (const bid of allCancelledBids) {
    if (!bidsByUser.has(bid.userId)) {
      bidsByUser.set(bid.userId, []);
    }
    bidsByUser.get(bid.userId).push(bid);
  }

  console.log(`Processing ${bidsByUser.size} users with cancelled bids...`);
  console.log('');

  const bidsToRestore = []; // { bid, participantRef, currentTeam, newSpentBudget }

  for (const [userId, bids] of bidsByUser) {
    // Get user's current team
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) continue;

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();
    const currentTeam = participantData.team || [];
    const currentRiderIds = new Set(currentTeam.map(r => r.riderNameId));
    let currentSpentBudget = participantData.spentBudget || 0;
    let currentRosterSize = currentTeam.length;
    const playername = participantData.playername;

    // Sort bids by bidAt (oldest first - first come first served)
    bids.sort((a, b) => {
      const timeA = a.bidAt?.toDate ? a.bidAt.toDate() : new Date(a.bidAt);
      const timeB = b.bidAt?.toDate ? b.bidAt.toDate() : new Date(b.bidAt);
      return timeA - timeB;
    });

    const userBidsToRestore = [];

    // Check each cancelled bid
    for (const bid of bids) {
      // Skip if rider already in team
      if (currentRiderIds.has(bid.riderNameId)) {
        continue;
      }

      // Check if we can add this rider
      const wouldExceedRoster = currentRosterSize >= MAX_RIDERS;
      const wouldExceedBudget = currentSpentBudget + bid.amount > MAX_BUDGET;

      if (!wouldExceedRoster && !wouldExceedBudget) {
        // This bid can be restored!
        userBidsToRestore.push({
          bid,
          participantRef: participantDoc.ref,
          userId,
          playername,
        });

        // Update tracking for next iterations
        currentRiderIds.add(bid.riderNameId);
        currentRosterSize++;
        currentSpentBudget += bid.amount;
      }
    }

    if (userBidsToRestore.length > 0) {
      console.log(`${playername}: Can restore ${userBidsToRestore.length} bid(s)`);
      console.log(`  Current: ${currentTeam.length} riders, ${participantData.spentBudget} budget`);
      console.log(`  After: ${currentRosterSize} riders, ${currentSpentBudget} budget`);
      for (const item of userBidsToRestore) {
        console.log(`    + ${item.bid.riderName} (${item.bid.amount})`);
      }
      console.log('');
      bidsToRestore.push(...userBidsToRestore);
    }
  }

  console.log('='.repeat(60));
  console.log(`Total bids to restore: ${bidsToRestore.length}`);
  console.log('='.repeat(60));

  if (bidsToRestore.length === 0) {
    console.log('No bids need to be restored. Done!');
    return;
  }

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN - No changes made. Set DRY_RUN = false to apply fixes.');
    return;
  }

  // Step 2: Apply changes - group by participant
  console.log('');
  console.log('Applying changes...');

  const updatesByParticipant = new Map();
  for (const item of bidsToRestore) {
    const participantId = item.participantRef.id;
    if (!updatesByParticipant.has(participantId)) {
      updatesByParticipant.set(participantId, {
        participantRef: item.participantRef,
        userId: item.userId,
        playername: item.playername,
        bids: [],
      });
    }
    updatesByParticipant.get(participantId).bids.push(item.bid);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const [participantId, data] of updatesByParticipant) {
    try {
      // Get current participant data
      const participantDoc = await data.participantRef.get();
      const participantData = participantDoc.data();
      const currentTeam = participantData.team || [];
      const currentSpentBudget = participantData.spentBudget || 0;

      // Add new riders to team
      const newRiders = data.bids.map(bid => ({
        riderNameId: bid.riderNameId,
        riderName: bid.riderName,
        riderTeam: bid.riderTeam || '',
        jerseyImage: bid.jerseyImage || '',
        pricePaid: bid.amount,
        acquiredAt: admin.firestore.Timestamp.now(),
      }));

      const newTeam = [...currentTeam, ...newRiders];
      const additionalCost = data.bids.reduce((sum, b) => sum + b.amount, 0);
      const newSpentBudget = currentSpentBudget + additionalCost;

      // Update participant
      await data.participantRef.update({
        team: newTeam,
        spentBudget: newSpentBudget,
        rosterSize: newTeam.length,
        rosterComplete: newTeam.length >= MAX_RIDERS,
      });

      // Update bid status and create playerTeams documents
      for (const bid of data.bids) {
        // Update bid status to 'won'
        await bid.ref.update({ status: 'won' });

        // Check if playerTeams doc exists
        const existingPT = await db.collection('playerTeams')
          .where('gameId', '==', GAME_ID)
          .where('userId', '==', data.userId)
          .where('riderNameId', '==', bid.riderNameId)
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
            riderNameId: bid.riderNameId,
            acquiredAt: admin.firestore.Timestamp.now(),
            acquisitionType: 'selection',
            pricePaid: bid.amount,
            riderName: bid.riderName,
            riderTeam: bid.riderTeam || '',
            riderCountry: '',
            jerseyImage: bid.jerseyImage || '',
            active: true,
            benched: false,
            pointsScored: 0,
            stagesParticipated: 0,
          });
        }
      }

      console.log(`  ✓ ${data.playername}: Added ${data.bids.length} rider(s)`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ ${data.playername}: Error - ${error.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Users updated: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total riders added: ${bidsToRestore.length}`);
  console.log('='.repeat(60));
}

// Run the script
fixIncorrectlyCancelledBids()
  .then(() => {
    console.log('');
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
