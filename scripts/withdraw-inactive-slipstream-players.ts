/**
 * Script to set specific Slipstream participants to 'withdrawn' status.
 *
 * These players have missed too many races and should be excluded from standings.
 * Setting status to 'withdrawn' removes them from the active standings query.
 *
 * Usage:
 *   # Dry run (preview changes, no actual modifications)
 *   npm run tsx scripts/withdraw-inactive-slipstream-players.ts <gameId>
 *
 *   # Live mode (actually make changes)
 *   npm run tsx scripts/withdraw-inactive-slipstream-players.ts <gameId> --live
 *
 * Examples:
 *   npm run tsx scripts/withdraw-inactive-slipstream-players.ts abc123
 *   npm run tsx scripts/withdraw-inactive-slipstream-players.ts abc123 --live
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env.local');
    console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });

  console.log('✅ Firebase Admin initialized');
}

const db = getFirestore();

// Players to withdraw — missed too many races
const PLAYERS_TO_WITHDRAW = [
  'Coolietje',
  'Fieljepper',
  'Ronde van Westfriesland',
  'Sons Jelle',
];

async function withdrawInactivePlayers(gameId: string, dryRun: boolean) {
  console.log('=== Withdraw Inactive Slipstream Players ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update status)'}`);
  console.log(`GameId: ${gameId}`);
  console.log(`Players to withdraw: ${PLAYERS_TO_WITHDRAW.join(', ')}`);
  console.log('');

  // Verify game exists and is a slipstream game
  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    console.error('❌ Game not found');
    process.exit(1);
  }
  const game = gameDoc.data()!;
  console.log(`Game: ${game.name} (type: ${game.type})`);
  if (game.type !== 'slipstream') {
    console.error(`❌ Game type is '${game.type}', expected 'slipstream'`);
    process.exit(1);
  }
  console.log('');

  // Find participants by playername
  const found: { docId: string; playername: string; currentStatus: string }[] = [];
  const notFound: string[] = [];

  for (const playername of PLAYERS_TO_WITHDRAW) {
    const snapshot = await db
      .collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('playername', '==', playername)
      .limit(1)
      .get();

    if (snapshot.empty) {
      notFound.push(playername);
      console.log(`  ⚠️  Not found: ${playername}`);
    } else {
      const doc = snapshot.docs[0];
      const data = doc.data();
      found.push({ docId: doc.id, playername, currentStatus: data.status });
      console.log(`  ✅ Found: ${playername} (status: ${data.status}, docId: ${doc.id})`);
    }
  }

  console.log('');

  if (notFound.length > 0) {
    console.log(`⚠️  Could not find ${notFound.length} player(s): ${notFound.join(', ')}`);
    console.log('   Check spelling or they may already be removed.');
    console.log('');
  }

  const alreadyWithdrawn = found.filter(p => p.currentStatus === 'withdrawn');
  const toUpdate = found.filter(p => p.currentStatus !== 'withdrawn');

  if (alreadyWithdrawn.length > 0) {
    console.log(`ℹ️  Already withdrawn: ${alreadyWithdrawn.map(p => p.playername).join(', ')}`);
  }

  if (toUpdate.length === 0) {
    console.log('✅ Nothing to update — all found players are already withdrawn.');
    return;
  }

  console.log(`Will set status → 'withdrawn' for: ${toUpdate.map(p => p.playername).join(', ')}`);
  console.log('');

  if (!dryRun) {
    const batch = db.batch();

    for (const player of toUpdate) {
      const ref = db.collection('gameParticipants').doc(player.docId);
      batch.update(ref, {
        status: 'withdrawn',
        withdrawnAt: Timestamp.now(),
      });
    }

    await batch.commit();
    console.log(`✅ Updated ${toUpdate.length} participant(s) to 'withdrawn'`);
  } else {
    console.log('ℹ️  DRY RUN — No changes made. Run with --live to apply changes.');
  }
}

// Parse args
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('❌ Usage: npm run tsx scripts/withdraw-inactive-slipstream-players.ts <gameId> [--live]');
  process.exit(1);
}

const gameId = args[0];
const isLive = args.includes('--live');

withdrawInactivePlayers(gameId, !isLive)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
