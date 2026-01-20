const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function findFirstRealFinalize() {
  const logs = await db.collection('activityLogs')
    .where('action', '==', 'AUCTION_FINALIZED')
    .get();

  const realFinalizations = [];
  logs.docs.forEach(doc => {
    const data = doc.data();
    if (data.details?.gameId === 'tG5QrMUSMBsbqfKa36Ii') {
      realFinalizations.push({
        id: doc.id,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        winnersAssigned: data.details.results?.winnersAssigned || 0,
        totalRiders: data.details.results?.totalRiders || 0,
      });
    }
  });

  realFinalizations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  console.log('All finalizations for Marginal Gains game:');
  console.log('==========================================');
  realFinalizations.forEach(f => {
    const marker = f.winnersAssigned > 0 ? '✓' : ' ';
    console.log(`${marker} ${f.timestamp.toISOString()} - winners: ${f.winnersAssigned}, riders: ${f.totalRiders}`);
  });

  const withWinners = realFinalizations.filter(f => f.winnersAssigned > 0);
  console.log('\n');
  console.log(`Total finalizations: ${realFinalizations.length}`);
  console.log(`With actual winners: ${withWinners.length}`);
}

findFirstRealFinalize().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
