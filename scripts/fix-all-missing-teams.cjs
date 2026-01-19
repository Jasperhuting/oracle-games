/**
 * Script to fix ALL missing teams in WorldTour Manager
 * Finds all users with active bids that were not processed during finalize
 *
 * Run with: node scripts/fix-all-missing-teams.cjs
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with production credentials
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// WorldTour Manager game ID
const GAME_ID = 'mGzPZfIOb2gAyEu0i6t6';

async function fixAllMissingTeams() {
  console.log('Starting fix for ALL missing teams in WorldTour Manager...\n');

  // Get game data
  const gameDoc = await db.collection('games').doc(GAME_ID).get();
  if (!gameDoc.exists) {
    console.error('Game not found!');
    return;
  }

  const gameData = gameDoc.data();
  const isSelectionBased = gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains';

  console.log(`Game: ${gameData?.name}`);
  console.log(`Game type: ${gameData?.gameType} (selection-based: ${isSelectionBased})\n`);

  // Get ALL active bids for this game (not yet processed)
  const allActiveBidsSnapshot = await db.collection('bids')
    .where('gameId', '==', GAME_ID)
    .where('status', '==', 'active')
    .get();

  console.log(`Found ${allActiveBidsSnapshot.size} total active bids to process\n`);

  if (allActiveBidsSnapshot.empty) {
    console.log('No active bids found to process');
    return;
  }

  // Group bids by userId
  const bidsByUser = new Map();
  allActiveBidsSnapshot.docs.forEach(doc => {
    const bidData = doc.data();
    const userId = bidData.userId;

    if (!bidsByUser.has(userId)) {
      bidsByUser.set(userId, []);
    }
    bidsByUser.get(userId).push({ id: doc.id, ref: doc.ref, data: bidData });
  });

  console.log(`Found ${bidsByUser.size} users with unprocessed bids:\n`);

  // Process each user
  let totalBidsProcessed = 0;
  let totalRidersAdded = 0;

  for (const [userId, bids] of bidsByUser.entries()) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing user: ${userId}`);
    console.log(`Active bids: ${bids.length}`);

    // Get participant data
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      console.log('  ⚠ Participant not found, skipping...');
      continue;
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();

    console.log(`Participant: ${participantData.playername}`);
    console.log(`Current team size: ${(participantData.team || []).length}`);
    console.log(`Current spent budget: ${participantData.spentBudget || 0}`);

    // Process each active bid for this user
    const newRiders = [];

    for (const bid of bids) {
      const bidData = bid.data;

      console.log(`  Processing: ${bidData.riderName}...`);

      // Mark bid as won
      await bid.ref.update({ status: 'won' });

      // Check if PlayerTeam already exists
      const existingPlayerTeam = await db.collection('playerTeams')
        .where('gameId', '==', GAME_ID)
        .where('userId', '==', userId)
        .where('riderNameId', '==', bidData.riderNameId)
        .limit(1)
        .get();

      if (!existingPlayerTeam.empty) {
        console.log(`    - PlayerTeam exists, skipping creation`);
      } else {
        // Create PlayerTeam document
        await db.collection('playerTeams').add({
          gameId: GAME_ID,
          userId: userId,
          riderNameId: bidData.riderNameId,
          acquiredAt: admin.firestore.Timestamp.now(),
          acquisitionType: isSelectionBased ? 'selection' : 'auction',
          pricePaid: bidData.amount,
          riderName: bidData.riderName,
          riderTeam: bidData.riderTeam || '',
          riderCountry: bidData.riderCountry || '',
          jerseyImage: bidData.jerseyImage || '',
          active: true,
          benched: false,
          pointsScored: 0,
          stagesParticipated: 0,
        });
        console.log(`    - Created PlayerTeam`);
      }

      // Add to team array
      newRiders.push({
        riderNameId: bidData.riderNameId,
        riderName: bidData.riderName,
        riderTeam: bidData.riderTeam || '',
        jerseyImage: bidData.jerseyImage || '',
        pricePaid: bidData.amount,
        acquiredAt: admin.firestore.Timestamp.now(),
      });

      totalBidsProcessed++;
    }

    // Calculate correct spent budget from ALL won bids
    const allWonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    let correctSpentBudget = 0;
    allWonBidsSnapshot.docs.forEach(bidDoc => {
      correctSpentBudget += bidDoc.data().amount || 0;
    });

    // Update participant
    const currentTeam = participantData.team || [];
    const newTeam = [...currentTeam, ...newRiders];

    // Check if roster is complete
    const maxRiders = gameData?.config?.maxRiders || 0;
    const rosterComplete = newTeam.length >= maxRiders;

    await participantDoc.ref.update({
      team: newTeam,
      spentBudget: correctSpentBudget,
      rosterSize: newTeam.length,
      rosterComplete,
    });

    console.log(`\n✓ Updated ${participantData.playername}:`);
    console.log(`  - Team size: ${currentTeam.length} -> ${newTeam.length}`);
    console.log(`  - Spent budget: ${participantData.spentBudget || 0} -> ${correctSpentBudget}`);
    console.log(`  - Roster complete: ${rosterComplete}`);

    totalRidersAdded += newRiders.length;
  }

  // Log the activity
  await db.collection('activityLogs').add({
    action: 'ADMIN_FIX_ALL_MISSING_TEAMS',
    userId: 'script',
    details: {
      gameId: GAME_ID,
      usersFixed: bidsByUser.size,
      totalBidsProcessed,
      totalRidersAdded,
    },
    timestamp: admin.firestore.Timestamp.now(),
    ipAddress: 'local-script',
    userAgent: 'node-script',
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('\n✓ All fixes completed successfully!');
  console.log(`\nFinal Summary:`);
  console.log(`  - Users fixed: ${bidsByUser.size}`);
  console.log(`  - Total bids processed: ${totalBidsProcessed}`);
  console.log(`  - Total riders added: ${totalRidersAdded}`);
}

// Run the fix
fixAllMissingTeams()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
