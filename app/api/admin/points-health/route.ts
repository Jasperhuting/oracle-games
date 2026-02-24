import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

type HealthItem = {
  raceSlug: string;
  year: number;
  type: 'stage' | 'result' | 'tour-gc';
  stage?: number | string;
  scrapedAt?: string | null;
  pointsStatus: 'missing' | 'failed' | 'partial';
  lastCalculatedAt?: string | null;
  lastError?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const yearParam = searchParams.get('year');
    const maxDaysParam = searchParams.get('maxDays');

    if (!userId || !yearParam) {
      return NextResponse.json(
        { error: 'userId and year are required' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    const maxDays = maxDaysParam ? parseInt(maxDaysParam, 10) : 60;
    const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const scraperSnapshot = await db
      .collection('scraper-data')
      .where('year', '==', year)
      .limit(2000)
      .get();

    const scraperItems = scraperSnapshot.docs
      .map(doc => doc.data() as any)
      .filter(doc => doc?.key?.type && doc?.key?.type !== 'startlist')
      .filter(doc => {
        if (!doc.updatedAt) return true;
        const updated = new Date(doc.updatedAt);
        return updated >= cutoff;
      })
      .map(doc => ({
        race: doc.key.race as string,
        type: doc.key.type as 'stage' | 'result' | 'tour-gc',
        stage: doc.key.stage,
        updatedAt: doc.updatedAt || null,
      }));

    const pointsSnapshot = await db
      .collection('pointsCalculationLogs')
      .where('year', '==', year)
      .limit(2000)
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

    const latestByKey = new Map<string, any>();
    pointsSnapshot.docs.forEach(doc => {
      const data = doc.data() as any;
      const key = `${data.raceSlug}|${String(data.stage)}`;
      const existing = latestByKey.get(key);
      const existingAt = existing?.calculatedAtMs ?? 0;
      const currentAt = toMillis(data.calculatedAt);
      if (!existing || currentAt >= existingAt) {
        latestByKey.set(key, {
          status: data.status,
          calculatedAt: data.calculatedAt?.toDate?.().toISOString?.() || data.calculatedAt || null,
          calculatedAtMs: currentAt,
          errors: Array.isArray(data.errors) ? data.errors : [],
        });
      }
    });

    const issues: HealthItem[] = [];
    scraperItems.forEach(item => {
      const stageKey = item.type === 'stage' ? String(item.stage) : item.type === 'result' ? 'result' : 'tour-gc';
      const mapKey = `${item.race}|${stageKey}`;
      const calc = latestByKey.get(mapKey);

      if (!calc) {
        issues.push({
          raceSlug: item.race,
          year,
          type: item.type,
          stage: item.stage,
          scrapedAt: item.updatedAt,
          pointsStatus: 'missing',
        });
        return;
      }

      if (calc.status === 'success') {
        return;
      }

      issues.push({
        raceSlug: item.race,
        year,
        type: item.type,
        stage: item.stage,
        scrapedAt: item.updatedAt,
        pointsStatus: calc.status === 'partial' ? 'partial' : 'failed',
        lastCalculatedAt: calc.calculatedAt,
        lastError: calc.errors?.[0] || null,
      });
    });

    return NextResponse.json({
      success: true,
      year,
      maxDays,
      totalScraped: scraperItems.length,
      issues,
    });
  } catch (error) {
    console.error('Error fetching points health:', error);
    return NextResponse.json(
      { error: 'Failed to fetch points health', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
