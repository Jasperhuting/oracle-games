import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * GET /api/season-points
 *
 * Fetch season points leaderboard for a given year.
 *
 * Query params:
 * - year (required): The season year (e.g., 2025, 2026)
 * - limit (optional): Number of results to return (default: 50, max: 200)
 * - offset (optional): Offset for pagination (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    console.log(`[SEASON_POINTS_API] Fetching season points for year ${yearNum}`);

    const db = getServerFirebase();

    // Query seasonPoints collection
    // Documents are named: {riderNameId}_{year}
    // Note: We query all documents for the year and sort client-side to avoid
    // needing a composite index (year + totalPoints)
    let seasonPointsSnapshot;
    try {
      seasonPointsSnapshot = await db.collection('seasonPoints')
        .where('year', '==', yearNum)
        .get();
      console.log(`[SEASON_POINTS_API] Found ${seasonPointsSnapshot.size} documents`);
    } catch (queryError) {
      console.error('[SEASON_POINTS_API] Query error:', queryError);
      throw queryError;
    }

    // Sort by totalPoints descending
    const allDocs = seasonPointsSnapshot.docs.sort((a, b) => {
      const aPoints = a.data().totalPoints || 0;
      const bPoints = b.data().totalPoints || 0;
      return bPoints - aPoints;
    });

    // Apply pagination
    const paginatedDocs = allDocs.slice(offset, offset + limit);

    // Points to position mapping (reverse lookup from TOP_20_POINTS)
    // TOP_20_POINTS = [100, 80, 66, 56, 50, 44, 40, 36, 32, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8]
    const pointsToPosition: Record<number, number> = {
      100: 1, 80: 2, 66: 3, 56: 4, 50: 5, 44: 6, 40: 7, 36: 8, 32: 9, 28: 10,
      26: 11, 24: 12, 22: 13, 20: 14, 18: 15, 16: 16, 14: 17, 12: 18, 10: 19, 8: 20
    };

    // Helper to derive position from stageResult points (fallback for old data without finishPosition)
    const derivePositionFromPoints = (stageResultPoints: number): number | null => {
      return pointsToPosition[stageResultPoints] || null;
    };

    const riders = paginatedDocs.map((doc, index) => {
      const data = doc.data();

      // For single-day races (stage='result'), extract the finish position for display
      // For multi-stage races, find the best finish position across all stages
      const racesWithDetails = data.races ? Object.entries(data.races).map(([raceSlug, raceData]: [string, any]) => {
        const stages = raceData.stages || {};
        const stageEntries = Object.entries(stages);

        // Find best finish position (lowest number = best result)
        let bestFinishPosition: number | null = null;
        for (const [, stagePoints] of stageEntries) {
          // Use stored finishPosition, or derive from stageResult points as fallback
          const fp = (stagePoints as any).finishPosition ||
                     derivePositionFromPoints((stagePoints as any).stageResult);
          if (fp && (bestFinishPosition === null || fp < bestFinishPosition)) {
            bestFinishPosition = fp;
          }
        }

        return {
          raceSlug,
          raceName: raceData.raceName || raceSlug,
          totalPoints: raceData.totalPoints || 0,
          stagesCount: stageEntries.length,
          bestFinishPosition,
          // Include stage details for more granular view
          stages: stageEntries.map(([stageKey, stagePoints]: [string, any]) => ({
            stage: stageKey,
            // Use stored finishPosition, or derive from stageResult points as fallback
            finishPosition: stagePoints.finishPosition || derivePositionFromPoints(stagePoints.stageResult),
            stageResult: stagePoints.stageResult || 0,
            gcPoints: stagePoints.gcPoints || 0,
            pointsClass: stagePoints.pointsClass || 0,
            mountainsClass: stagePoints.mountainsClass || 0,
            youthClass: stagePoints.youthClass || 0,
            total: stagePoints.total || 0,
          })),
        };
      }) : [];

      return {
        id: doc.id,
        rank: offset + index + 1,
        riderNameId: data.riderNameId,
        riderName: data.riderName,
        totalPoints: data.totalPoints || 0,
        racesCount: racesWithDetails.length,
        races: racesWithDetails,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null,
      };
    });

    return NextResponse.json({
      success: true,
      year: yearNum,
      riders,
      count: riders.length,
      total: allDocs.length,
      hasMore: offset + limit < allDocs.length,
      pagination: {
        limit,
        offset,
        nextOffset: offset + limit < allDocs.length ? offset + limit : null,
      },
    });
  } catch (error) {
    console.error('[SEASON_POINTS_API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: 'Failed to fetch season points',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
