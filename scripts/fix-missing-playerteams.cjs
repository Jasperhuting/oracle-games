const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixMissingPlayerTeams() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii'; // Marginal Gains game

  console.log('===========================================');
  console.log('Fix Missing PlayerTeams - Marginal Gains');
  console.log('===========================================\n');

  // Get all participants
  const participantsSnapshot = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .get();

  console.log(`Found ${participantsSnapshot.size} participants\n`);

  let totalFixed = 0;
  let totalCreated = 0;

  for (const participantDoc of participantsSnapshot.docs) {
    const participant = participantDoc.data();
    const userId = participant.userId;
    const playername = participant.playername;

    // Get won bids for this user
    const wonBidsSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'won')
      .get();

    // Get existing playerTeams for this user
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    const existingRiderIds = new Set(playerTeamsSnapshot.docs.map(d => d.data().riderNameId));

    // Find won bids that don't have a corresponding playerTeam
    const missingBids = wonBidsSnapshot.docs.filter(doc => {
      return !existingRiderIds.has(doc.data().riderNameId);
    });

    if (missingBids.length === 0) {
      continue; // No missing playerTeams for this user
    }

    console.log(`\n🔧 Fixing ${playername}: ${missingBids.length} missing playerTeams`);
    totalFixed++;

    // Create missing playerTeams
    for (const bidDoc of missingBids) {
      const bid = bidDoc.data();

      try {
        await db.collection('playerTeams').add({
          gameId: gameId,
          userId: userId,
          riderNameId: bid.riderNameId,
          acquiredAt: admin.firestore.Timestamp.now(),
          acquisitionType: 'selection',
          pricePaid: bid.amount,
          riderName: bid.riderName,
          riderTeam: bid.riderTeam || '',
          riderCountry: bid.riderCountry || '',
          jerseyImage: bid.jerseyImage || '',
          active: true,
          benched: false,
          pointsScored: 0,
          stagesParticipated: 0,
        });

        console.log(`   ✓ Created playerTeam for ${bid.riderName}`);
        totalCreated++;
      } catch (error) {
        console.error(`   ✗ ERROR creating playerTeam for ${bid.riderName}:`, error.message);
      }
    }

    // Update participant's team array and rosterSize
    const allWonBids = wonBidsSnapshot.docs.map(d => d.data());
    const team = allWonBids.map(bid => ({
      riderNameId: bid.riderNameId,
      riderName: bid.riderName,
      riderTeam: bid.riderTeam || '',
      jerseyImage: bid.jerseyImage || null,
      pricePaid: bid.amount,
      acquiredAt: admin.firestore.Timestamp.now(),
    }));

    // Calculate total spent
    const spentBudget = allWonBids.reduce((sum, bid) => sum + (bid.amount || 0), 0);

    await participantDoc.ref.update({
      team: team,
      rosterSize: team.length,
      spentBudget: spentBudget,
      rosterComplete: team.length >= 20,
    });

    console.log(`   ✓ Updated participant: rosterSize=${team.length}, spentBudget=${spentBudget}`);
  }

  console.log('\n===========================================');
  console.log('SUMMARY');
  console.log('===========================================');
  console.log(`Players fixed: ${totalFixed}`);
  console.log(`PlayerTeams created: ${totalCreated}`);
  console.log('===========================================\n');

  // Log the fix action
  await db.collection('activityLogs').add({
    action: 'ADMIN_BULK_FIX_MISSING_TEAMS',
    details: {
      gameId,
      gameName: 'Marginal Gains',
      playersFixed: totalFixed,
      playerTeamsCreated: totalCreated,
      reason: 'Timeout during finalization caused missing playerTeams',
    },
    timestamp: admin.firestore.Timestamp.now(),
    ipAddress: 'script',
    userAgent: 'fix-missing-playerteams.cjs',
  });

  console.log('Activity log created.\n');
}

fixMissingPlayerTeams()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
