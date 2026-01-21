import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
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
import { ClassificationRider, StageRider } from '@/lib/scraper/types';

interface StageResult {
  nameID?: string;
  shortName?: string;
  rank?: number;
  place?: number;  // Finish position in the race/stage
  points?: number | string;  // Pnt column from PCS (e.g., 15, 10, 7, 4, 2, 1 or "-")
  uciPoints?: string;  // UCI points from PCS - NOT USED for scoring
  time?: string;
  gap?: string;
  name?: string; // Full name from scraper
}

/**
 * Calculate and award points to players in Auctioneer games after a stage result is saved
 * This endpoint is called automatically after saveStageResult
 */
export async function POST(request: NextRequest) {
  try {
    const { raceSlug, stage, year } = await request.json();

    if (raceSlug === undefined || raceSlug === null || raceSlug === '' ||
        stage === undefined || stage === null ||
        year === undefined || year === null || year === '') {
      return NextResponse.json(
        { error: 'raceSlug, stage, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    console.log(`[CALCULATE_POINTS] Starting points calculation for ${raceSlug} ${stage === 'tour-gc' ? 'tour GC' : `stage ${stage}`}`);

    // Fetch the stage result from scraper-data collection
    // For single-day races, stage will be 'result', for multi-stage races it will be a number
    // For prologue (stage 0), use 'prologue' instead of 'stage-0'
    // For tour GC, use 'tour-gc'
    let docId: string;
    if (stage === 'result') {
      docId = `${raceSlug}-${year}-result`;
    } else if (stage === 'tour-gc') {
      docId = `${raceSlug}-${year}-tour-gc`;
    } else if (stage === 0) {
      docId = `${raceSlug}-${year}-prologue`;
    } else {
      docId = `${raceSlug}-${year}-stage-${stage}`;
    }
    
    const stageDocRef = db.collection('scraper-data').doc(docId);
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
    
    const stageResults: StageResult[] = stageData.stageResults ? 
      (typeof stageData.stageResults === 'string' ? JSON.parse(stageData.stageResults) : stageData.stageResults) : [];
    const generalClassification: ClassificationRider[] = stageData.generalClassification ? 
      (typeof stageData.generalClassification === 'string' ? JSON.parse(stageData.generalClassification) : stageData.generalClassification) : [];

    console.log(`[CALCULATE_POINTS] Found ${stageResults.length} riders in stage results`);
    console.log(`[CALCULATE_POINTS] Found 55 riders in general classification`);

    // Debug: Check if Diego Alejandro Méndez is in the GC data
    const diegoInGC = generalClassification.find(r => 
      r.rider === 'diego-alejandro-mendez' || 
      r.shortName === 'diego-alejandro-mendez'
    );
    if (diegoInGC) {
      console.log(`[CALCULATE_POINTS] Diego found in GC: Rank ${diegoInGC.place}, Points: ${diegoInGC.points}`);
    } else {
      console.log(`[CALCULATE_POINTS] Diego NOT found in GC data`);
    }

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
        if (!config || !shouldCountForPoints(raceSlug, stage, config.countingRaces)) {
          console.log(`[CALCULATE_POINTS] Game ${game.name} - race/stage does not count, skipping`);
          continue;
        }

        console.log(`[CALCULATE_POINTS] Processing game: ${game.name} (raceType: ${game.raceType})`);

        // For season games, use PCS points directly instead of TOP_20_POINTS
        const useDirectPcsPoints = game.raceType === 'season';

        // Get race configuration for multipliers
        const raceConfig = config?.countingRaces?.find(cr => 
          raceSlug.includes(cr.raceSlug) || raceSlug === cr.raceId
        );
        const mountainMultiplier = raceConfig?.mountainPointsMultiplier || 4;
        const sprintMultiplier = raceConfig?.sprintPointsMultiplier || 2;
        const restDays = raceConfig?.restDays || [];

        // Determine total stages (TODO: get from race config or data)
        const totalStages = 21; // Default for Grand Tours
        const stageNum = typeof stage === 'string' ? parseInt(stage) : stage;
        const isTourGC = stage === 'tour-gc';

        // Get multipliers for this stage
        const gcMultiplier = isTourGC ? 1 : getGCMultiplier(stageNum, totalStages, restDays);
        const pointsClassMultiplier = isTourGC ? 0 : getClassificationMultiplier('points', stageNum, totalStages);
        const mountainsClassMultiplier = isTourGC ? 0 : getClassificationMultiplier('mountains', stageNum, totalStages);
        const youthClassMultiplier = isTourGC ? 0 : getClassificationMultiplier('youth', stageNum, totalStages);

        console.log(`[CALCULATE_POINTS] ${isTourGC ? 'Tour GC' : `Stage ${stageNum}/${totalStages}`} - GC multiplier: ${gcMultiplier}x`);

        // Get all participants in this game
        const participantsSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', game.id)
          .where('status', '==', 'active')
          .get();

        console.log(`[CALCULATE_POINTS] Found ${participantsSnapshot.size} participants in game ${game.name}`);

        // Track points delta per participant (net change, accounting for re-scraping)
        let totalPointsDelta = 0;
        const participantPoints = new Map<string, { participantId: string; pointsDelta: number; ridersScored: string[] }>();

        // For each participant, check if any of their riders scored points
        for (const participantDoc of participantsSnapshot.docs) {
          const participantData = participantDoc.data();
          const userId = participantData.userId;
          let participantTotalPoints = 0;
          const ridersScored: string[] = [];

          // Get this participant's team from playerTeams collection
          const teamSnapshot = await db.collection('playerTeams')
            .where('gameId', '==', game.id)
            .where('userId', '==', userId)
            .get();


          // For each rider in the team
          for (const teamDoc of teamSnapshot.docs) {
            const teamData = teamDoc.data();
            const riderNameId = teamData.riderNameId;        

            // Track detailed points breakdown for this stage
            const stagePointsBreakdown: Record<string, number> = {};
            let riderTotalPoints = 0;

            // For tour GC, only check general classification, not stage results
            if (isTourGC) {
              // 1. GENERAL CLASSIFICATION POINTS (always for tour GC)
              if (gcMultiplier > 0 && generalClassification.length > 0) {
                const gcResult = generalClassification.find((r: StageResult) =>
                  r.nameID === riderNameId || 
                  r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
                );
                if (gcResult && gcResult.place) {
                  const gcPoints = calculateStagePoints(gcResult.place) * gcMultiplier;
                  if (gcPoints > 0) {
                    riderTotalPoints += gcPoints;
                    stagePointsBreakdown.gcPoints = gcPoints;
                    console.log(`[CALCULATE_POINTS] ${teamData.riderName} - GC: ${gcPoints} pts (place ${gcResult.place} x ${gcMultiplier})`);
                    ridersScored.push(teamData.riderName);
                  }
                }
              }
            } else {
              // For regular stages, check both stage results and GC
              
              // 1. STAGE RESULT POINTS (always awarded)
              const riderResult = stageResults.find(r => {
                // Try multiple matching strategies
                const stageNameId = r.nameID;
                const stageShortName = r.shortName?.toLowerCase().replace(/\s+/g, '-');
                const stageName = r.name?.toLowerCase().replace(/\s+/g, '-');
                
                // Debug logging for first few riders
                if (stageResults.indexOf(r) < 5) {
                  console.log(`[CALCULATE_POINTS] Stage rider data:`, {
                    stageNameId,
                    stageShortName,
                    stageName,
                    lookingFor: riderNameId
                  });
                }
                
                return stageNameId === riderNameId || 
                       stageShortName === riderNameId ||
                       stageName === riderNameId;
              });

              // Note: 'place' is the finish position, 'place' is the UCI placeing
              const finishPosition = riderResult?.place || riderResult?.place;
              if (riderResult && finishPosition) {
                console.log(`[CALCULATE_POINTS] Found rider ${teamData.riderName} in stage results at position ${finishPosition}`);
                let stagePoints: number;
                
                if (useDirectPcsPoints) {
                  // For season games, use PCS points directly from the 'points' field
                  const pcsPoints = typeof riderResult.points === 'number' ? riderResult.points :
                    (typeof riderResult.points === 'string' && riderResult.points !== '-' ? parseInt(riderResult.points) : 0);
                  stagePoints = pcsPoints;
                  if (stagePoints > 0) {
                    console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Stage result (PCS): ${stagePoints} pts (place ${finishPosition})`);
                  }
                } else {
                  // For Grand Tour games, use TOP_20_POINTS system
                  stagePoints = calculateStagePoints(finishPosition);
                  if (stagePoints > 0) {
                    console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Stage result: ${stagePoints} pts (place ${finishPosition})`);
                  }
                }
                
                if (stagePoints > 0) {
                  riderTotalPoints += stagePoints;
                  stagePointsBreakdown.stageResult = stagePoints;
                  ridersScored.push(teamData.riderName);
                }
              } else {
                console.log(`[CALCULATE_POINTS] Rider ${teamData.riderName} (${riderNameId}) not found in stage results`);
                // Debug: show some stage result nameIDs for comparison
                if (stageResults.length > 0) {
                  console.log(`[CALCULATE_POINTS] Sample stage result nameIDs:`, stageResults.slice(0, 5).map(r => ({ name: r.name, nameID: r.nameID, shortName: r.shortName })));
                }
              }

              // 2. GENERAL CLASSIFICATION POINTS (always for tour GC, otherwise only on rest days and final stage)
              if (gcMultiplier > 0 && stageData.generalClassification) {
                const gcResult = stageData.generalClassification.find((r: StageResult) =>
                  r.nameID === riderNameId || 
                  r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
                );
                if (gcResult && gcResult.place) {
                  const gcPoints = calculateStagePoints(gcResult.place) * gcMultiplier;
                  if (gcPoints > 0) {
                    riderTotalPoints += gcPoints;
                    stagePointsBreakdown.gcPoints = gcPoints;
                    console.log(`[CALCULATE_POINTS] ${teamData.riderName} - GC: ${gcPoints} pts (place ${gcResult.place} x ${gcMultiplier})`);
                  }
                }
              }
            }

            // 3. POINTS CLASSIFICATION (only at final stage)
            if (pointsClassMultiplier > 0 && stageData.pointsClassification) {
              const pointsResult = stageData.pointsClassification.find((r: StageResult) =>
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (pointsResult && pointsResult.place) {
                const pointsClassPoints = calculateStagePoints(pointsResult.place);
                if (pointsClassPoints > 0) {
                  riderTotalPoints += pointsClassPoints;
                  stagePointsBreakdown.pointsClass = pointsClassPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Points class: ${pointsClassPoints} pts (place ${pointsResult.place})`);
                }
              }
            }

            // 4. MOUNTAINS CLASSIFICATION (only at final stage)
            if (mountainsClassMultiplier > 0 && stageData.mountainsClassification) {
              const mountainsResult = stageData.mountainsClassification.find((r: StageResult) =>
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (mountainsResult && mountainsResult.place) {
                const mountainsClassPoints = calculateStagePoints(mountainsResult.place);
                if (mountainsClassPoints > 0) {
                  riderTotalPoints += mountainsClassPoints;
                  stagePointsBreakdown.mountainsClass = mountainsClassPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Mountains class: ${mountainsClassPoints} pts (place ${mountainsResult.place})`);
                }
              }
            }

            // 5. YOUTH CLASSIFICATION (only at final stage)
            if (youthClassMultiplier > 0 && stageData.youthClassification) {
              const youthResult = stageData.youthClassification.find((r: StageResult) =>
                r.nameID === riderNameId || 
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (youthResult && youthResult.place) {
                const youthClassPoints = calculateStagePoints(youthResult.place);
                if (youthClassPoints > 0) {
                  riderTotalPoints += youthClassPoints;
                  stagePointsBreakdown.youthClass = youthClassPoints;
                  console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Youth class: ${youthClassPoints} pts (place ${youthResult.place})`);
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
              const currentPoints = teamData.pointsScored || 0;
              const currentStages = teamData.stagesParticipated || 0;

              // Get existing race points data
              const racePoints = teamData.racePoints || {};
              const currentRaceData = racePoints[raceSlug] || { totalPoints: 0, stagePoints: {} };

              // Check if this stage was already processed (for re-scraping)
              const existingStagePoints = currentRaceData.stagePoints?.[stage.toString()]?.total || 0;
              const isRescrape = existingStagePoints > 0;

              // Add this stage's points breakdown (overwrites existing if re-scraping)
              stagePointsBreakdown.total = riderTotalPoints;
              currentRaceData.stagePoints[stage.toString()] = stagePointsBreakdown;

              // Recalculate race total from all stages (prevents double counting)
              let raceTotalPoints = 0;
              for (const stageData of Object.values(currentRaceData.stagePoints || {})) {
                raceTotalPoints += (stageData as any).total || 0;
              }
              currentRaceData.totalPoints = raceTotalPoints;
              racePoints[raceSlug] = currentRaceData;

              // Calculate net points change (new - old)
              const pointsDelta = riderTotalPoints - existingStagePoints;

              await teamDoc.ref.update({
                pointsScored: currentPoints + pointsDelta,
                stagesParticipated: isRescrape ? currentStages : currentStages + 1,
                racePoints: racePoints,
              });

              // Track the delta for participant total update
              participantTotalPoints += pointsDelta;
              ridersScored.push(teamData.riderName);

              console.log(`[CALCULATE_POINTS] ${teamData.riderName} - Updated race points for ${raceSlug} stage ${stage}: ${isRescrape ? 'rescrape ' : ''}${pointsDelta >= 0 ? '+' : ''}${pointsDelta} (race total: ${currentRaceData.totalPoints})`);
            }
          }

          // Add participant if they have riders with points
          if (participantTotalPoints > 0) {
            participantPoints.set(userId, {
              participantId: participantDoc.id,
              pointsDelta: participantTotalPoints,
              ridersScored,
            });
            totalPointsDelta += participantTotalPoints;
          }
        }

        // Update all participants' total points
        for (const [userId, data] of participantPoints.entries()) {
          const participantDoc = participantsSnapshot.docs.find(doc => doc.data().userId === userId);

          if (participantDoc && data.pointsDelta !== 0) {
            const currentTotal = participantDoc.data().totalPoints || 0;
            const newTotal = currentTotal + data.pointsDelta;

            await participantDoc.ref.update({
              totalPoints: newTotal,
            });

            console.log(`[CALCULATE_POINTS] Updated ${participantDoc.data().playername}: ${data.pointsDelta >= 0 ? '+' : ''}${data.pointsDelta} points (total: ${newTotal})`);

            results.participantsUpdated++;
            results.pointsAwarded += data.pointsDelta;
          }
        }

        // Update placeings for this game
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
      timestamp: Timestamp.now(),
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
 * Update placeings for all participants in a game based on total points
 */
async function updateGameRankings(db: FirebaseFirestore.Firestore, gameId: string): Promise<void> {
  console.log(`[UPDATE_RANKINGS] Updating placeings for game ${gameId}`);

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

  // Update placeing for each participant
  let currentRank = 1;
  let previousPoints = -1;
  let participantsWithSamePoints = 0;

  for (const participantDoc of participantsSnapshot.docs) {
    const participantData = participantDoc.data();
    const points = participantData.totalPoints || 0;

    // Handle tied placeings
    if (points === previousPoints) {
      participantsWithSamePoints++;
    } else {
      currentRank += participantsWithSamePoints;
      participantsWithSamePoints = 1;
      previousPoints = points;
    }

    // Only update if placeing changed
    if (participantData.placeing !== currentRank) {
      await participantDoc.ref.update({
        placeing: currentRank,
      });
      console.log(`[UPDATE_RANKINGS] ${participantData.playername}: place ${currentRank} (${points} points)`);
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
  // Handle single-day races where stage is 'result' instead of a number
  const isSingleDayRace = stage === 'result' || stage === 'Result';
  const isTourGC = stage === 'tour-gc';
  const stageNum = isSingleDayRace ? 1 : (typeof stage === 'string' ? parseInt(stage) : stage);
  const stageKey = isSingleDayRace ? 'result' : stage.toString();
  const stageResults: StageResult[] = stageData.stageResults || [];
  const generalClassification: ClassificationRider[] = stageData.generalClassification || [];

  console.log(`[SEASON_POINTS] isSingleDayRace: ${isSingleDayRace}, isTourGC: ${isTourGC}, stageKey: ${stageKey}, stageResults count: ${stageResults.length}, GC count: ${generalClassification.length}`);

  // Extract race name from slug (e.g., "tour-de-france_2025" -> "Tour de France")
  const raceName = raceSlug.replace(/_\d{4}$/, '').split('-').map((word: string) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  // Get multipliers for this stage (using same logic as main calculation)
  const totalStages = 21; // Default for Grand Tours
  
  // Check if this is one of the 3 Grand Tours
  const isGrandTour = raceSlug.includes('tour-de-france') || 
                     raceSlug.includes('giro-d-italia') || 
                     raceSlug.includes('vuelta-a-espana');
  
  const gcMultiplier = isTourGC ? 1 : 0;
  const pointsClassMultiplier = isTourGC ? 0 : getClassificationMultiplier('points', stageNum, totalStages);
  const mountainsClassMultiplier = isTourGC ? 0 : getClassificationMultiplier('mountains', stageNum, totalStages);
  const youthClassMultiplier = isTourGC ? 0 : getClassificationMultiplier('youth', stageNum, totalStages);

  console.log(`[SEASON_POINTS] isTourGC: ${isTourGC}, isGrandTour: ${isGrandTour}, gcMultiplier: ${gcMultiplier}`);

  // Type for rider points tracking
  interface RiderPointsEntry {
    nameID: string;
    name: string;
    finishPosition?: number;
    stageResult?: number;
    gcPoints?: number;
    pointsClass?: number;
    mountainsClass?: number;
    youthClass?: number;
    total: number;
  }

  // Track all riders who scored points
  const ridersWithPoints = new Map<string, RiderPointsEntry>();

  // Helper to get or create rider entry
  const getOrCreateRider = (nameID: string, name: string): RiderPointsEntry => {
    const existing = ridersWithPoints.get(nameID);
    if (existing) return existing;
    const newEntry: RiderPointsEntry = { nameID, name, total: 0 };
    ridersWithPoints.set(nameID, newEntry);
    return newEntry;
  };

  // 1. Process stage results (skip for tour GC)
  if (!isTourGC) {
    // Note: 'place' is the finish position, 'points' is the Pnt column from PCS (15, 10, 7, 4, 2, 1...)
    for (const riderResult of stageResults) {
      const finishPosition = riderResult.place || riderResult.place;
      // Use Pnt points directly from scraped data (the 'points' field)
      const pntPoints = typeof riderResult.points === 'number' ? riderResult.points :
                        (typeof riderResult.points === 'string' && riderResult.points !== '-' ? parseInt(riderResult.points) : 0);

      // Handle both nameID and shortName cases (some races have undefined nameID)
      const riderNameId = riderResult.nameID || riderResult.shortName?.toLowerCase().replace(/\s+/g, '-');
      const riderName = riderResult.shortName || riderResult.nameID || riderNameId;

      if (finishPosition && finishPosition > 0 && riderNameId && pntPoints > 0) {
        const entry = getOrCreateRider(riderNameId, riderName || '');
        entry.finishPosition = finishPosition;
        entry.stageResult = pntPoints;
        entry.total += pntPoints;
      }
    }
  }

  // 2. Process GC points (always for tour GC, otherwise only when multiplier > 0)
  if (gcMultiplier > 0 && generalClassification.length > 0) {
    console.log(`[SEASON_POINTS] Processing ${generalClassification.length} GC riders with multiplier ${gcMultiplier}`);
    
    for (const gcResult of generalClassification) {
      if (gcResult.place) {
        const gcNameId = gcResult.rider || gcResult.shortName?.toLowerCase().replace(/\s+/g, '-');
        const gcName = gcResult.shortName || gcResult.rider || gcNameId;
        
        console.log(`[SEASON_POINTS] Processing GC rider: ${gcName} (nameID: ${gcNameId}), Rank: ${gcResult.place}`);
        
        if (gcNameId) {
          // For Grand Tours, use TOP_20_POINTS system
          // For other tours, use direct PCS points from the "Pnt" column
          let gcPoints = 0;
          
          console.log(`[SEASON_POINTS] Debug - gcResult.points: ${gcResult.points}, typeof: ${typeof gcResult.points}`);
          
          if (isGrandTour) {
            gcPoints = calculateStagePoints(gcResult.place) * gcMultiplier;
          } else {
            // Use PCS points directly from scraped data
            gcPoints = (gcResult.points || 0) * gcMultiplier;
          }
          
          console.log(`[SEASON_POINTS] GC points for ${gcName}: ${gcPoints} (place ${gcResult.place}, isGrandTour: ${isGrandTour}, multiplier: ${gcMultiplier}, originalPoints: ${gcResult.points})`);
          
          if (gcPoints > 0) {
            const entry = getOrCreateRider(gcNameId, gcName);
            entry.gcPoints = gcPoints;
            entry.total += gcPoints;
            console.log(`[SEASON_POINTS] Added ${gcPoints} points to ${gcName}, total now: ${entry.total}`);
          }
        }
      }
    }
  }

  // 3. Process Points Classification (if applicable)
  if (pointsClassMultiplier > 0 && stageData.pointsClassification) {
    for (const pointsResult of stageData.pointsClassification) {
      if (pointsResult.place) {
        const pointsNameId = pointsResult.rider || pointsResult.shortName?.toLowerCase().replace(/\s+/g, '-');
        const pointsName = pointsResult.shortName || pointsResult.rider || pointsNameId;
        
        if (pointsNameId) {
          const pointsClassPoints = calculateStagePoints(pointsResult.place);
          if (pointsClassPoints > 0) {
            const entry = getOrCreateRider(pointsNameId, pointsName);
            entry.pointsClass = pointsClassPoints;
            entry.total += pointsClassPoints;
          }
        }
      }
    }
  }

  // 4. Process Mountains Classification (if applicable)
  if (mountainsClassMultiplier > 0 && stageData.mountainsClassification) {
    for (const mountainsResult of stageData.mountainsClassification) {
      if (mountainsResult.place) {
        const mountainsNameId = mountainsResult.rider || mountainsResult.shortName?.toLowerCase().replace(/\s+/g, '-');
        const mountainsName = mountainsResult.shortName || mountainsResult.rider || mountainsNameId;
        
        if (mountainsNameId) {
          const mountainsClassPoints = calculateStagePoints(mountainsResult.place);
          if (mountainsClassPoints > 0) {
            const entry = getOrCreateRider(mountainsNameId, mountainsName);
            entry.mountainsClass = mountainsClassPoints;
            entry.total += mountainsClassPoints;
          }
        }
      }
    }
  }

  // 5. Process Youth Classification (if applicable)
  if (youthClassMultiplier > 0 && stageData.youthClassification) {
    for (const youthResult of stageData.youthClassification) {
      if (youthResult.place) {
        const youthNameId = youthResult.rider || youthResult.shortName?.toLowerCase().replace(/\s+/g, '-');
        const youthName = youthResult.shortName || youthResult.rider || youthNameId;
        
        if (youthNameId) {
          const youthClassPoints = calculateStagePoints(youthResult.place);
          if (youthClassPoints > 0) {
            const entry = getOrCreateRider(youthNameId, youthName);
            entry.youthClass = youthClassPoints;
            entry.total += youthClassPoints;
          }
        }
      }
    }
  }

  console.log(`[SEASON_POINTS] Found ${ridersWithPoints.size} riders with points`);
  
  // Debug: Show all riders with points
  if (ridersWithPoints.size === 0) {
    console.log(`[SEASON_POINTS] No riders found with points. Debug info:`);
    console.log(`[SEASON_POINTS] - isTourGC: ${isTourGC}`);
    console.log(`[SEASON_POINTS] - gcMultiplier: ${gcMultiplier}`);
    console.log(`[SEASON_POINTS] - generalClassification.length: ${generalClassification.length}`);
    
    if (generalClassification.length > 0) {
      console.log(`[SEASON_POINTS] First 3 GC riders:`);
      generalClassification.slice(0, 3).forEach((rider, i) => {
        console.log(`[SEASON_POINTS]   ${i + 1}. ${rider.shortName || rider.rider} (place: ${rider.place}, rider: ${rider.rider})`);
      });
    }
  } else {
    console.log(`[SEASON_POINTS] Riders with points:`);
    ridersWithPoints.forEach((entry, nameID) => {
      console.log(`[SEASON_POINTS] - ${entry.name}: ${entry.total} points (GC: ${entry.gcPoints})`);
    });
  }

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

        // Add this stage's points (stageKey is already defined above)
        // Filter out undefined values to avoid Firestore errors
        const stagePointsData: Record<string, number> = { total: pointsData.total };
        if (pointsData.finishPosition !== undefined) stagePointsData.finishPosition = pointsData.finishPosition;
        if (pointsData.stageResult !== undefined) stagePointsData.stageResult = pointsData.stageResult;
        if (pointsData.gcPoints !== undefined) stagePointsData.gcPoints = pointsData.gcPoints;
        if (pointsData.pointsClass !== undefined) stagePointsData.pointsClass = pointsData.pointsClass;
        if (pointsData.mountainsClass !== undefined) stagePointsData.mountainsClass = pointsData.mountainsClass;
        if (pointsData.youthClass !== undefined) stagePointsData.youthClass = pointsData.youthClass;

        raceData.stages[stageKey] = stagePointsData;

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
        // Filter out undefined values to avoid Firestore errors
        const newStagePointsData: Record<string, number> = { total: pointsData.total };
        if (pointsData.finishPosition !== undefined) newStagePointsData.finishPosition = pointsData.finishPosition;
        if (pointsData.stageResult !== undefined) newStagePointsData.stageResult = pointsData.stageResult;
        if (pointsData.gcPoints !== undefined) newStagePointsData.gcPoints = pointsData.gcPoints;
        if (pointsData.pointsClass !== undefined) newStagePointsData.pointsClass = pointsData.pointsClass;
        if (pointsData.mountainsClass !== undefined) newStagePointsData.mountainsClass = pointsData.mountainsClass;
        if (pointsData.youthClass !== undefined) newStagePointsData.youthClass = pointsData.youthClass;

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
                [stageKey]: newStagePointsData,
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
      const placeingDoc = await db.collection(`placeings_${yearNum}`).doc(riderNameId).get();
      if (placeingDoc.exists) {
        const data = placeingDoc.data();
        return data?.points || 0;
      }
      return 0;
    } catch (error) {
      console.error(`[MARGINAL_GAINS_UPDATE] Error fetching placeing for ${riderNameId}:`, error);
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

      // Update placeings for this game
      const placeedParticipants = await db.collection('gameParticipants')
        .where('gameId', '==', game.id)
        .where('status', '==', 'active')
        .orderBy('totalPoints', 'desc')
        .get();

      let placeing = 1;
      for (const participantDoc of placeedParticipants.docs) {
        await participantDoc.ref.update({ placeing });
        placeing++;
      }

      console.log(`[MARGINAL_GAINS_UPDATE] Updated game ${game.name}`);

    } catch (error) {
      console.error(`[MARGINAL_GAINS_UPDATE] Error processing game ${gameDoc.id}:`, error);
    }
  }

  console.log(`[MARGINAL_GAINS_UPDATE] Marginal Gains games update complete`);
}
