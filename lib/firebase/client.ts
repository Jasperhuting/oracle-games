import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app
function initializeFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

const app = initializeFirebaseApp();

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const footballDb = getFirestore(app, 'oracle-games-football');

// Track if emulators have been connected
let emulatorsConnected = false;

// Connect to emulators - must be called on client side only
function connectToEmulatorsIfNeeded() {
  // Only run on client side
  if (typeof window === 'undefined') return;

  // Only connect once
  if (emulatorsConnected) return;

  // Check if we should use emulators - only if explicitly enabled via env var
  const useEmulators =
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' &&
    process.env.NODE_ENV === 'development' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (useEmulators) {
    try {
      // Connect Auth emulator
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

      // Connect Firestore emulators
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectFirestoreEmulator(footballDb, '127.0.0.1', 8080);

      emulatorsConnected = true;
      console.log('🔧 Connected to Firebase Emulators');
      console.log('   - Auth: http://127.0.0.1:9099');
      console.log('   - Firestore: http://127.0.0.1:8080');
      console.log('   - UI: http://127.0.0.1:4000');
    } catch (error: unknown) {
      // Already connected or connection failed
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/emulator-config-failed') {
        emulatorsConnected = true; // Already connected
      } else {
        console.error('Failed to connect to emulators:', error);
        console.log('📡 Using production Firebase');
      }
    }
  } else {
    console.log('📡 Using production Firebase');
  }
}

// Try to connect immediately if on client
connectToEmulatorsIfNeeded();

// Client-side Firebase
export function getClientFirebase() {
  return db;
}

export function getClientFirebaseFootball() {
  return footballDb;
}

export function getClientAuth() {
  return auth;
}

// Export instances directly
export { db, footballDb, auth };
