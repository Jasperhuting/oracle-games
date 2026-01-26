import { getServerFirebase } from '@/lib/firebase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  calculateStagePoints,
  shouldCountForPoints
} from '@/lib/utils/pointsCalculation';
import { AuctioneerConfig } from '@/lib/types/games';
import * as fs from 'fs';
import * as path from 'path';

interface StageResult {
  nameID?: string;
  shortName?: string;
  rank?: number;
  place?: number;
  points?: number | string;
  uciPoints?: string;
  time?: string;
  gap?: string;
  name?: string;
}

interface GameConfig {
  gameId: string;
  gameName: string;
  gameType: string;
  raceType: string;
  isSeasonGame: boolean;
  countingRaces: AuctioneerConfig['countingRaces'];
  status: string;
}

interface PlayerTeamUpdate {
  playerTeamId: string;
  gameId: string;
  gameName: string;
  userId: string;
  riderNameId: string;
  riderName: string;
  currentTotalPoints: number;
  currentPointsBreakdown: unknown[];
  wouldEarnPoints: number;
  newTotalPoints: number;
  breakdown: {
    raceSlug: string;
    stage: string;
    stagePosition?: number;
    stageResult?: number;
    gcPosition?: number;
    gcPoints?: number;
    total: number;
  };
  raceCountsForGame: boolean;
  skipReason?: string;
}

/**
 * DRY RUN: Calculate points without making any database changes
 * Simplified flow: directly query playerTeams by riderNameId
 */
