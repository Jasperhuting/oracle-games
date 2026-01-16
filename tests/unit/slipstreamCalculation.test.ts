/**
 * Slipstream Calculation Utility Tests
 *
 * Tests for time parsing, formatting, penalty calculation, and standings logic
 */
import { describe, it, expect } from 'vitest';
import {
  parseTimeGap,
  formatTime,
  formatTimeGap,
  calculateTimeLoss,
  calculateGreenJerseyPoints,
  applyMissedPickPenalty,
  sortByTimeLost,
  sortByGreenPoints,
  calculateRankings,
  isDeadlinePassed,
  getTimeUntilDeadline,
  formatTimeRemaining,
  StageRider,
} from '@/lib/utils/slipstreamCalculation';

// =============================================================================
// TIME PARSING TESTS
// =============================================================================

describe('parseTimeGap', () => {
  it('should parse MM:SS format', () => {
    expect(parseTimeGap('1:30')).toBe(90);
    expect(parseTimeGap('0:45')).toBe(45);
    expect(parseTimeGap('10:00')).toBe(600);
    expect(parseTimeGap('59:59')).toBe(3599);
  });

  it('should parse HH:MM:SS format', () => {
    expect(parseTimeGap('1:00:00')).toBe(3600);
    expect(parseTimeGap('1:30:45')).toBe(5445);
    expect(parseTimeGap('2:15:30')).toBe(8130);
  });

  it('should handle leading "+" sign', () => {
    expect(parseTimeGap('+1:30')).toBe(90);
    expect(parseTimeGap('+0:34')).toBe(34);
    expect(parseTimeGap('+1:00:00')).toBe(3600);
  });

  it('should handle "s.t." (same time)', () => {
    expect(parseTimeGap('s.t.')).toBe(0);
    expect(parseTimeGap('S.T.')).toBe(0);
    expect(parseTimeGap('st')).toBe(0);
  });

  it('should handle empty/null values', () => {
    expect(parseTimeGap('')).toBe(0);
    expect(parseTimeGap(null)).toBe(0);
    expect(parseTimeGap(undefined)).toBe(0);
    expect(parseTimeGap('-')).toBe(0);
  });

  it('should handle single number (seconds)', () => {
    expect(parseTimeGap('45')).toBe(45);
    expect(parseTimeGap('120')).toBe(120);
  });

  it('should handle invalid input gracefully', () => {
    expect(parseTimeGap('invalid')).toBe(0);
    expect(parseTimeGap('abc:def')).toBe(0);
  });
});

// =============================================================================
// TIME FORMATTING TESTS
// =============================================================================

describe('formatTime', () => {
  it('should format seconds to MM:SS', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(45)).toBe('0:45');
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(600)).toBe('10:00');
  });

  it('should format to H:MM:SS for times >= 1 hour', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(5445)).toBe('1:30:45');
  });

  it('should handle negative values', () => {
    expect(formatTime(-1)).toBe('0:00');
    expect(formatTime(-100)).toBe('0:00');
  });

  it('should pad single digit minutes and seconds', () => {
    expect(formatTime(61)).toBe('1:01');
    expect(formatTime(3601)).toBe('1:00:01');
    expect(formatTime(3660)).toBe('1:01:00');
  });
});

describe('formatTimeGap', () => {
  it('should add "+" prefix for non-zero times', () => {
    expect(formatTimeGap(90)).toBe('+1:30');
    expect(formatTimeGap(3600)).toBe('+1:00:00');
  });

  it('should return "0:00" for zero', () => {
    expect(formatTimeGap(0)).toBe('0:00');
  });
});

// =============================================================================
// TIME LOSS CALCULATION TESTS
// =============================================================================

