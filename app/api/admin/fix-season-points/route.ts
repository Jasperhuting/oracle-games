import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import * as admin from 'firebase-admin';

async function verifyAdminUser(db: admin.firestore.Firestore, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

// PCS points for nc-australia-itt (from the HTML data provided)
// Only top 3 get PCS points in this race
const NC_AUSTRALIA_ITT_PCS_POINTS: Record<string, number> = {
  'jay-vine': 15,        // 1st place
  'oliver-bleddyn': 7,   // 2nd place
  'kelland-brien': 2,    // 3rd place
  // Ben O'Connor (4th) and all others have 0 PCS points
  'ben-o-connor': 0,
};

// The race slug used in racePoints
const RACE_SLUG = 'nc-australia-itt';

// Season game IDs (both divisions)
const SEASON_GAME_IDS = [
  'xLbOq9mbPf6XJMIvzp2R', // Division 1
  'qltELoRHMvweHzhM26bN', // Division 2
];

export async function POST(request: NextRequest) {
  try {
    // Get Firestore instance
    const db = getServerFirebase();
    
    // Verify admin
    const isAdmin = await verifyAdminUser(db, request.headers.get('userId'));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    results.push('Starting season points fix for nc-australia-itt...');

    for (const gameId of SEASON_GAME_IDS) {
      results.push(`\nProcessing game: ${gameId}`);

      // Get all playerTeams for this game
      const playerTeamsSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('active', '==', true)
        .get();

      results.push(`Found ${playerTeamsSnapshot.size} active player teams`);

      for (const doc of playerTeamsSnapshot.docs) {
        const data = doc.data();
        const riderNameId = data.riderNameId;
        const racePoints = data.racePoints || {};

        // Check if this rider has points for nc-australia-itt
        if (racePoints[RACE_SLUG]) {
          const currentRaceData = racePoints[RACE_SLUG];
          const currentTotal = currentRaceData.totalPoints || 0;

          // Get the correct PCS points for this rider
          const correctPcsPoints = NC_AUSTRALIA_ITT_PCS_POINTS[riderNameId] || 0;

          if (currentTotal !== correctPcsPoints) {
            results.push(`\n${data.riderName} (${riderNameId}):`);
            results.push(`  Current points: ${currentTotal}`);
            results.push(`  Correct PCS points: ${correctPcsPoints}`);

            // Calculate the points difference
            const pointsDiff = correctPcsPoints - currentTotal;

            // Update racePoints
            const updatedRacePoints = { ...racePoints };
            updatedRacePoints[RACE_SLUG] = {
              totalPoints: correctPcsPoints,
              stagePoints: {
                'result': {
                  stageResult: correctPcsPoints,
                  total: correctPcsPoints,
                }
              }
            };

            // Update pointsScored
            const currentPointsScored = data.pointsScored || 0;
            const newPointsScored = currentPointsScored + pointsDiff;

            results.push(`  Points scored: ${currentPointsScored} -> ${newPointsScored}`);

            // Update the document
            await doc.ref.update({
              racePoints: updatedRacePoints,
              pointsScored: newPointsScored,
            });

            results.push(`  ✓ Updated`);
          }
        }
      }

      // Now update the gameParticipants totalPoints
      results.push(`\nUpdating participant totals for game ${gameId}...`);

      const participantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('status', '==', 'active')
        .get();

      for (const participantDoc of participantsSnapshot.docs) {
        const participantData = participantDoc.data();
        const userId = participantData.userId;

        // Get all riders for this participant
        const ridersSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .where('active', '==', true)
          .get();

        // Calculate total points from all riders
        let totalPoints = 0;
        for (const riderDoc of ridersSnapshot.docs) {
          const riderData = riderDoc.data();
          totalPoints += riderData.pointsScored || 0;
        }

        const currentTotal = participantData.totalPoints || 0;
        if (currentTotal !== totalPoints) {
          results.push(`${participantData.playername}: ${currentTotal} -> ${totalPoints}`);
          await participantDoc.ref.update({ totalPoints });
        }
      }

      // Update rankings
      results.push(`\nUpdating rankings for game ${gameId}...`);

      const updatedParticipantsSnapshot = await db.collection('gameParticipants')
        .where('gameId', '==', gameId)
        .where('status', '==', 'active')
        .orderBy('totalPoints', 'desc')
        .get();

      let currentRank = 1;
      let previousPoints = -1;
      let sameRankCount = 0;

      for (const doc of updatedParticipantsSnapshot.docs) {
        const data = doc.data();
        const points = data.totalPoints || 0;

        if (points === previousPoints) {
          sameRankCount++;
        } else {
          currentRank += sameRankCount;
          sameRankCount = 1;
          previousPoints = points;
        }

        if (data.ranking !== currentRank) {
          await doc.ref.update({ ranking: currentRank });
          results.push(`${data.playername}: rank ${currentRank} (${points} pts)`);
        }
      }
    }

    results.push('\n✓ Season points fix completed!');

    return NextResponse.json({
      success: true,
      results: results.join('\n'),
    });
  } catch (error) {
    console.error('Error fixing season points:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
