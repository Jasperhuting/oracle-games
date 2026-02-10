/**
 * Points calculation utilities for Auctioneer games
 */

// Points system for top 20 (stage results and classifications)
// 50 – 44 – 40 – 36 – 32 – 30 – 28 – 26 – 24 – 22 – 20 – 18 – 16 – 14 – 12 – 10 – 8 – 6 – 4 – 2
export const TOP_20_POINTS: Record<number, number> = {
  1: 50, 2: 44, 3: 40, 4: 36, 5: 32,
  6: 30, 7: 28, 8: 26, 9: 24, 10: 22,
  11: 20, 12: 18, 13: 16, 14: 14, 15: 12,
  16: 10, 17: 8, 18: 6, 19: 4, 20: 2,
};

// Full Grid points scales (top 20 unless noted)
export const FULL_GRID_SCALE_1: Record<number, number> = {
  1: 150, 2: 128, 3: 110, 4: 95, 5: 82,
  6: 71, 7: 61, 8: 52, 9: 44, 10: 37,
  11: 31, 12: 26, 13: 22, 14: 19, 15: 17,
  16: 15, 17: 13, 18: 12, 19: 11, 20: 10,
};

export const FULL_GRID_SCALE_2: Record<number, number> = {
  1: 100, 2: 85, 3: 72, 4: 61, 5: 52,
  6: 44, 7: 37, 8: 31, 9: 26, 10: 22,
  11: 19, 12: 16, 13: 14, 14: 12, 15: 10,
  16: 9, 17: 8, 18: 7, 19: 6, 20: 5,
};

export const FULL_GRID_SCALE_3: Record<number, number> = {
  1: 75, 2: 65, 3: 55, 4: 46, 5: 38,
  6: 31, 7: 25, 8: 20, 9: 16, 10: 13,
  11: 11, 12: 9, 13: 8, 14: 7, 15: 6,
  16: 5, 17: 4, 18: 3, 19: 2, 20: 1,
};

export const FULL_GRID_SCALE_4_STAGE: Record<number, number> = {
  1: 50, 2: 44, 3: 38, 4: 34, 5: 30,
  6: 26, 7: 22, 8: 18, 9: 14, 10: 12,
  11: 10, 12: 8, 13: 6, 14: 4, 15: 2,
};

export const FULL_GRID_SCALE_4_GC: Record<number, number> = {
  1: 100, 2: 88, 3: 76, 4: 68, 5: 60,
  6: 52, 7: 44, 8: 36, 9: 28, 10: 24,
  11: 20, 12: 16, 13: 12, 14: 8, 15: 4,
};

export function getFullGridStagePoints(scale: 1 | 2 | 3 | 4, rank: number): number {
  if (scale === 1) return FULL_GRID_SCALE_1[rank] || 0;
  if (scale === 2) return FULL_GRID_SCALE_2[rank] || 0;
  if (scale === 3) return FULL_GRID_SCALE_3[rank] || 0;
  return FULL_GRID_SCALE_4_STAGE[rank] || 0;
}

export function getFullGridGCPoints(scale: 1 | 2 | 3 | 4, rank: number): number {
  if (scale === 4) return FULL_GRID_SCALE_4_GC[rank] || 0;
  return 0;
}

// Team classification points (top 5 teams)
export const TEAM_CLASSIFICATION_POINTS: Record<number, number> = {
  1: 5, 2: 4, 3: 3, 4: 2, 5: 1,
};

// Strijdlust bonus (combativity award)
export const COMBATIVITY_BONUS = 25;

/**
 * Calculate points for a rider based on their rank in a stage result
 * @param rank - The rider's finishing position (1-based)
 * @returns Points earned (0 if outside top 20)
 */
export function calculateStagePoints(rank: number): number {
  return TOP_20_POINTS[rank] || 0;
}

/**
 * Calculate points for mountain classification during a stage
 * @param mountainPoints - Points earned in mountain classification during the stage
 * @param multiplier - Multiplier based on race (4 for Tour, 2 for Giro)
 * @returns Points earned
 */
export function calculateMountainPoints(mountainPoints: number, multiplier: number = 4): number {
  return mountainPoints * multiplier;
}

/**
 * Calculate points for sprint classification during a stage
 * @param sprintPoints - Points earned in sprint classification during the stage
 * @param multiplier - Multiplier (default 2)
 * @returns Points earned
 */
export function calculateSprintPoints(sprintPoints: number, multiplier: number = 2): number {
  return sprintPoints * multiplier;
}

