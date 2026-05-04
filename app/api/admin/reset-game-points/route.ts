import { getServerFirebase } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Reset all points for a specific game back to 0.
 * Clears pointsBreakdown + pointsScored on playerTeams,
 * and totalPoints + ranking on gameParticipants.
 *
 * POST /api/admin/reset-game-points
 * Body: { gameId: string, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { gameId, dryRun = true } = body as { gameId?: string; dryRun?: boolean };

    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'gameId is verplicht' }, { status: 400 });
    }

    const db = getServerFirebase();

    // Verify game exists
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: `Game ${gameId} niet gevonden` }, { status: 404 });
    }
    const gameName = gameDoc.data()?.name ?? gameId;

    // 1. Reset playerTeams
    const playerTeamsSnap = await db.collection('playerTeams').where('gameId', '==', gameId).get();

    const affectedTeams: { riderName: string; pointsScored: number; breakdownEntries: number }[] = [];

    const BATCH_SIZE = 450;
    for (let i = 0; i < playerTeamsSnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const doc of playerTeamsSnap.docs.slice(i, i + BATCH_SIZE)) {
        const data = doc.data();
        const hasPoints =
          (data.pointsScored ?? 0) !== 0 ||
          (Array.isArray(data.pointsBreakdown) && data.pointsBreakdown.length > 0);
        if (!hasPoints) continue;

        affectedTeams.push({
          riderName: data.riderName ?? data.riderNameId,
          pointsScored: data.pointsScored ?? 0,
          breakdownEntries: Array.isArray(data.pointsBreakdown) ? data.pointsBreakdown.length : 0,
        });

        if (!dryRun) {
          batch.update(doc.ref, { pointsScored: 0, pointsBreakdown: [] });
        }
      }
      if (!dryRun) await batch.commit();
    }

    // 2. Reset gameParticipants
    const participantsSnap = await db
      .collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    const affectedParticipants: { playername: string; totalPoints: number; ranking: number }[] = [];

    for (let i = 0; i < participantsSnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const doc of participantsSnap.docs.slice(i, i + BATCH_SIZE)) {
        const data = doc.data();
        if ((data.totalPoints ?? 0) === 0 && (data.ranking ?? 0) === 0) continue;

        affectedParticipants.push({
          playername: data.playername ?? data.userId,
          totalPoints: data.totalPoints ?? 0,
          ranking: data.ranking ?? 0,
        });

        if (!dryRun) {
          batch.update(doc.ref, { totalPoints: 0, ranking: 0 });
        }
      }
      if (!dryRun) await batch.commit();
    }

    if (!dryRun) {
      await db.collection('activityLogs').add({
        action: 'reset_game_points',
        gameId,
        gameName,
        details: {
          teamsReset: affectedTeams.length,
          participantsReset: affectedParticipants.length,
        },
        timestamp: new Date(),
        source: 'api/admin/reset-game-points',
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      gameName,
      message: dryRun
        ? `Dry run: ${affectedTeams.length} renners en ${affectedParticipants.length} deelnemers zouden worden gereset.`
        : `Klaar: ${affectedTeams.length} renners en ${affectedParticipants.length} deelnemers gereset.`,
      teamsReset: affectedTeams.length,
      participantsReset: affectedParticipants.length,
      affectedTeams,
      affectedParticipants,
    });
  } catch (error) {
    console.error('[RESET_GAME_POINTS] Error:', error);
    return NextResponse.json(
      { error: 'Mislukt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
