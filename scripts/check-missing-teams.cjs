const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkMissingTeams() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii'; // Marginal Gains game

  console.log('Checking for missing teams in Marginal Gains game...\n');

  // Get all participants
  const participantsSnapshot = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .get();

  console.log(`Found ${participantsSnapshot.size} participants\n`);

  const issues = [];

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

    // Get playerTeams for this user
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    const wonBidsCount = wonBidsSnapshot.size;
    const playerTeamsCount = playerTeamsSnapshot.size;
    const rosterSize = participant.rosterSize || 0;

    if (wonBidsCount !== playerTeamsCount) {
      issues.push({
        playername,
        userId,
        participantId: participantDoc.id,
        wonBids: wonBidsCount,
        playerTeams: playerTeamsCount,
        rosterSize,
        difference: wonBidsCount - playerTeamsCount,
      });

      console.log(`❌ ${playername}: ${wonBidsCount} won bids, ${playerTeamsCount} playerTeams (difference: ${wonBidsCount - playerTeamsCount})`);
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Total participants: ${participantsSnapshot.size}`);
  console.log(`Participants with issues: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\nAffected players:');
    issues.forEach(issue => {
      console.log(`  - ${issue.playername} (userId: ${issue.userId})`);
      console.log(`    Won bids: ${issue.wonBids}, PlayerTeams: ${issue.playerTeams}, RosterSize: ${issue.rosterSize}`);
    });
  }

  return issues;
}

checkMissingTeams()
  .then(issues => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
