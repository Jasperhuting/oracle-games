const admin = require('firebase-admin');

// ============================================================
// BELANGRIJK: Dit script update ALLEEN biedingen voor:
// Game ID: mGzPZfIOb2gAyEu0i6t6
// 
// Het zet alle biedingen met status "won" terug naar "active"
// voor dit specifieke spel.
// ============================================================

const GAME_ID = 'mGzPZfIOb2gAyEu0i6t6'; // <-- ALLEEN DEZE GAME ID WORDT AANGEPAST

// Initialize Firebase Admin with your service account
// Make sure you have the service account key file
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function restoreBidsToActive() {
  const gameId = GAME_ID;
  
  console.log('============================================================');
  console.log('RESTORE BIDS TO ACTIVE');
  console.log('============================================================');
  console.log(`Target Game ID: ${gameId}`);
  console.log('Status change: "won" -> "active"');
  console.log('============================================================\n');
  
  // Extra veiligheidscheck
  if (gameId !== 'mGzPZfIOb2gAyEu0i6t6') {
    console.error('FOUT: Game ID komt niet overeen met mGzPZfIOb2gAyEu0i6t6');
    console.error('Script wordt afgebroken voor veiligheid.');
    process.exit(1);
  }
  
  console.log(`Fetching all bids with gameId: ${gameId} and status: "won"...`);
  
  // Get all bids that need to be updated - ALLEEN voor deze specifieke gameId
  const bidsSnapshot = await db.collection('bids')
    .where('gameId', '==', gameId)  // ALLEEN gameId: mGzPZfIOb2gAyEu0i6t6
    .where('status', '==', 'won')
    .get();
  
  console.log(`Found ${bidsSnapshot.size} bids to update for gameId: ${gameId}`);
  
  if (bidsSnapshot.empty) {
    console.log('No bids to update. Done!');
    return;
  }
  
  // Firestore batch writes are limited to 500 operations per batch
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;
  let totalUpdated = 0;
  
  for (const doc of bidsSnapshot.docs) {
    batch.update(doc.ref, { status: 'active' });
    operationCount++;
    
    // Commit batch when we reach the limit
    if (operationCount === BATCH_SIZE) {
      console.log(`Committing batch of ${operationCount} updates...`);
      await batch.commit();
      totalUpdated += operationCount;
      console.log(`Progress: ${totalUpdated}/${bidsSnapshot.size} bids updated.`);
      
      // Start a new batch
      batch = db.batch();
      operationCount = 0;
    }
  }
  
  // Commit any remaining operations
  if (operationCount > 0) {
    console.log(`Committing final batch of ${operationCount} updates...`);
    await batch.commit();
    totalUpdated += operationCount;
  }
  
  console.log(`\nDone! Successfully updated ${totalUpdated} bids from "won" to "active".`);
}

restoreBidsToActive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
