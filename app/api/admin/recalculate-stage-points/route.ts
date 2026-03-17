import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';

export async function POST(request: NextRequest) {
  try {
    const { userId, raceSlug, year, stage } = await request.json();

    if (!userId || !raceSlug || year === undefined || stage === undefined) {
      return NextResponse.json(
        { error: 'userId, raceSlug, year, and stage are required' },
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

    const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
      method: 'POST',
      body: JSON.stringify({
        raceSlug,
        stage,
        year,
        force: true,
      }),
    });

    const response = await calculatePoints(mockRequest);
    const result = await response.json();

    // An empty stage (0 riders) produces a 400 validation error from calculate-points.
    // This is not a real error — there is simply nothing to calculate. Treat it as success.
    const isEmptyStage =
      response.status === 400 &&
      Array.isArray(result.validationErrors) &&
      result.validationErrors.some(
        (e: { message?: string }) => typeof e.message === 'string' && e.message.includes('Too few riders: 0'),
      );

    if (isEmptyStage) {
      return NextResponse.json({
        success: true,
        status: 200,
        result: { message: 'Stage is empty (0 riders) — no points to calculate' },
      });
    }

    return NextResponse.json({
      success: response.status === 200,
      status: response.status,
      result,
    }, { status: response.status });
  } catch (error) {
    console.error('Error recalculating stage points:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate stage points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
