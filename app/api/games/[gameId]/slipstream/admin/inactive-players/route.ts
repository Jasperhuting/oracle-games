import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Game, SlipstreamConfig, isSlipstream } from '@/lib/types/games';

export interface InactivePlayer {
  participantId: string;
  userId: string;
  playername: string;
  missedPicksCount: number;
  status: string;
}

export interface InactivePlayersResponse {
  success: boolean;
  threshold: number;
  finishedRacesCount: number;
  inactivePlayers: InactivePlayer[];
  withdrawnPlayers: InactivePlayer[];
}

/**
 * GET /api/games/[gameId]/slipstream/admin/inactive-players
 * Returns players who missed >= threshold races (default 4), and withdrawn players.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const threshold = parseInt(request.nextUrl.searchParams.get('threshold') || '4', 10);

    const db = getServerFirebase();

    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
    if (!isSlipstream(game)) {
      return NextResponse.json({ error: 'Not a Slipstream game' }, { status: 400 });
    }

    const config = game.config as SlipstreamConfig;
    const finishedRacesCount = config.countingRaces.filter(r => r.status === 'finished').length;

    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    const inactivePlayers: InactivePlayer[] = [];
    const withdrawnPlayers: InactivePlayer[] = [];

    for (const doc of participantsSnapshot.docs) {
      const data = doc.data();
      const missedPicksCount = (data.slipstreamData?.missedPicksCount as number) || 0;
      const player: InactivePlayer = {
        participantId: doc.id,
        userId: data.userId as string,
        playername: data.playername as string,
        missedPicksCount,
        status: data.status as string,
      };

      if (data.status === 'withdrawn') {
        withdrawnPlayers.push(player);
      } else if (data.status === 'active' && missedPicksCount >= threshold) {
        inactivePlayers.push(player);
      }
    }

    inactivePlayers.sort((a, b) => b.missedPicksCount - a.missedPicksCount);
    withdrawnPlayers.sort((a, b) => a.playername.localeCompare(b.playername));

    const response: InactivePlayersResponse = {
      success: true,
      threshold,
      finishedRacesCount,
      inactivePlayers,
      withdrawnPlayers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[SLIPSTREAM_INACTIVE_PLAYERS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inactive players' },
      { status: 500 }
    );
  }
}
