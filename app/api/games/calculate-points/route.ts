import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { 
  calculateStagePoints, 
  calculateMountainPoints,
  calculateSprintPoints,
  calculateTeamPoints,
  calculateCombativityBonus,
  getGCMultiplier,
  getClassificationMultiplier,
  shouldCountForPoints 
} from '@/lib/utils/pointsCalculation';
import { Game, AuctioneerConfig, CountingRace } from '@/lib/types/games';

interface StageResult {
  nameID?: string;
  shortName?: string;
  rank?: number;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Calculate and award points to players in Auctioneer games after a stage result is saved
 * This endpoint is called automatically after saveStageResult
 */
export async function POST(request: NextRequest) {
  try {
    const { raceSlug, stage, year } = await request.json();

    if (!raceSlug || !stage || !year) {
      return NextResponse.json(
        { error: 'raceSlug, stage, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    console.log(`[CALCULATE_POINTS] Starting points calculation for ${raceSlug} stage ${stage}`);

    // Fetch the stage result that was just saved
    const stageDocRef = db.collection(raceSlug).doc('stages').collection('results').doc(`stage-${stage}`);
    const stageDoc = await stageDocRef.get();

    if (!stageDoc.exists) {
      return NextResponse.json(
        { error: 'Stage result not found' },
        { status: 404 }
      );
    }

    const stageData = stageDoc.data();
    
    if (!stageData) {
      return NextResponse.json(
        { error: 'Stage data is empty' },
        { status: 404 }
      );
    }
    
    const stageResults: StageResult[] = stageData.stageResults || [];

    console.log(`[CALCULATE_POINTS] Found ${stageResults.length} riders in stage results`);

    // Find all active Auctioneer games that might use this race
    const gamesSnapshot = await db.collection('games')
      .where('gameType', '==', 'auctioneer')
      .where('status', 'in', ['active', 'bidding'])
      .get();

    console.log(`[CALCULATE_POINTS] Found ${gamesSnapshot.size} active auctioneer games`);

    const results = {
      gamesProcessed: 0,
      participantsUpdated: 0,
      pointsAwarded: 0,
      errors: [] as string[],
    };

    // Process each game
    for (const gameDoc of gamesSnapshot.docs) {
      try {
        const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
        const config = game.config as AuctioneerConfig;

        // Check if this race/stage counts for this game
        if (!shouldCountForPoints(raceSlug, stage, config.countingRaces)) {
          console.log(`[CALCULATE_POINTS] Game ${game.name} - race/stage does not count, skipping`);
          continue;
        }

        console.log(`[CALCULATE_POINTS] Processing game: ${game.name}`);

        // Get race configuration for multipliers
        const raceConfig = config.countingRaces?.find(cr => 
          raceSlug.includes(cr.raceSlug) || raceSlug === cr.raceId
        );
        const mountainMultiplier = raceConfig?.mountainPointsMultiplier || 4;
        const sprintMultiplier = raceConfig?.sprintPointsMultiplier || 2;
        const restDays = raceConfig?.restDays || [];

        // Determine total stages (TODO: get from race config or data)
        const totalStages = 21; // Default for Grand Tours
        const stageNum = typeof stage === 'string' ? parseInt(stage) : stage;

        // Get multipliers for this stage
        const gcMultiplier = getGCMultiplier(stageNum, totalStages, restDays);
        const pointsClassMultiplier = getClassificationMultiplier('points', stageNum, totalStages);
        const mountainsClassMultiplier = getClassificationMultiplier('mountains', stageNum, totalStages);
        const youthClassMultiplier = getClassificationMultiplier('youth', stageNum, totalStages);

        console.log(`[CALCULATE_POINTS] Stage ${stageNum}/${totalStages} - GC multiplier: ${gcMultiplier}x`);

        // Get all participants in this game
        const participantsSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', game.id)
          .where('status', '==', 'active')
          .get();

        console.log(`[CALCULATE_POINTS] Found ${participantsSnapshot.size} participants in game ${game.name}`);

        // Track points awarded per participant
        const participantPoints = new Map<string, { participantId: string; pointsEarned: number; ridersScored: string[] }>();

        // For each participant, check if any of their riders scored points
        for (const participantDoc of participantsSnapshot.docs) {
          const participantData = participantDoc.data();
          const userId = participantData.userId;

          // Get this participant's team from playerTeams collection
          const teamSnapshot = await db.collection('playerTeams')
            .where('gameId', '==', game.id)
            .where('userId', '==', userId)
            .where('active', '==', true)
            .get();

          if (teamSnapshot.empty) {
            continue;
          }

          let totalPointsForParticipant = 0;
          const ridersScored: string[] = [];

          // Check each rider in the team
          for (const teamDoc of teamSnapshot.docs) {
            const teamData = teamDoc.data();
            const riderNameId = teamData.riderNameId;
            
            // Track detailed points breakdown for this stage
            const stagePointsBreakdown: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
            let riderTotalPoints = 0;

            // 1. STAGE RESULT POINTS (always awarded)
            const riderResult = stageResults.find(r => 
              r.nameID === riderNameId || 
              r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
            );

            if (riderResult && riderResult.rank) {
              const stagePoints = calculateStagePoints(riderResult.rank);
              if (stagePoints > 0) {
                riderTotalPoints += stagePoints;
                stagePointsBreakdown.stageResult = stagePoints;
                console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Stage result: ${stagePoints} pts (rank ${riderResult.rank})`);
              }
            }

            // 2. GENERAL CLASSIFICATION POINTS (only on rest days and final stage)
            if (gcMultiplier > 0 && stageData.generalClassification) {
              const gcResult = stageData.generalClassification.find((r: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (gcResult && gcResult.rank) {
                const gcPoints = calculateStagePoints(gcResult.rank) * gcMultiplier;
                if (gcPoints > 0) {
                  riderTotalPoints += gcPoints;
                  stagePointsBreakdown.gcPoints = gcPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - GC: ${gcPoints} pts (rank ${gcResult.rank} x ${gcMultiplier})`);
                }
              }
            }

            // 3. POINTS CLASSIFICATION (only at final stage)
            if (pointsClassMultiplier > 0 && stageData.pointsClassification) {
              const pointsResult = stageData.pointsClassification.find((r: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (pointsResult && pointsResult.rank) {
                const pointsClassPoints = calculateStagePoints(pointsResult.rank);
                if (pointsClassPoints > 0) {
                  riderTotalPoints += pointsClassPoints;
                  stagePointsBreakdown.pointsClass = pointsClassPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Points class: ${pointsClassPoints} pts (rank ${pointsResult.rank})`);
                }
              }
            }

            // 4. MOUNTAINS CLASSIFICATION (only at final stage)
            if (mountainsClassMultiplier > 0 && stageData.mountainsClassification) {
              const mountainsResult = stageData.mountainsClassification.find((r: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (mountainsResult && mountainsResult.rank) {
                const mountainsClassPoints = calculateStagePoints(mountainsResult.rank);
                if (mountainsClassPoints > 0) {
                  riderTotalPoints += mountainsClassPoints;
                  stagePointsBreakdown.mountainsClass = mountainsClassPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Mountains class: ${mountainsClassPoints} pts (rank ${mountainsResult.rank})`);
                }
              }
            }

            // 5. YOUTH CLASSIFICATION (only at final stage)
            if (youthClassMultiplier > 0 && stageData.youthClassification) {
              const youthResult = stageData.youthClassification.find((r: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (youthResult && youthResult.rank) {
                const youthClassPoints = calculateStagePoints(youthResult.rank);
                if (youthClassPoints > 0) {
                  riderTotalPoints += youthClassPoints;
                  stagePointsBreakdown.youthClass = youthClassPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Youth class: ${youthClassPoints} pts (rank ${youthResult.rank})`);
                }
              }
            }

            // 6. MOUNTAIN POINTS DURING STAGE (always awarded if rider earned mountain points)
            // TODO: Need to track mountain points earned during stage (not in classification)
            // This requires additional data from stage scraper

            // 7. SPRINT POINTS DURING STAGE (always awarded if rider earned sprint points)
            // TODO: Need to track sprint points earned during stage (not in classification)
            // This requires additional data from stage scraper

            // 8. COMBATIVITY BONUS (strijdlust)
            // TODO: Need to track breakaway participation
            // This requires additional data from stage scraper

            // Update PlayerTeam if rider scored any points
            if (riderTotalPoints > 0) {
              totalPointsForParticipant += riderTotalPoints;
              ridersScored.push(teamData.riderName);

              const currentPoints = teamData.pointsScored || 0;
              const currentStages = teamData.stagesParticipated || 0;
              
              // Get existing race points data
              const racePoints = teamData.racePoints || {};
              const currentRaceData = racePoints[raceSlug] || { totalPoints: 0, stagePoints: {} };
              
              // Add this stage's points breakdown
              stagePointsBreakdown.total = riderTotalPoints;
              currentRaceData.stagePoints[stage.toString()] = stagePointsBreakdown;
              currentRaceData.totalPoints = (currentRaceData.totalPoints || 0) + riderTotalPoints;
              racePoints[raceSlug] = currentRaceData;
              
              await teamDoc.ref.update({
                pointsScored: currentPoints + riderTotalPoints,
                stagesParticipated: currentStages + 1,
                racePoints: racePoints,
              });
              
              console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Updated race points for ${raceSlug} stage ${stage}: +${riderTotalPoints} (race total: ${currentRaceData.totalPoints})`);
            }
          }

          if (totalPointsForParticipant > 0) {
            participantPoints.set(userId, {
              participantId: participantDoc.id,
              pointsEarned: totalPointsForParticipant,
              ridersScored,
            });
          }
        }

        // Update all participants' total points
        for (const [userId, data] of participantPoints.entries()) {
          const participantDoc = participantsSnapshot.docs.find(doc => doc.data().userId === userId);
          
          if (participantDoc) {
            const currentTotal = participantDoc.data().totalPoints || 0;
            const newTotal = currentTotal + data.pointsEarned;

            await participantDoc.ref.update({
              totalPoints: newTotal,
            });

            console.log(`[CALCULATE_POINTS] Updated ${participantDoc.data().playername}: +${data.pointsEarned} points (total: ${newTotal})`);
            
            results.participantsUpdated++;
            results.pointsAwarded += data.pointsEarned;
          }
        }

        // Update rankings for this game
        await updateGameRankings(db, game.id!);

        results.gamesProcessed++;

      } catch (error) {
        const errorMsg = `Error processing game ${gameDoc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log(`[CALCULATE_POINTS] Completed: ${results.gamesProcessed} games, ${results.participantsUpdated} participants, ${results.pointsAwarded} points awarded`);

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'POINTS_CALCULATED',
      details: {
        raceSlug,
        stage,
        year,
        results,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Points calculated for ${results.gamesProcessed} games`,
      results,
    });

  } catch (error) {
    console.error('[CALCULATE_POINTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Update rankings for all participants in a game based on total points
 */
async function updateGameRankings(db: FirebaseFirestore.Firestore, gameId: string): Promise<void> {
  console.log(`[UPDATE_RANKINGS] Updating rankings for game ${gameId}`);

  // Get all participants sorted by totalPoints (descending)
  const participantsSnapshot = await db.collection('gameParticipants')
    .where('gameId', '==', gameId)
    .where('status', '==', 'active')
    .orderBy('totalPoints', 'desc')
    .get();

  if (participantsSnapshot.empty) {
    console.log(`[UPDATE_RANKINGS] No participants found for game ${gameId}`);
    return;
  }

  // Update ranking for each participant
  let currentRank = 1;
  let previousPoints = -1;
  let participantsWithSamePoints = 0;

  for (const participantDoc of participantsSnapshot.docs) {
    const participantData = participantDoc.data();
    const points = participantData.totalPoints || 0;

    // Handle tied rankings
    if (points === previousPoints) {
      participantsWithSamePoints++;
    } else {
      currentRank += participantsWithSamePoints;
      participantsWithSamePoints = 1;
      previousPoints = points;
    }

    // Only update if ranking changed
    if (participantData.ranking !== currentRank) {
      await participantDoc.ref.update({
        ranking: currentRank,
      });
      console.log(`[UPDATE_RANKINGS] ${participantData.playername}: rank ${currentRank} (${points} points)`);
    }
  }

  console.log(`[UPDATE_RANKINGS] Updated ${participantsSnapshot.size} participants`);
}
