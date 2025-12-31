const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixStringTimestamp() {
  try {
    // Get all activity logs
    const activityLogsRef = db.collection('activityLogs');
    const snapshot = await activityLogsRef.get();

    console.log(`Found ${snapshot.size} total activity logs`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const timestamp = data.timestamp;

      // Check if timestamp is a string
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        const firestoreTimestamp = admin.firestore.Timestamp.fromDate(date);

        console.log(`\nConverting log ${doc.id}:`);
        console.log(`  Action: ${data.action}`);
        console.log(`  From: "${timestamp}" (${typeof timestamp})`);
        console.log(`  To: Firestore Timestamp (${date.toISOString()})`);

        await doc.ref.update({ timestamp: firestoreTimestamp });
        console.log(`  ✓ Successfully updated`);
        fixed++;
      } else {
        alreadyCorrect++;
      }
    }

    console.log(`\n✓ Done!`);
    console.log(`  Fixed: ${fixed} logs`);
    console.log(`  Already correct: ${alreadyCorrect} logs`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixStringTimestamp();
