/**
 * One-time script: write scrapeAfter times from race-times.json into Firestore race documents.
 *
 * Run: node import-scrape-times.mjs
 *
 * For each 1.UWT race with a scrapeAfter time, adds/updates the `scrapeAfter` field
 * (e.g. "19:21") on the matching race document in the `races` collection.
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load .env.local
const dotenv = require('dotenv');
dotenv.config({ path: resolve(__dirname, '.env.local') });

const { initializeApp, getApps, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

const projectId    = process.env.FIREBASE_PROJECT_ID;
const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env.local');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}
const db = getFirestore();

// Load race-times.json
const raceTimes = JSON.parse(readFileSync(resolve(__dirname, 'race-times.json'), 'utf8'));

const races = Object.values(raceTimes).filter(r => r.scrapeAfter);
console.log(`\nFound ${races.length} races with scrapeAfter times.\n`);

let updated = 0, notFound = 0;

for (const race of races) {
  const { slug, scrapeAfter } = race;

  // Try querying by slug field first
  let snap = await db.collection('races').where('slug', '==', slug).limit(1).get();

  // Fallback: try document ID = slug
  if (snap.empty) {
    const doc = await db.collection('races').doc(slug).get();
    if (doc.exists) {
      snap = { docs: [doc], empty: false };
    }
  }

  if (snap.empty) {
    console.log(`  ✗ Not found in Firestore: ${slug}`);
    notFound++;
    continue;
  }

  const docRef = snap.docs[0].ref;
  await docRef.update({ scrapeAfter });
  console.log(`  ✓ ${slug} → scrapeAfter: ${scrapeAfter}`);
  updated++;
}

console.log(`\n─────────────────────────────`);
console.log(`Updated: ${updated}`);
console.log(`Not found: ${notFound}`);
