const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function analyzeBids() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';

  // Get ALL bids for this game
  const allBids = await db.collection('bids')
    .where('gameId', '==', gameId)
    .get();

  console.log(`Total bids in game: ${allBids.size}`);

  // Group by status
  const byStatus = {};
  allBids.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  console.log('\nBids by status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Check if there are activity logs for bid status changes
  console.log('\n\nLooking for BIDS_REJECTED_AT_FINALIZE logs...');
  const rejectedLogs = await db.collection('activityLogs')
    .where('action', '==', 'BIDS_REJECTED_AT_FINALIZE')
    .get();
  console.log(`Found ${rejectedLogs.size} rejection logs`);

  // Check how bids for a working user were processed
  console.log('\n\nComparing a working user vs broken user...');

  // First, let's see a working participant's first bid
  const workingParticipant = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('rosterSize', '>', 0)
    .limit(1)
    .get();

  if (!workingParticipant.empty) {
    const working = workingParticipant.docs[0].data();
    console.log(`\nWorking user: ${working.playername} (${working.userId})`);
    console.log(`  Roster size: ${working.rosterSize}`);

    // Get their bids
    const workingBids = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', working.userId)
      .limit(3)
      .get();

    console.log(`  Sample bids:`);
    workingBids.docs.forEach(doc => {
      const bid = doc.data();
      console.log(`    - ${bid.riderName}: status=${bid.status}, bidAt=${bid.bidAt?.toDate?.()?.toISOString()}`);
    });

    // Get their playerTeams
    const workingTeams = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', working.userId)
      .limit(3)
      .get();

    console.log(`  Sample playerTeams:`);
    workingTeams.docs.forEach(doc => {
      const team = doc.data();
      console.log(`    - ${team.riderName}: acquiredAt=${team.acquiredAt?.toDate?.()?.toISOString()}`);
    });
  }

  // Broken user (Rahimns)
  const brokenUserId = 'mjwm5X7KYqMTYf6ngbO9p6iY01B2';
  console.log(`\nBroken user: Rahimns (${brokenUserId})`);

  const brokenBids = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', brokenUserId)
    .limit(3)
    .get();

  console.log(`  Sample bids:`);
  brokenBids.docs.forEach(doc => {
    const bid = doc.data();
    console.log(`    - ${bid.riderName}: status=${bid.status}, bidAt=${bid.bidAt?.toDate?.()?.toISOString()}`);
  });

  const brokenTeams = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', brokenUserId)
    .get();

  console.log(`  PlayerTeams count: ${brokenTeams.size}`);
}

analyzeBids().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
