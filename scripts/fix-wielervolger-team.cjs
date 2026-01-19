/**
 * Script to fix Wielervolger's missing team in WorldTour Manager
 * Their bids were not processed during finalize
 *
 * Run with: node scripts/fix-wielervolger-team.cjs
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with production credentials
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Wielervolger's data
const GAME_ID = 'mGzPZfIOb2gAyEu0i6t6';
const USER_ID = 'nmZq7REoyUf0WCroJrm2QMHpgf02';

async function fixWielervolgerTeam() {
  console.log('Starting fix for Wielervolger\'s team...\n');

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

  // Get all active bids for this user in this game
  const activeBidsSnapshot = await db.collection('bids')
    .where('gameId', '==', GAME_ID)
    .where('userId', '==', USER_ID)
    .where('status', '==', 'active')
    .get();

  console.log(`Found ${activeBidsSnapshot.size} active bids to process\n`);

  if (activeBidsSnapshot.empty) {
    console.log('No active bids found to process');
    return;
  }

  // Get current participant data
  const participantSnapshot = await db.collection('gameParticipants')
    .where('gameId', '==', GAME_ID)
    .where('userId', '==', USER_ID)
    .limit(1)
    .get();

  if (participantSnapshot.empty) {
    console.error('Participant not found!');
    return;
  }

  const participantDoc = participantSnapshot.docs[0];
  const participantData = participantDoc.data();

  console.log(`Participant: ${participantData.playername}`);
  console.log(`Current team size: ${(participantData.team || []).length}`);
  console.log(`Current spent budget: ${participantData.spentBudget || 0}\n`);

  // Process each active bid
  const newRiders = [];

  for (const bidDoc of activeBidsSnapshot.docs) {
    const bidData = bidDoc.data();

    console.log(`Processing bid for ${bidData.riderName}...`);

    // Mark bid as won
    await bidDoc.ref.update({ status: 'won' });
    console.log('  - Marked bid as "won"');

    // Check if PlayerTeam already exists
    const existingPlayerTeam = await db.collection('playerTeams')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', USER_ID)
      .where('riderNameId', '==', bidData.riderNameId)
      .limit(1)
      .get();

    if (!existingPlayerTeam.empty) {
      console.log('  - PlayerTeam already exists, skipping creation');
    } else {
      // Create PlayerTeam document
      await db.collection('playerTeams').add({
        gameId: GAME_ID,
        userId: USER_ID,
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
      console.log('  - Created PlayerTeam document');
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
  }

  // Calculate correct spent budget from ALL won bids
  const allWonBidsSnapshot = await db.collection('bids')
    .where('gameId', '==', GAME_ID)
    .where('userId', '==', USER_ID)
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

  console.log(`\n✓ Updated participant:`);
  console.log(`  - Team size: ${currentTeam.length} -> ${newTeam.length}`);
  console.log(`  - Spent budget: ${participantData.spentBudget || 0} -> ${correctSpentBudget}`);
  console.log(`  - Roster complete: ${rosterComplete}`);

  // Log the activity
  await db.collection('activityLogs').add({
    action: 'ADMIN_FIX_MISSING_TEAM',
    userId: 'script',
    details: {
      gameId: GAME_ID,
      targetUserId: USER_ID,
      playername: participantData.playername,
      bidsProcessed: activeBidsSnapshot.size,
      ridersAdded: newRiders.map(r => r.riderName),
    },
    timestamp: admin.firestore.Timestamp.now(),
    ipAddress: 'local-script',
    userAgent: 'node-script',
  });

  console.log('\n✓ Fix completed successfully!');
  console.log(`\nSummary:`);
  console.log(`  - Bids processed: ${activeBidsSnapshot.size}`);
  console.log(`  - Riders added: ${newRiders.length}`);
  console.log(`  - New team size: ${newTeam.length}`);
  console.log(`  - Correct spent budget: ${correctSpentBudget}`);
}

// Run the fix
fixWielervolgerTeam()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