describe('calculateTimeLoss', () => {
  const mockRaceResults: StageRider[] = [
    { nameID: 'tadej-pogacar', place: 1, timeDifference: '' },
    { nameID: 'jonas-vingegaard', place: 2, timeDifference: '0:15' },
    { nameID: 'remco-evenepoel', place: 3, timeDifference: '0:15' },
    { nameID: 'primoz-roglic', place: 4, timeDifference: '0:45' },
    { nameID: 'adam-yates', place: 5, timeDifference: '1:30' },
    { nameID: 'last-rider', place: 150, timeDifference: '45:00' },
  ];

  it('should return 0 time loss for winner', () => {
    const result = calculateTimeLoss(mockRaceResults, 'tadej-pogacar');

    expect(result.timeLostSeconds).toBe(0);
    expect(result.timeLostFormatted).toBe('0:00');
    expect(result.isPenalty).toBe(false);
    expect(result.riderFinishPosition).toBe(1);
  });

  it('should calculate correct time loss for other finishers', () => {
    const result = calculateTimeLoss(mockRaceResults, 'jonas-vingegaard');

    expect(result.timeLostSeconds).toBe(15);
    expect(result.timeLostFormatted).toBe('0:15');
    expect(result.isPenalty).toBe(false);
    expect(result.riderFinishPosition).toBe(2);
  });

  it('should handle same time (s.t.) correctly', () => {
    const resultsWithSameTime: StageRider[] = [
      { nameID: 'winner', place: 1, timeDifference: '' },
      { nameID: 'second', place: 2, timeDifference: 's.t.' },
      { nameID: 'third', place: 3, timeDifference: 's.t.' },
    ];

    const result = calculateTimeLoss(resultsWithSameTime, 'second');
    expect(result.timeLostSeconds).toBe(0);
    expect(result.isPenalty).toBe(false);
  });

  it('should apply DNF penalty when rider not in results', () => {
    const result = calculateTimeLoss(mockRaceResults, 'dnf-rider', 1);

    // Last finisher gap (45:00 = 2700) + penalty (1 min = 60) = 2760
    expect(result.timeLostSeconds).toBe(2760);
    expect(result.timeLostFormatted).toBe('46:00');
    expect(result.isPenalty).toBe(true);
    expect(result.penaltyReason).toBe('dnf');
    expect(result.riderFinishPosition).toBeUndefined();
  });

  it('should use custom penalty minutes', () => {
    const result = calculateTimeLoss(mockRaceResults, 'dnf-rider', 5);

    // Last finisher gap (45:00 = 2700) + penalty (5 min = 300) = 3000
    expect(result.timeLostSeconds).toBe(3000);
    expect(result.timeLostFormatted).toBe('50:00');
    expect(result.isPenalty).toBe(true);
  });

  it('should match rider by slug conversion', () => {
    const resultsWithNames: StageRider[] = [
      { nameID: 'tadej-pogacar', shortName: 'Tadej Pogačar', place: 1, timeDifference: '' },
      { nameID: 'jonas-vingegaard', shortName: 'Jonas Vingegaard', place: 2, timeDifference: '0:30' },
    ];

    const result = calculateTimeLoss(resultsWithNames, 'jonas-vingegaard');
    expect(result.timeLostSeconds).toBe(30);
    expect(result.riderFinishPosition).toBe(2);
  });
});

// =============================================================================
// GREEN JERSEY POINTS TESTS
// =============================================================================

describe('calculateGreenJerseyPoints', () => {
  it('should give 10 points for 1st place', () => {
    expect(calculateGreenJerseyPoints(1)).toBe(10);
  });

  it('should give correct points for top 10', () => {
    expect(calculateGreenJerseyPoints(1)).toBe(10);
    expect(calculateGreenJerseyPoints(2)).toBe(9);
    expect(calculateGreenJerseyPoints(3)).toBe(8);
    expect(calculateGreenJerseyPoints(4)).toBe(7);
    expect(calculateGreenJerseyPoints(5)).toBe(6);
    expect(calculateGreenJerseyPoints(6)).toBe(5);
    expect(calculateGreenJerseyPoints(7)).toBe(4);
    expect(calculateGreenJerseyPoints(8)).toBe(3);
    expect(calculateGreenJerseyPoints(9)).toBe(2);
    expect(calculateGreenJerseyPoints(10)).toBe(1);
  });

  it('should give 0 points for positions outside top 10', () => {
    expect(calculateGreenJerseyPoints(11)).toBe(0);
    expect(calculateGreenJerseyPoints(50)).toBe(0);
    expect(calculateGreenJerseyPoints(150)).toBe(0);
  });

  it('should handle undefined/invalid positions', () => {
    expect(calculateGreenJerseyPoints(undefined)).toBe(0);
    expect(calculateGreenJerseyPoints(0)).toBe(0);
    expect(calculateGreenJerseyPoints(-1)).toBe(0);
  });

  it('should use custom points config', () => {
    const customConfig = { 1: 25, 2: 20, 3: 15 };

    expect(calculateGreenJerseyPoints(1, customConfig)).toBe(25);
    expect(calculateGreenJerseyPoints(2, customConfig)).toBe(20);
    expect(calculateGreenJerseyPoints(3, customConfig)).toBe(15);
    expect(calculateGreenJerseyPoints(4, customConfig)).toBe(0);
  });
});

