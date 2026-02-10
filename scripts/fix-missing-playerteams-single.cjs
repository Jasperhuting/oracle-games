const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function main() {
  const gameId = process.argv[2];
  const userId = process.argv[3];

  if (!gameId || !userId) {
    console.error('Usage: node scripts/fix-missing-playerteams-single.cjs <gameId> <userId>');
    process.exit(1);
  }

  const participantSnap = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  if (participantSnap.empty) {
    console.error('No participant found for gameId/userId');
    process.exit(1);
  }

  const participantDoc = participantSnap.docs[0];
  const participant = participantDoc.data();

  const wonBidsSnap = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .where('status', '==', 'won')
    .get();

  const playerTeamsSnap = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const existingRiderIds = new Set(playerTeamsSnap.docs.map(d => d.data().riderNameId));
  const missingBids = wonBidsSnap.docs.filter(doc => !existingRiderIds.has(doc.data().riderNameId));

  console.log('Participant:', participant.playername || participant.userEmail || userId);
  console.log('Won bids:', wonBidsSnap.size);
  console.log('PlayerTeams:', playerTeamsSnap.size);
  console.log('Missing playerTeams to create:', missingBids.length);

  // 1) Create missing playerTeams from won bids
  for (const bidDoc of missingBids) {
    const bid = bidDoc.data();

    // Try to copy points from an existing playerTeam for this rider in the same game
    let pointsScored = 0;
    let totalPoints = 0;
    let pointsBreakdown = [];
    let racePoints = {};
    let stagesParticipated = 0;

    const sourceSnap = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('riderNameId', '==', bid.riderNameId)
      .limit(1)
      .get();

    if (!sourceSnap.empty) {
      const source = sourceSnap.docs[0].data();
      pointsScored = source.pointsScored || 0;
      totalPoints = source.totalPoints || pointsScored;
      pointsBreakdown = Array.isArray(source.pointsBreakdown) ? source.pointsBreakdown : [];
      racePoints = source.racePoints || {};
      stagesParticipated = source.stagesParticipated || 0;
    }

    await db.collection('playerTeams').add({
      gameId: gameId,
      userId: userId,
      riderNameId: bid.riderNameId,
      acquiredAt: bid.bidAt || admin.firestore.Timestamp.now(),
      acquisitionType: 'auction',
      pricePaid: bid.amount,
      riderName: bid.riderName,
      riderTeam: bid.riderTeam || '',
      riderCountry: bid.riderCountry || '',
      jerseyImage: bid.jerseyImage || '',
      active: true,
      benched: false,
      pointsScored: pointsScored,
      totalPoints: totalPoints,
      pointsBreakdown: pointsBreakdown,
      racePoints: racePoints,
      stagesParticipated: stagesParticipated,
    });

    console.log('  + created playerTeam for', bid.riderNameId);
  }

  // 2) Resync participant.team from won bids
  const allWonBids = wonBidsSnap.docs.map(d => d.data());
  const team = allWonBids.map(bid => ({
    riderNameId: bid.riderNameId,
    riderName: bid.riderName,
    riderTeam: bid.riderTeam || '',
    jerseyImage: bid.jerseyImage || '',
    pricePaid: bid.amount,
    acquiredAt: bid.bidAt || admin.firestore.Timestamp.now(),
  }));

  const spentBudget = allWonBids.reduce((sum, bid) => sum + (bid.amount || 0), 0);

  await participantDoc.ref.update({
    team: team,
    rosterSize: team.length,
    spentBudget: spentBudget,
    rosterComplete: team.length >= 20,
  });

  // 3) Recalculate participant totalPoints from all playerTeams
  const updatedTeamsSnap = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  let totalPointsSum = 0;
  updatedTeamsSnap.forEach(doc => {
    totalPointsSum += doc.data().pointsScored || 0;
  });

  await participantDoc.ref.update({
    totalPoints: totalPointsSum,
  });

  console.log('Updated participant.team, rosterSize:', team.length, 'spentBudget:', spentBudget);
  console.log('Updated participant totalPoints:', totalPointsSum);
  console.log('Done!');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
