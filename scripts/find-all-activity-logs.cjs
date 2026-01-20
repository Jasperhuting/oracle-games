const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function findLogs() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';

  // Get ALL activity logs for this game
  const allLogs = await db.collection('activityLogs').get();

  const gameLogs = [];
  allLogs.docs.forEach(doc => {
    const data = doc.data();
    if (data.details?.gameId === gameId || data.details?.targetGameId === gameId) {
      gameLogs.push({
        id: doc.id,
        action: data.action,
        timestamp: data.timestamp?.toDate?.()?.toISOString(),
        userId: data.userId || data.details?.userId || data.details?.adminUserId,
        details: data.details,
      });
    }
  });

  // Sort by timestamp
  gameLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Group by action type
  const byAction = {};
  gameLogs.forEach(log => {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
  });

  console.log('Activity logs for Marginal Gains game by action:');
  Object.entries(byAction).sort((a, b) => b[1] - a[1]).forEach(([action, count]) => {
    console.log(`  ${action}: ${count}`);
  });

  // Show non-finalize logs
  console.log('\n\nNon-AUCTION_FINALIZED logs (first 50):');
  const nonFinalize = gameLogs.filter(l => l.action !== 'AUCTION_FINALIZED').slice(0, 50);
  nonFinalize.forEach(log => {
    console.log(`  ${log.timestamp} - ${log.action}`);
    if (log.action === 'ADMIN_FIX_MISSING_TEAM') {
      console.log(`    Target: ${log.details?.playername}`);
    }
  });
}

findLogs().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
