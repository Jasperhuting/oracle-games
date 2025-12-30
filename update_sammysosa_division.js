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

async function updateSammysosaDivision() {
  console.log('Updating sammysosa division assignment...\n');

  try {
    // Zoek het gameParticipant document
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', GAME_ID)
      .where('userId', '==', USER_ID)
      .get();

    if (participantsSnapshot.empty) {
      console.error('No participant found for sammysosa!');
      return;
    }

    const participantDoc = participantsSnapshot.docs[0];
    
    // Update naar Division 2 (zoals de meeste andere spelers)
    await participantDoc.ref.update({
      divisionAssigned: true,
      assignedDivision: 'Division 2'
    });

    console.log('✓ Successfully updated sammysosa division!');
    console.log('  - Division: Division 2');
    console.log('  - Division assigned: true');
  } catch (error) {
    console.error('Error updating division:', error);
    throw error;
  }
}

updateSammysosaDivision()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
