import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/season-points/add
 * 
 * Add or update a rider's season points
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      riderNameId,
      riderName,
      year,
      totalPoints,
      rank,
      country,
      team,
      races,
      lastRace,
      source = 'manual'
    } = body;

    if (!riderNameId || !riderName || !year || totalPoints === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: riderNameId, riderName, year, totalPoints' },
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

    console.log(`[SEASON_POINTS_ADD] Adding ${riderName} with ${totalPoints} points for ${year}`);

    const db = getServerFirebase();
    const seasonPointsRef = db.collection('seasonPoints').doc(`${riderNameId}_${yearNum}`);
    
    const seasonPointsData = {
      riderNameId,
      riderName,
      year: yearNum,
      totalPoints,
      rank,
      country,
      team,
      races,
      lastRace,
      source,
      updatedAt: new Date().toISOString()
    };

    await seasonPointsRef.set(seasonPointsData, { merge: true });

    // Also add to playerTeams if not already there
    const playerTeamRef = db.collection('playerTeams').doc();
    const playerTeamData = {
      gameId: 'qltELoRHMvweHzhM26bN', // Auction Master (Season)
      userId: 'system-import',
      riderNameId,
      acquiredAt: new Date().toISOString(),
      acquisitionType: 'import',
      pricePaid: 0,
      riderName,
      riderTeam: team,
      riderCountry: country,
      jerseyImage: '',
      pointsScored: totalPoints,
      stagesParticipated: races || 0
    };

    await playerTeamRef.set(playerTeamData, { merge: true });

    return NextResponse.json({
      success: true,
      message: `Added ${riderName} with ${totalPoints} points`,
      data: seasonPointsData
    });

  } catch (error) {
    console.error('[SEASON_POINTS_ADD] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
