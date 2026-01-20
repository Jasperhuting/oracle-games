/**
 * Analyze script: Check if cancelled_overflow and cancelled_overbudget bids are correct
 *
 * This script checks each cancelled bid to see if it should actually be in the team
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

async function analyzeCancelledBids() {
  console.log('='.repeat(60));
  console.log('Analyze Cancelled Bids');
  console.log('='.repeat(60));
  console.log(`Game ID: ${GAME_ID}`);
  console.log(`Max Riders: ${MAX_RIDERS}`);
  console.log(`Max Budget: ${MAX_BUDGET}`);
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
    ...overflowBidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cancelReason: 'overflow' })),
    ...overbudgetBidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), cancelReason: 'overbudget' }))
  ];

  // Group by user
  const bidsByUser = new Map();
  for (const bid of allCancelledBids) {
    if (!bidsByUser.has(bid.userId)) {
      bidsByUser.set(bid.userId, []);
    }
    bidsByUser.get(bid.userId).push(bid);
  }

  console.log(`Analyzing ${bidsByUser.size} users with cancelled bids...`);
  console.log('');

  const incorrectCancellations = [];

  for (const [userId, bids] of bidsByUser) {
    // Get user's current team
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) continue;

    const participantData = participantSnapshot.docs[0].data();
    const currentTeam = participantData.team || [];
    const currentRiderIds = new Set(currentTeam.map(r => r.riderNameId));
    const currentSpentBudget = participantData.spentBudget || 0;
    const currentRosterSize = currentTeam.length;
    const playername = participantData.playername;

    // Sort bids by bidAt (oldest first)
    bids.sort((a, b) => {
      const timeA = a.bidAt?.toDate ? a.bidAt.toDate() : new Date(a.bidAt);
      const timeB = b.bidAt?.toDate ? b.bidAt.toDate() : new Date(b.bidAt);
      return timeA - timeB;
    });

    // Check each cancelled bid
    for (const bid of bids) {
      const riderAlreadyInTeam = currentRiderIds.has(bid.riderNameId);
      const wouldExceedRoster = currentRosterSize >= MAX_RIDERS;
      const wouldExceedBudget = currentSpentBudget + bid.amount > MAX_BUDGET;

      // Check if this cancellation was incorrect
      if (bid.cancelReason === 'overflow' && !wouldExceedRoster && !riderAlreadyInTeam) {
        incorrectCancellations.push({
          playername,
          userId,
          bidId: bid.id,
          riderName: bid.riderName,
          riderNameId: bid.riderNameId,
          amount: bid.amount,
          cancelReason: bid.cancelReason,
          currentRosterSize,
          currentSpentBudget,
          issue: `Team has ${currentRosterSize} riders (not full), but bid was cancelled as overflow`,
        });
      } else if (bid.cancelReason === 'overbudget' && !wouldExceedBudget && !riderAlreadyInTeam) {
        incorrectCancellations.push({
          playername,
          userId,
          bidId: bid.id,
          riderName: bid.riderName,
          riderNameId: bid.riderNameId,
          amount: bid.amount,
          cancelReason: bid.cancelReason,
          currentRosterSize,
          currentSpentBudget,
          issue: `Budget is ${currentSpentBudget}, bid amount is ${bid.amount}, total would be ${currentSpentBudget + bid.amount} (under ${MAX_BUDGET}), but cancelled as overbudget`,
        });
      }
    }
  }

  console.log('='.repeat(60));
  console.log(`Found ${incorrectCancellations.length} potentially incorrect cancellations`);
  console.log('='.repeat(60));

  if (incorrectCancellations.length > 0) {
    console.log('');
    console.log('Potentially incorrect cancellations:');
    incorrectCancellations.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.playername}: ${item.riderName}`);
      console.log(`     Reason: ${item.cancelReason}`);
      console.log(`     Current roster: ${item.currentRosterSize}/32`);
      console.log(`     Current budget: ${item.currentSpentBudget}/${MAX_BUDGET}`);
      console.log(`     Bid amount: ${item.amount}`);
      console.log(`     Issue: ${item.issue}`);
      console.log('');
    });

    // Group by user for summary
    const byUser = new Map();
    for (const item of incorrectCancellations) {
      if (!byUser.has(item.playername)) {
        byUser.set(item.playername, []);
      }
      byUser.get(item.playername).push(item);
    }

    console.log('='.repeat(60));
    console.log('Summary by user:');
    for (const [playername, items] of byUser) {
      console.log(`  ${playername}: ${items.length} potentially incorrect cancellation(s)`);
      console.log(`    Current roster: ${items[0].currentRosterSize}/32`);
      console.log(`    Current budget: ${items[0].currentSpentBudget}/${MAX_BUDGET}`);
    }
    console.log('='.repeat(60));
  }
}

// Run the script
analyzeCancelledBids()
  .then(() => {
    console.log('');
    console.log('Analysis completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
