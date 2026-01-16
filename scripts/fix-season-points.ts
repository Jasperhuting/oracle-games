/**
 * Script to fix season game points for nc-australia-itt race
 * The race was calculated with TOP_20_POINTS (50 for 1st) but should use PCS points (15 for 1st)
 * 
 * Run with: npx ts-node scripts/fix-season-points.ts
 */

import * as admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Initialize Firebase Admin
const serviceAccount = require('../oracle-games-b6af6-firebase-adminsdk-fbsvc-b1fdf0e6b2.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

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

async function fixSeasonPoints() {
  console.log('Starting season points fix for nc-australia-itt...');

  for (const gameId of SEASON_GAME_IDS) {
    console.log(`\nProcessing game: ${gameId}`);

    // Get all playerTeams for this game that have racePoints for nc-australia-itt
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('active', '==', true)
      .get();

    console.log(`Found ${playerTeamsSnapshot.size} active player teams`);

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
          console.log(`\n${data.riderName} (${riderNameId}):`);
          console.log(`  Current points: ${currentTotal}`);
          console.log(`  Correct PCS points: ${correctPcsPoints}`);
          
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
          
          console.log(`  Points scored: ${currentPointsScored} -> ${newPointsScored}`);
          
          // Update the document
          await doc.ref.update({
            racePoints: updatedRacePoints,
            pointsScored: newPointsScored,
          });
          
          console.log(`  ✓ Updated`);
        }
      }
    }

    // Now update the gameParticipants totalPoints
    console.log(`\nUpdating participant totals for game ${gameId}...`);
    
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
        console.log(`${participantData.playername}: ${currentTotal} -> ${totalPoints}`);
        await participantDoc.ref.update({ totalPoints });
      }
    }

    // Update rankings
    console.log(`\nUpdating rankings for game ${gameId}...`);
    
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
        console.log(`${data.playername}: rank ${currentRank} (${points} pts)`);
      }
    }
  }

  console.log('\n✓ Season points fix completed!');
}

// Run the fix
fixSeasonPoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
