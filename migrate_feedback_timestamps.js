const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateFeedbackTimestamps() {
  console.log('Starting feedback timestamp migration...\n');

  try {
    // Migrate feedback collection
    const feedbackSnapshot = await db.collection('feedback').get();

    console.log(`Found ${feedbackSnapshot.size} feedback documents to migrate\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of feedbackSnapshot.docs) {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;

      // Convert createdAt if it's a string
      if (data.createdAt && typeof data.createdAt === 'string') {
        updates.createdAt = admin.firestore.Timestamp.fromDate(new Date(data.createdAt));
        needsUpdate = true;
        console.log(`  - Converting createdAt for ${doc.id}: ${data.createdAt}`);
      }

      // Convert adminResponseDate if it exists and is a string
      if (data.adminResponseDate && typeof data.adminResponseDate === 'string') {
        updates.adminResponseDate = admin.firestore.Timestamp.fromDate(new Date(data.adminResponseDate));
        needsUpdate = true;
        console.log(`  - Converting adminResponseDate for ${doc.id}: ${data.adminResponseDate}`);
      }

      if (needsUpdate) {
        batch.update(doc.ref, updates);
        batchCount++;
        updatedCount++;

        // Firestore batch limit is 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✓ Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      } else {
        skippedCount++;
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed final batch of ${batchCount} updates`);
    }

    console.log('\n✓ Feedback collection migration complete!');
    console.log(`  - Updated: ${updatedCount} documents`);
    console.log(`  - Skipped: ${skippedCount} documents (already Timestamps)\n`);

    // Migrate config collection - add updatedAt field
    console.log('Migrating config collection...\n');
    const configRef = db.collection('config').doc('system');
    const configDoc = await configRef.get();

    if (configDoc.exists) {
      const configData = configDoc.data();

      // Add updatedAt if it doesn't exist
      if (!configData.updatedAt) {
        await configRef.update({
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log('  ✓ Added updatedAt to config/system\n');
      } else if (typeof configData.updatedAt === 'string') {
        await configRef.update({
          updatedAt: admin.firestore.Timestamp.fromDate(new Date(configData.updatedAt))
        });
        console.log('  ✓ Converted updatedAt to Timestamp in config/system\n');
      } else {
        console.log('  - config/system already has Timestamp updatedAt\n');
      }
    } else {
      console.log('  - config/system does not exist, skipping\n');
    }

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

migrateFeedbackTimestamps()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
