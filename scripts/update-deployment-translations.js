const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateTranslations() {
  try {
    // Update English
    await db.collection('translations').doc('en').update({
      'admin.tabs.deployments': 'Deployments'
    });
    console.log('✅ Updated English translations');

    // Update Dutch
    await db.collection('translations').doc('nl').update({
      'admin.tabs.deployments': 'Deployments'
    });
    console.log('✅ Updated Dutch translations');

    console.log('\n✨ All translations updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating translations:', error);
    process.exit(1);
  }
}

updateTranslations();
