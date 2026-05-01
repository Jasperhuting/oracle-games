import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, isSlipstream } from '@/lib/types/games';

interface WithdrawPlayerRequest {
  participantId: string;
  restore?: boolean;
}

/**
 * POST /api/games/[gameId]/slipstream/admin/withdraw-player
 * Withdraw or restore a player from a Slipstream game (reversible).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body: WithdrawPlayerRequest = await request.json();
    const { participantId, restore = false } = body;

    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
    if (!isSlipstream(game)) {
      return NextResponse.json({ error: 'Not a Slipstream game' }, { status: 400 });
    }

    const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
    if (!participantDoc.exists) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const participantData = participantDoc.data()!;
    if (participantData.gameId !== gameId) {
      return NextResponse.json({ error: 'Participant does not belong to this game' }, { status: 400 });
    }

    const newStatus = restore ? 'active' : 'withdrawn';

    await participantDoc.ref.update({
      status: newStatus,
      ...(restore
        ? { restoredAt: Timestamp.now() }
        : { withdrawnAt: Timestamp.now() }),
    });

    await db.collection('activityLogs').add({
      action: restore ? 'SLIPSTREAM_PLAYER_RESTORED' : 'SLIPSTREAM_PLAYER_WITHDRAWN',
      gameId,
      details: {
        participantId,
        playername: participantData.playername,
        userId: participantData.userId,
        previousStatus: participantData.status,
        newStatus,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      participantId,
      playername: participantData.playername,
      newStatus,
    });
  } catch (error) {
    console.error('[SLIPSTREAM_WITHDRAW_PLAYER] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update player status' },
      { status: 500 }
    );
  }
}
