import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/sync-participant-rankings
 *
 * Syncs gameParticipants.totalPoints and .ranking from existing
 * playerTeams.pointsScored without resetting or recalculating anything.
 *
 * Body: { gameId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    const db = getServerFirebase();

    // Sum pointsScored per userId from playerTeams
    const ridersSnap = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .get();

    const pointsByUser = new Map<string, number>();
    for (const doc of ridersSnap.docs) {
      const d = doc.data();
      const uid = d.userId as string;
      if (!uid) continue;
      pointsByUser.set(uid, (pointsByUser.get(uid) ?? 0) + (Number(d.pointsScored) || 0));
    }

    // Sort by points descending to assign rankings
    const sorted = [...pointsByUser.entries()].sort((a, b) => b[1] - a[1]);
    const rankByUser = new Map<string, number>();
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][1] < sorted[i - 1][1]) {
        currentRank = i + 1;
      }
      rankByUser.set(sorted[i][0], currentRank);
    }

    // Fetch participants and update
    const participantsSnap = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    const updates: { userId: string; totalPoints: number; ranking: number }[] = [];
    const batch = db.batch();

    for (const doc of participantsSnap.docs) {
      const userId = doc.data().userId as string;
      const totalPoints = pointsByUser.get(userId) ?? 0;
      const ranking = rankByUser.get(userId) ?? 0;
      batch.update(doc.ref, { totalPoints, ranking });
      updates.push({ userId, totalPoints, ranking });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      gameId,
      participantsUpdated: updates.length,
      updates,
    });
  } catch (error) {
    console.error('[SYNC_PARTICIPANT_RANKINGS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync rankings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
