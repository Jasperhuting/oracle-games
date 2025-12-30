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

// De 7 renners die sammysosa had moeten winnen
const winnersToAdd = [
  { riderNameId: 'joao-almeida', riderName: 'João Almeida', pricePaid: 2450 },
  { riderNameId: 'davide-piganzoli', riderName: 'Davide Piganzoli', pricePaid: 712 },
  { riderNameId: 'senna-remijn', riderName: 'Senna Remijn', pricePaid: 132 },
  { riderNameId: 'markel-beloki', riderName: 'Markel Beloki', pricePaid: 122 },
  { riderNameId: 'pavel-novak', riderName: 'Pavel Novák', pricePaid: 167 },
  { riderNameId: 'georg-steinhauser', riderName: 'Georg Steinhauser', pricePaid: 165 },
  { riderNameId: 'luke-tuckwell', riderName: 'Luke Tuckwell', pricePaid: 62 },
];

async function restoreSammysosaTeam() {
  console.log('Starting restore process for sammysosa...\n');

  const acquiredAt = admin.firestore.Timestamp.fromDate(new Date('2025-12-19T16:32:53.718Z'));

  for (const rider of winnersToAdd) {
    try {
      const playerTeamDoc = {
        gameId: GAME_ID,
        userId: USER_ID,
        riderNameId: rider.riderNameId,
        acquiredAt: acquiredAt,
        acquisitionType: 'auction',
        pricePaid: rider.pricePaid,
        riderName: rider.riderName,
        riderTeam: '',
        riderCountry: '',
        jerseyImage: '',
        active: true,
        benched: false,
        pointsScored: 0,
        stagesParticipated: 0,
      };

      await db.collection('playerTeams').add(playerTeamDoc);
      console.log(`✓ Added ${rider.riderName} (€${rider.pricePaid}) to sammysosa's team`);
    } catch (error) {
      console.error(`✗ Error adding ${rider.riderName}:`, error.message);
    }
  }

  const totalSpent = winnersToAdd.reduce((sum, r) => sum + r.pricePaid, 0);
  console.log(`\n✓ Successfully restored sammysosa's team!`);
  console.log(`Total riders: ${winnersToAdd.length}`);
  console.log(`Total spent: €${totalSpent}`);
  console.log(`Remaining budget: €${7000 - totalSpent}`);
}

restoreSammysosaTeam()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
