import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, StagePick, isSlipstream } from '@/lib/types/games';

interface PicksQuery {
  userId?: string;      // Filter by specific user
  raceSlug?: string;    // Filter by specific race
  locked?: string;      // Filter by locked status ('true' or 'false')
}

/**
 * GET /api/games/[gameId]/slipstream/picks
 * Get all picks for a Slipstream game, optionally filtered by user or race
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    const query: PicksQuery = {
      userId: searchParams.get('userId') || undefined,
      raceSlug: searchParams.get('raceSlug') || undefined,
      locked: searchParams.get('locked') || undefined,
    };

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

    // 2. Build query for stagePicks
    let picksQuery = db.collection('stagePicks')
      .where('gameId', '==', gameId);

    if (query.userId) {
      picksQuery = picksQuery.where('userId', '==', query.userId);
    }

    if (query.raceSlug) {
      picksQuery = picksQuery.where('raceSlug', '==', query.raceSlug);
    }

    if (query.locked !== undefined) {
      picksQuery = picksQuery.where('locked', '==', query.locked === 'true');
    }

    // 3. Execute query
    const picksSnapshot = await picksQuery.get();

    // 4. Transform picks to client format
    const picks: (StagePick & { id: string })[] = picksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        gameId: data.gameId,
        userId: data.userId,
        playername: data.playername,
        raceSlug: data.raceSlug,
        stageNumber: data.stageNumber,
        riderId: data.riderId,
        riderName: data.riderName,
        timeLostSeconds: data.timeLostSeconds ?? null,
        timeLostFormatted: data.timeLostFormatted ?? null,
        greenJerseyPoints: data.greenJerseyPoints ?? null,
        riderFinishPosition: data.riderFinishPosition ?? null,
        isPenalty: data.isPenalty ?? null,
        penaltyReason: data.penaltyReason ?? null,
        processedAt: data.processedAt instanceof Timestamp
          ? data.processedAt.toDate().toISOString()
          : data.processedAt ?? null,
        pickedAt: data.pickedAt instanceof Timestamp
          ? data.pickedAt.toDate().toISOString()
          : data.pickedAt,
        locked: data.locked,
      } as StagePick & { id: string };
    });

    // 5. Sort picks by race order (using countingRaces order)
    const raceOrderMap = new Map(
      config.countingRaces.map((race, index) => [race.raceSlug, index])
    );

    picks.sort((a, b) => {
      const orderA = raceOrderMap.get(a.raceSlug) ?? 999;
      const orderB = raceOrderMap.get(b.raceSlug) ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by playername
      return a.playername.localeCompare(b.playername);
    });

    // 6. Return response
    return NextResponse.json({
      success: true,
      gameId,
      picks,
      count: picks.length,
      filters: {
        userId: query.userId || null,
        raceSlug: query.raceSlug || null,
        locked: query.locked || null,
      }
    });

  } catch (error) {
    console.error('[SLIPSTREAM_PICKS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch picks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
