/**
 * Script to find unused/orphaned collections in Firestore
 * Compares existing collections against the 'races' collection (source of truth)
 * and checks if any games reference those races.
 *
 * Run with: npx tsx scripts/find-unused-collections.ts
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase credentials in .env.local (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// Known static (non-race) collections that should always exist
const KNOWN_STATIC_COLLECTIONS = new Set([
  'races',
  'users',
  'games',
  'gameParticipants',
  'playerTeams',
  'bids',
  'stagePicks',
  'leagues',
  'divisions',
  'draftPicks',
  'riderPools',
  'teams',
  'scraper-data',
  'activityLogs',
  'jobs',
  'config',
  'messages',
  'chat_rooms',
  'translations',
  'adminTodos',
  'participants',
  'seasonPoints',
  'seasonRankings',
  'rider-data',
  'system',
  'playerNameGenerations',
  'ipRateLimits',
  'passkeys',
  'passkeyChallenge',
  'scoreUpdates',
  'raceLineups',
]);

// Pattern: rankings_YYYY
const RANKINGS_PATTERN = /^rankings_\d{4}$/;

// Pattern: {race-slug}_{year} or {race-slug}
const RACE_COLLECTION_PATTERN = /^[a-z0-9-]+_\d{4}$/;

async function findUnusedCollections() {
  console.log('=== Firestore Collection Audit ===\n');

  // Step 1: List all root collections
  console.log('Fetching all root collections...');
  const allCollections = await db.listCollections();
  const allCollectionIds = allCollections.map(c => c.id);
  console.log(`Total root collections found: ${allCollectionIds.length}\n`);

  // Step 2: Get all race slugs from 'races' collection (source of truth)
  console.log('Fetching races from "races" collection...');
  const racesSnapshot = await db.collection('races').get();
  const knownRaceSlugs = new Set<string>();
  racesSnapshot.docs.forEach(doc => {
    const slug = doc.data().slug || doc.id;
    knownRaceSlugs.add(slug);
  });
  console.log(`Known races in "races" collection: ${knownRaceSlugs.size}`);
  console.log([...knownRaceSlugs].sort().map(s => `  - ${s}`).join('\n'));
  console.log();

  // Step 3: Get all game raceSlug references (to check which races have active games)
  console.log('Fetching game race references...');
  const gamesSnapshot = await db.collection('games').get();
  const raceSlugsWithGames = new Set<string>();
  gamesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const raceSlug = data.raceSlug || data.race;
    if (raceSlug) raceSlugsWithGames.add(raceSlug);
  });
  console.log(`Race slugs referenced by games: ${raceSlugsWithGames.size}`);
  console.log([...raceSlugsWithGames].sort().map(s => `  - ${s}`).join('\n'));
  console.log();

  // Step 4: Categorize all collections
  const raceLikeCollections: string[] = [];
  const rankingsCollections: string[] = [];
  const unknownCollections: string[] = [];

  for (const id of allCollectionIds) {
    if (KNOWN_STATIC_COLLECTIONS.has(id)) continue;
    if (RANKINGS_PATTERN.test(id)) {
      rankingsCollections.push(id);
    } else if (RACE_COLLECTION_PATTERN.test(id)) {
      raceLikeCollections.push(id);
    } else {
      unknownCollections.push(id);
    }
  }

  // Step 5: Identify orphaned race collections
  const orphanedRaceCollections: string[] = [];
  const racesWithoutGames: string[] = [];

  for (const colId of raceLikeCollections) {
    const isInRacesCollection = knownRaceSlugs.has(colId);
    const hasGames = raceSlugsWithGames.has(colId);

    if (!isInRacesCollection) {
      orphanedRaceCollections.push(colId);
    } else if (!hasGames) {
      racesWithoutGames.push(colId);
    }
  }

  // Step 6: Count documents in orphaned collections
  console.log('=== RESULTS ===\n');

  console.log('--- Rankings Collections ---');
  rankingsCollections.sort().forEach(id => console.log(`  ${id}`));
  console.log();

  console.log('--- Race-like Collections (in "races" collection + have games) ---');
  raceLikeCollections
    .filter(id => knownRaceSlugs.has(id) && raceSlugsWithGames.has(id))
    .sort()
    .forEach(id => console.log(`  ✓ ${id}`));
  console.log();

  console.log('--- Race-like Collections (in "races" collection but NO games) ---');
  if (racesWithoutGames.length === 0) {
    console.log('  (none)');
  } else {
    racesWithoutGames.sort().forEach(id => console.log(`  ⚠ ${id}`));
  }
  console.log();

  console.log('--- ORPHANED Race Collections (NOT in "races" collection) ---');
  if (orphanedRaceCollections.length === 0) {
    console.log('  (none)');
  } else {
    for (const id of orphanedRaceCollections.sort()) {
      const snap = await db.collection(id).limit(1).get();
      const docCount = snap.empty ? 0 : '1+';
      console.log(`  ✗ ${id}  (docs: ${docCount})`);
    }
  }
  console.log();

  console.log('--- Unknown Collections (unrecognized pattern) ---');
  if (unknownCollections.length === 0) {
    console.log('  (none)');
  } else {
    unknownCollections.sort().forEach(id => console.log(`  ? ${id}`));
  }
  console.log();

  // Step 7: Check for races in 'races' collection that have NO dynamic collection
  console.log('--- Races in "races" collection WITHOUT a dynamic collection ---');
  const missingDynamicCollections: string[] = [];
  for (const slug of knownRaceSlugs) {
    if (!raceLikeCollections.includes(slug)) {
      missingDynamicCollections.push(slug);
    }
  }
  if (missingDynamicCollections.length === 0) {
    console.log('  (none)');
  } else {
    missingDynamicCollections.sort().forEach(id => console.log(`  ⚠ ${id}  (collection missing)`));
  }
  console.log();

  console.log('=== SUMMARY ===');
  console.log(`  Total collections: ${allCollectionIds.length}`);
  console.log(`  Known static: ${KNOWN_STATIC_COLLECTIONS.size}`);
  console.log(`  Rankings collections: ${rankingsCollections.length}`);
  console.log(`  Active race collections (with games): ${raceLikeCollections.filter(id => knownRaceSlugs.has(id) && raceSlugsWithGames.has(id)).length}`);
  console.log(`  Race collections without games: ${racesWithoutGames.length}`);
  console.log(`  Orphaned race collections: ${orphanedRaceCollections.length}`);
  console.log(`  Unknown collections: ${unknownCollections.length}`);
}

findUnusedCollections()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
