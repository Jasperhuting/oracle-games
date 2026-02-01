// Script to truncate existing F1 predictions to 10 positions
// Run with: node scripts/truncate-f1-predictions.js

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const f1Db = getFirestore(admin.app(), 'oracle-games-f1');

async function truncatePredictions() {
  try {
    console.log('Starting to truncate F1 predictions to 10 positions...');
    
    // List all collections to debug
    console.log('Listing all collections...');
    const collections = await f1Db.listCollections();
    console.log('Found collections:', collections.map(col => col.id));
    
    // Get all predictions
    const snapshot = await f1Db.collection('predictions').get();
    
    console.log(`Found ${snapshot.size} predictions in total`);
    
    let updatedCount = 0;
    
    for (const doc of snapshot.docs) {
      const predictionData = doc.data();
      
      console.log(`Prediction for user ${predictionData.userId}, round ${predictionData.round} has ${predictionData.finishOrder?.length || 0} positions`);
      
      // Check if prediction has more than 10 positions in finishOrder
      if (predictionData.finishOrder && predictionData.finishOrder.length > 10) {
        // Truncate to first 10 positions
        const truncatedFinishOrder = predictionData.finishOrder.slice(0, 10);
        
        // Update the document
        await doc.ref.update({
          finishOrder: truncatedFinishOrder
        });
        
        updatedCount++;
        console.log(`Updated prediction for user ${predictionData.userId}, round ${predictionData.round}`);
      }
    }
    
    console.log(`Successfully truncated ${updatedCount} predictions to 10 positions`);
    
  } catch (error) {
    console.error('Error truncating predictions:', error);
  }
}

// Run the function
truncatePredictions();
