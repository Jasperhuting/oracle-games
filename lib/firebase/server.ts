import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  getApp as getAdminApp,
  cert,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// Track if emulators have been configured
let emulatorsConfigured = false;

function shouldUseFirebaseEmulators() {
  return (
    process.env.USE_FIREBASE_EMULATORS === "true" ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" ||
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST
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

  // Allow initialization without service-account credentials when emulator mode is enabled.
  // applicationDefault() satisfies firebase-admin v13's ServiceAccountCredential /
  // isApplicationDefault() check in firestore-internal.js. In emulator mode the Firestore
  // client never calls getAccessToken(), so no real credentials are needed.
  if (shouldUseFirebaseEmulators() && (!projectId || !clientEmail || !privateKey)) {
    console.log("🔧 Initializing Firebase Admin for emulator use (no credentials needed)");
    return initializeAdminApp({
      projectId: emulatorProjectId,
      credential: applicationDefault(),
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
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "oracle-games-b6af6";
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({
      projectId: process.env.GCLOUD_PROJECT,
    });

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
  return getAdminFirestore(app);
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

// Lazy-initialized singletons — deferred until first use so module import
// never throws during build when env vars are absent.
function lazyProxy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_, prop, receiver) {
      if (!instance) instance = factory();
      return Reflect.get(instance, prop, receiver);
    },
    apply(_, thisArg, args) {
      if (!instance) instance = factory();
      return Reflect.apply(instance as unknown as Function, thisArg, args);
    },
  });
}

export const adminDb = lazyProxy(getServerFirebase);
export const adminFootballDb = lazyProxy(getServerFirebaseFootball);
export const adminF1Db = lazyProxy(getServerFirebaseF1);
export const adminAuth = lazyProxy(getServerAuth);
