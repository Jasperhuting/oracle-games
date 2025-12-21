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
  points?: number;
  time?: string;
  gap?: string;
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
            const stagePointsBreakdown: Record<string, number> = {};
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
              const gcResult = stageData.generalClassification.find((r: StageResult) =>
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
              const pointsResult = stageData.pointsClassification.find((r: StageResult) =>
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
              const mountainsResult = stageData.mountainsClassification.find((r: StageResult) =>
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
              const youthResult = stageData.youthClassification.find((r: StageResult) =>
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

    // Update season points for all riders who scored
    console.log(`[CALCULATE_POINTS] Updating season points for ${year}`);
    try {
      await updateSeasonPoints(db, raceSlug, stage, year, stageData);
    } catch (error) {
      console.error('[CALCULATE_POINTS] Error updating season points:', error);
      // Don't fail the whole request if season points update fails
    }

    // Update Marginal Gains games
    console.log(`[CALCULATE_POINTS] Checking for Marginal Gains games to update`);
    try {
      await updateMarginalGainsGames(db, year);
    } catch (error) {
      console.error('[CALCULATE_POINTS] Error updating Marginal Gains games:', error);
      // Don't fail the whole request if Marginal Gains update fails
    }

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

/**
 * Update season points for all riders who scored in this stage
 * This is used for tracking rider performance across the entire season
 */
async function updateSeasonPoints(
  db: FirebaseFirestore.Firestore,
  raceSlug: string,
  stage: string | number,
  year: string | number,
  stageData: any
): Promise<void> {
  console.log(`[SEASON_POINTS] Updating season points for ${raceSlug} stage ${stage}`);

  const yearNum = typeof year === 'string' ? parseInt(year) : year;
  const stageNum = typeof stage === 'string' ? parseInt(stage) : stage;
  const stageResults: StageResult[] = stageData.stageResults || [];

  // Extract race name from slug (e.g., "tour-de-france_2025" -> "Tour de France")
  const raceName = raceSlug.replace(/_\d{4}$/, '').split('-').map((word: string) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  // Get multipliers for this stage (using same logic as main calculation)
  const totalStages = 21; // Default for Grand Tours
  const gcMultiplier = getGCMultiplier(stageNum, totalStages, []);
  const pointsClassMultiplier = getClassificationMultiplier('points', stageNum, totalStages);
  const mountainsClassMultiplier = getClassificationMultiplier('mountains', stageNum, totalStages);
  const youthClassMultiplier = getClassificationMultiplier('youth', stageNum, totalStages);

  // Track all riders who scored points
  const ridersWithPoints = new Map<string, {
    nameID: string;
    name: string;
    stageResult?: number;
    gcPoints?: number;
    pointsClass?: number;
    mountainsClass?: number;
    youthClass?: number;
    total: number;
  }>();

  // 1. Process stage results
  for (const riderResult of stageResults) {
    if (riderResult.rank && riderResult.nameID) {
      const stagePoints = calculateStagePoints(riderResult.rank);
      if (stagePoints > 0) {
        const existing = ridersWithPoints.get(riderResult.nameID) || {
          nameID: riderResult.nameID,
          name: riderResult.shortName || riderResult.nameID,
          total: 0,
        };
        existing.stageResult = stagePoints;
        existing.total += stagePoints;
        ridersWithPoints.set(riderResult.nameID, existing);
      }
    }
  }

  // 2. Process GC points (if applicable)
  if (gcMultiplier > 0 && stageData.generalClassification) {
    for (const gcResult of stageData.generalClassification) {
      if (gcResult.rank && gcResult.nameID) {
        const gcPoints = calculateStagePoints(gcResult.rank) * gcMultiplier;
        if (gcPoints > 0) {
          const existing = ridersWithPoints.get(gcResult.nameID) || {
            nameID: gcResult.nameID,
            name: gcResult.shortName || gcResult.nameID,
            total: 0,
          };
          existing.gcPoints = gcPoints;
          existing.total += gcPoints;
          ridersWithPoints.set(gcResult.nameID, existing);
        }
      }
    }
  }

  // 3. Process Points Classification (if applicable)
  if (pointsClassMultiplier > 0 && stageData.pointsClassification) {
    for (const pointsResult of stageData.pointsClassification) {
      if (pointsResult.rank && pointsResult.nameID) {
        const pointsClassPoints = calculateStagePoints(pointsResult.rank);
        if (pointsClassPoints > 0) {
          const existing = ridersWithPoints.get(pointsResult.nameID) || {
            nameID: pointsResult.nameID,
            name: pointsResult.shortName || pointsResult.nameID,
            total: 0,
          };
          existing.pointsClass = pointsClassPoints;
          existing.total += pointsClassPoints;
          ridersWithPoints.set(pointsResult.nameID, existing);
        }
      }
    }
  }

  // 4. Process Mountains Classification (if applicable)
  if (mountainsClassMultiplier > 0 && stageData.mountainsClassification) {
    for (const mountainsResult of stageData.mountainsClassification) {
      if (mountainsResult.rank && mountainsResult.nameID) {
        const mountainsClassPoints = calculateStagePoints(mountainsResult.rank);
        if (mountainsClassPoints > 0) {
          const existing = ridersWithPoints.get(mountainsResult.nameID) || {
            nameID: mountainsResult.nameID,
            name: mountainsResult.shortName || mountainsResult.nameID,
            total: 0,
          };
          existing.mountainsClass = mountainsClassPoints;
          existing.total += mountainsClassPoints;
          ridersWithPoints.set(mountainsResult.nameID, existing);
        }
      }
    }
  }

  // 5. Process Youth Classification (if applicable)
  if (youthClassMultiplier > 0 && stageData.youthClassification) {
    for (const youthResult of stageData.youthClassification) {
      if (youthResult.rank && youthResult.nameID) {
        const youthClassPoints = calculateStagePoints(youthResult.rank);
        if (youthClassPoints > 0) {
          const existing = ridersWithPoints.get(youthResult.nameID) || {
            nameID: youthResult.nameID,
            name: youthResult.shortName || youthResult.nameID,
            total: 0,
          };
          existing.youthClass = youthClassPoints;
          existing.total += youthClassPoints;
          ridersWithPoints.set(youthResult.nameID, existing);
        }
      }
    }
  }

  console.log(`[SEASON_POINTS] Found ${ridersWithPoints.size} riders with points`);

  // Update seasonPoints collection for each rider
  for (const [riderNameId, pointsData] of ridersWithPoints.entries()) {
    try {
      const seasonPointsDocRef = db.collection('seasonPoints').doc(`${riderNameId}_${yearNum}`);
      const seasonPointsDoc = await seasonPointsDocRef.get();

      if (seasonPointsDoc.exists) {
        // Update existing document
        const existingData = seasonPointsDoc.data();
        const races = existingData?.races || {};
        const raceData = races[raceSlug] || { raceName, totalPoints: 0, stages: {} };

        // Add this stage's points
        const stageKey = stage.toString();
        raceData.stages[stageKey] = {
          stageResult: pointsData.stageResult,
          gcPoints: pointsData.gcPoints,
          pointsClass: pointsData.pointsClass,
          mountainsClass: pointsData.mountainsClass,
          youthClass: pointsData.youthClass,
          total: pointsData.total,
        };

        // Recalculate race total
        let raceTotalPoints = 0;
        for (const stagePoints of Object.values(raceData.stages)) {
          raceTotalPoints += (stagePoints as any).total || 0;
        }
        raceData.totalPoints = raceTotalPoints;

        races[raceSlug] = raceData;

        // Recalculate season total
        let seasonTotalPoints = 0;
        for (const race of Object.values(races)) {
          seasonTotalPoints += (race as any).totalPoints || 0;
        }

        await seasonPointsDocRef.update({
          races,
          totalPoints: seasonTotalPoints,
          updatedAt: new Date(),
        });

        console.log(`[SEASON_POINTS] Updated ${pointsData.name}: +${pointsData.total} pts (season total: ${seasonTotalPoints})`);

      } else {
        // Create new document
        const newSeasonPoints = {
          riderNameId,
          riderName: pointsData.name,
          year: yearNum,
          totalPoints: pointsData.total,
          races: {
            [raceSlug]: {
              raceName,
              totalPoints: pointsData.total,
              stages: {
                [stage.toString()]: {
                  stageResult: pointsData.stageResult,
                  gcPoints: pointsData.gcPoints,
                  pointsClass: pointsData.pointsClass,
                  mountainsClass: pointsData.mountainsClass,
                  youthClass: pointsData.youthClass,
                  total: pointsData.total,
                },
              },
            },
          },
          updatedAt: new Date(),
        };

        await seasonPointsDocRef.set(newSeasonPoints);
        console.log(`[SEASON_POINTS] Created new season points for ${pointsData.name}: ${pointsData.total} pts`);
      }

    } catch (error) {
      console.error(`[SEASON_POINTS] Error updating ${riderNameId}:`, error);
    }
  }

  console.log(`[SEASON_POINTS] Season points update complete`);
}

/**
 * Update Marginal Gains games after season points are updated
 * This recalculates the gain for all riders in active Marginal Gains games
 */
async function updateMarginalGainsGames(
  db: FirebaseFirestore.Firestore,
  year: string | number
): Promise<void> {
  const yearNum = typeof year === 'string' ? parseInt(year) : year;

  console.log(`[MARGINAL_GAINS_UPDATE] Checking for active Marginal Gains games for year ${yearNum}`);

  // Find all active Marginal Gains games for this year
  const marginalGainsGamesSnapshot = await db.collection('games')
    .where('gameType', '==', 'marginal-gains')
    .where('status', 'in', ['active', 'bidding'])
    .get();

  if (marginalGainsGamesSnapshot.empty) {
    console.log(`[MARGINAL_GAINS_UPDATE] No active Marginal Gains games found`);
    return;
  }

  console.log(`[MARGINAL_GAINS_UPDATE] Found ${marginalGainsGamesSnapshot.size} active Marginal Gains games`);

  // Helper functions to get points
  const getStartingPoints = async (riderNameId: string): Promise<number> => {
    try {
      const rankingDoc = await db.collection(`rankings_${yearNum}`).doc(riderNameId).get();
      if (rankingDoc.exists) {
        const data = rankingDoc.data();
        return data?.points || 0;
      }
      return 0;
    } catch (error) {
      console.error(`[MARGINAL_GAINS_UPDATE] Error fetching ranking for ${riderNameId}:`, error);
      return 0;
    }
  };

  const getCurrentSeasonPoints = async (riderNameId: string): Promise<number> => {
    try {
      const seasonPointsDoc = await db.collection('seasonPoints').doc(`${riderNameId}_${yearNum}`).get();
      if (seasonPointsDoc.exists) {
        const data = seasonPointsDoc.data();
        return data?.totalPoints || 0;
      }
      return 0;
    } catch (error) {
      console.error(`[MARGINAL_GAINS_UPDATE] Error fetching season points for ${riderNameId}:`, error);
      return 0;
    }
  };

  // Process each game
  for (const gameDoc of marginalGainsGamesSnapshot.docs) {
    try {
      const gameData = gameDoc.data();
      const game = { id: gameDoc.id, ...gameData } as any;
      const config = game.config;

      // Check if this game is for the current year
      if (config.currentYear !== yearNum) {
        console.log(`[MARGINAL_GAINS_UPDATE] Skipping game ${game.name} (year ${config.currentYear} != ${yearNum})`);
        continue;
      }

      console.log(`[MARGINAL_GAINS_UPDATE] Processing game: ${game.name}`);

      // Get all participants
      const participantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', game.id)
        .where('status', '==', 'active')
        .get();

      // Update each participant's score
      for (const participantDoc of participantsSnapshot.docs) {
        const participantData = participantDoc.data();
        const userId = participantData.userId;

        // Get team
        const teamSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', game.id)
          .where('userId', '==', userId)
          .where('active', '==', true)
          .get();

        if (teamSnapshot.empty) continue;

        let totalScore = 0;

        // Calculate gain for each rider
        for (const teamDoc of teamSnapshot.docs) {
          const teamData = teamDoc.data();
          const riderNameId = teamData.riderNameId;

          const startingPoints = await getStartingPoints(riderNameId);
          const currentPoints = await getCurrentSeasonPoints(riderNameId);
          const gain = currentPoints - startingPoints;

          totalScore += gain;

          // Update PlayerTeam
          await teamDoc.ref.update({
            pointsScored: gain,
          });
        }

        // Update participant total
        await participantDoc.ref.update({
          totalPoints: totalScore,
        });
      }

      // Update rankings for this game
      const rankedParticipants = await db.collection('gameParticipants')
        .where('gameId', '==', game.id)
        .where('status', '==', 'active')
        .orderBy('totalPoints', 'desc')
        .get();

      let ranking = 1;
      for (const participantDoc of rankedParticipants.docs) {
        await participantDoc.ref.update({ ranking });
        ranking++;
      }

      console.log(`[MARGINAL_GAINS_UPDATE] Updated game ${game.name}`);

    } catch (error) {
      console.error(`[MARGINAL_GAINS_UPDATE] Error processing game ${gameDoc.id}:`, error);
    }
  }

  console.log(`[MARGINAL_GAINS_UPDATE] Marginal Gains games update complete`);
}
