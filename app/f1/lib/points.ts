import { 
  F1Prediction, 
  F1RaceResult, 
  F1PointsBreakdown, 
  F1_POINTS_CONFIG 
} from '../types';

/**
 * Calculate penalty points for a prediction based on race results
 * Lower score = better prediction
 */
export function calculatePredictionPoints(
  prediction: F1Prediction,
  result: F1RaceResult
): { total: number; breakdown: F1PointsBreakdown } {
  let totalPenalty = 0;
  let correctPositions = 0;
  let bonusCorrect = 0;

  const predictedOrder = prediction.finishOrder
    .slice(0, F1_POINTS_CONFIG.maxPredictionSize)
    .filter(Boolean);

  // Calculate penalty points (sum of capped position differences)
  for (let i = 0; i < predictedOrder.length; i++) {
    const predictedDriver = predictedOrder[i];
    const predictedPos = i + 1;
    const actualIndex = result.finishOrder.indexOf(predictedDriver);

    let penalty = 0;

    if (actualIndex === -1) {
      // Driver not in results - treat as DNS/DSQ
      penalty = F1_POINTS_CONFIG.maxPenaltyPerDriver;
    } else if (result.dnfDrivers?.includes(predictedDriver)) {
      // DNF always counts as max penalty, regardless of finishing position
      penalty = F1_POINTS_CONFIG.maxPenaltyPerDriver;
    } else {
      const actualPos = actualIndex + 1;
      const positionDiff = Math.abs(predictedPos - actualPos);
      penalty = Math.min(F1_POINTS_CONFIG.maxPenaltyPerDriver, positionDiff);
    }

    totalPenalty += penalty;
    if (penalty === 0) {
      correctPositions++;
    }
  }

  // Bonus questions: each correct answer reduces penalty by 2
  if (prediction.polePosition && prediction.polePosition === result.polePosition) {
    bonusCorrect++;
  }
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLap) {
    bonusCorrect++;
  }
  const predictedDnfs = [prediction.dnf1, prediction.dnf2].filter(Boolean) as string[];
  for (const dnf of predictedDnfs) {
    if (result.dnfDrivers?.includes(dnf)) {
      bonusCorrect++;
    }
  }

  const bonusPenalty = -F1_POINTS_CONFIG.bonusPenaltyPerCorrect * bonusCorrect;
  const finalScore = totalPenalty + bonusPenalty;

  const breakdown: F1PointsBreakdown = {
    positionPenalty: totalPenalty,
    bonusPenalty,
    bonusCorrect,
  };

  return {
    total: finalScore,
    breakdown,
  };
}

/**
 * Calculate maximum possible penalty points for a race
 */
export function getMaxPossiblePoints(): number {
  return F1_POINTS_CONFIG.maxPredictionSize * F1_POINTS_CONFIG.maxPenaltyPerDriver;
}

/**
 * Get points breakdown as readable text
 */
export function formatPointsBreakdown(breakdown: F1PointsBreakdown): string[] {
  const lines: string[] = [];

  lines.push(`Posities: +${breakdown.positionPenalty}`);
  if (breakdown.bonusCorrect > 0) {
    lines.push(`Bonus: ${breakdown.bonusPenalty} (${breakdown.bonusCorrect} correct)`);
  }

  return lines;
}

/**
 * Calculate position accuracy percentage
 */
export function calculateAccuracy(prediction: F1Prediction, result: F1RaceResult): number {
  let correctPositions = 0;

  const predictedOrder = prediction.finishOrder
    .slice(0, F1_POINTS_CONFIG.maxPredictionSize)
    .filter(Boolean);

  for (let i = 0; i < predictedOrder.length; i++) {
    const predictedDriver = predictedOrder[i];
    const actualPosition = result.finishOrder.indexOf(predictedDriver);

    if (actualPosition === i) {
      correctPositions++;
    }
  }

  return predictedOrder.length > 0
    ? Math.round((correctPositions / predictedOrder.length) * 100)
    : 0;
}
