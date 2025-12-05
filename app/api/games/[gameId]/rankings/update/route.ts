import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * Manually update rankings for a game
 * This can be called by admins to recalculate rankings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Check if game exists
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    console.log(`[UPDATE_RANKINGS] Manually updating rankings for game ${gameId}`);

    // Get all participants sorted by totalPoints (descending)
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .orderBy('totalPoints', 'desc')
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No participants found',
        participantsUpdated: 0,
      });
    }

    // Update ranking for each participant
    let currentRank = 1;
    let previousPoints = -1;
    let participantsWithSamePoints = 0;
    let updatedCount = 0;

    for (const participantDoc of participantsSnapshot.docs) {
      const participantData = participantDoc.data();
      const points = participantData.totalPoints || 0;

      // Handle tied rankings
      if (points === previousPoints) {
        participantsWithSamePoints++;
      } else {
        currentRank += participantsWithSamePoints;
        participantsWithSamePoints = 1;
        previousPoints = points;
      }

      // Only update if ranking changed
      if (participantData.ranking !== currentRank) {
        await participantDoc.ref.update({
          ranking: currentRank,
        });
        console.log(`[UPDATE_RANKINGS] ${participantData.playername}: rank ${currentRank} (${points} points)`);
        updatedCount++;
      }
    }

    console.log(`[UPDATE_RANKINGS] Updated ${updatedCount} of ${participantsSnapshot.size} participants`);

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'RANKINGS_UPDATED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        gameId,
        gameName: gameDoc.data()?.name,
        participantsUpdated: updatedCount,
        totalParticipants: participantsSnapshot.size,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Rankings updated for ${participantsSnapshot.size} participants`,
      participantsUpdated: updatedCount,
      totalParticipants: participantsSnapshot.size,
    });

  } catch (error) {
    console.error('[UPDATE_RANKINGS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update rankings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
