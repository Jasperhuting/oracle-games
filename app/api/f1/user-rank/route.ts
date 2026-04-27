import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1 } from '@/lib/firebase/server';
import { calculateRankings } from '@/lib/utils/slipstreamCalculation';
import type { F1Standing } from '@/app/f1/types';

export const dynamic = 'force-dynamic';

// GET /api/f1/user-rank?userId=xxx
// Returns per-season F1 rank for a given user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    const f1Db = getServerFirebaseF1();

    const participantsSnapshot = await f1Db
      .collection('participants')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({ success: true, results: [] });
    }

    const seasons = participantsSnapshot.docs.map((doc) => Number(doc.data().season)).filter(Boolean);
    const uniqueSeasons = [...new Set(seasons)];

    const results: { season: number; rank: number; totalParticipants: number }[] = [];

    for (const season of uniqueSeasons) {
      const standingsSnapshot = await f1Db
        .collection('standings')
        .where('season', '==', season)
        .get();

      const standings = standingsSnapshot.docs
        .map((doc) => ({ userId: String(doc.data().userId || ''), totalPoints: Number(doc.data().totalPoints || 0) }))
        .filter((s) => s.userId);

      if (standings.length === 0) continue;

      const ranks = calculateRankings(standings, (s) => s.totalPoints, true);
      const userIndex = standings.findIndex((s) => s.userId === userId);

      if (userIndex === -1) continue;

      results.push({
        season,
        rank: ranks[userIndex],
        totalParticipants: standings.length,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error fetching F1 user rank:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch F1 rank' }, { status: 500 });
  }
}
