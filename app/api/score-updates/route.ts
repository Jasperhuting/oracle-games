import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

interface ScoreUpdate {
  id: string;
  year: number;
  raceSlug: string;
  stage: string;
  calculatedAt: string;
  totalPointsAwarded: number;
  gamesAffected: string[];
  createdAt?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const yearParam = searchParams.get('year');
    const gameId = searchParams.get('gameId') || undefined;
    const raceSlugParam = searchParams.get('raceSlug') || undefined;
    const limitParam = searchParams.get('limit');

    if (!yearParam) {
      return NextResponse.json({ error: 'year is required' }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);
    if (Number.isNaN(year)) {
      return NextResponse.json({ error: 'year must be a valid number' }, { status: 400 });
    }

    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 1, 1), 50) : 25;

    const db = getServerFirebase();

    // Keep query/index requirements minimal:
    // - filter by year
    // - order by createdAt desc
    // - limit
    // Then filter in-memory for raceSlug/gameId.
    const snapshot = await db
      .collection('scoreUpdates')
      .where('year', '==', year)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const normalizeRaceSlug = (slug: string) => slug.replace(/_\d{4}$/, '');
    const raceSlugFilter = raceSlugParam ? normalizeRaceSlug(raceSlugParam) : undefined;

    const updates: ScoreUpdate[] = snapshot.docs
      .map((doc) => {
        const data = doc.data() as any;

        const createdAt = data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === 'string'
            ? data.createdAt
            : undefined;

        return {
          id: doc.id,
          year: data.year,
          raceSlug: data.raceSlug,
          stage: data.stage,
          calculatedAt: data.calculatedAt,
          totalPointsAwarded: data.totalPointsAwarded || 0,
          gamesAffected: Array.isArray(data.gamesAffected) ? data.gamesAffected : [],
          createdAt,
        };
      })
      .filter((u) => u.year === year);

    const match = updates.find((u) => {
      if (raceSlugFilter && normalizeRaceSlug(u.raceSlug) !== raceSlugFilter) return false;
      if (gameId && !u.gamesAffected.includes(gameId)) return false;
      return true;
    });

    return NextResponse.json({ update: match || null });
  } catch (error) {
    console.error('Error fetching score updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch score updates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
