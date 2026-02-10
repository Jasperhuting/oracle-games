const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const DEFAULT_RIDERS = [
  'enric-mas',
  'jorgen-nordhagen',
  'luke-lamperti',
  'gerben-thijssen',
  'axel-zingle',
  'aleksandr-vlasov',
];

async function main() {
  const gameId = process.argv[2];
  const userId = process.argv[3];
  const riders = process.argv.slice(4);

  if (!gameId || !userId) {
    console.error('Usage: node scripts/sync-rider-points-from-game.cjs <gameId> <userId> [riderNameId ...]');
    process.exit(1);
  }

  const riderList = riders.length ? riders : DEFAULT_RIDERS;

  for (const riderNameId of riderList) {
    // Find a source playerTeam in this game with the highest points for this rider
    const sourceSnap = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('riderNameId', '==', riderNameId)
      .get();

    if (sourceSnap.empty) {
      console.log(`No playerTeams found in game for ${riderNameId}`);
      continue;
    }

    let bestDoc = null;
    let bestPoints = -1;

    sourceSnap.forEach(doc => {
      const data = doc.data();
      const points = data.pointsScored || data.totalPoints || 0;
      if (points > bestPoints) {
        bestPoints = points;
        bestDoc = data;
      }
    });

    if (!bestDoc) {
      console.log(`No source data found for ${riderNameId}`);
      continue;
    }

    const targetSnap = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('riderNameId', '==', riderNameId)
      .get();

    if (targetSnap.empty) {
      console.log(`No target playerTeam found for ${riderNameId} (userId ${userId})`);
      continue;
    }

    console.log(`Syncing ${riderNameId}: points ${bestPoints} to ${targetSnap.size} docs`);

    const batch = db.batch();
    targetSnap.forEach(doc => {
      batch.update(doc.ref, {
        pointsScored: bestDoc.pointsScored || bestDoc.totalPoints || 0,
        totalPoints: bestDoc.totalPoints || bestDoc.pointsScored || 0,
        pointsBreakdown: Array.isArray(bestDoc.pointsBreakdown) ? bestDoc.pointsBreakdown : [],
        racePoints: bestDoc.racePoints || {},
        stagesParticipated: bestDoc.stagesParticipated || 0,
      });
    });

    await batch.commit();
  }

  // Recalculate participant totalPoints after updates
  const participantSnap = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  if (!participantSnap.empty) {
    const teamsSnap = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    let totalPointsSum = 0;
    teamsSnap.forEach(doc => {
      totalPointsSum += doc.data().pointsScored || 0;
    });

    await participantSnap.docs[0].ref.update({ totalPoints: totalPointsSum });
    console.log('Updated participant totalPoints:', totalPointsSum);
  }

  console.log('Done!');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
