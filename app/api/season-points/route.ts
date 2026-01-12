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

    const riders = paginatedDocs.map((doc, index) => {
      const data = doc.data();
      return {
        id: doc.id,
        rank: offset + index + 1,
        riderNameId: data.riderNameId,
        riderName: data.riderName,
        totalPoints: data.totalPoints || 0,
        racesCount: data.races ? Object.keys(data.races).length : 0,
        // Include summary of races (just names and totals, not full breakdown)
        races: data.races ? Object.entries(data.races).map(([raceSlug, raceData]: [string, any]) => ({
          raceSlug,
          raceName: raceData.raceName || raceSlug,
          totalPoints: raceData.totalPoints || 0,
          stagesCount: raceData.stages ? Object.keys(raceData.stages).length : 0,
        })) : [],
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
