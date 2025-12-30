const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const GAME_ID = 'qltELoRHMvweHzhM26bN';
const USER_ID = 'YxTaYrQSeiQ9b0jeQ1JXJHf4oH72';

// De 7 renners die sammysosa had moeten winnen met hun laatste biedingen
const bidsToRestore = [
  { riderNameId: 'joao-almeida', riderName: 'João Almeida', amount: 2450, bidAt: '2025-12-19T14:20:38.425Z' },
  { riderNameId: 'davide-piganzoli', riderName: 'Davide Piganzoli', amount: 712, bidAt: '2025-12-19T16:32:53.718Z' },
  { riderNameId: 'senna-remijn', riderName: 'Senna Remijn', amount: 132, bidAt: '2025-12-19T16:32:09.786Z' },
  { riderNameId: 'markel-beloki', riderName: 'Markel Beloki', amount: 122, bidAt: '2025-12-19T16:32:34.305Z' },
  { riderNameId: 'pavel-novak', riderName: 'Pavel Novák', amount: 167, bidAt: '2025-12-19T16:32:26.906Z' },
  { riderNameId: 'georg-steinhauser', riderName: 'Georg Steinhauser', amount: 165, bidAt: '2025-12-19T16:31:55.580Z' },
  { riderNameId: 'luke-tuckwell', riderName: 'Luke Tuckwell', amount: 62, bidAt: '2025-12-19T16:32:19.669Z' },
];

async function restoreSammysosaBids() {
  console.log('Restoring sammysosa bids...\n');

  for (const bid of bidsToRestore) {
    try {
      const bidDoc = {
        gameId: GAME_ID,
        userId: USER_ID,
        playername: 'Sammysosa',
        riderNameId: bid.riderNameId,
        riderName: bid.riderName,
        amount: bid.amount,
        bidAt: admin.firestore.Timestamp.fromDate(new Date(bid.bidAt)),
        riderTeam: '',
        jerseyImage: null,
        status: 'won',
      };

      await db.collection('bids').add(bidDoc);
      console.log(`✓ Restored bid for ${bid.riderName} (€${bid.amount}) - status: won`);
    } catch (error) {
      console.error(`✗ Error restoring bid for ${bid.riderName}:`, error.message);
    }
  }

  const totalSpent = bidsToRestore.reduce((sum, b) => sum + b.amount, 0);
  console.log(`\n✓ Successfully restored ${bidsToRestore.length} bids!`);
  console.log(`Total: €${totalSpent}`);
}

restoreSammysosaBids()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
