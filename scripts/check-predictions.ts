import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore(app, 'oracle-games-f1');

async function checkData() {
  console.log('--- Races ---\n');
  const racesSnapshot = await db.collection('races').orderBy('round').limit(5).get();
  
  for (const doc of racesSnapshot.docs) {
    const data = doc.data();
    console.log(`Round ${data.round}: ${data.name} | Status: ${data.status}`);
  }
}

checkData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
