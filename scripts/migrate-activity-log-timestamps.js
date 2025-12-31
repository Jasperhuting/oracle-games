/**
 * Script to migrate activity log timestamps to Firestore Timestamp format
 * This will convert:
 * - Unix timestamps (numbers) -> Firestore Timestamp
 * - ISO strings -> Firestore Timestamp
 * - Keep existing Firestore Timestamps as-is
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateTimestamps() {
  console.log('Starting timestamp migration for activityLogs collection...\n');

  const logsSnapshot = await db.collection('activityLogs').get();

  console.log(`Found ${logsSnapshot.size} activity logs\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;

  for (const doc of logsSnapshot.docs) {
    const data = doc.data();
    const timestamp = data.timestamp;

    try {
      let newTimestamp = null;

      // Check what type of timestamp we have
      if (timestamp instanceof admin.firestore.Timestamp) {
        // Already a Firestore Timestamp, skip
        skippedCount++;
        continue;
      } else if (typeof timestamp === 'number') {
        // Unix timestamp in milliseconds
        newTimestamp = admin.firestore.Timestamp.fromMillis(timestamp);
        console.log(`Converting number timestamp for doc ${doc.id}: ${timestamp} -> ${newTimestamp.toDate().toISOString()}`);
      } else if (typeof timestamp === 'string') {
        // ISO string
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          newTimestamp = admin.firestore.Timestamp.fromDate(date);
          console.log(`Converting string timestamp for doc ${doc.id}: ${timestamp} -> ${newTimestamp.toDate().toISOString()}`);
        } else {
          console.error(`Invalid date string for doc ${doc.id}: ${timestamp}`);
          errorCount++;
          continue;
        }
      } else if (timestamp && typeof timestamp === 'object' && timestamp._seconds !== undefined) {
        // Already serialized Firestore Timestamp object (shouldn't happen but just in case)
        newTimestamp = new admin.firestore.Timestamp(timestamp._seconds, timestamp._nanoseconds || 0);
        console.log(`Converting serialized timestamp for doc ${doc.id}`);
      } else {
        console.error(`Unknown timestamp format for doc ${doc.id}:`, typeof timestamp, timestamp);
        errorCount++;
        continue;
      }

      if (newTimestamp) {
        batch.update(doc.ref, { timestamp: newTimestamp });
        batchCount++;
        migratedCount++;

        // Commit batch if we hit the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`\nCommitted batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
    } catch (error) {
      console.error(`Error processing doc ${doc.id}:`, error);
      errorCount++;
    }
  }

  // Commit any remaining updates
  if (batchCount > 0) {
    await batch.commit();
    console.log(`\nCommitted final batch of ${batchCount} updates`);
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total documents: ${logsSnapshot.size}`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Skipped (already Firestore Timestamp): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('=========================\n');
}

// Run the migration
migrateTimestamps()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
