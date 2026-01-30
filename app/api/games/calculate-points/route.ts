import { getServerFirebase } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { PointsEvent } from '@/lib/types';
import {
  calculateStagePoints,
  getGCMultiplier,
  getClassificationMultiplier,
  shouldCountForPoints
} from '@/lib/utils/pointsCalculation';
import { AuctioneerConfig } from '@/lib/types/games';
import { ClassificationRider } from '@/lib/scraper/types';
import { scrapeRidersWithPoints } from '@/lib/firebase/rider-points-service';
import { validateStageResult, generateDataHash } from '@/lib/validation/scraper-validation';
import { sendAdminNotification, isNotificationsEnabled } from '@/lib/email/admin-notifications';

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

interface GameConfig {
  gameId: string;
  gameName: string;
  gameType: string;
  raceType: string;
  isSeasonGame: boolean;
  countingRaces: AuctioneerConfig['countingRaces'];
  status: string;
  config?: AuctioneerConfig;
}

/**
 * Calculate and award points to players in Auctioneer games after a stage result is saved
 * This endpoint is called automatically after saveStageResult
 */
export async function POST(request: NextRequest) {
  try {
    const { raceSlug, stage, year, force = false } = await request.json();

    if (raceSlug === undefined || raceSlug === null || raceSlug === '' ||
        stage === undefined || stage === null ||
        year === undefined || year === null || year === '') {
      return NextResponse.json(
        { error: 'raceSlug, stage, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Extract race name without year suffix for doc ID lookup
    // raceSlug can be 'tour-down-under_2026' or 'tour-down-under'
    const raceName = raceSlug.replace(/_\d{4}$/, '');
    
    // Convert year to number for consistency
    const yearNum = typeof year === 'string' ? parseInt(year) : year;

    console.log(`[CALCULATE_POINTS] Starting points calculation for ${raceSlug} (raceName: ${raceName}) ${stage === 'tour-gc' ? 'tour GC' : `stage ${stage}`}`);

    // Fetch the stage result from scraper-data collection
    // For single-day races, stage will be 'result', for multi-stage races it will be a number
    // For prologue (stage 0), use 'prologue' instead of 'stage-0'
    // For tour GC, use 'tour-gc'
    // Note: doc IDs use raceName (without year suffix) + year, e.g., 'tour-down-under-2026-prologue'
    let docId: string;
    if (stage === 'result') {
      docId = `${raceName}-${year}-result`;
    } else if (stage === 'tour-gc') {
      docId = `${raceName}-${year}-tour-gc`;
    } else if (stage === 0) {
      docId = `${raceName}-${year}-prologue`;
    } else {
      docId = `${raceName}-${year}-stage-${stage}`;
    }
    
    const stageDocRef = db.collection('scraper-data').doc(docId);
    
    // Check if this stage was already processed to prevent duplicate points
    const existingStageDoc = await stageDocRef.get();
    if (existingStageDoc.exists) {
      const existingData = existingStageDoc.data();
      const lastUpdated = existingData?.updatedAt;
      const lastUpdatedTime = lastUpdated ? new Date(lastUpdated).getTime() : 0;
      const currentTime = new Date().getTime();
      
      // Only process if data was updated more than 5 minutes ago, or if we're in development
      const timeDiffMinutes = (currentTime - lastUpdatedTime) / (1000 * 60);
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (timeDiffMinutes < 5 && !isDevelopment) {
        console.log(`[CALCULATE_POINTS] Stage ${docId} was recently processed (${Math.round(timeDiffMinutes)} minutes ago). Skipping to prevent duplicate points.`);
        return NextResponse.json({
          success: true,
          message: 'Stage recently processed, skipping to prevent duplicates',
          skipped: true,
        });
      }
    }
    
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

    // Track start time for duration logging
    const startTime = Date.now();

    // Generate hash for idempotency check
    const inputDataHash = generateDataHash(stageData as any);

    // Check for existing calculation with same hash (idempotency)
    const existingCalcSnapshot = await db.collection('pointsCalculationLogs')
      .where('raceSlug', '==', raceName)
      .where('stage', '==', stage)
      .where('year', '==', yearNum)
      .where('inputDataHash', '==', inputDataHash)
      .where('status', '==', 'success')
      .limit(1)
      .get();

    if (!existingCalcSnapshot.empty && !force) {
      const existingCalc = existingCalcSnapshot.docs[0].data();
      console.log(`[CALCULATE_POINTS] Idempotency check: Already processed with same data hash ${inputDataHash}`);
      return NextResponse.json({
        success: true,
        message: 'Points already calculated for this exact data',
        skipped: true,
        idempotent: true,
        previousCalculation: {
          calculatedAt: existingCalc.calculatedAt,
          totalPointsAwarded: existingCalc.totalPointsAwarded,
          gamesAffected: existingCalc.gamesAffected?.length || 0,
        },
      });
    }

    if (force && !existingCalcSnapshot.empty) {
      console.log(`[CALCULATE_POINTS] Force mode: bypassing idempotency check for hash ${inputDataHash}`);
    }

    // Validate stage data before calculation
    const validationResult = validateStageResult(stageData as any);

    if (!validationResult.valid) {
      console.error(`[CALCULATE_POINTS] Validation failed for ${docId}:`, validationResult.errors);

      // Log the failed calculation attempt
      await db.collection('pointsCalculationLogs').add({
        raceSlug: raceName,
        stage,
        year: yearNum,
        calculatedAt: new Date(),
        inputDataHash,
        gamesAffected: [],
        totalPointsAwarded: 0,
        status: 'failed',
        errors: validationResult.errors.map(e => e.message),
        validationResult: {
          valid: false,
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
        },
        duration: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          error: 'Stage data validation failed',
          validationErrors: validationResult.errors,
          validationWarnings: validationResult.warnings,
        },
        { status: 400 }
      );
    }

    // Log validation warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn(`[CALCULATE_POINTS] Validation warnings for ${docId}:`, validationResult.warnings);
    }

    const stageResults: StageResult[] = stageData.stageResults ? 
      (typeof stageData.stageResults === 'string' ? 
        (() => {
          try {
            return JSON.parse(stageData.stageResults);
          } catch (e) {
            console.error(`[CALCULATE_POINTS] Error parsing stageResults: ${e instanceof Error ? e.message : String(e)}`);
            console.error(`[CALCULATE_POINTS] Raw stageResults:`, stageData.stageResults.substring(0, 200));
            return [];
          }
        })() : 
        stageData.stageResults
      ) : [];
    const generalClassification: ClassificationRider[] = stageData.generalClassification ? 
      (typeof stageData.generalClassification === 'string' ? 
        (() => {
          try {
            return JSON.parse(stageData.generalClassification);
          } catch (e) {
            console.error(`[CALCULATE_POINTS] Error parsing generalClassification: ${e instanceof Error ? e.message : String(e)}`);
            return [];
          }
        })() : 
        stageData.generalClassification
      ) : [];

    console.log(`[CALCULATE_POINTS] Found ${stageResults.length} riders in stage results`);
    console.log(`[CALCULATE_POINTS] Found 55 riders in general classification`);
    
    // Debug: Check first few riders and data structure
    console.log(`[CALCULATE_POINTS] Raw stageResults type: ${typeof stageData.stageResults}`);
    console.log(`[CALCULATE_POINTS] Parsed stageResults type: ${Array.isArray(stageResults) ? 'array' : typeof stageResults}`);
    if (stageResults.length > 0) {
      console.log(`[CALCULATE_POINTS] First rider structure:`, stageResults[0]);
      console.log(`[CALCULATE_POINTS] First 3 riders:`, stageResults.slice(0, 3).map(r => ({
        shortName: r.shortName,
        place: r.place,
        points: r.points
      })));
    }

    // ================================================================
    // SIMPLIFIED FLOW: Query playerTeams directly by riderNameId
    // Instead of: games → participants → playerTeams → find rider
    // Now: riders → playerTeams → check if game counts → update
    // ================================================================

    // Cache for game configs (to avoid repeated lookups)
    const gameConfigCache = new Map<string, GameConfig>();

    // Helper to get game config (with caching)
    const getGameConfig = async (gameId: string): Promise<GameConfig | null> => {
      if (gameConfigCache.has(gameId)) {
        return gameConfigCache.get(gameId)!;
      }

      const gameDoc = await db.collection('games').doc(gameId).get();
      if (!gameDoc.exists) {
        return null;
      }

      const gameData = gameDoc.data()!;
      const config: GameConfig = {
        gameId,
        gameName: gameData.name || 'Unknown',
        gameType: gameData.gameType || 'unknown',
        raceType: gameData.raceType || 'unknown',
        isSeasonGame: gameData.raceType === 'season',
        countingRaces: (gameData.config as AuctioneerConfig)?.countingRaces || [],
        status: gameData.status || 'unknown',
        config: gameData.config as AuctioneerConfig,
      };

      gameConfigCache.set(gameId, config);
      return config;
    };

    // Helper to check if race counts for a game
    const doesRaceCount = (gameConfig: GameConfig): boolean => {
      // Only process active/bidding games
      if (!['active', 'bidding'].includes(gameConfig.status)) {
        return false;
      }
      // Season games count all races
      if (gameConfig.isSeasonGame) {
        return true;
      }
      // Check if race is in countingRaces
      return shouldCountForPoints(raceSlug, stage, gameConfig.countingRaces);
    };

    // Helper to get multipliers for a game
    const getMultipliers = (gameConfig: GameConfig) => {
      const config = gameConfig.config;
      const raceConfig = config?.countingRaces?.find(cr => {
        if (typeof cr === 'string') {
          return raceSlug === cr || raceSlug.includes(cr.replace(/_\d{4}$/, '')) || cr.includes(raceSlug.replace(/_\d{4}$/, ''));
        }
        return raceSlug.includes(cr.raceSlug) || raceSlug === cr.raceId;
      });
      const raceConfigObj = typeof raceConfig === 'string' ? null : raceConfig;
      const restDays = raceConfigObj?.restDays || [];
      const totalStages = 21; // Default for Grand Tours
      const stageNum = typeof stage === 'string' ? parseInt(stage) : stage;
      const isTourGC = stage === 'tour-gc';

      return {
        gcMultiplier: isTourGC ? 1 : getGCMultiplier(stageNum, totalStages, restDays),
        pointsClassMultiplier: isTourGC ? 0 : getClassificationMultiplier('points', stageNum, totalStages),
        mountainsClassMultiplier: isTourGC ? 0 : getClassificationMultiplier('mountains', stageNum, totalStages),
        youthClassMultiplier: isTourGC ? 0 : getClassificationMultiplier('youth', stageNum, totalStages),
        isTourGC,
        stageNum,
        totalStages,
      };
    };

    // Collect all rider nameIDs from results
    // Handle both regular stage results and TTT (Team Time Trial) results
    const riderNameIds = new Set<string>();
    const tttRiderPointsMap = new Map<string, { points: string; place: number }>(); // For TTT: nameId -> points
    
    for (const result of stageResults) {
      // Check if this is a TTT result (has 'riders' array)
      if ('riders' in result && Array.isArray(result.riders)) {
        // TTT result - extract riders from team
        const teamPlace = result.place || 0;
        for (const rider of result.riders) {
          const nameId = rider.shortName?.toLowerCase().replace(/\s+/g, '-');
          if (nameId && nameId !== '-') {
            riderNameIds.add(nameId);
            // Store the rider's points and team place for later use
            tttRiderPointsMap.set(nameId, { 
              points: rider.points || '-', 
              place: teamPlace 
            });
          }
        }
      } else {
        // Regular stage result
        const nameId = result.nameID || result.shortName?.toLowerCase().replace(/\s+/g, '-');
        if (nameId && nameId !== '-') {
          riderNameIds.add(nameId);
        }
      }
    }
    // Also collect from GC if available
    for (const result of generalClassification) {
      // ClassificationRider uses 'rider' and 'shortName' instead of 'nameID'
      const nameId = result.rider || result.shortName?.toLowerCase().replace(/\s+/g, '-');
      if (nameId && nameId !== '-') {
        riderNameIds.add(nameId);
      }
    }

    console.log(`[CALCULATE_POINTS] Found ${riderNameIds.size} unique riders in results`);

    const results = {
      gamesProcessed: 0,
      playerTeamsUpdated: 0,
      pointsAwarded: 0,
      errors: [] as string[],
    };

    // Track which games were affected
    const gamesAffected = new Set<string>();

    // For each rider in the results, find their playerTeams
    for (const riderNameId of riderNameIds) {
      try {
        // Find the rider's result in stage results
        // For TTT results, use the pre-computed tttRiderPointsMap
        let riderResult: StageResult | undefined;
        const tttData = tttRiderPointsMap.get(riderNameId);
        
        if (tttData) {
          // TTT rider - create a synthetic StageResult from TTT data
          riderResult = {
            nameID: riderNameId,
            shortName: riderNameId,
            place: tttData.place,
            points: tttData.points,
          };
        } else {
          // Regular stage result
          riderResult = stageResults.find(r =>
            r.nameID === riderNameId ||
            r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
          ) as StageResult | undefined;
        }

        // Find the rider's GC position (ClassificationRider uses 'rider' not 'nameID')
        const gcResult = generalClassification.find(r =>
          r.rider === riderNameId ||
          r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
        );

        // Find all playerTeams with this rider
        const playerTeamsSnapshot = await db.collection('playerTeams')
          .where('riderNameId', '==', riderNameId)
          .get();

        if (playerTeamsSnapshot.empty) {
          continue; // No teams have this rider
        }

        for (const teamDoc of playerTeamsSnapshot.docs) {
          const teamData = teamDoc.data();
          const gameId = teamData.gameId;

          // Get game config (cached)
          const gameConfig = await getGameConfig(gameId);

          if (!gameConfig) {
            console.log(`[CALCULATE_POINTS] Game ${gameId} not found for rider ${riderNameId}`);
            continue;
          }

          // Check if race counts for this game
          if (!doesRaceCount(gameConfig)) {
            continue;
          }

          gamesAffected.add(gameId);

          // Get multipliers for this game
          const multipliers = getMultipliers(gameConfig);
          const useDirectPcsPoints = gameConfig.isSeasonGame;

          // Track detailed points breakdown for this stage
          const stagePointsBreakdown: Record<string, number> = {};
          let riderTotalPoints = 0;

          // For tour GC, only check general classification - always use PCS points
          if (multipliers.isTourGC) {
            if (multipliers.gcMultiplier > 0 && gcResult && gcResult.place) {
              // Always use PCS points for tour GC
              const pcsPoints = typeof gcResult.points === 'number' ? gcResult.points :
                (typeof gcResult.points === 'string' && gcResult.points !== '-' ? parseInt(gcResult.points as string) : 0);
              const gcPoints = pcsPoints > 0 ? pcsPoints : calculateStagePoints(gcResult.place) * multipliers.gcMultiplier;

              if (gcPoints > 0) {
                riderTotalPoints += gcPoints;
                stagePointsBreakdown.gcPoints = gcPoints;
                stagePointsBreakdown.gcPosition = gcResult.place;
                console.log(`[CALCULATE_POINTS] ${teamData.riderName} (${gameConfig.gameName}) - GC: ${gcPoints} pts (place ${gcResult.place}, pcsPoints: ${gcResult.points})`);
              }
            }
          } else {
            // 1. STAGE RESULT POINTS
            const finishPosition = riderResult?.place;
            if (riderResult && finishPosition) {
              let stagePoints: number;

              if (useDirectPcsPoints) {
                const pcsPoints = typeof riderResult.points === 'number' ? riderResult.points :
                  (typeof riderResult.points === 'string' && riderResult.points !== '-' ? parseInt(riderResult.points) : 0);
                stagePoints = pcsPoints;
              } else {
                stagePoints = calculateStagePoints(finishPosition);
              }

              if (stagePoints > 0) {
                riderTotalPoints += stagePoints;
                stagePointsBreakdown.stageResult = stagePoints;
                stagePointsBreakdown.stagePosition = finishPosition;
                console.log(`[CALCULATE_POINTS] ${teamData.riderName} (${gameConfig.gameName}) - Stage: ${stagePoints} pts (place ${finishPosition})`);
              }
            }

            // 2. GENERAL CLASSIFICATION POINTS
            if (multipliers.gcMultiplier > 0 && gcResult && gcResult.place) {
              const gcPoints = calculateStagePoints(gcResult.place) * multipliers.gcMultiplier;
              if (gcPoints > 0) {
                riderTotalPoints += gcPoints;
                stagePointsBreakdown.gcPoints = gcPoints;
                stagePointsBreakdown.gcPosition = gcResult.place;
                console.log(`[CALCULATE_POINTS] ${teamData.riderName} (${gameConfig.gameName}) - GC: ${gcPoints} pts (place ${gcResult.place})`);
              }
            }

            // 3. POINTS CLASSIFICATION (only at final stage)
            if (multipliers.pointsClassMultiplier > 0 && stageData.pointsClassification) {
              const pointsResult = stageData.pointsClassification.find((r: StageResult) =>
                r.nameID === riderNameId ||
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (pointsResult && pointsResult.place) {
                const pointsClassPoints = calculateStagePoints(pointsResult.place);
                if (pointsClassPoints > 0) {
                  riderTotalPoints += pointsClassPoints;
                  stagePointsBreakdown.pointsClass = pointsClassPoints;
                }
              }
            }

            // 4. MOUNTAINS CLASSIFICATION (only at final stage)
            if (multipliers.mountainsClassMultiplier > 0 && stageData.mountainsClassification) {
              const mountainsResult = stageData.mountainsClassification.find((r: StageResult) =>
                r.nameID === riderNameId ||
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (mountainsResult && mountainsResult.place) {
                const mountainsClassPoints = calculateStagePoints(mountainsResult.place);
                if (mountainsClassPoints > 0) {
                  riderTotalPoints += mountainsClassPoints;
                  stagePointsBreakdown.mountainsClass = mountainsClassPoints;
                }
              }
            }

            // 5. YOUTH CLASSIFICATION (only at final stage)
            if (multipliers.youthClassMultiplier > 0 && stageData.youthClassification) {
              const youthResult = stageData.youthClassification.find((r: StageResult) =>
                r.nameID === riderNameId ||
                r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
              );
              if (youthResult && youthResult.place) {
                const youthClassPoints = calculateStagePoints(youthResult.place);
                if (youthClassPoints > 0) {
                  riderTotalPoints += youthClassPoints;
                  stagePointsBreakdown.youthClass = youthClassPoints;
                }
              }
            }
          }

          // Update PlayerTeam if rider scored any points
          if (riderTotalPoints > 0) {
            // Build pointsBreakdown entry
            const existingBreakdown: PointsEvent[] = Array.isArray(teamData.pointsBreakdown)
              ? teamData.pointsBreakdown
              : [];

            const newPointsEvent: PointsEvent = {
              raceSlug: raceName,
              stage: stage.toString(),
              total: riderTotalPoints,
              calculatedAt: new Date().toISOString(),
            };

            // Add optional breakdown fields
            if (stagePointsBreakdown.stageResult) newPointsEvent.stageResult = stagePointsBreakdown.stageResult;
            if (stagePointsBreakdown.stagePosition) newPointsEvent.stagePosition = stagePointsBreakdown.stagePosition;
            if (stagePointsBreakdown.gcPoints) newPointsEvent.gcPoints = stagePointsBreakdown.gcPoints;
            if (stagePointsBreakdown.gcPosition) newPointsEvent.gcPosition = stagePointsBreakdown.gcPosition;
            if (stagePointsBreakdown.pointsClass) newPointsEvent.pointsClass = stagePointsBreakdown.pointsClass;
            if (stagePointsBreakdown.mountainsClass) newPointsEvent.mountainsClass = stagePointsBreakdown.mountainsClass;
            if (stagePointsBreakdown.youthClass) newPointsEvent.youthClass = stagePointsBreakdown.youthClass;

            // Remove existing entry for this race/stage (prevents duplicates on re-scrape)
            const updatedBreakdown = existingBreakdown.filter(
              (event) => !(event.raceSlug === raceName && event.stage === stage.toString())
            );
            updatedBreakdown.push(newPointsEvent);

            // Calculate pointsScored from pointsBreakdown (source of truth)
            const calculatedPoints = updatedBreakdown.reduce(
              (sum, event) => sum + (event.total || 0),
              0
            );

            // Update PlayerTeam with only the essential fields
            await teamDoc.ref.update({
              pointsScored: calculatedPoints,
              pointsBreakdown: updatedBreakdown,
            });

            results.playerTeamsUpdated++;
            results.pointsAwarded += riderTotalPoints;

            console.log(`[CALCULATE_POINTS] ${teamData.riderName} (${gameConfig.gameName}) - Updated: ${riderTotalPoints} pts (new total: ${calculatedPoints})`);
          }
        }
      } catch (error) {
        const errorMsg = `Error processing rider ${riderNameId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    results.gamesProcessed = gamesAffected.size;
    console.log(`[CALCULATE_POINTS] Completed: ${results.gamesProcessed} games, ${results.playerTeamsUpdated} playerTeams, ${results.pointsAwarded} points awarded`);

    // Log successful calculation to pointsCalculationLogs
    const gamesAffectedIds = [...gamesAffected];

    await db.collection('pointsCalculationLogs').add({
      raceSlug: raceName,
      stage,
      year: yearNum,
      calculatedAt: new Date(),
      inputDataHash,
      gamesAffected: gamesAffectedIds,
      totalPointsAwarded: results.pointsAwarded,
      status: results.errors.length > 0 ? 'partial' : 'success',
      errors: results.errors,
      validationResult: {
        valid: validationResult.valid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
      },
      duration: Date.now() - startTime,
    });

    await db.collection('scoreUpdates').add({
      year: yearNum,
      raceSlug: raceName,
      stage: stage.toString(),
      calculatedAt: new Date().toISOString(),
      createdAt: Timestamp.now(),
      totalPointsAwarded: results.pointsAwarded,
      gamesAffected: gamesAffectedIds,
    });



    // Trigger rider scraping for detailed points data
    console.log(`[CALCULATE_POINTS] Triggering rider scraping for detailed points data`);
    try {
      // Run this in the background to avoid blocking the response
      const yearNum = typeof year === 'string' ? parseInt(year) : year;
      scrapeRidersWithPoints(yearNum).catch(error => {
        console.error('[CALCULATE_POINTS] Background rider scraping error:', error);
      });
    } catch (error) {
      console.error('[CALCULATE_POINTS] Error triggering rider scraping:', error);
      // Don't fail the whole request if rider scraping fails
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

    // Send admin notification for calculation error
    if (isNotificationsEnabled()) {
      try {
        // Extract race/year/stage from request body if possible
        let race = 'unknown';
        let year = 0;
        let stage: number | string | undefined;
        try {
          const body = await request.clone().json();
          race = body.raceSlug || 'unknown';
          year = body.year || 0;
          stage = body.stage;
        } catch {
          // Ignore JSON parse errors
        }

        await sendAdminNotification('calculation_error', {
          race,
          year,
          stage,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } catch (notifyError) {
        console.error('[CALCULATE_POINTS] Failed to send admin notification:', notifyError);
      }
    }

    return NextResponse.json(
      { error: 'Failed to calculate points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


