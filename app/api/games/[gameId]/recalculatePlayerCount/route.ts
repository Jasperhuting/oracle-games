import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

// POST - Recalculate player count for a game based on actual participants
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin user ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get game
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Count actual participants (not pending)
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    const actualPlayerCount = participantsSnapshot.size;
    const gameData = gameDoc.data();
    const oldPlayerCount = gameData?.playerCount || 0;

    // Update the game with correct player count
    await gameDoc.ref.update({
      playerCount: actualPlayerCount,
    });

    // Log the activity
    const adminData = adminDoc.data();
    await db.collection('activityLogs').add({
      action: 'PLAYER_COUNT_RECALCULATED',
      userId: adminUserId,
      userEmail: adminData?.email,
      userName: adminData?.playername || adminData?.email,
      details: {
        gameId: gameId,
        gameName: gameData?.name,
        oldPlayerCount: oldPlayerCount,
        newPlayerCount: actualPlayerCount,
        difference: actualPlayerCount - oldPlayerCount,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Player count recalculated for ${gameData?.name}`,
      oldPlayerCount,
      newPlayerCount: actualPlayerCount,
      difference: actualPlayerCount - oldPlayerCount,
    });
  } catch (error) {
    console.error('Error recalculating player count:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate player count', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
