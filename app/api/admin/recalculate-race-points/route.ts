import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';

export async function POST(request: NextRequest) {
  try {
    const { userId, raceSlug, year } = await request.json();

    if (!userId || !raceSlug || !year) {
      return NextResponse.json(
        { error: 'userId, raceSlug, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    const raceName = raceSlug.replace(/_\\d{4}$/, '');

    const scraperDataSnapshot = await db.collection('scraper-data')
      .where('race', '==', raceName)
      .where('year', '==', yearNum)
      .get();

    const stagesProcessed: Array<{ stage: string; type: string; success: boolean; status: number; error?: string }> = [];

    for (const scraperDoc of scraperDataSnapshot.docs) {
      const scraperData = scraperDoc.data();
      const key = scraperData?.key;
      if (!key || !key.type) continue;

      if (key.type === 'startlist') continue;

      let stage: number | string | undefined;
      if (key.type === 'stage') {
        stage = key.stage;
      } else if (key.type === 'result') {
        stage = 'result';
      } else if (key.type === 'tour-gc') {
        stage = 'tour-gc';
      } else {
        continue;
      }

      if (stage === undefined || stage === null || stage === '') continue;

      try {
        const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
          method: 'POST',
          body: JSON.stringify({
            raceSlug,
            stage,
            year: yearNum,
            force: true,
          }),
        });

        const response = await calculatePoints(mockRequest);
        const result = await response.json();

        stagesProcessed.push({
          stage: stage.toString(),
          type: key.type,
          success: response.status === 200,
          status: response.status,
          error: response.status === 200 ? undefined : result?.error || 'Unknown error',
        });
      } catch (error) {
        stagesProcessed.push({
          stage: stage.toString(),
          type: key.type,
          success: false,
          status: 500,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await db.collection('activityLogs').add({
      action: 'RACE_POINTS_RECALCULATED',
      userId,
      details: {
        raceSlug,
        year: yearNum,
        totalStages: stagesProcessed.length,
        successCount: stagesProcessed.filter(s => s.success).length,
        failCount: stagesProcessed.filter(s => !s.success).length,
      },
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      raceSlug,
      year: yearNum,
      totalStages: stagesProcessed.length,
      successCount: stagesProcessed.filter(s => s.success).length,
      failCount: stagesProcessed.filter(s => !s.success).length,
      details: stagesProcessed,
    });
  } catch (error) {
    console.error('[RECALC_RACE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate race points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