/**
 * Calculate points for team classification
 * @param teamRank - Team's rank in classification (1-5)
 * @param activeRidersCount - Number of active riders from this team
 * @returns Points earned
 */
export function calculateTeamPoints(teamRank: number, activeRidersCount: number): number {
  const basePoints = TEAM_CLASSIFICATION_POINTS[teamRank] || 0;
  return basePoints * activeRidersCount;
}

/**
 * Calculate combativity bonus
 * @param wasInBreakaway - Whether rider was in breakaway for >50% of stage
 * @returns Points earned
 */
export function calculateCombativityBonus(wasInBreakaway: boolean): number {
  return wasInBreakaway ? COMBATIVITY_BONUS : 0;
}

/**
 * Get GC multiplier based on stage type
 * Voor de stand in het algemeen klassement worden op de eerste rustdag (1x), 
 * de tweede rustdag (2x) en na afloop (3x) punten toegekend
 * 
 * @param stageNumber - Current stage number
 * @param totalStages - Total number of stages
 * @param restDays - Array of rest day stage numbers
 * @returns Multiplier for GC points (0, 1, 2, or 3)
 */
export function getGCMultiplier(
  stageNumber: number,
  totalStages: number,
  restDays: number[] = []
): number {
  // Final stage: 3x multiplier
  if (stageNumber === totalStages) {
    return 3;
  }
  
  // Rest days: 1x for first, 2x for second
  if (restDays.length > 0) {
    const restDayIndex = restDays.indexOf(stageNumber);
    if (restDayIndex === 0) return 1; // First rest day
    if (restDayIndex === 1) return 2; // Second rest day
  }
  
  // Regular stages: no GC points
  return 0;
}

/**
 * Get classification multiplier for final standings
 * Voor het punten en bergklassement wordt eenmalig punten toegekend na afloop van de Tour.
 * Voor het jongerenklassement gebeurd dit twee keer.
 * 
 * @param classificationType - Type of classification
 * @param stageNumber - Current stage number
 * @param totalStages - Total number of stages
 * @returns Multiplier (0 or 1 for points/mountains, 0 or 1 for youth)
 */
export function getClassificationMultiplier(
  classificationType: 'points' | 'mountains' | 'youth',
  stageNumber: number,
  totalStages: number
): number {
  // Points and mountains: only at final stage
  if (classificationType === 'points' || classificationType === 'mountains') {
    return stageNumber === totalStages ? 1 : 0;
  }
  
  // Youth: TODO - need to determine when to award (twice during race)
  // For now, only at final stage
  if (classificationType === 'youth') {
    return stageNumber === totalStages ? 1 : 0;
  }
  
  return 0;
}

/**
 * Get points system from game config or use default
 * @param gameConfig - The game's configuration
 * @returns Points system to use
 */
export function getPointsSystem(): Record<number, number> {
  // Always use TOP_20_POINTS system
  return TOP_20_POINTS;
}

/**
 * Check if a race/stage should count for points in a game
 * @param raceSlug - The race slug (e.g., "tour-de-france_2025")
 * @param stage - The stage number
 * @param countingRaces - Array of counting races from game config (can be strings or objects)
 * @returns True if this race/stage counts for points
 */
export function shouldCountForPoints(
  raceSlug: string,
  stage: number | string,
  countingRaces?: Array<string | { raceId: string; raceSlug: string; raceName: string; stages?: number[] }>
): boolean {
  // If no countingRaces specified, all races count
  if (!countingRaces || countingRaces.length === 0) {
    return true;
  }

  // Check if this race is in the counting races
  // countingRaces can be strings (e.g., "tour-down-under_2026") or objects with raceSlug/raceId
  const countingRace = countingRaces.find(cr => {
    if (typeof cr === 'string') {
      // String format: check if raceSlug matches or contains the counting race string
      return raceSlug === cr || raceSlug.includes(cr.replace(/_\d{4}$/, '')) || cr.includes(raceSlug.replace(/_\d{4}$/, ''));
    }
    // Object format: check raceSlug or raceId
    return raceSlug.includes(cr.raceSlug) || raceSlug === cr.raceId;
  });

  if (!countingRace) {
    return false;
  }

  // If countingRace is a string, all stages count (no stage filtering)
  if (typeof countingRace === 'string') {
    return true;
  }

  // If no specific stages specified, all stages of this race count
  if (!countingRace.stages || countingRace.stages.length === 0) {
    return true;
  }

  // Check if this specific stage is in the counting stages
  const stageNum = typeof stage === 'string' ? parseInt(stage) : stage;
  return countingRace.stages.includes(stageNum);
}
