import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, StagePick, isSlipstream } from '@/lib/types/games';
import { isDeadlinePassed } from '@/lib/utils/slipstreamCalculation';

interface PickRequest {
  userId: string;
  raceSlug: string;
  stageNumber?: string | number;  // "result" for one-day races, or stage number
  riderId?: string | null;
  riderName?: string | null;
  clearPick?: boolean;
}

/**
 * POST /api/games/[gameId]/slipstream/pick
 * Submit a rider pick for a Slipstream race
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body: PickRequest = await request.json();
    const { userId, raceSlug, riderId, riderName, clearPick } = body;
    const stageNumber = body.stageNumber || 'result';

    // Validate required fields
    if (!userId || !raceSlug) {
      return NextResponse.json(
        { error: 'userId and raceSlug are required' },
        { status: 400 }
      );
    }
    if (!clearPick && (!riderId || !riderName)) {
      return NextResponse.json(
        { error: 'riderId and riderName are required unless clearPick is true' },
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

    // 2. Check if game is active (allow 'active', 'bidding', 'registration', 'open' statuses)
    const allowedStatuses = ['active', 'bidding', 'registration', 'open'];
    if (!allowedStatuses.includes(game.status)) {
      return NextResponse.json(
        { error: `Game is not active (status: ${game.status})` },
        { status: 400 }
      );
    }

    // 3. Check if user is a participant
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: 'User is not a participant in this game' },
        { status: 403 }
      );
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();

    // 4. Find the race in countingRaces
    const race = config.countingRaces.find(r => r.raceSlug === raceSlug || r.raceId === raceSlug);
    if (!race) {
      return NextResponse.json(
        { error: 'Race is not part of this game' },
        { status: 400 }
      );
    }

    // 5. Check if deadline has passed
    const pickDeadline = race.pickDeadline instanceof Timestamp
      ? race.pickDeadline.toDate()
      : new Date(race.pickDeadline as unknown as string);

    if (isDeadlinePassed(pickDeadline)) {
      return NextResponse.json(
        { error: 'Pick deadline has passed for this race' },
        { status: 400 }
      );
    }

    // 6. Check if rider has already been used by this participant
    const slipstreamData = {
      totalTimeLostSeconds: 0,
      totalGreenJerseyPoints: 0,
      usedRiders: [],
      picksCount: 0,
      missedPicksCount: 0,
      yellowJerseyRanking: 0,
      greenJerseyRanking: 0,
      ...(participantData.slipstreamData || {})
    };

    // Normalize types to avoid NaN/undefined writes
    slipstreamData.usedRiders = Array.isArray(slipstreamData.usedRiders) ? slipstreamData.usedRiders : [];
    slipstreamData.picksCount = Number.isFinite(slipstreamData.picksCount) ? slipstreamData.picksCount : 0;

    if (!clearPick && slipstreamData.usedRiders.includes(riderId as string)) {
      return NextResponse.json(
        { error: 'This rider has already been used. Each rider can only be picked once.' },
        { status: 400 }
      );
    }

    // 7. Check if there's already a pick for this race (to update instead of create)
    const existingPickSnapshot = await db.collection('stagePicks')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .where('raceSlug', '==', raceSlug)
      .limit(1)
      .get();

    let pickId: string | null = null;
    let previousRiderId: string | null = null;

    if (!existingPickSnapshot.empty) {
      // Update existing pick
      pickId = existingPickSnapshot.docs[0].id;
      const existingPick = existingPickSnapshot.docs[0].data();
      previousRiderId = existingPick.riderId || null;

      if (clearPick) {
        // Delete existing pick
        await existingPickSnapshot.docs[0].ref.delete();
      } else {
      // If updating to a different rider, remove the old rider from usedRiders
      // (the old rider becomes available again)
      if (previousRiderId && previousRiderId !== riderId) {
        // Check if the NEW rider was already used (in a different race)
        const usedWithoutPrevious = slipstreamData.usedRiders.filter(
          (r: string) => r !== previousRiderId
        );
        if (usedWithoutPrevious.includes(riderId as string)) {
          return NextResponse.json(
            { error: 'This rider has already been used in another race.' },
            { status: 400 }
          );
        }
      }

      // Update the pick
      await existingPickSnapshot.docs[0].ref.update({
        riderId,
        riderName,
        pickedAt: Timestamp.now(),
        locked: false,
        // Reset result fields (will be recalculated after race)
        timeLostSeconds: null,
        timeLostFormatted: null,
        greenJerseyPoints: null,
        riderFinishPosition: null,
        isPenalty: null,
        penaltyReason: null,
        processedAt: null
      });
      }
    } else {
      if (clearPick) {
        return NextResponse.json({
          success: true,
          pickId: null,
          message: 'No pick to clear',
          pick: null,
          usedRiders: slipstreamData.usedRiders,
          remainingRiders: config.countingRaces.length - slipstreamData.usedRiders.length
        });
      }
      // Create new pick
      const newPick: Omit<StagePick, 'id'> = {
        gameId,
        userId,
        playername: participantData.playername,
        raceSlug,
        stageNumber,
        riderId: riderId as string,
        riderName: riderName as string,
        pickedAt: Timestamp.now(),
        locked: false
      };

      const newPickRef = await db.collection('stagePicks').add(newPick);
      pickId = newPickRef.id;
    }

    // 8. Update participant's usedRiders list
    let updatedUsedRiders = [...slipstreamData.usedRiders];

    // Remove previous rider if this is an update
    if (previousRiderId && previousRiderId !== riderId) {
      updatedUsedRiders = updatedUsedRiders.filter(r => r !== previousRiderId);
    }

    // Add new rider if not already in list
    if (!clearPick && riderId && !updatedUsedRiders.includes(riderId)) {
      updatedUsedRiders.push(riderId);
    }

    await participantDoc.ref.update({
      'slipstreamData.usedRiders': updatedUsedRiders,
      'slipstreamData.picksCount': clearPick
        ? Math.max(0, slipstreamData.picksCount - 1)
        : (existingPickSnapshot.empty ? slipstreamData.picksCount + 1 : slipstreamData.picksCount)
    });

    // 9. Log the activity
    await db.collection('activityLogs').add({
      action: 'SLIPSTREAM_PICK',
      userId,
      gameId,
      details: {
        raceSlug,
        riderId,
        riderName,
        isUpdate: !existingPickSnapshot.empty,
        previousRiderId
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 10. Return success response
    return NextResponse.json({
      success: true,
      pickId,
      message: clearPick
        ? 'Pick cleared successfully'
        : (existingPickSnapshot.empty ? 'Pick submitted successfully' : 'Pick updated successfully'),
      pick: clearPick ? null : {
        id: pickId,
        gameId,
        userId,
        playername: participantData.playername,
        raceSlug,
        stageNumber,
        riderId,
        riderName,
        pickedAt: new Date().toISOString(),
        locked: false
      },
      usedRiders: updatedUsedRiders,
      remainingRiders: config.countingRaces.length - updatedUsedRiders.length
    });

  } catch (error) {
    console.error('[SLIPSTREAM_PICK] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit pick', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