export async function POST(request: NextRequest) {
  try {
    const { raceSlug, stage, year } = await request.json();

    if (!raceSlug || stage === undefined || !year) {
      return NextResponse.json(
        { error: 'raceSlug, stage, and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    const raceName = raceSlug.replace(/_\d{4}$/, '');

    console.log(`[DRY_RUN] Starting dry run for ${raceSlug} stage ${stage}`);

    // Build doc ID for scraper data
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

    // Fetch scraper data
    const stageDoc = await db.collection('scraper-data').doc(docId).get();

    if (!stageDoc.exists) {
      return NextResponse.json(
        { error: `Scraper data not found: ${docId}` },
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

    // Parse stage results
    const stageResults: StageResult[] = stageData.stageResults ?
      (typeof stageData.stageResults === 'string' ?
        JSON.parse(stageData.stageResults) : stageData.stageResults) : [];

    console.log(`[DRY_RUN] Found ${stageResults.length} riders in stage results`);

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

    // Collect all rider nameIDs from results
    const riderNameIds = new Set<string>();
    for (const result of stageResults) {
      const nameId = result.nameID || result.shortName?.toLowerCase().replace(/\s+/g, '-');
      if (nameId && nameId !== '-') {
        riderNameIds.add(nameId);
      }
    }

    console.log(`[DRY_RUN] Found ${riderNameIds.size} unique riders in results`);

    // Track all playerTeam updates
    const playerTeamUpdates: PlayerTeamUpdate[] = [];

    // For each rider in the results, find their playerTeams
    for (const riderNameId of riderNameIds) {
      // Find the rider's result
      const riderResult = stageResults.find(r =>
        r.nameID === riderNameId ||
        r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
      );

      if (!riderResult || !riderResult.place) continue;

      // Calculate points for this rider
      const finishPosition = riderResult.place;
      const pcsPoints = typeof riderResult.points === 'number' ? riderResult.points :
        (typeof riderResult.points === 'string' && riderResult.points !== '-' ?
          parseInt(riderResult.points) : 0);

      // Find all playerTeams with this rider
      const playerTeamsSnapshot = await db.collection('playerTeams')
        .where('riderNameId', '==', riderNameId)
        .get();

      for (const teamDoc of playerTeamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const gameId = teamData.gameId;

        // Get game config
        const gameConfig = await getGameConfig(gameId);

        if (!gameConfig) {
          playerTeamUpdates.push({
            playerTeamId: teamDoc.id,
            gameId,
            gameName: 'Unknown (game not found)',
            userId: teamData.userId,
            riderNameId,
            riderName: teamData.riderName || riderNameId,
            currentTotalPoints: teamData.totalPoints || 0,
            currentPointsBreakdown: teamData.pointsBreakdown || [],
            wouldEarnPoints: 0,
            newTotalPoints: teamData.totalPoints || 0,
            breakdown: { raceSlug: raceName, stage: stage.toString(), total: 0 },
            raceCountsForGame: false,
            skipReason: 'Game not found',
          });
          continue;
        }

        const raceCountsForGame = doesRaceCount(gameConfig);

        // Calculate points based on game type
        let stagePoints = 0;
        if (raceCountsForGame) {
          if (gameConfig.isSeasonGame) {
            // Season games use PCS points directly
            stagePoints = pcsPoints;
          } else {
            // Other games use TOP_20_POINTS system
            stagePoints = calculateStagePoints(finishPosition);
          }
        }

        // Calculate new total
        const existingBreakdown = teamData.pointsBreakdown || [];
        const otherPoints = existingBreakdown
          .filter((e: { raceSlug: string; stage: string }) =>
            !(e.raceSlug === raceName && e.stage === stage.toString()))
          .reduce((sum: number, e: { total: number }) => sum + (e.total || 0), 0);
        const newTotalPoints = otherPoints + stagePoints;

        playerTeamUpdates.push({
          playerTeamId: teamDoc.id,
          gameId,
          gameName: gameConfig.gameName,
          userId: teamData.userId,
          riderNameId,
          riderName: teamData.riderName || riderNameId,
          currentTotalPoints: teamData.totalPoints || 0,
          currentPointsBreakdown: existingBreakdown,
          wouldEarnPoints: stagePoints,
          newTotalPoints,
          breakdown: {
            raceSlug: raceName,
            stage: stage.toString(),
            stagePosition: finishPosition,
            stageResult: stagePoints,
            total: stagePoints,
          },
          raceCountsForGame,
          skipReason: raceCountsForGame ? undefined :
            `Race does not count for ${gameConfig.gameName} (${gameConfig.raceType})`,
        });
      }
    }

    // Summary
    const summary = {
      scraperDataDoc: docId,
      raceSlug,
      raceName,
      stage,
      year,
      stageResultsCount: stageResults.length,
      uniqueRidersInResults: riderNameIds.size,
      playerTeamsFound: playerTeamUpdates.length,
      playerTeamsWouldUpdate: playerTeamUpdates.filter(u => u.raceCountsForGame && u.wouldEarnPoints > 0).length,
      playerTeamsSkipped: playerTeamUpdates.filter(u => !u.raceCountsForGame).length,
      totalPointsWouldBeAwarded: playerTeamUpdates
        .filter(u => u.raceCountsForGame)
        .reduce((sum, u) => sum + u.wouldEarnPoints, 0),
      gamesInvolved: [...new Set(playerTeamUpdates.map(u => u.gameName))],
    };

    // Sample of stage results
    const stageResultsSample = stageResults.slice(0, 10).map(r => ({
      nameID: r.nameID,
      shortName: r.shortName,
      place: r.place,
      points: r.points,
    }));

    const result = {
      success: true,
      dryRun: true,
      message: 'This is a DRY RUN - no database changes were made',
      summary,
      stageResultsSample,
      playerTeamUpdates: playerTeamUpdates.filter(u => u.raceCountsForGame),
      skippedPlayerTeams: playerTeamUpdates.filter(u => !u.raceCountsForGame),
    };

    // Write results to file
    const outputDir = path.join(process.cwd(), 'app/api/games/calculate-points-dry-run');
    const outputFile = path.join(outputDir, `dry-run-${raceName}-${stage}-${year}.json`);

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`[DRY_RUN] Results written to: ${outputFile}`);

    return NextResponse.json({
      ...result,
      outputFile: `app/api/games/calculate-points-dry-run/dry-run-${raceName}-${stage}-${year}.json`,
    });

  } catch (error) {
    console.error('[DRY_RUN] Error:', error);
    return NextResponse.json(
      { error: 'Dry run failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
