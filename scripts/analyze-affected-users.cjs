const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function analyze() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';

  // Affected users (from previous analysis)
  const affectedUserIds = [
    'EzHyFrJTHDTpvlQ3t4a9eFWu6Ye2', // Fieljepper
    'DJ3Umirv3zeS3l5tfHqJmgsncL33', // Andre Brusse
    'tQKHLpLAgBNlfzo8AfpwrsnimQK2', // Jajayejaja
    'CXjI8Z84h7aqBGd0g3meiUf2gzd2', // Arviidd (partial)
    'mjwm5X7KYqMTYf6ngbO9p6iY01B2', // Rahimns
    'VK1GnKNBGJXlZIWZuvGJ2QRuFQP2', // Leukefans
    'xDJTmoSn3rhOUf9CingKm2uZAEr1', // Duurt
    'GaNrhKzPukOlVRpTFKnWZuto6Iu1', // Ralf86
    '0U9n9bYEpuaIB0Ti2LBgYxCqkex1', // Pirazzi
    // Meerkoe has no bids so not really affected
  ];

  console.log('Analyzing affected users...\n');

  for (const userId of affectedUserIds) {
    // Get participant
    const participant = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participant.empty) continue;

    const p = participant.docs[0].data();
    console.log(`=== ${p.playername} ===`);

    // Get ALL bids (including cancelled)
    const allBids = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    // Group by status
    const byStatus = {};
    allBids.docs.forEach(doc => {
      const status = doc.data().status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    console.log(`  Total bids: ${allBids.size}`);
    console.log(`  By status: ${JSON.stringify(byStatus)}`);

    // Check for cancelled bids
    const cancelledBids = allBids.docs.filter(d => d.data().status?.includes('cancelled'));
    if (cancelledBids.length > 0) {
      console.log(`  Cancelled bids:`);
      cancelledBids.slice(0, 3).forEach(doc => {
        const bid = doc.data();
        console.log(`    - ${bid.riderName}: ${bid.status}`);
      });
    }

    // Get playerTeams
    const teams = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    console.log(`  PlayerTeams: ${teams.size}`);
    console.log('');
  }
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
