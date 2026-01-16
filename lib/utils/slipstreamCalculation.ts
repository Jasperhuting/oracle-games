/**
 * Slipstream Game Calculation Utilities
 *
 * Handles time loss calculations, green jersey points, and penalty logic
 * for the Slipstream cycling fantasy game.
 */

import { DEFAULT_GREEN_JERSEY_POINTS } from '@/lib/types/games';

// ============================================================================
// TYPES
// ============================================================================

export interface StageRider {
  nameID?: string;
  shortName?: string;
  rank?: number;
  place?: number;           // Finish position
  time?: string;            // Absolute time
  timeDifference?: string;  // Gap to winner (e.g., "+0:34", "+1:23:45")
  gap?: string;             // Alternative field for gap
}

export interface TimeLossResult {
  timeLostSeconds: number;
  timeLostFormatted: string;
  isPenalty: boolean;
  penaltyReason?: 'dnf' | 'dns' | 'dsq' | 'missed_pick';
  riderFinishPosition?: number;
}

export interface PenaltyResult {
  timeLostSeconds: number;
  timeLostFormatted: string;
}

// ============================================================================
// TIME PARSING AND FORMATTING
// ============================================================================

/**
 * Parse a time gap string to seconds
 * Handles formats like: "0:34", "1:23", "1:02:34", "+0:34", "s.t." (same time)
 */
export function parseTimeGap(gap: string | undefined | null): number {
  if (!gap) return 0;

  // Handle "s.t." (same time) or empty values
  const cleanGap = gap.replace('+', '').trim().toLowerCase();
  if (cleanGap === 's.t.' || cleanGap === 'st' || cleanGap === '' || cleanGap === '-') {
    return 0;
  }

  const parts = cleanGap.split(':').map(Number);

  // Filter out NaN values
  if (parts.some(isNaN)) {
    console.warn(`[SLIPSTREAM] Could not parse time gap: ${gap}`);
    return 0;
  }

  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  // Single number (seconds only)
  if (parts.length === 1) {
    return parts[0];
  }

  return 0;
}

/**
 * Format seconds to a human-readable time string
 * Returns "MM:SS" or "H:MM:SS" format
 */
export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to a human-readable time string with "+" prefix for non-zero times
 * Used for displaying time gaps in standings
 */
export function formatTimeGap(seconds: number): string {
  if (seconds <= 0) return '0:00';
  return `+${formatTime(seconds)}`;
}

// ============================================================================
// TIME LOSS CALCULATION
// ============================================================================

/**
 * Convert a rider name/ID to a slug format for matching
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Calculate time loss for a rider in a stage/race
 *
 * @param stageResults - Array of riders with their results
 * @param riderId - The rider's nameID to look up
 * @param penaltyMinutes - Penalty time in minutes for DNF/DNS (default: 1)
 * @returns Time loss result with formatted time and penalty info
 */
export function calculateTimeLoss(
  stageResults: StageRider[],
  riderId: string,
  penaltyMinutes: number = 1
): TimeLossResult {
  // Find the rider in results
  const riderResult = stageResults.find(r =>
    r.nameID === riderId ||
    toSlug(r.shortName || '') === riderId ||
    toSlug(r.nameID || '') === toSlug(riderId)
  );

  // Rider not in results - DNF/DNS
  if (!riderResult) {
    const lastFinisher = getLastFinisher(stageResults);
    const lastFinisherGap = parseTimeGap(lastFinisher?.timeDifference || lastFinisher?.gap);
    const penaltySeconds = penaltyMinutes * 60;
    const totalPenalty = lastFinisherGap + penaltySeconds;

    return {
      timeLostSeconds: totalPenalty,
      timeLostFormatted: formatTime(totalPenalty),
      isPenalty: true,
      penaltyReason: 'dnf'
    };
  }

  // Get finish position
  const finishPosition = riderResult.place || riderResult.rank;

  // Winner has 0 time lost
  if (finishPosition === 1) {
    return {
      timeLostSeconds: 0,
      timeLostFormatted: '0:00',
      isPenalty: false,
      riderFinishPosition: 1
    };
  }

  // Parse time difference from results
  const timeDiff = riderResult.timeDifference || riderResult.gap;
  const timeLostSeconds = parseTimeGap(timeDiff);

  return {
    timeLostSeconds,
    timeLostFormatted: formatTime(timeLostSeconds),
    isPenalty: false,
    riderFinishPosition: finishPosition
  };
}

/**
 * Get the last finisher from stage results (for penalty calculation)
 */
