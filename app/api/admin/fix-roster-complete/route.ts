import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { gameId, userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get game config
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const maxRiders = gameData?.config?.maxRiders || 0;

    console.log(`[FIX_ROSTER_COMPLETE] Fixing rosterComplete for game ${gameId}, maxRiders=${maxRiders}`);

    // Get all participants
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    console.log(`[FIX_ROSTER_COMPLETE] Found ${participantsSnapshot.size} participants`);

    let updated = 0;
    for (const doc of participantsSnapshot.docs) {
      const data = doc.data();
      const teamSize = data.rosterSize || 0;
      const shouldBeComplete = teamSize >= maxRiders;
      const currentlyComplete = data.rosterComplete || false;

      if (shouldBeComplete !== currentlyComplete) {
        await doc.ref.update({ rosterComplete: shouldBeComplete });
        console.log(`[FIX_ROSTER_COMPLETE] Updated ${data.playername}: rosterComplete = ${shouldBeComplete} (${teamSize}/${maxRiders} riders)`);
        updated++;
      }
    }

    console.log(`[FIX_ROSTER_COMPLETE] Updated ${updated} participants`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} participants`,
      total: participantsSnapshot.size,
      updated,
    });

  } catch (error) {
    console.error('[FIX_ROSTER_COMPLETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fix roster complete', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
