import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * GET /api/season-points/[riderNameId]
 *
 * Fetch detailed season points for a specific rider.
 *
 * Query params:
 * - year (required): The season year (e.g., 2025, 2026)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ riderNameId: string }> }
) {
  try {
    const { riderNameId } = await params;
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

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

    const db = getServerFirebase();

    // Get the season points document
    const docId = `${riderNameId}_${yearNum}`;
    const seasonPointsDoc = await db.collection('seasonPoints').doc(docId).get();

    if (!seasonPointsDoc.exists) {
      return NextResponse.json(
        { error: 'Season points not found for this rider and year' },
        { status: 404 }
      );
    }

    const data = seasonPointsDoc.data()!;

    // Transform races data for better client consumption
    const races = data.races ? Object.entries(data.races).map(([raceSlug, raceData]: [string, any]) => ({
      raceSlug,
      raceName: raceData.raceName || raceSlug,
      totalPoints: raceData.totalPoints || 0,
      stages: raceData.stages ? Object.entries(raceData.stages)
        .map(([stageNum, stageData]: [string, any]) => ({
          stageNumber: parseInt(stageNum),
          stageResult: stageData.stageResult,
          gcPoints: stageData.gcPoints,
          pointsClass: stageData.pointsClass,
          mountainsClass: stageData.mountainsClass,
          youthClass: stageData.youthClass,
          mountainPoints: stageData.mountainPoints,
          sprintPoints: stageData.sprintPoints,
          combativityBonus: stageData.combativityBonus,
          teamPoints: stageData.teamPoints,
          total: stageData.total || 0,
        }))
        .sort((a, b) => a.stageNumber - b.stageNumber)
      : [],
    })) : [];

    return NextResponse.json({
      success: true,
      rider: {
        id: seasonPointsDoc.id,
        riderNameId: data.riderNameId,
        riderName: data.riderName,
        year: data.year,
        totalPoints: data.totalPoints || 0,
        races,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('Error fetching rider season points:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rider season points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
