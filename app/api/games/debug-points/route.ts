import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * Debug endpoint to check points calculation status
 * GET /api/games/debug-points?gameId=xxx&userId=yyy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const userId = searchParams.get('userId');

    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get game info
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    
    if (!gameData) {
      return NextResponse.json(
        { error: 'Game data is empty' },
        { status: 404 }
      );
    }

    // Get participants
    let participantsQuery = db.collection('gameParticipants')
      .where('gameId', '==', gameId);
    
    if (userId) {
      participantsQuery = participantsQuery.where('userId', '==', userId);
    }

    const participantsSnapshot = await participantsQuery.get();

    const participantsData = [];
    for (const participantDoc of participantsSnapshot.docs) {
      const participantData = participantDoc.data();
      
      // Get their team
      const teamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantData.userId)
        .get();

      const riders = [];
      for (const teamDoc of teamSnapshot.docs) {
        const teamData = teamDoc.data();
        riders.push({
          riderName: teamData.riderName,
          riderNameId: teamData.riderNameId,
          pointsScored: teamData.pointsScored || 0,
          stagesParticipated: teamData.stagesParticipated || 0,
          racePoints: teamData.racePoints || {},
        });
      }

      participantsData.push({
        playername: participantData.playername,
        userId: participantData.userId,
        totalPoints: participantData.totalPoints || 0,
        ranking: participantData.ranking || 0,
        riders,
      });
    }

    return NextResponse.json({
      game: {
        name: gameData.name,
        gameType: gameData.gameType,
        status: gameData.status,
        config: gameData.config,
      },
      participants: participantsData,
    });

  } catch (error) {
    console.error('[DEBUG_POINTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to debug points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
