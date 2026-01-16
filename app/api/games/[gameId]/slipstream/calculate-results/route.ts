import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, isSlipstream } from '@/lib/types/games';
import {
  calculateTimeLoss,
  calculateGreenJerseyPoints,
  applyMissedPickPenalty,
  formatTime,
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

    // 5. First pass: Calculate results for all participants who made valid picks
    // (riders that finished the race)
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

    // Track valid picks to find the worst one for penalty calculation
    const validPickResults: Array<{
      userId: string;
      timeLostSeconds: number;
    }> = [];

    // Track participants who need penalties (DNF/DNS/DSQ or missed pick)
    const penaltyParticipants: Array<{
      userId: string;
      playername: string;
      participantRef: FirebaseFirestore.DocumentReference;
      existingPick?: {
        id: string;
        ref: FirebaseFirestore.DocumentReference;
        riderId: string;
        riderName: string;
        alreadyProcessed: boolean;
        previousTimeLost: number;
        previousGreenPoints: number;
      };
      penaltyReason: 'dnf' | 'dns' | 'dsq' | 'missed_pick';
    }> = [];

    // First pass: process valid picks and identify penalty participants
    for (const participant of participants) {
      const { userId, playername, ref: participantRef } = participant;
      const existingPick = existingPicks.get(userId);

      if (existingPick) {
        // Participant made a pick - check if rider finished
        const riderId = existingPick.riderId as string;
        const riderName = existingPick.riderName as string;

        const timeLossResult = calculateTimeLoss(
          stageResults,
          riderId,
          0 // Don't apply penalty yet, we'll calculate it based on other picks
        );

        if (!timeLossResult.isPenalty) {
          // Valid pick - rider finished the race
          const timeLostSeconds = timeLossResult.timeLostSeconds;
          const timeLostFormatted = timeLossResult.timeLostFormatted;
          const riderFinishPosition = timeLossResult.riderFinishPosition || null;

          // Calculate green jersey points
          let greenJerseyPoints = 0;
          if (riderFinishPosition) {
            greenJerseyPoints = calculateGreenJerseyPoints(
              riderFinishPosition,
              config.greenJerseyPoints
            );
          }

          // Track this as a valid pick for penalty calculation
          validPickResults.push({ userId, timeLostSeconds });

          // Update the existing pick
          batch.update(existingPick.ref, {
            timeLostSeconds,
            timeLostFormatted,
            greenJerseyPoints,
            riderFinishPosition,
            isPenalty: false,
            penaltyReason: null,
            processedAt: Timestamp.now(),
            locked: true
          });

          // Update participant totals
          if (existingPick.alreadyProcessed) {
            const prevTime = existingPick.previousTimeLost || 0;
            const prevPoints = existingPick.previousGreenPoints || 0;
            const timeDelta = timeLostSeconds - prevTime;
            const pointsDelta = greenJerseyPoints - prevPoints;
            const updates: Record<string, unknown> = {};
            if (timeDelta !== 0 && !isNaN(timeDelta) && isFinite(timeDelta)) {
              updates['slipstreamData.totalTimeLostSeconds'] = FieldValue.increment(timeDelta);
            }
            if (pointsDelta !== 0 && !isNaN(pointsDelta) && isFinite(pointsDelta)) {
              updates['slipstreamData.totalGreenJerseyPoints'] = FieldValue.increment(pointsDelta);
            }
            if (Object.keys(updates).length > 0) {
              batch.update(participantRef, updates);
            }
          } else {
            const updates: Record<string, unknown> = {};
            if (timeLostSeconds > 0 && !isNaN(timeLostSeconds) && isFinite(timeLostSeconds)) {
              updates['slipstreamData.totalTimeLostSeconds'] = FieldValue.increment(timeLostSeconds);
            }
            if (greenJerseyPoints > 0 && !isNaN(greenJerseyPoints) && isFinite(greenJerseyPoints)) {
              updates['slipstreamData.totalGreenJerseyPoints'] = FieldValue.increment(greenJerseyPoints);
            }
            if (Object.keys(updates).length > 0) {
              batch.update(participantRef, updates);
            }
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
            isPenalty: false,
            penaltyReason: null
          });
        } else {
          // DNF/DNS/DSQ - mark for penalty processing
          penaltyParticipants.push({
            userId,
            playername,
            participantRef,
            existingPick,
            penaltyReason: timeLossResult.penaltyReason || 'dnf'
          });
        }
      } else {
        // Participant missed the pick - mark for penalty processing
        penaltyParticipants.push({
          userId,
          playername,
          participantRef,
          penaltyReason: 'missed_pick'
        });
      }
    }

    // Second pass: Calculate penalty based on worst pick of OTHER players
    // Penalty = worst time of other valid picks + penalty minutes
    // If no other valid picks exist, fall back to last finisher of the race
    const penaltyMinutes = config.penaltyMinutes ?? 1;  // Default to 1 minute if not configured
    const penaltySeconds = penaltyMinutes * 60;

    console.log('[SLIPSTREAM] Penalty minutes from config:', config.penaltyMinutes, '-> using:', penaltyMinutes, '-> penaltySeconds:', penaltySeconds);
    console.log('[SLIPSTREAM] Valid pick results for penalty calculation:', validPickResults);
    console.log('[SLIPSTREAM] Penalty participants:', penaltyParticipants.map(p => ({ userId: p.userId, playername: p.playername, reason: p.penaltyReason })));

    for (const penaltyParticipant of penaltyParticipants) {
      const { userId, playername, participantRef, existingPick, penaltyReason } = penaltyParticipant;

      // Find the worst time among OTHER participants' valid picks
      const otherValidPicks = validPickResults.filter(p => p.userId !== userId);
      console.log(`[SLIPSTREAM] Other valid picks for ${playername}:`, otherValidPicks);

      let worstTimeOfOthers: number;
      if (otherValidPicks.length > 0) {
        // Use the worst (highest) time from other players' valid picks
        const times = otherValidPicks.map(p => p.timeLostSeconds);
        worstTimeOfOthers = Math.max(...times);
        console.log(`[SLIPSTREAM] Worst time of others for ${playername}: ${worstTimeOfOthers} (from times: ${JSON.stringify(times)})`);
      } else {
        // Fallback: use last finisher from race results if no other valid picks
        const penalty = applyMissedPickPenalty(stageResults, 0);
        worstTimeOfOthers = penalty.timeLostSeconds;
        console.log(`[SLIPSTREAM] Using fallback penalty for ${playername}: ${worstTimeOfOthers}`);
      }

      // Ensure we have valid numbers
      if (isNaN(worstTimeOfOthers) || worstTimeOfOthers === undefined || worstTimeOfOthers === null) {
        console.log(`[SLIPSTREAM] WARNING: worstTimeOfOthers is invalid, using 0`);
        worstTimeOfOthers = 0;
      }

      const timeLostSeconds = worstTimeOfOthers + penaltySeconds;
      const timeLostFormatted = formatTime(timeLostSeconds);
      console.log(`[SLIPSTREAM] Calculated penalty for ${playername}: ${timeLostSeconds} (${timeLostFormatted})`);

      if (existingPick) {
        // Update existing pick with penalty
        batch.update(existingPick.ref, {
          timeLostSeconds,
          timeLostFormatted,
          greenJerseyPoints: 0,
          riderFinishPosition: null,
          isPenalty: true,
          penaltyReason,
          processedAt: Timestamp.now(),
          locked: true
        });

        // Update participant totals
        if (existingPick.alreadyProcessed) {
          const prevTime = existingPick.previousTimeLost || 0;
          const prevPoints = existingPick.previousGreenPoints || 0;
          const timeDelta = timeLostSeconds - prevTime;
          const pointsDelta = 0 - prevPoints;
          if (timeDelta !== 0 && !isNaN(timeDelta) && isFinite(timeDelta)) {
            batch.update(participantRef, {
              'slipstreamData.totalTimeLostSeconds': FieldValue.increment(timeDelta)
            });
          }
          if (pointsDelta !== 0 && !isNaN(pointsDelta) && isFinite(pointsDelta)) {
            batch.update(participantRef, {
              'slipstreamData.totalGreenJerseyPoints': FieldValue.increment(pointsDelta)
            });
          }
        } else {
          if (timeLostSeconds > 0 && !isNaN(timeLostSeconds) && isFinite(timeLostSeconds)) {
            batch.update(participantRef, {
              'slipstreamData.totalTimeLostSeconds': FieldValue.increment(timeLostSeconds)
            });
          }
        }

        results.push({
          userId,
          playername,
          riderId: existingPick.riderId,
          riderName: existingPick.riderName,
          timeLostSeconds,
          timeLostFormatted,
          greenJerseyPoints: 0,
          riderFinishPosition: null,
          isPenalty: true,
          penaltyReason
        });
      } else {
        // Create a penalty pick record for missed pick
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

        // Update participant totals and missed picks count
        const missedPickUpdates: Record<string, unknown> = {
          'slipstreamData.missedPicksCount': FieldValue.increment(1)
        };
        if (timeLostSeconds > 0 && !isNaN(timeLostSeconds) && isFinite(timeLostSeconds)) {
          missedPickUpdates['slipstreamData.totalTimeLostSeconds'] = FieldValue.increment(timeLostSeconds);
        }
        batch.update(participantRef, missedPickUpdates);

        results.push({
          userId,
          playername,
          riderId: null,
          riderName: null,
          timeLostSeconds,
          timeLostFormatted,
          greenJerseyPoints: 0,
          riderFinishPosition: null,
          isPenalty: true,
          penaltyReason: 'missed_pick'
        });
      }
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
