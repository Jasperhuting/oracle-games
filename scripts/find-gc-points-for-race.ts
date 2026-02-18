import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

const RACE_SLUG = 'vuelta-ciclista-a-la-region-de-murcia';
const DRY_RUN = !process.argv.includes('--apply');

interface MatchEntry {
  stage?: string;
  gcPoints?: number;
  stageResult?: number;
  total?: number;
  gcPosition?: number;
  calculatedAt?: string;
}

interface MatchResult {
  docId: string;
  gameId?: string;
  participantId?: string;
  userId?: string;
  riderName?: string;
  riderNameId?: string;
  currentPointsScored: number;
  newPointsScored: number;
  pointsDiff: number;
  tourGcEntries: MatchEntry[];
}

async function findAndFixTourGcPoints() {
  console.log(`Searching playerTeams for tour-gc entries in race: ${RACE_SLUG}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to actually fix)' : '*** APPLYING FIXES ***'}\n`);

  const results: MatchResult[] = [];
  let checked = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let query = db.collection('playerTeams')
      .orderBy(FieldPath.documentId())
      .limit(1000);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      checked += 1;
      const data = doc.data();
      const breakdown: any[] = Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown : [];

      // Find tour-gc entries for this race
      const tourGcEntries: MatchEntry[] = [];
      for (const entry of breakdown) {
        if (entry?.raceSlug !== RACE_SLUG) continue;
        if (entry?.stage === 'tour-gc') {
          tourGcEntries.push({
            stage: entry.stage,
            gcPoints: entry.gcPoints,
            stageResult: entry.stageResult,
            total: entry.total,
            gcPosition: entry.gcPosition,
            calculatedAt: entry.calculatedAt,
          });
        }
      }

      if (tourGcEntries.length > 0) {
        // Calculate new pointsBreakdown without tour-gc entries
        const newBreakdown = breakdown.filter(
          (e: any) => !(e?.raceSlug === RACE_SLUG && e?.stage === 'tour-gc')
        );
        const newPointsScored = newBreakdown.reduce((sum: number, e: any) => sum + (Number(e?.total) || 0), 0);
        const currentPointsScored = Number(data.pointsScored) || 0;

        results.push({
          docId: doc.id,
          gameId: data.gameId,
          participantId: data.participantId,
          userId: data.userId,
          riderName: data.riderName,
          riderNameId: data.riderNameId,
          currentPointsScored,
          newPointsScored,
          pointsDiff: currentPointsScored - newPointsScored,
          tourGcEntries,
        });

        if (!DRY_RUN) {
          await doc.ref.update({
            pointsBreakdown: newBreakdown,
            pointsScored: newPointsScored,
          });
        }
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`Checked ${checked} playerTeams... affected: ${results.length}`);
  }

  console.log('\n=== RESULTS ===');
  console.log(`Checked ${checked} playerTeams.`);
  console.log(`Found ${results.length} playerTeams with tour-gc entries for ${RACE_SLUG}.`);

  if (results.length === 0) return;

  let totalPointsRemoved = 0;

  // Group by game
  const byGame: Record<string, MatchResult[]> = {};
  for (const r of results) {
    const gid = r.gameId ?? 'unknown';
    if (!byGame[gid]) byGame[gid] = [];
    byGame[gid].push(r);
    totalPointsRemoved += r.pointsDiff;
  }

  for (const [gameId, items] of Object.entries(byGame)) {
    console.log(`\n=== Game: ${gameId} (${items.length} riders affected) ===`);
    for (const r of items) {
      console.log(`  ${r.riderName} (${r.riderNameId}) | doc: ${r.docId}`);
      console.log(`    points: ${r.currentPointsScored} -> ${r.newPointsScored} (removing ${r.pointsDiff})`);
      for (const e of r.tourGcEntries) {
        console.log(`    tour-gc entry: gcPoints=${e.gcPoints ?? 0} stageResult=${e.stageResult ?? 0} total=${e.total ?? 0}`);
      }
    }
  }

  console.log(`\nTotal points to remove: ${totalPointsRemoved}`);

  if (!DRY_RUN) {
    console.log('\n=== Updating gameParticipants totals ===');
    // Group by game + userId to update participant totals
    const participantUpdates: Record<string, { gameId: string; userId: string; pointsDiff: number }> = {};
    for (const r of results) {
      const key = `${r.gameId}_${r.userId}`;
      if (!participantUpdates[key]) {
        participantUpdates[key] = { gameId: r.gameId ?? '', userId: r.userId ?? '', pointsDiff: 0 };
      }
      participantUpdates[key].pointsDiff += r.pointsDiff;
    }

    for (const upd of Object.values(participantUpdates)) {
      // Find the gameParticipant doc
      const partSnap = await db.collection('gameParticipants')
        .where('gameId', '==', upd.gameId)
        .where('userId', '==', upd.userId)
        .limit(1)
        .get();

      if (!partSnap.empty) {
        const partDoc = partSnap.docs[0];
        const currentTotal = Number(partDoc.data().totalPoints) || 0;
        const newTotal = Math.max(0, currentTotal - upd.pointsDiff);
        await partDoc.ref.update({ totalPoints: newTotal });
        console.log(`  Updated participant ${partDoc.id} (game: ${upd.gameId}, user: ${upd.userId}): ${currentTotal} -> ${newTotal}`);
      }
    }

    console.log('\n✅ Fix applied successfully!');
  } else {
    console.log('\n⚠️  DRY RUN - no changes made. Pass --apply to fix.');
  }
}

findAndFixTourGcPoints().catch((err) => {
  console.error(err);
  process.exit(1);
});
