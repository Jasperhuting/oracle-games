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
    console.error('Usage: node scripts/check-specific-player.cjs <gameId> <userId>');
    process.exit(1);
  }

  const participantSnap = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  console.log('=== PARTICIPANT ===');
  console.log('count:', participantSnap.size);
  participantSnap.forEach(doc => {
    console.log('id:', doc.id);
    console.log('data:', doc.data());
  });

  const playerTeamsSnap = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const playerTeamsActiveSnap = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .where('active', '==', true)
    .get();

  console.log('\n=== PLAYER TEAMS ===');
  console.log('total:', playerTeamsSnap.size);
  console.log('active:', playerTeamsActiveSnap.size);

  const bidsSnap = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  console.log('\n=== BIDS ===');
  console.log('total:', bidsSnap.size);

  const statusCounts = {};
  bidsSnap.forEach(doc => {
    const status = doc.data().status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('by status:', statusCounts);

  const wonBidsSnap = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .where('status', '==', 'won')
    .get();

  console.log('won:', wonBidsSnap.size);

  const ptRiders = new Set();
  playerTeamsSnap.forEach(doc => ptRiders.add(doc.data().riderNameId));

  const wonRiders = new Set();
  wonBidsSnap.forEach(doc => wonRiders.add(doc.data().riderNameId));

  const inPTnotBid = [...ptRiders].filter(r => !wonRiders.has(r));
  const inBidnotPT = [...wonRiders].filter(r => !ptRiders.has(r));

  console.log('\n=== DIFF ===');
  console.log('in playerTeams not in won bids:', inPTnotBid.length, inPTnotBid);
  console.log('in won bids not in playerTeams:', inBidnotPT.length, inBidnotPT);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
