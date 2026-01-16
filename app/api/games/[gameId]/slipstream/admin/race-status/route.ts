import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, SlipstreamRaceStatus, isSlipstream } from '@/lib/types/games';

interface UpdateRaceStatusRequest {
  raceSlug: string;
  status: SlipstreamRaceStatus;
}

/**
 * POST /api/games/[gameId]/slipstream/admin/race-status
 * Update the status of a race in a Slipstream game (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body: UpdateRaceStatusRequest = await request.json();
    const { raceSlug, status } = body;

    if (!raceSlug || !status) {
      return NextResponse.json(
        { error: 'raceSlug and status are required' },
        { status: 400 }
      );
    }

    if (!['upcoming', 'locked', 'finished'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: upcoming, locked, or finished' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // 1. Fetch game and validate it's a Slipstream game
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
    if (!isSlipstream(game)) {
      return NextResponse.json(
        { error: 'This game is not a Slipstream game' },
        { status: 400 }
      );
    }

    const config = game.config as SlipstreamConfig;

    // 2. Find the race
    const raceIndex = config.countingRaces.findIndex(r => r.raceSlug === raceSlug);
    if (raceIndex === -1) {
      return NextResponse.json(
        { error: 'Race not found in this game' },
        { status: 404 }
      );
    }

    // 3. Update the race status
    const updatedRaces = [...config.countingRaces];
    updatedRaces[raceIndex] = {
      ...updatedRaces[raceIndex],
      status
    };

    await gameDoc.ref.update({
      'config.countingRaces': updatedRaces,
      updatedAt: Timestamp.now()
    });

    // 4. If locking, also lock all picks for this race
    if (status === 'locked') {
      const picksSnapshot = await db.collection('stagePicks')
        .where('gameId', '==', gameId)
        .where('raceSlug', '==', raceSlug)
        .where('locked', '==', false)
        .get();

      const batch = db.batch();
      picksSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { locked: true });
      });
      await batch.commit();
    }

    // 5. Log the activity
    await db.collection('activityLogs').add({
      action: 'SLIPSTREAM_RACE_STATUS_UPDATE',
      gameId,
      details: {
        raceSlug,
        newStatus: status,
        previousStatus: config.countingRaces[raceIndex].status
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      gameId,
      raceSlug,
      status,
      message: `Race status updated to ${status}`
    });

  } catch (error) {
    console.error('[SLIPSTREAM_ADMIN_RACE_STATUS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update race status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
