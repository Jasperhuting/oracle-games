import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, ClientSlipstreamRace, isSlipstream } from '@/lib/types/games';
import { isDeadlinePassed, getTimeUntilDeadline, formatTimeRemaining } from '@/lib/utils/slipstreamCalculation';

interface CalendarRace extends ClientSlipstreamRace {
  deadlinePassed: boolean;
  timeUntilDeadline: number;
  timeUntilDeadlineFormatted: string;
  userPick?: {
    riderId: string;
    riderName: string;
    locked: boolean;
    timeLostSeconds?: number;
    timeLostFormatted?: string;
    greenJerseyPoints?: number;
    riderFinishPosition?: number;
  } | null;
}

/**
 * GET /api/games/[gameId]/slipstream/calendar
 * Get the race calendar with user's picks and deadline info
 * 
 * Query params:
 * - userId: Optional user ID to include their picks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

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

    // If no races configured, return empty calendar
    if (countingRaces.length === 0) {
      return NextResponse.json({
        success: true,
        gameId,
        calendar: [],
        summary: {
          totalRaces: 0,
          upcomingCount: 0,
          lockedCount: 0,
          finishedCount: 0,
          nextRace: null
        },
        userId: userId || null
      });
    }

    // 2. Get user's picks if userId provided
    let userPicks = new Map<string, {
      riderId: string;
      riderName: string;
      locked: boolean;
      timeLostSeconds?: number;
      timeLostFormatted?: string;
      greenJerseyPoints?: number;
      riderFinishPosition?: number;
    }>();

    if (userId) {
      const picksSnapshot = await db.collection('stagePicks')
        .where('gameId', '==', gameId)
        .where('userId', '==', userId)
        .get();

      picksSnapshot.docs.forEach(doc => {
        const data = doc.data();
        userPicks.set(data.raceSlug, {
          riderId: data.riderId,
          riderName: data.riderName,
          locked: data.locked,
          timeLostSeconds: data.timeLostSeconds,
          timeLostFormatted: data.timeLostFormatted,
          greenJerseyPoints: data.greenJerseyPoints,
          riderFinishPosition: data.riderFinishPosition
        });
      });
    }

    // 3. Transform races to calendar format
    const calendar: CalendarRace[] = countingRaces.map(race => {
      const raceDate = race.raceDate instanceof Timestamp
        ? race.raceDate.toDate()
        : new Date(race.raceDate as unknown as string);
      
      const pickDeadline = race.pickDeadline instanceof Timestamp
        ? race.pickDeadline.toDate()
        : new Date(race.pickDeadline as unknown as string);

      const deadlinePassed = isDeadlinePassed(pickDeadline);
      const timeUntilDeadline = getTimeUntilDeadline(pickDeadline);

      return {
        raceId: race.raceId,
        raceSlug: race.raceSlug,
        raceName: race.raceName,
        raceDate: raceDate.toISOString(),
        pickDeadline: pickDeadline.toISOString(),
        status: race.status,
        order: race.order,
        deadlinePassed,
        timeUntilDeadline,
        timeUntilDeadlineFormatted: formatTimeRemaining(timeUntilDeadline),
        userPick: userId ? (userPicks.get(race.raceSlug) || null) : undefined
      };
    });

    // 4. Sort by order
    calendar.sort((a, b) => a.order - b.order);

    // 5. Calculate summary stats
    const upcomingRaces = calendar.filter(r => r.status === 'upcoming' && !r.deadlinePassed);
    const lockedRaces = calendar.filter(r => r.status === 'locked' || (r.status === 'upcoming' && r.deadlinePassed));
    const finishedRaces = calendar.filter(r => r.status === 'finished');
    const nextRace = upcomingRaces[0] || null;

    // 6. Return response
    return NextResponse.json({
      success: true,
      gameId,
      calendar,
      summary: {
        totalRaces: calendar.length,
        upcomingCount: upcomingRaces.length,
        lockedCount: lockedRaces.length,
        finishedCount: finishedRaces.length,
        nextRace: nextRace ? {
          raceSlug: nextRace.raceSlug,
          raceName: nextRace.raceName,
          raceDate: nextRace.raceDate,
          pickDeadline: nextRace.pickDeadline,
          timeUntilDeadlineFormatted: nextRace.timeUntilDeadlineFormatted
        } : null
      },
      userId: userId || null
    });

  } catch (error) {
    console.error('[SLIPSTREAM_CALENDAR] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
