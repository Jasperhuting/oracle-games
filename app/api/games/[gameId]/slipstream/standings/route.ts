import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Game, SlipstreamConfig, isSlipstream } from '@/lib/types/games';
import {
  formatTimeGap,
  calculateRankings
} from '@/lib/utils/slipstreamCalculation';

interface StandingEntry {
  userId: string;
  playername: string;
  ranking: number;
  value: number;           // timeLostSeconds for yellow, points for green
  valueFormatted: string;  // formatted time or points string
  gapToLeader: number;
  gapToLeaderFormatted: string;
  picksCount: number;
  missedPicksCount: number;
}

interface StandingsResponse {
  success: boolean;
  gameId: string;
  yellowJersey: StandingEntry[];
  greenJersey: StandingEntry[];
  racesCompleted: number;
  totalRaces: number;
}

/**
 * GET /api/games/[gameId]/slipstream/standings
 * Get Yellow Jersey (time) and Green Jersey (points) standings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
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
    const countingRaces = config.countingRaces || [];

    // 2. Get all active participants
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        gameId,
        yellowJersey: [],
        greenJersey: [],
        racesCompleted: 0,
        totalRaces: countingRaces.length
      });
    }

    // 3. Extract participant data
    const participants = participantsSnapshot.docs.map(doc => {
      const data = doc.data();
      const slipstreamData = data.slipstreamData || {
        totalTimeLostSeconds: 0,
        totalGreenJerseyPoints: 0,
        picksCount: 0,
        missedPicksCount: 0
      };
      return {
        userId: data.userId as string,
        playername: data.playername as string,
        totalTimeLostSeconds: slipstreamData.totalTimeLostSeconds as number,
        totalGreenJerseyPoints: slipstreamData.totalGreenJerseyPoints as number,
        picksCount: slipstreamData.picksCount as number,
        missedPicksCount: slipstreamData.missedPicksCount as number
      };
    });

    // 4. Calculate Yellow Jersey standings (lowest time = best)
    const yellowRankings = calculateRankings(
      participants,
      p => p.totalTimeLostSeconds || 0,
      true  // ascending - lower is better
    );

    const timeValues = participants.map(p => p.totalTimeLostSeconds || 0);
    const leaderTime = timeValues.length > 0 ? Math.min(...timeValues) : 0;
    
    const yellowJersey: StandingEntry[] = participants.map((p, i) => {
      const time = p.totalTimeLostSeconds || 0;
      const gap = time - leaderTime;
      return {
        userId: p.userId,
        playername: p.playername,
        ranking: yellowRankings[i],
        value: time,
        valueFormatted: formatTimeGap(time),
        gapToLeader: gap,
        gapToLeaderFormatted: gap === 0 ? '-' : formatTimeGap(gap),
        picksCount: p.picksCount || 0,
        missedPicksCount: p.missedPicksCount || 0
      };
    }).sort((a, b) => a.ranking - b.ranking);

    // 5. Calculate Green Jersey standings (highest points = best)
    const greenRankings = calculateRankings(
      participants,
      p => p.totalGreenJerseyPoints || 0,
      false  // descending - higher is better
    );

    const pointValues = participants.map(p => p.totalGreenJerseyPoints || 0);
    const leaderPoints = pointValues.length > 0 ? Math.max(...pointValues) : 0;

    const greenJersey: StandingEntry[] = participants.map((p, i) => {
      const points = p.totalGreenJerseyPoints || 0;
      const gap = leaderPoints - points;
      return {
        userId: p.userId,
        playername: p.playername,
        ranking: greenRankings[i],
        value: points,
        valueFormatted: `${points} pts`,
        gapToLeader: gap,
        gapToLeaderFormatted: gap === 0 ? '-' : `-${gap} pts`,
        picksCount: p.picksCount || 0,
        missedPicksCount: p.missedPicksCount || 0
      };
    }).sort((a, b) => a.ranking - b.ranking);

    // 6. Count completed races
    const racesCompleted = countingRaces.filter(r => r.status === 'finished').length;

    // 7. Return response
    const response: StandingsResponse = {
      success: true,
      gameId,
      yellowJersey,
      greenJersey,
      racesCompleted,
      totalRaces: countingRaces.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[SLIPSTREAM_STANDINGS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch standings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
