import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const raceSlug = searchParams.get('raceSlug');
    const yearParam = searchParams.get('year');

    if (!userId || !raceSlug || !yearParam) {
      return NextResponse.json(
        { error: 'userId, raceSlug, and year are required' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const snapshot = await db.collection('pointsCalculationLogs')
      .where('raceSlug', '==', raceSlug)
      .where('year', '==', year)
      .limit(200)
      .get();

    const toMillis = (value: any): number => {
      if (!value) return 0;
      if (typeof value.toDate === 'function') {
        return value.toDate().getTime();
      }
      if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      return 0;
    };

    const latestByStage = new Map<string, any>();
    snapshot.docs.forEach(doc => {
      const data = doc.data() as any;
      const stageKey = String(data.stage);
      const currentAt = toMillis(data.calculatedAt);
      const existing = latestByStage.get(stageKey);
      if (!existing || currentAt >= (existing.calculatedAtMs ?? 0)) {
        latestByStage.set(stageKey, {
          id: doc.id,
          stage: data.stage,
          status: data.status,
          calculatedAt: data.calculatedAt?.toDate?.().toISOString?.() || data.calculatedAt,
          calculatedAtMs: currentAt,
          totalPointsAwarded: data.totalPointsAwarded ?? 0,
          errors: data.errors || [],
        });
      }
    });

    return NextResponse.json({
      success: true,
      items: Array.from(latestByStage.values()),
    });
  } catch (error) {
    console.error('Error fetching points calculation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch points calculation status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
