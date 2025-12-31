const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateAdminTodosToTimestamps() {
  try {
    console.log('Starting migration of adminTodos createdAt and updatedAt to Firestore Timestamps...');

    const todosSnapshot = await db.collection('adminTodos').get();

    if (todosSnapshot.empty) {
      console.log('No adminTodos found in the database.');
      return;
    }

    console.log(`Found ${todosSnapshot.size} adminTodos to migrate.`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const doc of todosSnapshot.docs) {
      try {
        const data = doc.data();
        const updates = {};

        // Check if createdAt needs migration
        if (data.createdAt && typeof data.createdAt === 'string') {
          const createdAtDate = new Date(data.createdAt);
          if (!isNaN(createdAtDate.getTime())) {
            updates.createdAt = admin.firestore.Timestamp.fromDate(createdAtDate);
            console.log(`  ${doc.id}: Converting createdAt from "${data.createdAt}" to Timestamp`);
          } else {
            console.log(`  ${doc.id}: Invalid createdAt date string: "${data.createdAt}"`);
          }
        }

        // Check if updatedAt needs migration
        if (data.updatedAt && typeof data.updatedAt === 'string') {
          const updatedAtDate = new Date(data.updatedAt);
          if (!isNaN(updatedAtDate.getTime())) {
            updates.updatedAt = admin.firestore.Timestamp.fromDate(updatedAtDate);
            console.log(`  ${doc.id}: Converting updatedAt from "${data.updatedAt}" to Timestamp`);
          } else {
            console.log(`  ${doc.id}: Invalid updatedAt date string: "${data.updatedAt}"`);
          }
        }

        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          await doc.ref.update(updates);
          successCount++;
          console.log(`  ${doc.id}: ✓ Successfully migrated`);
        } else {
          skippedCount++;
          console.log(`  ${doc.id}: - Skipped (already using Timestamps or no timestamp fields)`);
        }

      } catch (error) {
        errorCount++;
        console.error(`  ${doc.id}: ✗ Error migrating:`, error.message);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total documents: ${todosSnapshot.size}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('=========================\n');

    if (errorCount === 0) {
      console.log('Migration completed successfully! ✓');
    } else {
      console.log('Migration completed with errors. Please review the errors above.');
    }

  } catch (error) {
    console.error('Fatal error during migration:', error);
    throw error;
  }
}

// Run the migration
migrateAdminTodosToTimestamps()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
