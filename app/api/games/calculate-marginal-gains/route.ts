import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Game, MarginalGainsConfig, SeasonPoints } from '@/lib/types/games';

/**
 * Calculate and update scores for Marginal Gains games
 *
 * The game works as follows:
 * - Each rider starts with NEGATIVE points equal to their UCI ranking points at the start of the current year
 *   (which represents what they earned in the previous year)
 * - During the current season, riders earn points through race results (stored in seasonPoints)
 * - The Marginal Gain = (season points earned this year) - (UCI ranking points from start of year)
 * - Players need to select riders who will improve the most compared to last year
 *
 * Example for 2026 game:
 * - rankings_2026 contains UCI points earned in 2025 (starting value, becomes NEGATIVE)
 * - seasonPoints 2026 contains points earned during 2026 season (current value)
 * - Gain = seasonPoints_2026 - rankings_2026
 */
export async function POST(request: NextRequest) {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json(
        { error: 'gameId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    console.log(`[MARGINAL_GAINS] Starting score calculation for game ${gameId}`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

    if (game.gameType !== 'marginal-gains') {
      return NextResponse.json(
        { error: 'This endpoint only works for Marginal Gains games' },
        { status: 400 }
      );
    }

    const config = game.config as MarginalGainsConfig;
    const currentYear = config.currentYear;   // e.g., 2026

    console.log(`[MARGINAL_GAINS] Calculating marginal gains for ${currentYear}`);

    // Get all participants in this game
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    console.log(`[MARGINAL_GAINS] Found ${participantsSnapshot.size} participants`);

    const results = {
      participantsProcessed: 0,
      ridersScored: 0,
      errors: [] as string[],
    };

    // Build functions to get points

    // Get UCI ranking points (what the rider earned last year, now their starting NEGATIVE value)
    const getStartingPoints = async (riderNameId: string): Promise<number> => {
      try {
        const rankingDoc = await db.collection(`rankings_${currentYear}`).doc(riderNameId).get();
        if (rankingDoc.exists) {
          const data = rankingDoc.data();
          return data?.points || 0;
        }
        return 0;
      } catch (error) {
        console.error(`[MARGINAL_GAINS] Error fetching ranking for ${riderNameId} (${currentYear}):`, error);
        return 0;
      }
    };

    // Get current season points (what the rider is earning during this season)
    const getCurrentSeasonPoints = async (riderNameId: string): Promise<number> => {
      try {
        const seasonPointsDoc = await db.collection('seasonPoints').doc(`${riderNameId}_${currentYear}`).get();
        if (seasonPointsDoc.exists) {
          const data = seasonPointsDoc.data() as SeasonPoints;
          return data.totalPoints || 0;
        }
        return 0;
      } catch (error) {
        console.error(`[MARGINAL_GAINS] Error fetching season points for ${riderNameId} (${currentYear}):`, error);
        return 0;
      }
    };

    // Process each participant
    for (const participantDoc of participantsSnapshot.docs) {
      try {
        const participantData = participantDoc.data();
        const userId = participantData.userId;

        console.log(`[MARGINAL_GAINS] Processing participant ${participantData.playername}`);

        // Get this participant's team from playerTeams collection
        const teamSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .where('active', '==', true)
          .get();

        if (teamSnapshot.empty) {
          console.log(`[MARGINAL_GAINS] No team found for ${participantData.playername}`);
          continue;
        }

        let totalScore = 0;

        // Calculate score for each rider in the team
        for (const teamDoc of teamSnapshot.docs) {
          const teamData = teamDoc.data();
          const riderNameId = teamData.riderNameId;

          // Fetch points:
          // - Starting points: UCI ranking points (from rankings_2026, earned in 2025)
          // - Current points: Season points (from seasonPoints, earning during 2026)
          const startingPoints = await getStartingPoints(riderNameId);
          const currentPoints = await getCurrentSeasonPoints(riderNameId);

          // Marginal Gain = (current season points) - (starting UCI points)
          // Riders start with NEGATIVE points equal to their UCI ranking
          // During the season, they work towards positive territory
          const gain = currentPoints - startingPoints;

          totalScore += gain;

          console.log(`[MARGINAL_GAINS]   ${teamData.riderName}: -${startingPoints} (starting) + ${currentPoints} (current) = ${gain > 0 ? '+' : ''}${gain}`);

          // Update PlayerTeam document with current score
          await teamDoc.ref.update({
            pointsScored: gain,
          });

          results.ridersScored++;
        }

        console.log(`[MARGINAL_GAINS] ${participantData.playername} total score: ${totalScore > 0 ? '+' : ''}${totalScore}`);

        // Update participant's total points
        await participantDoc.ref.update({
          totalPoints: totalScore,
        });

        results.participantsProcessed++;

      } catch (error) {
        const errorMsg = `Failed to process participant: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[MARGINAL_GAINS] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    // Recalculate rankings
    console.log(`[MARGINAL_GAINS] Recalculating rankings`);
    const allParticipantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .orderBy('totalPoints', 'desc')
      .get();

    let ranking = 1;
    for (const participantDoc of allParticipantsSnapshot.docs) {
      await participantDoc.ref.update({ ranking });
      ranking++;
    }

    console.log(`[MARGINAL_GAINS] Score calculation complete`);

    return NextResponse.json({
      success: true,
      message: 'Marginal Gains scores calculated successfully',
      results,
    });

  } catch (error) {
    console.error('[MARGINAL_GAINS] Error calculating scores:', error);
    return NextResponse.json(
      { error: 'Failed to calculate scores', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
