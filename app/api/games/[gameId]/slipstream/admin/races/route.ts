import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, SlipstreamRace, isSlipstream } from '@/lib/types/games';

interface AddRaceRequest {
  raceId: string;
  raceSlug: string;
  raceName: string;
  raceDate: string;  // ISO date string
  order?: number;
}

interface AddRacesRequest {
  races: AddRaceRequest[];
}

/**
 * GET /api/games/[gameId]/slipstream/admin/races
 * Get all races configured for this Slipstream game
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
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
    
    const races = config.countingRaces.map(race => ({
      ...race,
      raceDate: race.raceDate instanceof Timestamp 
        ? race.raceDate.toDate().toISOString() 
        : race.raceDate,
      pickDeadline: race.pickDeadline instanceof Timestamp 
        ? race.pickDeadline.toDate().toISOString() 
        : race.pickDeadline
    }));

    return NextResponse.json({
      success: true,
      gameId,
      races,
      count: races.length,
      config: {
        penaltyMinutes: config.penaltyMinutes,
        pickDeadlineMinutes: config.pickDeadlineMinutes
      }
    });

  } catch (error) {
    console.error('[SLIPSTREAM_ADMIN_RACES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/games/[gameId]/slipstream/admin/races
 * Add races to a Slipstream game
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body: AddRacesRequest = await request.json();
    const { races } = body;

    if (!races || !Array.isArray(races) || races.length === 0) {
      return NextResponse.json(
        { error: 'races array is required and must not be empty' },
        { status: 400 }
      );
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

    const config = game.config as SlipstreamConfig;
    const existingRaces = config.countingRaces || [];
    const pickDeadlineMinutes = config.pickDeadlineMinutes || 60;

    // Convert input races to SlipstreamRace format
    const newRaces = races.map((race, index) => {
      const raceDate = new Date(race.raceDate);
      const pickDeadline = new Date(raceDate.getTime() - pickDeadlineMinutes * 60 * 1000);
      
      return {
        raceId: race.raceId,
        raceSlug: race.raceSlug,
        raceName: race.raceName,
        raceDate: Timestamp.fromDate(raceDate),
        pickDeadline: Timestamp.fromDate(pickDeadline),
        status: 'upcoming' as const,
        order: race.order ?? existingRaces.length + index + 1
      };
    });

    // Merge with existing races (avoid duplicates by raceSlug)
    const existingSlugs = new Set(existingRaces.map(r => r.raceSlug));
    const racesToAdd = newRaces.filter(r => !existingSlugs.has(r.raceSlug));
    const updatedRaces = [...existingRaces, ...racesToAdd];

    // Sort by order
    updatedRaces.sort((a, b) => a.order - b.order);

    await gameDoc.ref.update({
      'config.countingRaces': updatedRaces,
      updatedAt: Timestamp.now()
    });

    // Log activity
    await db.collection('activityLogs').add({
      action: 'SLIPSTREAM_RACES_ADDED',
      gameId,
      details: {
        racesAdded: racesToAdd.length,
        totalRaces: updatedRaces.length,
        racesSlugs: racesToAdd.map(r => r.raceSlug)
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      gameId,
      racesAdded: racesToAdd.length,
      duplicatesSkipped: newRaces.length - racesToAdd.length,
      totalRaces: updatedRaces.length
    });

  } catch (error) {
    console.error('[SLIPSTREAM_ADMIN_RACES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/games/[gameId]/slipstream/admin/races
 * Remove a race from a Slipstream game
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { raceSlug } = await request.json();

    if (!raceSlug) {
      return NextResponse.json({ error: 'raceSlug is required' }, { status: 400 });
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

    const config = game.config as SlipstreamConfig;
    const updatedRaces = config.countingRaces.filter(r => r.raceSlug !== raceSlug);

    if (updatedRaces.length === config.countingRaces.length) {
      return NextResponse.json({ error: 'Race not found in game' }, { status: 404 });
    }

    await gameDoc.ref.update({
      'config.countingRaces': updatedRaces,
      updatedAt: Timestamp.now()
    });

    return NextResponse.json({
      success: true,
      gameId,
      raceSlug,
      remainingRaces: updatedRaces.length
    });

  } catch (error) {
    console.error('[SLIPSTREAM_ADMIN_RACES_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete race', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