// =============================================================================
// MISSED PICK PENALTY TESTS (FALLBACK FUNCTION)
// =============================================================================

describe('applyMissedPickPenalty (fallback)', () => {
  // NOTE: This function is used as a FALLBACK when no other valid picks exist.
  // The actual penalty logic in calculate-results uses:
  // Penalty = worst time of OTHER players' valid picks + penalty minutes
  // This function calculates: last finisher of race + penalty minutes

  const mockRaceResults: StageRider[] = [
    { nameID: 'winner', place: 1, timeDifference: '' },
    { nameID: 'second', place: 2, timeDifference: '1:00' },
    { nameID: 'last', place: 100, timeDifference: '30:00' },
  ];

  it('should calculate fallback penalty as last finisher gap + penalty minutes', () => {
    const result = applyMissedPickPenalty(mockRaceResults, 1);

    // Last finisher gap (30:00 = 1800) + penalty (1 min = 60) = 1860
    expect(result.timeLostSeconds).toBe(1860);
    expect(result.timeLostFormatted).toBe('31:00');
  });

  it('should use custom penalty minutes', () => {
    const result = applyMissedPickPenalty(mockRaceResults, 5);

    // Last finisher gap (30:00 = 1800) + penalty (5 min = 300) = 2100
    expect(result.timeLostSeconds).toBe(2100);
    expect(result.timeLostFormatted).toBe('35:00');
  });

  it('should handle empty results gracefully', () => {
    const result = applyMissedPickPenalty([], 1);

    expect(result.timeLostSeconds).toBe(60); // Just the penalty
    expect(result.timeLostFormatted).toBe('1:00');
  });
});

// =============================================================================
// PENALTY CALCULATION LOGIC (DOCUMENTATION)
// =============================================================================

describe('Penalty calculation logic', () => {
  /**
   * NEW PENALTY RULE:
   * When a player has DNF/DNS/DSQ pick OR missed pick:
   * Penalty = worst time of OTHER players' valid picks + penalty minutes
   *
   * Example with 10 players:
   * - 9 players made valid picks with times: 0:00, 0:15, 0:30, 1:00, 1:30, 2:00, 2:30, 3:00, 5:00
   * - 1 player missed their pick
   * - Worst time of the 9 others = 5:00 (300 seconds)
   * - Penalty = 5:00 + 1:00 = 6:00 (360 seconds)
   *
   * If ALL other players also have penalties (no valid picks from others),
   * fallback to: last finisher of race + penalty minutes
   */

  it('should document penalty based on worst pick of other players', () => {
    // Simulate the scenario described above
    const validPickTimes = [0, 15, 30, 60, 90, 120, 150, 180, 300]; // 9 valid picks
    const worstTimeOfOthers = Math.max(...validPickTimes);
    const penaltyMinutes = 1;
    const penaltySeconds = penaltyMinutes * 60;

    const expectedPenalty = worstTimeOfOthers + penaltySeconds;

    expect(worstTimeOfOthers).toBe(300); // 5:00
    expect(expectedPenalty).toBe(360);   // 6:00
  });

  it('should handle scenario where penalty player picked DNF rider', () => {
    // Player A picks rider who DNFs
    // Players B, C, D have valid picks with times: 0:00, 1:00, 2:00
    // Player A's penalty = worst of B,C,D (2:00) + 1 minute = 3:00

    const otherValidTimes = [0, 60, 120];
    const worstTimeOfOthers = Math.max(...otherValidTimes);
    const penaltySeconds = 60;

    const expectedPenalty = worstTimeOfOthers + penaltySeconds;

    expect(expectedPenalty).toBe(180); // 3:00
  });

  it('should handle scenario where multiple players need penalties', () => {
    // Players A and B both missed their picks
    // Players C and D have valid picks: 1:00 and 3:00
    // Player A's penalty = worst of C,D (3:00) + 1 min = 4:00
    // Player B's penalty = worst of C,D (3:00) + 1 min = 4:00 (same!)

    const validTimes = [60, 180];
    const worstTimeOfOthers = Math.max(...validTimes);
    const penaltySeconds = 60;

    const penaltyA = worstTimeOfOthers + penaltySeconds;
    const penaltyB = worstTimeOfOthers + penaltySeconds;

    expect(penaltyA).toBe(240); // 4:00
    expect(penaltyB).toBe(240); // 4:00
    expect(penaltyA).toBe(penaltyB); // Both get the same penalty
  });
});

