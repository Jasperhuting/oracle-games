/**
 * Script to fix teams that have spent more than their budget (12.000)
 * Removes the most recently added riders until budget is within limit
 *
 * Run with: node scripts/fix-overbudget-teams.cjs
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
const MAX_BUDGET = 12000;
const MAX_RIDERS = 32;

async function fixOverbudgetTeams() {
  console.log('Starting fix for overbudget teams...\n');

  // Get game data
  const gameDoc = await db.collection('games').doc(GAME_ID).get();
  if (!gameDoc.exists) {
    console.error('Game not found!');
    return;
  }

  const gameData = gameDoc.data();
  const configBudget = gameData?.config?.budget || MAX_BUDGET;
  console.log(`Game: ${gameData?.name}`);
  console.log(`Max budget: ${configBudget}\n`);

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

    // Calculate current spent budget from PlayerTeams
    let currentSpent = 0;
    playerTeamsSnapshot.docs.forEach(doc => {
      currentSpent += doc.data().pricePaid || 0;
    });

    if (currentSpent <= configBudget) {
      continue; // Budget is fine
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Fixing: ${participantData.playername}`);
    console.log(`Current spent: ${currentSpent} (${currentSpent - configBudget} over budget)`);
    console.log(`Active riders: ${playerTeamsSnapshot.size}`);

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

    // Remove riders until we're under budget
    const ridersToRemove = [];
    let newSpent = currentSpent;

    for (const rider of playerTeams) {
      if (newSpent <= configBudget) {
        break;
      }
      ridersToRemove.push(rider);
      newSpent -= rider.data.pricePaid || 0;
    }

    console.log(`\nRemoving ${ridersToRemove.length} riders to get under budget:`);

    const riderNameIdsToRemove = new Set();

    for (const rider of ridersToRemove) {
      const acquiredDate = rider.acquiredAt instanceof Date ? rider.acquiredAt : new Date(rider.acquiredAt);
      console.log(`  - ${rider.data.riderName} (${rider.data.pricePaid} pts, acquired: ${acquiredDate.toISOString()})`);
      riderNameIdsToRemove.add(rider.data.riderNameId);

      // Mark PlayerTeam as inactive
      await rider.ref.update({ active: false });

      // Find and update the corresponding bid
      const bidsSnapshot = await db.collection('bids')
        .where('gameId', '==', GAME_ID)
        .where('userId', '==', userId)
        .where('riderNameId', '==', rider.data.riderNameId)
        .where('status', '==', 'won')
        .limit(1)
        .get();

      if (!bidsSnapshot.empty) {
        await bidsSnapshot.docs[0].ref.update({ status: 'cancelled_overbudget' });
      }

      ridersRemoved++;
    }

    // Get remaining active PlayerTeams
    const remainingPlayerTeams = playerTeams.filter(pt => !riderNameIdsToRemove.has(pt.data.riderNameId));

    // Build correct team array
    const correctTeamArray = remainingPlayerTeams.map(pt => ({
      riderNameId: pt.data.riderNameId,
      riderName: pt.data.riderName,
      riderTeam: pt.data.riderTeam || '',
      jerseyImage: pt.data.jerseyImage || '',
      pricePaid: pt.data.pricePaid,
      acquiredAt: pt.data.acquiredAt,
    }));

    // Calculate final spent budget
    let finalSpent = 0;
    remainingPlayerTeams.forEach(pt => {
      finalSpent += pt.data.pricePaid || 0;
    });

    // Update participant
    await participantDoc.ref.update({
      team: correctTeamArray,
      rosterSize: correctTeamArray.length,
      spentBudget: finalSpent,
      rosterComplete: correctTeamArray.length >= MAX_RIDERS,
    });

    console.log(`\n✓ Updated ${participantData.playername}:`);
    console.log(`  - Spent: ${currentSpent} -> ${finalSpent}`);
    console.log(`  - Riders: ${playerTeamsSnapshot.size} -> ${correctTeamArray.length}`);

    teamsFixed++;
  }

  // Log the activity
  await db.collection('activityLogs').add({
    action: 'ADMIN_FIX_OVERBUDGET_TEAMS',
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
fixOverbudgetTeams()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
