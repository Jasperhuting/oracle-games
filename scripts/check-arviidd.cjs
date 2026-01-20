const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function check() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';
  const userId = 'CXjI8Z84h7aqBGd0g3meiUf2gzd2'; // Arviidd

  // Get all bids
  const bids = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  // Get all playerTeams
  const teams = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', userId)
    .get();

  const bidRiders = new Set(bids.docs.map(d => d.data().riderNameId));
  const teamRiders = new Set(teams.docs.map(d => d.data().riderNameId));

  console.log('Arviidd analysis:');
  console.log(`  Bids: ${bids.size}`);
  console.log(`  PlayerTeams: ${teams.size}`);

  console.log('\nRiders with bids but NO playerTeam:');
  bidRiders.forEach(rider => {
    if (!teamRiders.has(rider)) {
      const bid = bids.docs.find(d => d.data().riderNameId === rider);
      console.log(`  - ${bid.data().riderName}`);
    }
  });

  console.log('\nPlayerTeam creation times:');
  teams.docs.forEach(doc => {
    const t = doc.data();
    console.log(`  ${t.riderName}: ${t.acquiredAt?.toDate?.()?.toISOString()}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
