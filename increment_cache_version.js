const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function incrementCacheVersion() {
  try {
    console.log('Incrementing cache version...\n');

    // Get current cache version
    const cacheDoc = await db.collection('config').doc('cache').get();
    const currentVersion = cacheDoc.exists ? (cacheDoc.data()?.version || 1) : 1;
    const newVersion = currentVersion + 1;

    // Update cache version
    await db.collection('config').doc('cache').set({
      version: newVersion,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✓ Cache version incremented from ${currentVersion} to ${newVersion}`);
    console.log(`✓ All clients will now invalidate their cached rider data\n`);
  } catch (error) {
    console.error('Error incrementing cache version:', error);
    process.exit(1);
  }
}

incrementCacheVersion()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
