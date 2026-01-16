import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, isSlipstream } from '@/lib/types/games';
import {
  calculateTimeLoss,
  calculateGreenJerseyPoints,
  applyMissedPickPenalty,
  StageRider
} from '@/lib/utils/slipstreamCalculation';

interface CalculateResultsRequest {
  raceSlug: string;
  stageResults: StageRider[];  // Array of riders with finish positions and time gaps
}

/**
 * POST /api/games/[gameId]/slipstream/calculate-results
 * Calculate and store results for all picks in a race
 * 
 * This endpoint:
 * 1. Validates the game and race
 * 2. Fetches all picks for the race
 * 3. Calculates time loss and green jersey points for each pick
 * 4. Applies penalties for participants who missed the pick
 * 5. Updates participant totals
 * 6. Locks all picks for this race
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body: CalculateResultsRequest = await request.json();
    const { raceSlug, stageResults } = body;

    // Validate required fields
    if (!raceSlug || !stageResults || !Array.isArray(stageResults)) {
      return NextResponse.json(
        { error: 'raceSlug and stageResults array are required' },
        { status: 400 }
      );
    }

    if (stageResults.length === 0) {
      return NextResponse.json(
        { error: 'stageResults cannot be empty' },
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

    // 2. Validate race is part of this game
    const race = config.countingRaces.find(r => r.raceSlug === raceSlug || r.raceId === raceSlug);
    if (!race) {
      return NextResponse.json(
        { error: 'Race is not part of this game' },
        { status: 400 }
      );
    }

    // 3. Get all participants in this game
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json(
        { error: 'No active participants in this game' },
        { status: 400 }
      );
    }

    const participants = participantsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ref: doc.ref,
        userId: data.userId as string,
        playername: data.playername as string,
        slipstreamData: data.slipstreamData as {
          totalTimeLostSeconds: number;
          totalGreenJerseyPoints: number;
          usedRiders: string[];
          picksCount: number;
          missedPicksCount: number;
        } | undefined
      };
    });

    // 4. Get all existing picks for this race
    const picksSnapshot = await db.collection('stagePicks')
      .where('gameId', '==', gameId)
      .where('raceSlug', '==', raceSlug)
      .get();

    const existingPicks = new Map(
      picksSnapshot.docs.map(doc => {
        const data = doc.data();
        return [data.userId, {
          id: doc.id,
          ref: doc.ref,
          riderId: data.riderId as string,
          riderName: data.riderName as string,
          alreadyProcessed: !!data.processedAt,
          previousTimeLost: (data.timeLostSeconds as number) || 0,
          previousGreenPoints: (data.greenJerseyPoints as number) || 0
        }];
      })
    );

    // 5. Process each participant
    const batch = db.batch();
    const results: Array<{
      userId: string;
      playername: string;
      riderId: string | null;
      riderName: string | null;
      timeLostSeconds: number;
      timeLostFormatted: string;
      greenJerseyPoints: number;
      riderFinishPosition: number | null;
      isPenalty: boolean;
      penaltyReason: string | null;
    }> = [];

    for (const participant of participants) {
      const { userId, playername, ref: participantRef } = participant;
      const existingPick = existingPicks.get(userId);

      let timeLostSeconds: number;
      let timeLostFormatted: string;
      let greenJerseyPoints: number = 0;
      let riderFinishPosition: number | null = null;
      let isPenalty: boolean;
      let penaltyReason: 'dnf' | 'dns' | 'dsq' | 'missed_pick' | null = null;
      let riderId: string | null = null;
      let riderName: string | null = null;

      if (existingPick) {
        // Participant made a pick - calculate their result
        riderId = existingPick.riderId as string;
        riderName = existingPick.riderName as string;

        const timeLossResult = calculateTimeLoss(
          stageResults,
          riderId,
          config.penaltyMinutes
        );

        timeLostSeconds = timeLossResult.timeLostSeconds;
        timeLostFormatted = timeLossResult.timeLostFormatted;
        isPenalty = timeLossResult.isPenalty;
        penaltyReason = timeLossResult.penaltyReason || null;
        riderFinishPosition = timeLossResult.riderFinishPosition || null;

        // Calculate green jersey points (only if not a penalty)
        if (!isPenalty && riderFinishPosition) {
          greenJerseyPoints = calculateGreenJerseyPoints(
            riderFinishPosition,
            config.greenJerseyPoints
          );
        }

        // Update the existing pick
        batch.update(existingPick.ref, {
          timeLostSeconds,
          timeLostFormatted,
          greenJerseyPoints,
          riderFinishPosition,
          isPenalty,
          penaltyReason,
          processedAt: Timestamp.now(),
          locked: true
        });
      } else {
        // Participant missed the pick - apply penalty
        const penalty = applyMissedPickPenalty(stageResults, config.penaltyMinutes);
        timeLostSeconds = penalty.timeLostSeconds;
        timeLostFormatted = penalty.timeLostFormatted;
        isPenalty = true;
        penaltyReason = 'missed_pick';

        // Create a penalty pick record
        const penaltyPickRef = db.collection('stagePicks').doc();
        batch.set(penaltyPickRef, {
          gameId,
          userId,
          playername,
          raceSlug,
          stageNumber: 'result',
          riderId: null,
          riderName: null,
          timeLostSeconds,
          timeLostFormatted,
          greenJerseyPoints: 0,
          riderFinishPosition: null,
          isPenalty: true,
          penaltyReason: 'missed_pick',
          pickedAt: Timestamp.now(),
          processedAt: Timestamp.now(),
          locked: true
        });

        // Update participant's missed picks count
        batch.update(participantRef, {
          'slipstreamData.missedPicksCount': FieldValue.increment(1)
        });
      }

      // Update participant totals
      // If already processed, subtract old values first to avoid double counting
      if (existingPick?.alreadyProcessed) {
        const timeDelta = timeLostSeconds - existingPick.previousTimeLost;
        const pointsDelta = greenJerseyPoints - existingPick.previousGreenPoints;
        batch.update(participantRef, {
          'slipstreamData.totalTimeLostSeconds': FieldValue.increment(timeDelta),
          'slipstreamData.totalGreenJerseyPoints': FieldValue.increment(pointsDelta)
        });
      } else {
        batch.update(participantRef, {
          'slipstreamData.totalTimeLostSeconds': FieldValue.increment(timeLostSeconds),
          'slipstreamData.totalGreenJerseyPoints': FieldValue.increment(greenJerseyPoints)
        });
      }

      results.push({
        userId,
        playername,
        riderId,
        riderName,
        timeLostSeconds,
        timeLostFormatted,
        greenJerseyPoints,
        riderFinishPosition,
        isPenalty,
        penaltyReason
      });
    }

    // 6. Update race status to 'finished' in game config
    const updatedRaces = config.countingRaces.map(r =>
      r.raceSlug === raceSlug ? { ...r, status: 'finished' as const } : r
    );
    batch.update(gameDoc.ref, {
      'config.countingRaces': updatedRaces,
      updatedAt: Timestamp.now()
    });

    // 7. Commit all updates
    await batch.commit();

    // 8. Log the activity
    await db.collection('activityLogs').add({
      action: 'SLIPSTREAM_RESULTS_CALCULATED',
      gameId,
      details: {
        raceSlug,
        participantsProcessed: results.length,
        picksWithResults: results.filter(r => !r.isPenalty).length,
        missedPicks: results.filter(r => r.penaltyReason === 'missed_pick').length,
        dnfPenalties: results.filter(r => r.penaltyReason === 'dnf').length
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    // 9. Return success response
    return NextResponse.json({
      success: true,
      gameId,
      raceSlug,
      processedAt: new Date().toISOString(),
      summary: {
        participantsProcessed: results.length,
        picksWithResults: results.filter(r => !r.isPenalty).length,
        missedPicks: results.filter(r => r.penaltyReason === 'missed_pick').length,
        dnfPenalties: results.filter(r => r.penaltyReason === 'dnf').length
      },
      results: results.sort((a, b) => a.timeLostSeconds - b.timeLostSeconds)
    });

  } catch (error) {
    console.error('[SLIPSTREAM_CALCULATE_RESULTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
