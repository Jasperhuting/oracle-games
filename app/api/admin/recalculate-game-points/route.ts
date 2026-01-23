import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';

/**
 * POST /api/admin/recalculate-game-points
 *
 * Recalculates all points for a specific game by:
 * 1. Resetting all playerTeams pointsScored to 0
 * 2. Resetting all participants totalPoints to 0
 * 3. Re-running calculate-points for each stage that has scraper-data
 *
 * Body: { userId, gameId }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, gameId } = await request.json();

    if (!userId || !gameId) {
      return NextResponse.json(
        { error: 'userId and gameId are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if requesting user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[RECALC_GAME] Starting recalculation for game ${gameId}`);

    // Get the game
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();
    const config = gameData?.config;
    const countingRaces = config?.countingRaces || [];
    const year = gameData?.year;

    console.log(`[RECALC_GAME] Game: ${gameData?.name}, Year: ${year}, Counting races:`, countingRaces.map((r: { raceSlug: string }) => r.raceSlug));

    // Step 1: Reset all playerTeams for this game
    console.log(`[RECALC_GAME] Resetting playerTeams points...`);
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .get();

    let teamsReset = 0;
    for (const teamDoc of playerTeamsSnapshot.docs) {
      await teamDoc.ref.update({
        pointsScored: 0,
        stagesParticipated: 0,
        racePoints: {},
      });
      teamsReset++;
    }
    console.log(`[RECALC_GAME] Reset ${teamsReset} playerTeams`);

    // Step 2: Reset all participants for this game
    console.log(`[RECALC_GAME] Resetting participants points...`);
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    let participantsReset = 0;
    for (const participantDoc of participantsSnapshot.docs) {
      await participantDoc.ref.update({
        totalPoints: 0,
      });
      participantsReset++;
    }
    console.log(`[RECALC_GAME] Reset ${participantsReset} participants`);

    // Step 3: Find all scraper-data docs for counting races
    const stagesProcessed: { raceSlug: string; stage: string; success: boolean; error?: string }[] = [];

    for (const countingRace of countingRaces) {
      // countingRace can be a string or an object with raceSlug/raceId
      const raceSlug = typeof countingRace === 'string'
        ? countingRace
        : (countingRace.raceSlug || countingRace.raceId);
      // Extract race name without year suffix
      const raceName = raceSlug.replace(/_\d{4}$/, '');

      console.log(`[RECALC_GAME] Looking for scraper-data for ${raceName} (year ${year})`);

      // Query scraper-data for this race
      const scraperDataSnapshot = await db.collection('scraper-data')
        .where('race', '==', raceName)
        .where('year', '==', parseInt(year))
        .get();

      console.log(`[RECALC_GAME] Found ${scraperDataSnapshot.size} scraper-data docs for ${raceName}`);

      for (const scraperDoc of scraperDataSnapshot.docs) {
        const scraperData = scraperDoc.data();
        const key = scraperData.key;

        if (!key || key.type !== 'stage') {
          continue;
        }

        const stage = key.stage;
        console.log(`[RECALC_GAME] Processing ${raceName} stage ${stage}`);

        try {
          // Call calculate-points for this stage
          const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
            method: 'POST',
            body: JSON.stringify({
              raceSlug: raceSlug,
              stage: stage,
              year: year.toString(),
            }),
          });

          const response = await calculatePoints(mockRequest);
          const result = await response.json();

          if (response.status === 200) {
            stagesProcessed.push({ raceSlug, stage: stage.toString(), success: true });
            console.log(`[RECALC_GAME] Successfully calculated points for ${raceName} stage ${stage}:`, result);
          } else {
            stagesProcessed.push({ raceSlug, stage: stage.toString(), success: false, error: result.error });
            console.error(`[RECALC_GAME] Failed to calculate points for ${raceName} stage ${stage}:`, result);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          stagesProcessed.push({ raceSlug, stage: stage.toString(), success: false, error: errorMessage });
          console.error(`[RECALC_GAME] Error calculating points for ${raceName} stage ${stage}:`, error);
        }
      }
    }

    // Log activity
    await db.collection('activityLogs').add({
      action: 'GAME_POINTS_RECALCULATED',
      userId,
      details: {
        gameId,
        gameName: gameData?.name,
        teamsReset,
        participantsReset,
        stagesProcessed,
      },
      timestamp: Timestamp.now(),
    });

    const successCount = stagesProcessed.filter(s => s.success).length;
    const failCount = stagesProcessed.filter(s => !s.success).length;

    console.log(`[RECALC_GAME] Completed: ${successCount} stages successful, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Recalculated points for game ${gameData?.name}`,
      teamsReset,
      participantsReset,
      stagesProcessed: stagesProcessed.length,
      successCount,
      failCount,
      details: stagesProcessed,
    });

  } catch (error) {
    console.error('[RECALC_GAME] Error:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate game points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
