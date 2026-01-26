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

    // Sort riders by totalPoints (highest to lowest)
    riders.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    // Calculate team statistics from totalPoints (source of truth from playerTeams)
    const totalPoints = riders.reduce((sum, rider) => sum + (rider.totalPoints || 0), 0);

    // Calculate actual ranking by comparing with all participants in the game
    let ranking = participantData.ranking || 0;
    if (ranking === 0) {
      // Query all participants to calculate ranking
      const allParticipantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .get();

      // Calculate total points for each participant
      const participantPoints: { id: string; points: number }[] = [];
      for (const pDoc of allParticipantsSnapshot.docs) {
        const pData = pDoc.data();
        const pTeamSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', gameId)
          .where('userId', '==', pData.userId)
          .get();

        const pTotal = pTeamSnapshot.docs.reduce((sum, tDoc) => {
          const tData = tDoc.data();
          return sum + (tData.totalPoints ?? tData.pointsScored ?? 0);
        }, 0);

        participantPoints.push({ id: pDoc.id, points: pTotal });
      }

      // Sort by points descending and find ranking
      participantPoints.sort((a, b) => b.points - a.points);
      const rankIndex = participantPoints.findIndex(p => p.id === participantId);
      ranking = rankIndex >= 0 ? rankIndex + 1 : 0;
    }

    return NextResponse.json({
      success: true,
      participant: {
        id: participantId,
        userId: participantData.userId,
        playerName: userData?.playername || userData?.email || 'Unknown',
        totalPoints: totalPoints,
        ranking: ranking,
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
