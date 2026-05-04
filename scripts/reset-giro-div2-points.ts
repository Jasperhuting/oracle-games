/**
 * Reset incorrectly awarded points for Giro Divisie 2 (vzBNUh6nzUaLyy6rKQos).
 * The game was misconfigured and picked up points from races before the Giro started.
 * This script clears all pointsBreakdown/pointsScored from playerTeams and resets
 * totalPoints/ranking in gameParticipants back to 0.
 *
 * Run with: npx ts-node scripts/reset-giro-div2-points.ts
 * Add --apply to actually write changes (default is dry-run).
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const GAME_ID = 'vzBNUh6nzUaLyy6rKQos';
const DRY_RUN = !process.argv.includes('--apply');

function ensureFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }

  const fallbackPath = join(process.cwd(), 'service-account-key.json');
  const raw = readFileSync(fallbackPath, 'utf8');
  const key = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  return initializeApp({
    credential: cert({ projectId: key.project_id, clientEmail: key.client_email, privateKey: key.private_key }),
    projectId: key.project_id,
  });
}

async function main() {
  ensureFirebaseAdmin();
  const db = getFirestore();

  console.log(`[RESET_GIRO_DIV2] ${DRY_RUN ? 'DRY RUN — pass --apply to write' : 'APPLY MODE'}`);
  console.log(`[RESET_GIRO_DIV2] Resetting points for game ${GAME_ID}`);

  // 1. Reset playerTeams
  const playerTeamsSnap = await db.collection('playerTeams').where('gameId', '==', GAME_ID).get();
  console.log(`[RESET_GIRO_DIV2] Found ${playerTeamsSnap.size} playerTeam documents`);

  let teamsWithPoints = 0;
  for (let i = 0; i < playerTeamsSnap.docs.length; i += 450) {
    const batch = db.batch();
    for (const doc of playerTeamsSnap.docs.slice(i, i + 450)) {
      const data = doc.data();
      const hasPoints = (data.pointsScored ?? 0) !== 0 || (Array.isArray(data.pointsBreakdown) && data.pointsBreakdown.length > 0);
      if (!hasPoints) continue;

      teamsWithPoints++;
      console.log(`  [playerTeam] ${data.riderName} — pointsScored: ${data.pointsScored}, breakdown entries: ${(data.pointsBreakdown ?? []).length}`);

      if (!DRY_RUN) {
        batch.update(doc.ref, { pointsScored: 0, pointsBreakdown: [] });
      }
    }
    if (!DRY_RUN) await batch.commit();
  }
  console.log(`[RESET_GIRO_DIV2] playerTeams with points: ${teamsWithPoints}`);

  // 2. Reset gameParticipants
  const participantsSnap = await db.collection('gameParticipants').where('gameId', '==', GAME_ID).get();
  console.log(`[RESET_GIRO_DIV2] Found ${participantsSnap.size} participants`);

  let participantsWithPoints = 0;
  for (let i = 0; i < participantsSnap.docs.length; i += 450) {
    const batch = db.batch();
    for (const doc of participantsSnap.docs.slice(i, i + 450)) {
      const data = doc.data();
      if ((data.totalPoints ?? 0) === 0 && (data.ranking ?? 0) === 0) continue;

      participantsWithPoints++;
      console.log(`  [participant] ${data.playername} — totalPoints: ${data.totalPoints}, ranking: ${data.ranking}`);

      if (!DRY_RUN) {
        batch.update(doc.ref, { totalPoints: 0, ranking: 0 });
      }
    }
    if (!DRY_RUN) await batch.commit();
  }
  console.log(`[RESET_GIRO_DIV2] participants with points: ${participantsWithPoints}`);

  if (!DRY_RUN) {
    await db.collection('activityLogs').add({
      action: 'reset_giro_div2_points',
      gameId: GAME_ID,
      details: { teamsReset: teamsWithPoints, participantsReset: participantsWithPoints },
      timestamp: Timestamp.now(),
      source: 'scripts/reset-giro-div2-points.ts',
    });
    console.log('[RESET_GIRO_DIV2] Activity log written.');
  }

  console.log(`[RESET_GIRO_DIV2] Done. ${DRY_RUN ? 'No changes written (dry run).' : 'Changes applied.'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[RESET_GIRO_DIV2] Failed:', err);
    process.exit(1);
  });
