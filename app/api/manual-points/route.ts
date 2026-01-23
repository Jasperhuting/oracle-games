import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { gameId, riderNameId, points } = await request.json();

    if (!gameId || !riderNameId || points === undefined) {
      return NextResponse.json(
        { error: 'gameId, riderNameId, and points are required' },
        { status: 400 }
      );
    }

    console.log(`[MANUAL_POINTS] Updating ${riderNameId} with ${points} points in game ${gameId}`);

    const db = getServerFirebase();

    // Get all teams with this rider
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('riderNameId', '==', riderNameId)
      .get();

    if (playerTeamsSnapshot.empty) {
      return NextResponse.json(
        { error: 'No teams found with this rider in this game' },
        { status: 404 }
      );
    }

    let totalPointsUpdated = 0;
    const userIds = new Set<string>();

    // Update each team with the points
    for (const teamDoc of playerTeamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const userId = teamData.userId;
      userIds.add(userId);

      console.log(`[MANUAL_POINTS] Updating team: ${teamData.riderName} for user: ${userId}`);

      await teamDoc.ref.update({
        pointsScored: points,
        updatedAt: new Date().toISOString(),
      });

      totalPointsUpdated++;
    }

    // Update total points for each user
    for (const userId of userIds) {
      const gameParticipantSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .get();

      if (!gameParticipantSnapshot.empty) {
        const participantDoc = gameParticipantSnapshot.docs[0];
        
        // Calculate total points for all riders in this user's team
        const allTeamsSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .get();

        const totalTeamPoints = allTeamsSnapshot.docs.reduce((sum, doc) => {
          return sum + (doc.data().pointsScored || 0);
        }, 0);

        await participantDoc.ref.update({
          totalPoints: totalTeamPoints,
          updatedAt: new Date().toISOString(),
        });

        console.log(`[MANUAL_POINTS] Updated user ${userId} total points: ${totalTeamPoints}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${totalPointsUpdated} teams with ${points} points`,
      teamsUpdated: totalPointsUpdated,
      usersUpdated: userIds.size,
    });

  } catch (error) {
    console.error('[MANUAL_POINTS] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update points', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
