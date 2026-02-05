import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  getApp as getAdminApp,
  cert,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// Track if emulators have been configured
let emulatorsConfigured = false;

function shouldUseFirebaseEmulators() {
  return (
    process.env.USE_FIREBASE_EMULATORS === "true" ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
  );
}

function initializeFirebaseAdmin() {
  if (getAdminApps().length > 0) {
    return getAdminApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  const emulatorProjectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "oracle-games-b6af6";

  // Provide a lightweight credential for emulator usage to avoid ADC lookups.
  const emulatorCredential = {
    getAccessToken: async () => ({ access_token: "owner", expires_in: 3600 }),
  };

  // Allow initialization without service-account credentials when emulator mode is enabled
  if (shouldUseFirebaseEmulators() && (!projectId || !clientEmail || !privateKey)) {
    console.log("🔧 Initializing Firebase Admin for emulator use (no credentials needed)");
    return initializeAdminApp({
      projectId: emulatorProjectId,
      credential: emulatorCredential as any,
    });
  }

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

function configureEmulatorsIfNeeded() {
  if (emulatorsConfigured) return;

  // Use emulators whenever explicitly enabled via env vars
  if (shouldUseFirebaseEmulators()) {
    // Set emulator environment variables for Firebase Admin SDK
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

    emulatorsConfigured = true;
    console.log("🔧 Server-side Firebase configured to use emulators");
  }
}

export function getServerFirebase() {
  configureEmulatorsIfNeeded();
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin not initialized — missing env vars.");
  }
  return getAdminFirestore();
}

export function getServerFirebaseFootball() {
  configureEmulatorsIfNeeded();
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin not initialized — missing env vars.");
  }
  return getAdminFirestore(app, "oracle-games-football");
}

export function getServerFirebaseF1() {
  configureEmulatorsIfNeeded();
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin not initialized — missing env vars.");
  }
  return getAdminFirestore(app, "oracle-games-f1");
}

export function getServerAuth() {
  configureEmulatorsIfNeeded();
  const app = initializeFirebaseAdmin();
  if (!app) {
    throw new Error("Firebase Admin not initialized — missing env vars.");
  }
  return getAdminAuth(app);
}

export const adminDb = getServerFirebase();
export const adminFootballDb = getServerFirebaseFootball();
export const adminF1Db = getServerFirebaseF1();
export const adminAuth = getServerAuth();