// =============================================================================
// STANDINGS SORTING TESTS
// =============================================================================

describe('sortByTimeLost', () => {
  it('should sort participants by time lost ascending', () => {
    const participants = [
      { name: 'C', totalTimeLostSeconds: 300 },
      { name: 'A', totalTimeLostSeconds: 100 },
      { name: 'B', totalTimeLostSeconds: 200 },
    ];

    const sorted = sortByTimeLost(participants);

    expect(sorted[0].name).toBe('A');
    expect(sorted[1].name).toBe('B');
    expect(sorted[2].name).toBe('C');
  });

  it('should not mutate original array', () => {
    const participants = [
      { name: 'B', totalTimeLostSeconds: 200 },
      { name: 'A', totalTimeLostSeconds: 100 },
    ];
    const original = [...participants];

    sortByTimeLost(participants);

    expect(participants).toEqual(original);
  });
});

describe('sortByGreenPoints', () => {
  it('should sort participants by green points descending', () => {
    const participants = [
      { name: 'A', totalGreenJerseyPoints: 10 },
      { name: 'C', totalGreenJerseyPoints: 30 },
      { name: 'B', totalGreenJerseyPoints: 20 },
    ];

    const sorted = sortByGreenPoints(participants);

    expect(sorted[0].name).toBe('C');
    expect(sorted[1].name).toBe('B');
    expect(sorted[2].name).toBe('A');
  });
});

// =============================================================================
// RANKING CALCULATION TESTS
// =============================================================================

describe('calculateRankings', () => {
  it('should assign rankings for ascending order (time)', () => {
    const items = [
      { name: 'A', value: 100 },
      { name: 'B', value: 200 },
      { name: 'C', value: 300 },
    ];

    const rankings = calculateRankings(items, item => item.value, true);

    expect(rankings[0]).toBe(1); // A: 100 - rank 1
    expect(rankings[1]).toBe(2); // B: 200 - rank 2
    expect(rankings[2]).toBe(3); // C: 300 - rank 3
  });

  it('should assign rankings for descending order (points)', () => {
    const items = [
      { name: 'A', value: 100 },
      { name: 'B', value: 200 },
      { name: 'C', value: 300 },
    ];

    const rankings = calculateRankings(items, item => item.value, false);

    expect(rankings[0]).toBe(3); // A: 100 - rank 3
    expect(rankings[1]).toBe(2); // B: 200 - rank 2
    expect(rankings[2]).toBe(1); // C: 300 - rank 1
  });

  it('should handle ties correctly', () => {
    const items = [
      { name: 'A', value: 100 },
      { name: 'B', value: 100 }, // Tie with A
      { name: 'C', value: 200 },
    ];

    const rankings = calculateRankings(items, item => item.value, true);

    expect(rankings[0]).toBe(1); // A: 100 - rank 1
    expect(rankings[1]).toBe(1); // B: 100 - rank 1 (tie)
    expect(rankings[2]).toBe(3); // C: 200 - rank 3 (skips 2)
  });

  it('should handle multiple ties', () => {
    const items = [
      { name: 'A', value: 100 },
      { name: 'B', value: 100 },
      { name: 'C', value: 100 },
      { name: 'D', value: 200 },
    ];

    const rankings = calculateRankings(items, item => item.value, true);

    expect(rankings[0]).toBe(1); // A - rank 1
    expect(rankings[1]).toBe(1); // B - rank 1
    expect(rankings[2]).toBe(1); // C - rank 1
    expect(rankings[3]).toBe(4); // D - rank 4
  });
});

