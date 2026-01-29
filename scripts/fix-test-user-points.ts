import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore(app, 'oracle-games-f1');

// Actual race result
const actualResult = ['VER', 'NOR', 'PIA', 'RUS', 'LEC', 'ANT', 'HAM', 'ALB', 'ALO', 'BOT', 'PER', 'HAD', 'HUL', 'SAI', 'LAW', 'BEA', 'BOR', 'COL', 'GAS', 'LIN', 'OCO', 'STR'];
const actualPole = 'VER';
const actualFastestLap = 'PIA';
const actualDnfs = ['STR', 'LAW', 'BEA'];

// Bonus points system (from F1_POINTS_CONFIG)
function calculateBonusPoints(prediction: {
  finishOrder: string[];
  polePosition: string | null;
  fastestLap: string | null;
  dnf1: string | null;
  dnf2: string | null;
}): { total: number; breakdown: { position: number; pole: number; fl: number; dnf: number } } {
  let positionPoints = 0;
  let poleBonus = 0;
  let flBonus = 0;
  let dnfBonus = 0;

  // Position points
  actualResult.forEach((actualDriver, actualIndex) => {
    const actualPos = actualIndex + 1;
    const predictedIndex = prediction.finishOrder.indexOf(actualDriver);
    
    if (predictedIndex === -1) return;
    
    const predictedPos = predictedIndex + 1;
    const diff = Math.abs(actualPos - predictedPos);

    if (diff === 0) {
      positionPoints += 25; // Exact match
    } else if (diff === 1) {
      positionPoints += 10; // Off by 1
    } else if (diff === 2) {
      positionPoints += 5; // Off by 2
    } else if (actualPos <= 10 && predictedPos <= 10) {
      positionPoints += 2; // Both in top 10 but >2 diff
    }
  });

  // Pole position bonus (10 pts)
  if (prediction.polePosition === actualPole) {
    poleBonus = 10;
  }

  // Fastest lap bonus (10 pts)
  if (prediction.fastestLap === actualFastestLap) {
    flBonus = 10;
  }

  // DNF bonus (5 pts per correct)
  if (prediction.dnf1 && actualDnfs.includes(prediction.dnf1)) {
    dnfBonus += 5;
  }
  if (prediction.dnf2 && actualDnfs.includes(prediction.dnf2)) {
    dnfBonus += 5;
  }

  return {
    total: positionPoints + poleBonus + flBonus + dnfBonus,
    breakdown: { position: positionPoints, pole: poleBonus, fl: flBonus, dnf: dnfBonus }
  };
}

async function fixTestUserPoints() {
  console.log('Recalculating test user points with bonus system...\n');

  // Get all predictions for race 1
  const predictionsSnapshot = await db.collection('predictions')
    .where('raceId', '==', '2026_01')
    .get();

  const results: { userId: string; name: string; oldPoints: number; newPoints: number; breakdown: any }[] = [];

  for (const doc of predictionsSnapshot.docs) {
    const prediction = doc.data();
    const userId = prediction.userId;

    // Get current standing
    const standingDoc = await db.collection('standings').doc(`${userId}_2026`).get();
    const standing = standingDoc.data();
    
    if (!standing) continue;

    const oldPoints = standing.totalPoints;
    const { total: newPoints, breakdown } = calculateBonusPoints({
      finishOrder: prediction.finishOrder,
      polePosition: prediction.polePosition,
      fastestLap: prediction.fastestLap,
      dnf1: prediction.dnf1,
      dnf2: prediction.dnf2,
    });

    // Update standing with correct points
    await db.collection('standings').doc(`${userId}_2026`).update({
      totalPoints: newPoints,
      racePoints: { '2026_01': newPoints },
      lastRacePoints: newPoints,
      updatedAt: Timestamp.now(),
    });

    results.push({
      userId,
      name: standing.visibleName || userId.substring(0, 12),
      oldPoints,
      newPoints,
      breakdown,
    });

    console.log(`✓ ${standing.visibleName || userId}: ${oldPoints} → ${newPoints} pts`);
    console.log(`  Position: ${breakdown.position}, Pole: ${breakdown.pole}, FL: ${breakdown.fl}, DNF: ${breakdown.dnf}`);
  }

  console.log('\n✅ All points recalculated!\n');
  
  // Sort and display final standings
  results.sort((a, b) => b.newPoints - a.newPoints);
  console.log('Final Standings:');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}: ${r.newPoints} pts`);
  });
}

fixTestUserPoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
