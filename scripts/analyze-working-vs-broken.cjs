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

  // Working user - Erveedeeee (from the earlier participant data)
  const workingUserId = '2IBY1KopZPSEsJZcQmHFI0bf9I63';
  // Broken user - Rahimns
  const brokenUserId = 'mjwm5X7KYqMTYf6ngbO9p6iY01B2';

  console.log('=== WORKING USER (Erveedeeee) ===');
  const workingBids = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', workingUserId)
    .get();
  console.log(`Bids: ${workingBids.size}`);

  const workingTeams = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', workingUserId)
    .get();
  console.log(`PlayerTeams: ${workingTeams.size}`);

  // Show bid timestamps
  console.log('\nBid timestamps:');
  const workingBidTimes = workingBids.docs.map(d => d.data().bidAt?.toDate?.()?.toISOString()).sort();
  console.log(`  First: ${workingBidTimes[0]}`);
  console.log(`  Last: ${workingBidTimes[workingBidTimes.length - 1]}`);

  // Show playerTeam timestamps
  console.log('\nPlayerTeam acquiredAt:');
  const workingTeamTimes = workingTeams.docs.map(d => d.data().acquiredAt?.toDate?.()?.toISOString()).sort();
  console.log(`  First: ${workingTeamTimes[0]}`);
  console.log(`  Last: ${workingTeamTimes[workingTeamTimes.length - 1]}`);

  console.log('\n=== BROKEN USER (Rahimns) ===');
  const brokenBids = await db.collection('bids')
    .where('gameId', '==', gameId)
    .where('userId', '==', brokenUserId)
    .get();
  console.log(`Bids: ${brokenBids.size}`);

  const brokenTeams = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .where('userId', '==', brokenUserId)
    .get();
  console.log(`PlayerTeams: ${brokenTeams.size}`);

  // Show bid timestamps
  console.log('\nBid timestamps:');
  const brokenBidTimes = brokenBids.docs.map(d => d.data().bidAt?.toDate?.()?.toISOString()).sort();
  console.log(`  First: ${brokenBidTimes[0]}`);
  console.log(`  Last: ${brokenBidTimes[brokenBidTimes.length - 1]}`);

  // Check participant team array
  console.log('\n=== Checking participant.team array ===');
  const workingParticipant = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', workingUserId)
    .limit(1)
    .get();

  if (!workingParticipant.empty) {
    const data = workingParticipant.docs[0].data();
    console.log(`Erveedeeee team array length: ${(data.team || []).length}`);
    if (data.team && data.team.length > 0) {
      console.log(`  First rider acquiredAt: ${data.team[0].acquiredAt?.toDate?.()?.toISOString()}`);
    }
  }

  const brokenParticipant = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('userId', '==', brokenUserId)
    .limit(1)
    .get();

  if (!brokenParticipant.empty) {
    const data = brokenParticipant.docs[0].data();
    console.log(`Rahimns team array length: ${(data.team || []).length}`);
  }
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
