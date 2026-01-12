import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function updateRace() {
  const raceRef = db.collection('races').doc('nc-australia-mj-itt_2026');

  await raceRef.update({
    createdAt: new Date().toISOString(),
    active: true,
    description: '',
  });

  console.log('Race nc-australia-mj-itt_2026 updated successfully');
}

updateRace().catch(console.error);
