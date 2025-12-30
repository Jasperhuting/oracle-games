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

async function addSammysosaAsParticipant() {
  console.log('Adding sammysosa as game participant...\n');

  try {
    // Haal de playerTeams op die we net hebben toegevoegd
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', USER_ID)
      .get();

    const team = [];
    let spentBudget = 0;

    playerTeamsSnapshot.forEach(doc => {
      const data = doc.data();
      team.push({
        riderNameId: data.riderNameId,
        riderName: data.riderName,
        pricePaid: data.pricePaid,
        riderTeam: data.riderTeam || '',
        jerseyImage: data.jerseyImage || null,
        acquiredAt: data.acquiredAt.toDate().toISOString(),
      });
      spentBudget += data.pricePaid;
    });

    console.log(`Found ${team.length} riders in team`);
    console.log(`Total spent: €${spentBudget}\n`);

    // Maak gameParticipant document
    const gameParticipantDoc = {
      gameId: GAME_ID,
      userId: USER_ID,
      playername: 'Sammysosa',
      userEmail: 's.schampers@cureplus.nl',
      joinedAt: admin.firestore.Timestamp.fromDate(new Date('2025-12-06T11:59:58.684Z')), // originele registratie datum
      status: 'active',
      budget: 7000,
      rosterComplete: false,
      totalPoints: 0,
      ranking: 0,
      leagueIds: [],
      divisionAssigned: false,
      assignedDivision: '',
      spentBudget: spentBudget,
      team: team,
      rosterSize: team.length,
    };

    await db.collection('gameParticipants').add(gameParticipantDoc);

    console.log('✓ Successfully added sammysosa as game participant!');
    console.log(`  - Username: Sammysosa`);
    console.log(`  - Email: s.schampers@cureplus.nl`);
    console.log(`  - Team size: ${team.length} riders`);
    console.log(`  - Budget spent: €${spentBudget}`);
    console.log(`  - Remaining budget: €${7000 - spentBudget}`);
  } catch (error) {
    console.error('Error adding participant:', error);
    throw error;
  }
}

addSammysosaAsParticipant()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
