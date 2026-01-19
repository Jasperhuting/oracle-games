/**
 * Script to fix teams that have more than 32 riders
 * Removes the most recently added riders that exceed the limit
 *
 * Run with: node scripts/fix-oversized-teams.cjs
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
const MAX_RIDERS = 32;

async function fixOversizedTeams() {
  console.log('Starting fix for oversized teams...\n');

  // Get game data to confirm max riders
  const gameDoc = await db.collection('games').doc(GAME_ID).get();
  if (!gameDoc.exists) {
    console.error('Game not found!');
    return;
  }

  const gameData = gameDoc.data();
  const configMaxRiders = gameData?.config?.maxRiders || MAX_RIDERS;
  console.log(`Game: ${gameData?.name}`);
  console.log(`Max riders per team: ${configMaxRiders}\n`);

  // Get all participants
  const participantsSnapshot = await db.collection('gameParticipants')
    .where('gameId', '==', GAME_ID)
    .where('status', '==', 'active')
    .get();

  console.log(`Found ${participantsSnapshot.size} participants\n`);

  let teamsFixed = 0;
  let ridersRemoved = 0;

  for (const participantDoc of participantsSnapshot.docs) {
    const participantData = participantDoc.data();
    const userId = participantData.userId;
    const teamArray = participantData.team || [];

    if (teamArray.length <= configMaxRiders) {
      continue; // Team is fine
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Fixing: ${participantData.playername}`);
    console.log(`Current team size: ${teamArray.length} (${teamArray.length - configMaxRiders} over limit)`);

    // Get all PlayerTeam documents for this user, sorted by acquiredAt (most recent first)
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    console.log(`Found ${playerTeamsSnapshot.size} PlayerTeam documents`);

    // Sort by acquiredAt (most recent first)
    const playerTeams = playerTeamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      data: doc.data(),
      acquiredAt: doc.data().acquiredAt?.toDate?.() || doc.data().acquiredAt || new Date(0)
    }));

    playerTeams.sort((a, b) => {
      const dateA = a.acquiredAt instanceof Date ? a.acquiredAt : new Date(a.acquiredAt);
      const dateB = b.acquiredAt instanceof Date ? b.acquiredAt : new Date(b.acquiredAt);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });

    // Determine how many to remove
    const toRemove = playerTeams.length - configMaxRiders;
    const ridersToRemove = playerTeams.slice(0, toRemove);

    console.log(`\nRemoving ${toRemove} most recently added riders:`);

    // Get the riderNameIds to remove
    const riderNameIdsToRemove = new Set();

    for (const rider of ridersToRemove) {
      console.log(`  - ${rider.data.riderName} (acquired: ${rider.acquiredAt})`);
      riderNameIdsToRemove.add(rider.data.riderNameId);

      // Mark PlayerTeam as inactive
      await rider.ref.update({ active: false });

      // Find and update the corresponding bid to "cancelled"
      const bidsSnapshot = await db.collection('bids')
        .where('gameId', '==', GAME_ID)
        .where('userId', '==', userId)
        .where('riderNameId', '==', rider.data.riderNameId)
        .where('status', '==', 'won')
        .limit(1)
        .get();

      if (!bidsSnapshot.empty) {
        await bidsSnapshot.docs[0].ref.update({ status: 'cancelled_overflow' });
      }

      ridersRemoved++;
    }

    // Update the team array in gameParticipants
    const newTeamArray = teamArray.filter(r => !riderNameIdsToRemove.has(r.riderNameId));

    // Recalculate spent budget from remaining active PlayerTeams
    const remainingPlayerTeams = playerTeams.slice(toRemove);
    let correctSpentBudget = 0;
    for (const pt of remainingPlayerTeams) {
      correctSpentBudget += pt.data.pricePaid || 0;
    }

    // Update participant
    await participantDoc.ref.update({
      team: newTeamArray,
      rosterSize: newTeamArray.length,
      spentBudget: correctSpentBudget,
      rosterComplete: newTeamArray.length >= configMaxRiders,
    });

    console.log(`\n✓ Updated ${participantData.playername}:`);
    console.log(`  - Team size: ${teamArray.length} -> ${newTeamArray.length}`);
    console.log(`  - Spent budget: ${participantData.spentBudget || 0} -> ${correctSpentBudget}`);

    teamsFixed++;
  }

  // Log the activity
  await db.collection('activityLogs').add({
    action: 'ADMIN_FIX_OVERSIZED_TEAMS',
    userId: 'script',
    details: {
      gameId: GAME_ID,
      teamsFixed,
      ridersRemoved,
    },
    timestamp: admin.firestore.Timestamp.now(),
    ipAddress: 'local-script',
    userAgent: 'node-script',
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('\n✓ All fixes completed!');
  console.log(`\nSummary:`);
  console.log(`  - Teams fixed: ${teamsFixed}`);
  console.log(`  - Riders removed: ${ridersRemoved}`);
}

// Run the fix
fixOversizedTeams()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
