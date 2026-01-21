// Script to remove active and benched fields from all PlayerTeam documents
const admin = require('firebase-admin');
const serviceAccount = require('../../../path/to/serviceAccountKey.json'); // Update path

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeActiveAndBenchedFields() {
  try {
    console.log('Starting to remove active and benched fields from PlayerTeam documents...');
    
    // Get all PlayerTeam documents
    const snapshot = await db.collection('playerTeams').get();
    
    console.log(`Found ${snapshot.size} PlayerTeam documents to update`);
    
    let batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Check if document has active or benched fields
      if (data.hasOwnProperty('active') || data.hasOwnProperty('benched')) {
        // Create update object without active and benched fields
        const updateData = { ...data };
        delete updateData.active;
        delete updateData.benched;
        
        // Remove the fields from the document
        batch.update(doc.ref, {
          active: admin.firestore.FieldValue.delete(),
          benched: admin.firestore.FieldValue.delete()
        });
        
        batchCount++;
        totalUpdated++;
        
        // Execute batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`Updated batch of ${batchCount} documents. Total updated: ${totalUpdated}`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Updated final batch of ${batchCount} documents. Total updated: ${totalUpdated}`);
    }
    
    console.log(`Successfully removed active and benched fields from ${totalUpdated} PlayerTeam documents`);
    
  } catch (error) {
    console.error('Error removing fields:', error);
  } finally {
    // Close Firebase connection
    admin.app().delete();
  }
}

// Run the script
removeActiveAndBenchedFields();
