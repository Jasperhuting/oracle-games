const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function trace() {
  const gameId = 'tG5QrMUSMBsbqfKa36Ii';

  // Get all playerTeams for this game
  const allTeams = await db.collection('playerTeams')
    .where('gameId', '==', gameId)
    .get();

  console.log(`Total playerTeams for game: ${allTeams.size}`);

  // Group by acquiredAt timestamp (rounded to minute)
  const byTime = {};
  allTeams.docs.forEach(doc => {
    const acquiredAt = doc.data().acquiredAt?.toDate?.();
    if (acquiredAt) {
      // Round to nearest minute
      const key = acquiredAt.toISOString().slice(0, 16);
      if (!byTime[key]) {
        byTime[key] = { count: 0, users: new Set() };
      }
      byTime[key].count++;
      byTime[key].users.add(doc.data().userId);
    }
  });

  console.log('\nPlayerTeams creation timeline:');
  Object.entries(byTime)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([time, data]) => {
      console.log(`  ${time} - ${data.count} riders for ${data.users.size} users`);
    });

  // Show which users got playerTeams at each time
  console.log('\n\nUsers with playerTeams by creation time:');
  const userTimes = {};
  allTeams.docs.forEach(doc => {
    const userId = doc.data().userId;
    const acquiredAt = doc.data().acquiredAt?.toDate?.()?.toISOString();
    if (!userTimes[userId]) {
      userTimes[userId] = [];
    }
    userTimes[userId].push(acquiredAt);
  });

  // Get playername for each user
  const participants = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .get();

  const userNames = {};
  participants.docs.forEach(doc => {
    userNames[doc.data().userId] = doc.data().playername;
  });

  Object.entries(userTimes).forEach(([userId, times]) => {
    const playername = userNames[userId] || 'Unknown';
    const minTime = times.sort()[0];
    console.log(`  ${playername}: ${times.length} riders, first at ${minTime}`);
  });
}

trace().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