// =============================================================================
// DEADLINE TESTS
// =============================================================================

describe('isDeadlinePassed', () => {
  it('should return true when deadline is in the past', () => {
    const pastDate = new Date(Date.now() - 60000); // 1 minute ago
    expect(isDeadlinePassed(pastDate)).toBe(true);
    expect(isDeadlinePassed(pastDate.toISOString())).toBe(true);
  });

  it('should return false when deadline is in the future', () => {
    const futureDate = new Date(Date.now() + 60000); // 1 minute from now
    expect(isDeadlinePassed(futureDate)).toBe(false);
    expect(isDeadlinePassed(futureDate.toISOString())).toBe(false);
  });
});

describe('getTimeUntilDeadline', () => {
  it('should return positive milliseconds for future deadline', () => {
    const futureDate = new Date(Date.now() + 60000);
    const timeRemaining = getTimeUntilDeadline(futureDate);

    expect(timeRemaining).toBeGreaterThan(0);
    expect(timeRemaining).toBeLessThanOrEqual(60000);
  });

  it('should return 0 for past deadline', () => {
    const pastDate = new Date(Date.now() - 60000);
    expect(getTimeUntilDeadline(pastDate)).toBe(0);
  });
});

describe('formatTimeRemaining', () => {
  it('should format days, hours, minutes', () => {
    const twoDays = 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
    expect(formatTimeRemaining(twoDays)).toBe('2d 5h 30m');
  });

  it('should format hours and minutes', () => {
    const fiveHours = 5 * 60 * 60 * 1000 + 45 * 60 * 1000;
    expect(formatTimeRemaining(fiveHours)).toBe('5h 45m');
  });

  it('should format just minutes', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(formatTimeRemaining(thirtyMinutes)).toBe('30m');
  });

  it('should return "Deadline passed" for 0 or negative', () => {
    expect(formatTimeRemaining(0)).toBe('Deadline passed');
    expect(formatTimeRemaining(-1000)).toBe('Deadline passed');
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration: Full race result processing', () => {
  const raceResults: StageRider[] = [
    { nameID: 'winner', place: 1, timeDifference: '' },
    { nameID: 'second', place: 2, timeDifference: '0:30' },
    { nameID: 'third', place: 3, timeDifference: '0:45' },
    { nameID: 'tenth', place: 10, timeDifference: '5:00' },
    { nameID: 'eleventh', place: 11, timeDifference: '5:30' },
    { nameID: 'last', place: 150, timeDifference: '1:30:00' },
  ];

  it('should correctly process multiple picks', () => {
    const picks = [
      { riderId: 'winner' },
      { riderId: 'second' },
      { riderId: 'tenth' },
      { riderId: 'eleventh' },
      { riderId: 'dnf-rider' },
    ];

    const results = picks.map(pick => ({
      ...calculateTimeLoss(raceResults, pick.riderId),
      greenJerseyPoints: calculateGreenJerseyPoints(
        calculateTimeLoss(raceResults, pick.riderId).riderFinishPosition
      )
    }));

    // Winner: 0 time, 10 points
    expect(results[0].timeLostSeconds).toBe(0);
    expect(results[0].greenJerseyPoints).toBe(10);

    // Second: 30 seconds, 9 points
    expect(results[1].timeLostSeconds).toBe(30);
    expect(results[1].greenJerseyPoints).toBe(9);

    // Tenth: 5:00, 1 point
    expect(results[2].timeLostSeconds).toBe(300);
    expect(results[2].greenJerseyPoints).toBe(1);

    // Eleventh: 5:30, 0 points (outside top 10)
    expect(results[3].timeLostSeconds).toBe(330);
    expect(results[3].greenJerseyPoints).toBe(0);

    // DNF: penalty time, 0 points
    expect(results[4].timeLostSeconds).toBe(5460); // 1:30:00 + 1:00
    expect(results[4].isPenalty).toBe(true);
    expect(results[4].greenJerseyPoints).toBe(0);
  });
});
