const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function incrementCacheVersion() {
  console.log('Incrementing cache version...\n');

  try {
    const configRef = db.collection('config').doc('system');
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      console.log('Creating system config...');
      await configRef.set({ cacheVersion: 1 });
      console.log('✓ Created cache version: 1');
    } else {
      const currentVersion = configDoc.data().cacheVersion || 0;
      const newVersion = currentVersion + 1;
      await configRef.update({ cacheVersion: newVersion });
      console.log(`✓ Updated cache version: ${currentVersion} → ${newVersion}`);
    }
  } catch (error) {
    console.error('Error updating cache version:', error);
    throw error;
  }
}

incrementCacheVersion()
  .then(() => {
    console.log('\nDone! Client should refresh on next load.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
