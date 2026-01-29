import { 
  F1Prediction, 
  F1RaceResult, 
  F1PointsBreakdown, 
  F1_POINTS_CONFIG 
} from '../types';

/**
 * Calculate points for a prediction based on race results
 * Uses penalty system: start with max points, subtract for position differences
 * Lower score = better prediction
 */
export function calculatePredictionPoints(
  prediction: F1Prediction,
  result: F1RaceResult
): { total: number; breakdown: F1PointsBreakdown } {
  let totalPenalty = 0;
  let correctPositions = 0;
  let poleBonus = 0;
  let fastestLapBonus = 0;
  let dnfBonus = 0;

  // Calculate penalty points (sum of position differences)
  for (let i = 0; i < prediction.finishOrder.length; i++) {
    const predictedDriver = prediction.finishOrder[i];
    const actualPosition = result.finishOrder.indexOf(predictedDriver);

    if (actualPosition === -1) {
      // Driver not in results - max penalty for this position
      totalPenalty += 21; // Max possible difference
      continue;
    }

    const positionDiff = Math.abs(i - actualPosition);
    totalPenalty += positionDiff;

    if (positionDiff === 0) {
      correctPositions++;
    }
  }

  // Pole position bonus (reduces penalty)
  if (prediction.polePosition && prediction.polePosition === result.polePosition) {
    poleBonus = F1_POINTS_CONFIG.polePosition;
  }

  // Fastest lap bonus (reduces penalty)
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLap) {
    fastestLapBonus = F1_POINTS_CONFIG.fastestLap;
  }

  // DNF bonus (reduces penalty)
  const predictedDnfs = [prediction.dnf1, prediction.dnf2].filter(Boolean) as string[];
  for (const dnf of predictedDnfs) {
    if (result.dnfDrivers?.includes(dnf)) {
      dnfBonus += F1_POINTS_CONFIG.dnfCorrect;
    }
  }

  // Final score: penalty minus bonuses (lower is better)
  // But we store as positive where higher = better for standings
  // Max possible penalty is 22 * 21 = 462, so we invert
  const maxPenalty = 462;
  const bonuses = poleBonus + fastestLapBonus + dnfBonus;
  const finalScore = maxPenalty - totalPenalty + bonuses;

  const breakdown: F1PointsBreakdown = {
    positionPoints: correctPositions, // Store correct count for display
    poleBonus,
    fastestLapBonus,
    dnfBonus,
  };

  return {
    total: finalScore,
    breakdown,
  };
}

/**
 * Calculate maximum possible points for a race
 */
export function getMaxPossiblePoints(): number {
  // All 22 positions correct + pole + fastest lap + 2 DNFs
  const maxPositionPoints = 22 * F1_POINTS_CONFIG.position.exact;
  const maxPoleBonus = F1_POINTS_CONFIG.polePosition;
  const maxFastestLapBonus = F1_POINTS_CONFIG.fastestLap;
  const maxDnfBonus = 2 * F1_POINTS_CONFIG.dnfCorrect;

  return maxPositionPoints + maxPoleBonus + maxFastestLapBonus + maxDnfBonus;
}

/**
 * Get points breakdown as readable text
 */
export function formatPointsBreakdown(breakdown: F1PointsBreakdown): string[] {
  const lines: string[] = [];

  if (breakdown.positionPoints > 0) {
    lines.push(`Posities: +${breakdown.positionPoints}`);
  }
  if (breakdown.poleBonus > 0) {
    lines.push(`Pole Position: +${breakdown.poleBonus}`);
  }
  if (breakdown.fastestLapBonus > 0) {
    lines.push(`Snelste Ronde: +${breakdown.fastestLapBonus}`);
  }
  if (breakdown.dnfBonus > 0) {
    lines.push(`DNF Correct: +${breakdown.dnfBonus}`);
  }

  return lines;
}

/**
 * Calculate position accuracy percentage
 */
export function calculateAccuracy(prediction: F1Prediction, result: F1RaceResult): number {
  let correctPositions = 0;

  for (let i = 0; i < prediction.finishOrder.length; i++) {
    const predictedDriver = prediction.finishOrder[i];
    const actualPosition = result.finishOrder.indexOf(predictedDriver);

    if (actualPosition === i) {
      correctPositions++;
    }
  }

  return Math.round((correctPositions / prediction.finishOrder.length) * 100);
}
