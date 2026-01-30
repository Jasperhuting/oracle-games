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

    // Get game data (needed for gameType-specific scoring)
    const gameDoc = await db.collection('games').doc(gameId).get();
    const gameData = gameDoc.data();
    const gameType = gameData?.gameType ?? gameData?.config?.gameType;
    const isMarginalGains = gameType === 'marginal-gains';

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

      // Use pointsScored as the source of truth
      const riderPoints = data.pointsScored ?? 0;

      riders.push({
        id: doc.id,
        nameId: data.riderNameId,
        name: data.riderName,
        team: data.riderTeam,
        country: data.riderCountry,
        rank: data.riderRank || 0,
        pointsScored: riderPoints,
        points: riderPoints,
        pointsBreakdown: data.pointsBreakdown || [],
        jerseyImage: data.jerseyImage,
        pricePaid: data.pricePaid,
        acquisitionType: data.acquisitionType,
        draftRound: data.draftRound,
        draftPick: data.draftPick,
      });
    }

    // Sort riders by pointsScored (highest to lowest)
    riders.sort((a, b) => (b.pointsScored || 0) - (a.pointsScored || 0));

    // Calculate team statistics from pointsScored
    const baseTotalPoints = riders.reduce((sum, rider) => sum + (rider.pointsScored || 0), 0);
    const spentBudget = participantData?.spentBudget || 0;
    const totalPoints = isMarginalGains ? (-spentBudget) + baseTotalPoints : baseTotalPoints;

    // Calculate actual ranking by comparing with all participants in the game
    // Mirror teams-overview behavior: rank only active participants, sort by points desc then playername,
    // and give equal points the same rank.
    const allParticipantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    const participantPoints: { id: string; points: number; playername: string }[] = [];
    for (const pDoc of allParticipantsSnapshot.docs) {
      const pData = pDoc.data();
      const pTeamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', pData.userId)
        .get();

      const pBaseTotal = pTeamSnapshot.docs.reduce((sum, tDoc) => {
        const tData = tDoc.data();
        return sum + (tData.totalPoints ?? tData.pointsScored ?? 0);
      }, 0);

      const pSpentBudget = pData?.spentBudget || 0;
      const pTotal = isMarginalGains ? (-pSpentBudget) + pBaseTotal : pBaseTotal;

      participantPoints.push({
        id: pDoc.id,
        points: pTotal,
        playername: pData.playername || '',
      });
    }

    participantPoints.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.playername.localeCompare(b.playername);
    });

    let ranking = 0;
    let currentRank = 1;
    let previousPoints: number | null = null;
    for (let index = 0; index < participantPoints.length; index++) {
      const row = participantPoints[index];
      if (previousPoints === null || row.points !== previousPoints) {
        currentRank = index + 1;
        previousPoints = row.points;
      }
      if (row.id === participantId) {
        ranking = currentRank;
        break;
      }
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
