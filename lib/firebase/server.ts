import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin App
function initializeFirebaseAdmin() {
  if (getAdminApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    return initializeAdminApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return getAdminApp();
}

// Server-side Firebase Admin - Default Database
export function getServerFirebase() {
  initializeFirebaseAdmin();
  return getAdminFirestore();
}

// Server-side Firebase Admin - Football Database
export function getServerFirebaseFootball() {
  const app = initializeFirebaseAdmin();
  return getAdminFirestore(app, 'oracle-games-football');
}

export const adminDb = getServerFirebase(); // Default database
export const adminFootballDb = getServerFirebaseFootball(); // Football database
