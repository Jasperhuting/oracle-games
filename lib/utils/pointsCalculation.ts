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
 * @param countingRaces - Array of counting races from game config
 * @returns True if this race/stage counts for points
 */
export function shouldCountForPoints(
  raceSlug: string,
  stage: number | string,
  countingRaces?: Array<{ raceId: string; raceSlug: string; raceName: string; stages?: number[] }>
): boolean {
  // If no countingRaces specified, all races count
  if (!countingRaces || countingRaces.length === 0) {
    return true;
  }

  // Check if this race is in the counting races
  const countingRace = countingRaces.find(cr => 
    raceSlug.includes(cr.raceSlug) || raceSlug === cr.raceId
  );

  if (!countingRace) {
    return false;
  }

  // If no specific stages specified, all stages of this race count
  if (!countingRace.stages || countingRace.stages.length === 0) {
    return true;
  }

  // Check if this specific stage is in the counting stages
  const stageNum = typeof stage === 'string' ? parseInt(stage) : stage;
  return countingRace.stages.includes(stageNum);
}
