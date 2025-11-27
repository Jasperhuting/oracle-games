import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  getApp as getAdminApp,
  cert,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

function initializeFirebaseAdmin() {
  if (getAdminApps().length > 0) {
    return getAdminApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  // 🚨 Prevent Vercel build from crashing
  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "⚠️ Firebase Admin not initialized — missing environment variables."
    );
    return;
  }

  return initializeAdminApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

export function getServerFirebase() {
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin not initialized — missing env vars.");
  }
  return getAdminFirestore();
}

export function getServerFirebaseFootball() {
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin not initialized — missing env vars.");
  }
  return getAdminFirestore(app, "oracle-games-football");
}

export const adminDb = getServerFirebase();
export const adminFootballDb = getServerFirebaseFootball();