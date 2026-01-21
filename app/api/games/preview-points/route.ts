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
  place?: number;
  points?: number | string;
  uciPoints?: string;
  time?: string;
  gap?: string;
}

/**
 * Preview points calculation without saving to database
 * This allows users to see who will get how many points before committing
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

    console.log(`[PREVIEW_POINTS] Previewing points calculation for ${raceSlug} stage ${stage}`);

    // Fetch the stage result from scraper-data collection
    // For single-day races, stage will be 'result', for multi-stage races it will be a number
    // For prologue (stage 0), use 'prologue' instead of 'stage-0'
    let docId: string;
    if (stage === 'result') {
      docId = `${raceSlug}-${year}-result`;
    } else if (stage === 0) {
      docId = `${raceSlug}-${year}-prologue`;
    } else {
      docId = `${raceSlug}-${year}-stage-${stage}`;
    }
    
    console.log(`[PREVIEW_POINTS] Looking for document: ${docId}`);
    
    const scraperDocRef = db.collection('scraper-data').doc(docId);
    const scraperDoc = await scraperDocRef.get();

    if (!scraperDoc.exists) {
      return NextResponse.json(
        { error: `No stage result found for ${raceSlug} ${year} stage ${stage}` },
        { status: 404 }
      );
    }

    const stageData = scraperDoc.data();
    const stageResults = stageData?.stageResults || [];

    // Fetch all active games (both auctioneer and seasonal)
    const gamesSnapshot = await db
      .collection('games')
      .where('status', 'in', ['active', 'bidding'])
      .get();

    console.log(`[PREVIEW_POINTS] Found ${gamesSnapshot.size} active/bidding games`);

    if (gamesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No active games found',
        preview: [],
        stageInfo: {
          raceSlug,
          stage,
          year,
          totalRiders: stageResults.length
        }
      });
    }

    const previewResults = [];

    // Process each game
    for (const gameDoc of gamesSnapshot.docs) {
      try {
        const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
        const gameConfig = game.config as AuctioneerConfig;

        console.log(`[PREVIEW] Processing game: ${game.name}, type: ${game.gameType}, config exists: ${!!gameConfig}`);

        // For seasonal games, all races count by default
        // For auctioneer games, check countingRaces
        let shouldCount = false;
        if (game.gameType === 'season') {
          shouldCount = true; // All races count for seasonal games
          console.log(`[PREVIEW] Seasonal game ${game.name} - all races count`);
        } else if (game.gameType === 'auctioneer') {
          shouldCount = gameConfig && shouldCountForPoints(raceSlug, stage, gameConfig.countingRaces);
          console.log(`[PREVIEW] Auctioneer game ${game.name} - race counts: ${shouldCount}`);
        } else {
          console.log(`[PREVIEW] Game ${game.name} - unknown type: ${game.gameType}, skipping`);
          continue;
        }

        if (!shouldCount) {
          console.log(`[PREVIEW] Game ${game.name} - race does not count, skipping`);
          continue;
        }

        // Get all participants in this game
        const participantsSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', game.id)
          .where('status', '==', 'active')
          .get();

        console.log(`[PREVIEW] Game ${game.name} - found ${participantsSnapshot.size} active participants`);

        if (participantsSnapshot.empty) {
          console.log(`[PREVIEW] Game ${game.name} - no active participants, skipping`);
          continue;
        }

        const gamePreview = {
          gameId: game.id!,
          gameName: game.name,
          participants: []
        };

        // Calculate points for each participant
        let totalParticipantsWithPoints = 0;
        for (const participantDoc of participantsSnapshot.docs) {
          const participantData = participantDoc.data();
          const userId = participantData.userId;

          console.log(`[PREVIEW] Processing participant: ${participantData.playername}`);

          // Get this participant's team from playerTeams collection
          const teamSnapshot = await db.collection('playerTeams')
            .where('gameId', '==', game.id)
            .where('userId', '==', userId)
            .get();

          console.log(`[PREVIEW] Participant ${participantData.playername} - found ${teamSnapshot.size} teams`);

          if (teamSnapshot.empty) {
            console.log(`[PREVIEW] Participant ${participantData.playername} - no teams, skipping`);
            continue;
          }

          const riderPoints = [];
          let totalParticipantPoints = 0;

          // Check each rider in the team
          for (const teamDoc of teamSnapshot.docs) {
            const teamData = teamDoc.data();
            const riderNameId = teamData.riderNameId;

            console.log(`[PREVIEW] Checking rider: ${teamData.riderName} (${riderNameId})`);

            // Find rider in stage results
            const riderResult = stageResults.find((r: StageResult) => 
              r.nameID === riderNameId || 
              r.shortName?.toLowerCase().replace(/\s+/g, '-') === riderNameId
            );

            if (!riderResult) {
              console.log(`[PREVIEW] Rider ${teamData.riderName} not found in stage results`);
              continue;
            }

            const finishPosition = riderResult.place || riderResult.rank;
            if (!finishPosition) {
              console.log(`[PREVIEW] Rider ${teamData.riderName} has no finish position`);
              continue;
            }

            console.log(`[PREVIEW] Rider ${teamData.riderName} finished in position ${finishPosition}`);

            // Calculate stage points using same logic as calculate-points
            let stagePoints = 0;
            if (game.raceType === 'season') {
              // For season games, use PCS points directly
              stagePoints = typeof riderResult.points === 'number' ? riderResult.points :
                (typeof riderResult.points === 'string' && riderResult.points !== '-' ? parseInt(riderResult.points) : 0);
            } else {
              // For Grand Tour games, use TOP_20_POINTS system
              stagePoints = calculateStagePoints(finishPosition);
            }

            if (stagePoints > 0) {
              riderPoints.push({
                riderName: teamData.riderName,
                riderNameId,
                playerName: participantData.playername,
                place: finishPosition,
                stagePoints,
                totalPoints: stagePoints
              });
              totalParticipantPoints += stagePoints;
            }
          }

          // Add participant if they have riders with points
          if (riderPoints.length > 0) {
            gamePreview.participants.push({
              userId,
              playerName: participantData.playername,
              riders: riderPoints,
              totalPoints: totalParticipantPoints
            });
            totalParticipantsWithPoints++;
            console.log(`[PREVIEW] Participant ${participantData.playername} got ${totalParticipantPoints} points from ${riderPoints.length} riders`);
          } else {
            console.log(`[PREVIEW] Participant ${participantData.playername} got no points`);
          }
        }

        console.log(`[PREVIEW] Game ${game.name} - ${totalParticipantsWithPoints} participants with points`);

        // Sort participants by total points (descending)
        gamePreview.participants.sort((a, b) => b.totalPoints - a.totalPoints);
        
        if (gamePreview.participants.length > 0) {
          previewResults.push(gamePreview);
        }
      } catch (error) {
        console.error(`[PREVIEW] Error processing game ${gameDoc.id}:`, error);
        // Continue processing other games
      }
    }

    return NextResponse.json({
      success: true,
      message: `Preview calculated for ${previewResults.length} games`,
      preview: previewResults,
      stageInfo: {
        raceSlug,
        stage,
        year,
        totalRiders: stageResults.length,
        totalGamesWithPoints: previewResults.length
      }
    });

  } catch (error) {
    console.error('[PREVIEW_POINTS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
