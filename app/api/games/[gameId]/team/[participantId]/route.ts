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
      .where('active', '==', true)
      .get();

    const riders = [];
    for (const doc of teamSnapshot.docs) {
      const data = doc.data();
      riders.push({
        id: doc.id,
        nameId: data.riderNameId,
        name: data.riderName,
        team: data.riderTeam,
        country: data.riderCountry,
        rank: data.riderRank || 0,
        pointsScored: data.pointsScored || 0,
        points: data.pointsScored || 0,
        racePoints: data.racePoints || null,
        jerseyImage: data.jerseyImage,
        pricePaid: data.pricePaid,
        acquisitionType: data.acquisitionType,
        draftRound: data.draftRound,
        draftPick: data.draftPick,
        benched: data.benched || false,
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
          // Only count NC-Australia races
          if (raceSlug.toLowerCase().includes('nc-australia')) {
            Object.entries(raceData.stagePoints || {}).forEach(([stage, stagePoints]) => {
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
    
    const activeRiders = riders.filter(r => !r.benched).length;
    const benchedRiders = riders.filter(rider => rider.benched).length;

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
        activeRiders,
        benchedRiders,
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
