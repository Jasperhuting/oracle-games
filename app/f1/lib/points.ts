import { 
  F1Prediction, 
  F1RaceResult, 
  F1PointsBreakdown, 
  F1_POINTS_CONFIG 
} from '../types';

/**
 * Calculate points for a prediction based on race results
 */
export function calculatePredictionPoints(
  prediction: F1Prediction,
  result: F1RaceResult
): { total: number; breakdown: F1PointsBreakdown } {
  let positionPoints = 0;
  let poleBonus = 0;
  let fastestLapBonus = 0;
  let dnfBonus = 0;

  // Calculate position points
  for (let i = 0; i < prediction.finishOrder.length; i++) {
    const predictedDriver = prediction.finishOrder[i];
    const actualPosition = result.finishOrder.indexOf(predictedDriver);

    if (actualPosition === -1) continue; // Driver not in results (DNF etc)

    const positionDiff = Math.abs(i - actualPosition);

    if (positionDiff === 0) {
      positionPoints += F1_POINTS_CONFIG.position.exact;
    } else if (positionDiff === 1) {
      positionPoints += F1_POINTS_CONFIG.position.offBy1;
    } else if (positionDiff === 2) {
      positionPoints += F1_POINTS_CONFIG.position.offBy2;
    } else if (i < 10 && actualPosition < 10) {
      // Both in top 10 but more than 2 positions off
      positionPoints += F1_POINTS_CONFIG.position.inTop10;
    }
  }

  // Pole position bonus
  if (prediction.polePosition && prediction.polePosition === result.polePosition) {
    poleBonus = F1_POINTS_CONFIG.polePosition;
  }

  // Fastest lap bonus
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLap) {
    fastestLapBonus = F1_POINTS_CONFIG.fastestLap;
  }

  // DNF bonus
  const predictedDnfs = [prediction.dnf1, prediction.dnf2].filter(Boolean) as string[];
  for (const dnf of predictedDnfs) {
    if (result.dnfDrivers.includes(dnf)) {
      dnfBonus += F1_POINTS_CONFIG.dnfCorrect;
    }
  }

  const breakdown: F1PointsBreakdown = {
    positionPoints,
    poleBonus,
    fastestLapBonus,
    dnfBonus,
  };

  return {
    total: positionPoints + poleBonus + fastestLapBonus + dnfBonus,
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
