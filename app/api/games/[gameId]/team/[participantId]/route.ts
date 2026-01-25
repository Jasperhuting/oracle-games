import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// GET team details with rider points for a participant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string; participantId: string }> }
) {
  try {
    const { gameId, participantId } = await params;
    const db = getServerFirebase();

    // Get participant details
    const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
    
    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantData = participantDoc.data();
    
    if (participantData?.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Participant does not belong to this game' },
        { status: 400 }
      );
    }

    // Get user details for player name
    const userDoc = await db.collection('users').doc(participantData.userId).get();
    const userData = userDoc.data();

    // Get team riders with their points
    const teamSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', participantData.userId)
      .get();

    const riders = [];
    for (const doc of teamSnapshot.docs) {
      const data = doc.data();

      // Use new totalPoints field with fallback to legacy pointsScored
      const riderPoints = data.totalPoints ?? data.pointsScored ?? 0;

      riders.push({
        id: doc.id,
        nameId: data.riderNameId,
        name: data.riderName,
        team: data.riderTeam,
        country: data.riderCountry,
        rank: data.riderRank || 0,
        // LEGACY: pointsScored (kept for backwards compatibility)
        pointsScored: riderPoints,
        points: riderPoints,
        // NEW: totalPoints as source of truth
        totalPoints: riderPoints,
        // LEGACY: racePoints (kept for backwards compatibility)
        racePoints: (data.racePoints && typeof data.racePoints === 'object' && !Array.isArray(data.racePoints)) ? data.racePoints : undefined,
        // NEW: pointsBreakdown array
        pointsBreakdown: data.pointsBreakdown || [],
        jerseyImage: data.jerseyImage,
        pricePaid: data.pricePaid,
        acquisitionType: data.acquisitionType,
        draftRound: data.draftRound,
        draftPick: data.draftPick,
        stagesParticipated: data.stagesParticipated || 0,
      });
    }

    // Calculate team statistics based on correct race points
    let totalPoints = 0;
    for (const rider of riders) {
      let riderCorrectPoints = 0;

      // Calculate correct points from racePoints
      if (rider.racePoints) {
        Object.entries(rider.racePoints).forEach(([raceSlug, raceData]) => {
          const raceDataTyped = raceData as { stagePoints?: Record<string, { stageResult?: number; total?: number }> };
          // Only count NC-Australia races
          if (raceSlug.toLowerCase().includes('nc-australia')) {
            Object.entries(raceDataTyped.stagePoints || {}).forEach(([stage, stagePoints]) => {
              // Convert 50 points to 15 points (as requested)
              if (stagePoints.stageResult === 50) {
                riderCorrectPoints += 15;
              } else if (stagePoints.total === 10 || stagePoints.stageResult === 10) {
                riderCorrectPoints += (stagePoints.stageResult || stagePoints.total || 0);
              }
            });
          }
        });
      }

      totalPoints += riderCorrectPoints;
    }
    
    return NextResponse.json({
      success: true,
      participant: {
        id: participantId,
        userId: participantData.userId,
        playerName: userData?.playername || userData?.email || 'Unknown',
        totalPoints: totalPoints, // Use calculated totalPoints instead of participantData.totalPoints
        ranking: participantData.ranking || 0,
      },
      team: {
        riders,
        totalPoints,
        riderCount: riders.length,
      },
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
