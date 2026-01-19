/**
 * Script to fix teams that have more than 32 riders
 * The team array in gameParticipants should match the active PlayerTeam documents
 *
 * Run with: node scripts/fix-oversized-teams-v2.cjs
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
  console.log('Starting fix for oversized teams (v2)...\n');

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

    // Get all ACTIVE PlayerTeam documents for this user
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    const activePlayerTeamCount = playerTeamsSnapshot.size;

    if (activePlayerTeamCount <= configMaxRiders) {
      // Team has correct number of PlayerTeams, just need to sync the team array
      const teamArray = participantData.team || [];

      if (teamArray.length !== activePlayerTeamCount) {
        // Build correct team array from PlayerTeams
        const correctTeamArray = playerTeamsSnapshot.docs.map(doc => {
          const pt = doc.data();
          return {
            riderNameId: pt.riderNameId,
            riderName: pt.riderName,
            riderTeam: pt.riderTeam || '',
            jerseyImage: pt.jerseyImage || '',
            pricePaid: pt.pricePaid,
            acquiredAt: pt.acquiredAt,
          };
        });

        // Calculate correct spent budget
        let correctSpentBudget = 0;
        playerTeamsSnapshot.docs.forEach(doc => {
          correctSpentBudget += doc.data().pricePaid || 0;
        });

        await participantDoc.ref.update({
          team: correctTeamArray,
          rosterSize: correctTeamArray.length,
          spentBudget: correctSpentBudget,
          rosterComplete: correctTeamArray.length >= configMaxRiders,
        });

        console.log(`Synced ${participantData.playername}: team array ${teamArray.length} -> ${correctTeamArray.length}`);
        teamsFixed++;
      }
      continue;
    }

    // Team has too many PlayerTeams - need to remove the excess
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Fixing: ${participantData.playername}`);
    console.log(`Active PlayerTeams: ${activePlayerTeamCount} (${activePlayerTeamCount - configMaxRiders} over limit)`);

    // Sort by acquiredAt (most recent first) to remove the newest ones
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
    const toRemove = activePlayerTeamCount - configMaxRiders;
    const ridersToRemove = playerTeams.slice(0, toRemove);
    const ridersToKeep = playerTeams.slice(toRemove);

    console.log(`\nRemoving ${toRemove} most recently added riders:`);

    for (const rider of ridersToRemove) {
      const acquiredDate = rider.acquiredAt instanceof Date ? rider.acquiredAt : new Date(rider.acquiredAt);
      console.log(`  - ${rider.data.riderName} (acquired: ${acquiredDate.toISOString()})`);

      // Mark PlayerTeam as inactive
      await rider.ref.update({ active: false });

      // Find and update the corresponding bid to "cancelled_overflow"
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

    // Build correct team array from remaining PlayerTeams
    const correctTeamArray = ridersToKeep.map(pt => ({
      riderNameId: pt.data.riderNameId,
      riderName: pt.data.riderName,
      riderTeam: pt.data.riderTeam || '',
      jerseyImage: pt.data.jerseyImage || '',
      pricePaid: pt.data.pricePaid,
      acquiredAt: pt.data.acquiredAt,
    }));

    // Calculate correct spent budget
    let correctSpentBudget = 0;
    ridersToKeep.forEach(pt => {
      correctSpentBudget += pt.data.pricePaid || 0;
    });

    // Update participant
    await participantDoc.ref.update({
      team: correctTeamArray,
      rosterSize: correctTeamArray.length,
      spentBudget: correctSpentBudget,
      rosterComplete: correctTeamArray.length >= configMaxRiders,
    });

    console.log(`\n✓ Updated ${participantData.playername}:`);
    console.log(`  - Team size: ${activePlayerTeamCount} -> ${correctTeamArray.length}`);
    console.log(`  - Spent budget: ${participantData.spentBudget || 0} -> ${correctSpentBudget}`);

    teamsFixed++;
  }

  // Log the activity
  await db.collection('activityLogs').add({
    action: 'ADMIN_FIX_OVERSIZED_TEAMS_V2',
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
  console.log(`  - Teams fixed/synced: ${teamsFixed}`);
  console.log(`  - Riders removed (over limit): ${ridersRemoved}`);
}

// Run the fix
fixOversizedTeams()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