function getLastFinisher(stageResults: StageRider[]): StageRider | undefined {
  // Filter riders with valid finish positions and sort by position (descending)
  const finishers = stageResults
    .filter(r => (r.place || r.rank) && (r.timeDifference || r.gap))
    .sort((a, b) => {
      const posA = a.place || a.rank || 0;
      const posB = b.place || b.rank || 0;
      return posB - posA;  // Descending order
    });

  return finishers[0];
}

// ============================================================================
// GREEN JERSEY POINTS
// ============================================================================

/**
 * Calculate green jersey points based on finish position
 * Default scoring: 1st=10, 2nd=9, 3rd=8, ... 10th=1
 *
 * @param finishPosition - The rider's finish position (1-based)
 * @param pointsConfig - Optional custom points configuration
 * @returns Points earned (0 if outside top 10)
 */
export function calculateGreenJerseyPoints(
  finishPosition: number | undefined,
  pointsConfig: Record<number, number> = DEFAULT_GREEN_JERSEY_POINTS
): number {
  if (!finishPosition || finishPosition < 1) return 0;
  return pointsConfig[finishPosition] || 0;
}

// ============================================================================
// PENALTY CALCULATION
// ============================================================================

/**
 * Apply penalty for missed pick
 * Penalty = last finisher's time + penaltyMinutes
 *
 * @param stageResults - Array of riders with their results
 * @param penaltyMinutes - Penalty time in minutes (default: 1)
 * @returns Penalty result with formatted time
 */
export function applyMissedPickPenalty(
  stageResults: StageRider[],
  penaltyMinutes: number = 1
): PenaltyResult {
  const lastFinisher = getLastFinisher(stageResults);
  const lastFinisherGap = parseTimeGap(lastFinisher?.timeDifference || lastFinisher?.gap);
  const penaltySeconds = penaltyMinutes * 60;
  const totalPenalty = lastFinisherGap + penaltySeconds;

  return {
    timeLostSeconds: totalPenalty,
    timeLostFormatted: formatTime(totalPenalty)
  };
}

// ============================================================================
// STANDINGS CALCULATION
// ============================================================================

/**
 * Sort participants by total time lost (ascending - less is better)
 * Used for Yellow Jersey standings
 */
export function sortByTimeLost<T extends { totalTimeLostSeconds: number }>(
  participants: T[]
): T[] {
  return [...participants].sort((a, b) => a.totalTimeLostSeconds - b.totalTimeLostSeconds);
}

/**
 * Sort participants by green jersey points (descending - more is better)
 * Used for Green Jersey standings
 */
export function sortByGreenPoints<T extends { totalGreenJerseyPoints: number }>(
  participants: T[]
): T[] {
  return [...participants].sort((a, b) => b.totalGreenJerseyPoints - a.totalGreenJerseyPoints);
}

/**
 * Calculate rankings with tie handling
 * Returns array of rankings corresponding to input array positions
 */
export function calculateRankings<T>(
  items: T[],
  getValue: (item: T) => number,
  ascending: boolean = true
): number[] {
  // Create array of {index, value} pairs
  const indexed = items.map((item, index) => ({
    index,
    value: getValue(item)
  }));

  // Sort by value
  indexed.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

  // Assign rankings (handle ties)
  const rankings = new Array<number>(items.length);
  let currentRank = 1;

  for (let i = 0; i < indexed.length; i++) {
    if (i > 0 && indexed[i].value !== indexed[i - 1].value) {
      currentRank = i + 1;  // Skip ranks for ties
    }
    rankings[indexed[i].index] = currentRank;
  }

  return rankings;
}

// ============================================================================
// RACE STATUS HELPERS
// ============================================================================

/**
 * Check if a race's pick deadline has passed
 */
export function isDeadlinePassed(pickDeadline: Date | string): boolean {
  const deadline = typeof pickDeadline === 'string' ? new Date(pickDeadline) : pickDeadline;
  return new Date() > deadline;
}

/**
 * Get time remaining until deadline in milliseconds
 * Returns 0 if deadline has passed
 */
export function getTimeUntilDeadline(pickDeadline: Date | string): number {
  const deadline = typeof pickDeadline === 'string' ? new Date(pickDeadline) : pickDeadline;
  const remaining = deadline.getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * Format time remaining as human-readable string
 * e.g., "2d 5h 30m", "5h 30m", "30m", "5m"
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Deadline passed';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;

  if (days > 0) {
    return `${days}d ${remainingHours}h ${remainingMinutes}m`;
  }
  if (hours > 0) {
    return `${remainingHours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}
