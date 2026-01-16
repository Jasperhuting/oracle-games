import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { Game, SlipstreamConfig, isSlipstream } from '@/lib/types/games';

/**
 * POST /api/admin/slipstream-test
 *
 * Test endpoint to simulate Slipstream scenarios:
 * 1. Add a test race to a Slipstream game
 * 2. Simulate race results with DNF/DNS riders
 * 3. Test penalty calculation
 *
 * Request body:
 * {
 *   "action": "add-test-race" | "simulate-result" | "full-test",
 *   "gameId": "your-game-id",
 *   "userId": "admin-user-id"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { action, gameId, userId } = await request.json();

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: 'gameId and userId are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin (skip in development for testing)
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    // Verify game is slipstream
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
    if (!isSlipstream(game)) {
      return NextResponse.json({ error: 'Not a Slipstream game' }, { status: 400 });
    }

    const config = game.config as SlipstreamConfig;

    if (action === 'add-test-race') {
      // Add a test race with deadline in the past (so we can test without waiting)
      const testRace = {
        raceId: 'test-race_2026',
        raceSlug: 'test-race',
        raceName: 'Test Race (Penalty Test)',
        raceDate: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
        pickDeadline: Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 60 * 1000)), // 3 hours ago
        status: 'upcoming' as const,
        order: 99
      };

      const existingRaces = config.countingRaces || [];
      const alreadyExists = existingRaces.some(r => r.raceSlug === 'test-race');

      if (!alreadyExists) {
        await gameDoc.ref.update({
          'config.countingRaces': [...existingRaces, testRace]
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Test race added',
        race: {
          ...testRace,
          raceDate: testRace.raceDate.toDate().toISOString(),
          pickDeadline: testRace.pickDeadline.toDate().toISOString()
        }
      });
    }

    if (action === 'simulate-result') {
      // Create fake race results with:
      // - A winner (0 time lost)
      // - Some finishers with time gaps
      // - A DNF rider
      // - A DNS rider

      const fakeResults = [
        { place: 1, nameID: 'winner-rider', shortName: 'Winner Rider', timeDifference: '', time: '4:32:15' },
        { place: 2, nameID: 'second-rider', shortName: 'Second Rider', timeDifference: '+0:12', time: '4:32:27' },
        { place: 3, nameID: 'third-rider', shortName: 'Third Rider', timeDifference: '+0:34', time: '4:32:49' },
        { place: 4, nameID: 'fourth-rider', shortName: 'Fourth Rider', timeDifference: '+1:05', time: '4:33:20' },
        { place: 5, nameID: 'fifth-rider', shortName: 'Fifth Rider', timeDifference: '+1:45', time: '4:34:00' },
        { place: 6, nameID: 'sixth-rider', shortName: 'Sixth Rider', timeDifference: '+2:30', time: '4:34:45' },
        { place: 7, nameID: 'seventh-rider', shortName: 'Seventh Rider', timeDifference: '+3:00', time: '4:35:15' },
        { place: 8, nameID: 'eighth-rider', shortName: 'Eighth Rider', timeDifference: '+4:12', time: '4:36:27' },
        { place: 9, nameID: 'ninth-rider', shortName: 'Ninth Rider', timeDifference: '+5:30', time: '4:37:45' },
        { place: 10, nameID: 'tenth-rider', shortName: 'Tenth Rider', timeDifference: '+7:00', time: '4:39:15' },
        { place: 11, nameID: 'eleventh-rider', shortName: 'Eleventh Rider', timeDifference: '+10:00', time: '4:42:15' },
        // DNF rider is NOT in this list - they didn't finish
        // DNS rider is also NOT in this list - they didn't start
      ];

      // Save to Firestore as a race result
      await db.collection('test-race_2026').doc('stages').collection('results').doc('result').set({
        stage: 'result',
        race: 'test-race',
        year: 2026,
        stageTitle: 'Test Race Result',
        stageResults: fakeResults,
        generalClassification: fakeResults,
        scrapedAt: new Date().toISOString(),
        source: 'test-simulation'
      });

      return NextResponse.json({
        success: true,
        message: 'Test result saved',
        results: fakeResults,
        note: 'DNF riders (dnf-rider) and DNS riders (dns-rider) are NOT in results - they will get penalty time'
      });
    }

    if (action === 'add-test-picks') {
      // Add test picks for participants
      // This requires participants to exist in the game

      const participantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('status', '==', 'active')
        .get();

      if (participantsSnapshot.empty) {
        return NextResponse.json({
          success: false,
          message: 'No participants in game. Add participants first.'
        });
      }

      const picks = [];
      const participants = participantsSnapshot.docs;

      for (let i = 0; i < participants.length; i++) {
        const participant = participants[i].data();
        let riderId: string;
        let riderName: string;
        let scenario: string;

        // Assign different scenarios to different participants
        if (i % 4 === 0) {
          // Participant picked the winner
          riderId = 'winner-rider';
          riderName = 'Winner Rider';
          scenario = 'Picked winner (0 time lost)';
        } else if (i % 4 === 1) {
          // Participant picked someone who finished 5th
          riderId = 'fifth-rider';
          riderName = 'Fifth Rider';
          scenario = 'Picked 5th place (+1:45 time lost)';
        } else if (i % 4 === 2) {
          // Participant picked a DNF rider (not in results)
          riderId = 'dnf-rider';
          riderName = 'DNF Rider';
          scenario = 'Picked DNF rider (PENALTY: last finisher time + 1 min)';
        } else {
          // No pick for this participant (will get penalty)
          scenario = 'NO PICK - will get penalty';
          picks.push({
            odId: participant.odId,
            playername: participant.playername,
            scenario,
            pick: null
          });
          continue;
        }

        // Create the pick
        const pickData = {
          gameId,
          userId: participant.userId,
          playername: participant.playername,
          raceSlug: 'test-race',
          stageNumber: 'result',
          riderId,
          riderName,
          pickedAt: Timestamp.now(),
          locked: true // Deadline passed
        };

        await db.collection('stagePicks').add(pickData);

        picks.push({
          odId: participant.odId,
          playername: participant.playername,
          scenario,
          pick: { riderId, riderName }
        });
      }

      return NextResponse.json({
        success: true,
        message: `Created ${picks.length} test picks`,
        picks
      });
    }

    if (action === 'update-pick-to-dnf') {
      // Update a specific participant's pick to a DNF rider for testing
      const { participantUserId } = await request.json().catch(() => ({}));

      // Find a pick to update
      const picksSnapshot = await db.collection('stagePicks')
        .where('gameId', '==', gameId)
        .where('raceSlug', '==', 'test-race')
        .limit(1)
        .get();

      if (picksSnapshot.empty) {
        return NextResponse.json({ error: 'No picks found to update' }, { status: 400 });
      }

      const pickToUpdate = participantUserId
        ? picksSnapshot.docs.find(d => d.data().userId === participantUserId)
        : picksSnapshot.docs[0];

      if (!pickToUpdate) {
        return NextResponse.json({ error: 'Pick not found for specified user' }, { status: 404 });
      }

      const oldData = pickToUpdate.data();

      await pickToUpdate.ref.update({
        riderId: 'dnf-rider',
        riderName: 'DNF Rider (niet gefinished)',
        // Reset any previous results
        timeLostSeconds: null,
        timeLostFormatted: null,
        greenJerseyPoints: null,
        riderFinishPosition: null,
        isPenalty: null,
        penaltyReason: null,
        processedAt: null
      });

      return NextResponse.json({
        success: true,
        message: `Updated pick for ${oldData.playername}`,
        oldPick: { riderId: oldData.riderId, riderName: oldData.riderName },
        newPick: { riderId: 'dnf-rider', riderName: 'DNF Rider (niet gefinished)' }
      });
    }

    if (action === 'delete-pick') {
      // Delete a pick to simulate "no pick made" scenario
      const picksSnapshot = await db.collection('stagePicks')
        .where('gameId', '==', gameId)
        .where('raceSlug', '==', 'test-race')
        .limit(1)
        .get();

      if (picksSnapshot.empty) {
        return NextResponse.json({ error: 'No picks found to delete' }, { status: 400 });
      }

      const pickToDelete = picksSnapshot.docs[0];
      const pickData = pickToDelete.data();

      await pickToDelete.ref.delete();

      return NextResponse.json({
        success: true,
        message: `Deleted pick for ${pickData.playername}`,
        deletedPick: { riderId: pickData.riderId, riderName: pickData.riderName, playername: pickData.playername }
      });
    }

    if (action === 'calculate-results') {
      // First, fetch the simulated results from Firestore
      const resultsDoc = await db.collection('test-race_2026').doc('stages').collection('results').doc('result').get();

      if (!resultsDoc.exists) {
        return NextResponse.json({
          success: false,
          message: 'No test results found. Run simulate-result first.',
        });
      }

      const resultsData = resultsDoc.data();
      const stageResults = resultsData?.stageResults || [];

      // Trigger the calculate-results endpoint with the stage results
      const response = await fetch(
        `${request.nextUrl.origin}/api/games/${gameId}/slipstream/calculate-results`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            raceSlug: 'test-race',
            stageResults
          })
        }
      );

      const result = await response.json();

      return NextResponse.json({
        success: response.ok,
        message: response.ok ? 'Results calculated' : 'Failed to calculate results',
        result
      });
    }

    if (action === 'full-test') {
      // Run all steps in sequence
      const results: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Step 1: Add test race
      const step1 = await fetch(`${request.nextUrl.origin}/api/admin/slipstream-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-test-race', gameId, userId })
      });
      results.push({ step: 'add-test-race', result: await step1.json() });

      // Step 2: Simulate result
      const step2 = await fetch(`${request.nextUrl.origin}/api/admin/slipstream-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate-result', gameId, userId })
      });
      results.push({ step: 'simulate-result', result: await step2.json() });

      // Step 3: Add test picks
      const step3 = await fetch(`${request.nextUrl.origin}/api/admin/slipstream-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-test-picks', gameId, userId })
      });
      results.push({ step: 'add-test-picks', result: await step3.json() });

      // Step 4: Calculate results
      const step4 = await fetch(`${request.nextUrl.origin}/api/admin/slipstream-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate-results', gameId, userId })
      });
      results.push({ step: 'calculate-results', result: await step4.json() });

      return NextResponse.json({
        success: true,
        message: 'Full test completed',
        results
      });
    }

    if (action === 'cleanup') {
      // Remove test race and picks
      const updatedRaces = (config.countingRaces || []).filter(r => r.raceSlug !== 'test-race');
      await gameDoc.ref.update({ 'config.countingRaces': updatedRaces });

      // Delete test picks
      const picksSnapshot = await db.collection('stagePicks')
        .where('gameId', '==', gameId)
        .where('raceSlug', '==', 'test-race')
        .get();

      const batch = db.batch();
      picksSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Delete test race results
      try {
        await db.collection('test-race_2026').doc('stages').collection('results').doc('result').delete();
      } catch (e) {
        // Ignore if doesn't exist
      }

      // Recalculate participant standings from remaining real picks
      const participantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('status', '==', 'active')
        .get();

      let participantsRecalculated = 0;
      for (const participantDoc of participantsSnapshot.docs) {
        const participant = participantDoc.data();

        // Get all picks for this participant (excluding test-race)
        const allPicksSnapshot = await db.collection('stagePicks')
          .where('gameId', '==', gameId)
          .where('userId', '==', participant.userId)
          .get();

        // Recalculate totals from actual picks
        let totalTimeLostSeconds = 0;
        let totalGreenJerseyPoints = 0;
        let missedPicksCount = 0;
        const usedRiders: string[] = [];

        for (const pickDoc of allPicksSnapshot.docs) {
          const pick = pickDoc.data();
          if (pick.timeLostSeconds !== undefined && pick.timeLostSeconds !== null) {
            totalTimeLostSeconds += pick.timeLostSeconds;
          }
          if (pick.greenJerseyPoints) {
            totalGreenJerseyPoints += pick.greenJerseyPoints;
          }
          if (pick.isPenalty && pick.penaltyReason === 'missed_pick') {
            missedPicksCount++;
          }
          if (pick.riderId && !usedRiders.includes(pick.riderId)) {
            usedRiders.push(pick.riderId);
          }
        }

        await participantDoc.ref.update({
          slipstreamData: {
            totalTimeLostSeconds,
            totalGreenJerseyPoints,
            usedRiders,
            picksCount: allPicksSnapshot.size,
            missedPicksCount
          }
        });
        participantsRecalculated++;
      }

      return NextResponse.json({
        success: true,
        message: 'Test data cleaned up and participant standings recalculated',
        picksDeleted: picksSnapshot.size,
        participantsRecalculated
      });
    }

    return NextResponse.json(
      {
        error: 'Invalid action',
        validActions: ['add-test-race', 'simulate-result', 'add-test-picks', 'calculate-results', 'full-test', 'cleanup']
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('[SLIPSTREAM_TEST] Error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/slipstream-test
 *
 * Get test results/picks for a game
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const gameId = searchParams.get('gameId');

  if (!gameId) {
    return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
  }

  const db = getServerFirebase();

  // Get picks for test race
  const picksSnapshot = await db.collection('stagePicks')
    .where('gameId', '==', gameId)
    .where('raceSlug', '==', 'test-race')
    .get();

  const picks = picksSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    pickedAt: doc.data().pickedAt?.toDate?.()?.toISOString() || doc.data().pickedAt
  }));

  // Get participant slipstream data
  const participantsSnapshot = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .get();

  const participants = participantsSnapshot.docs.map(doc => ({
    id: doc.id,
    playername: doc.data().playername,
    slipstreamData: doc.data().slipstreamData || null
  }));

  return NextResponse.json({
    success: true,
    gameId,
    testRaceSlug: 'test-race',
    picks,
    participants
  });
}
