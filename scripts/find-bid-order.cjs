const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function findOrder() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';

  // Get all participants
  const participants = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .get();

  const participantData = [];

  for (const doc of participants.docs) {
    const p = doc.data();

    // Get first bid time
    const bids = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', p.userId)
      .limit(1)
      .get();

    const firstBidAt = bids.docs[0]?.data()?.bidAt?.toDate?.()?.toISOString() || 'none';

    // Get playerTeams count
    const teams = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', p.userId)
      .get();

    participantData.push({
      playername: p.playername,
      joinedAt: p.joinedAt?.toDate?.()?.toISOString(),
      firstBidAt,
      rosterSize: p.rosterSize || 0,
      playerTeamsCount: teams.size,
      userId: p.userId,
    });
  }

  // Sort by first bid time
  participantData.sort((a, b) => (a.firstBidAt || 'z').localeCompare(b.firstBidAt || 'z'));

  console.log('Participants sorted by first bid time:');
  console.log('=====================================');
  participantData.forEach((p, i) => {
    const status = p.playerTeamsCount === 0 ? '❌ MISSING' :
      p.playerTeamsCount < 20 ? '⚠️ PARTIAL' : '✓';
    console.log(`${String(i + 1).padStart(2)}. ${p.playername.padEnd(30)} firstBid: ${p.firstBidAt?.slice(0, 16) || 'none'} teams: ${p.playerTeamsCount} ${status}`);
  });

  // Count issues
  const missing = participantData.filter(p => p.playerTeamsCount === 0).length;
  const partial = participantData.filter(p => p.playerTeamsCount > 0 && p.playerTeamsCount < 20).length;
  console.log(`\nSummary: ${missing} missing, ${partial} partial, ${participantData.length - missing - partial} complete`);
}

findOrder().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
