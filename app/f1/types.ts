import { Timestamp } from 'firebase/firestore';

// ============================================
// F1 Database Types for oracle-games-f1
// ============================================

// ============================================
// Season
// ============================================
export interface F1Season {
  year: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  totalRaces: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Team (Constructor)
// ============================================
export interface F1Team {
  id: string;
  name: string;
  shortName: string;
  season: number;
  color: string;
  colorAlt?: string;
  carImage?: string;
  country: string;
  isActive: boolean;
  createdAt: Timestamp;
}

// ============================================
// Driver
// ============================================
export interface F1Driver {
  shortName: string;
  firstName: string;
  lastName: string;
  teamId: string;
  season: number;
  number: number;
  country: string;
  image: string;
  numberImage?: string;
  isActive: boolean;
  createdAt: Timestamp;
}

// Extended driver with team data (for UI display)
export interface F1DriverWithTeam extends F1Driver {
  team: F1Team;
}

// ============================================
// Race
// ============================================
export type RaceStatus = 'upcoming' | 'open' | 'done';

export interface F1Race {
  round: number;
  season: number;
  name: string;
  subName: string;
  startDate: string;
  endDate: string;
  raceImage: string;
  raceRoundPosition: [HorizontalPosition, VerticalPosition];
  circuit?: string;
  country?: string;
  status: RaceStatus;
  predictionDeadline?: Timestamp;
  createdAt: Timestamp;
}

export type HorizontalPosition = 'left' | 'center' | 'right';
export type VerticalPosition = 'top' | 'center' | 'bottom';

// ============================================
// Race Results (Official)
// ============================================
export interface F1RaceResult {
  raceId: string;
  season: number;
  round: number;
  finishOrder: string[];  // Array of driver shortNames (22 positions)
  polePosition: string;
  fastestLap: string;
  dnfDrivers: string[];
  publishedAt: Timestamp;
  createdAt: Timestamp;
}

// ============================================
// SubLeague (Poule)
// ============================================
export interface F1SubLeague {
  id?: string;  // Document ID
  name: string;
  code: string;  // Unique join code
  season: number;
  gameId?: string;  // Reference to game in default database
  createdBy: string;  // userId from default database
  memberIds: string[];
  isPublic: boolean;
  maxMembers: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Prediction
// ============================================
export interface F1Prediction {
  userId: string;  // userId from default database
  raceId: string;  // Format: "2026_01"
  season: number;
  round: number;
  
  // Predictions
  finishOrder: string[];  // Array of driver shortNames (22 positions)
  polePosition: string | null;
  fastestLap: string | null;
  dnf1: string | null;
  dnf2: string | null;
  
  // Metadata
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  isLocked: boolean;
}

// ============================================
// Standings
// ============================================
export interface F1Standing {
  userId: string;  // userId from default database
  visibleName?: string;  // Display name for test users
  season: number;
  
  // Totals
  totalPoints: number;
  correctPredictions: number;
  racesParticipated: number;
  bestFinish: number | null;
  
  // Per race breakdown
  racePoints: Record<string, number>;  // { "2026_01": 28, "2026_02": 32, ... }
  
  lastRacePoints: number | null;
  lastRaceRound: number | null;
  
  updatedAt: Timestamp;
}

// ============================================
// Points History (Subcollection of Standings)
// ============================================
export interface F1PointsBreakdown {
  positionPoints: number;
  poleBonus: number;
  fastestLapBonus: number;
  dnfBonus: number;
}

export interface F1PointsHistory {
  round: number;
  raceId: string;
  points: number;
  breakdown: F1PointsBreakdown;
  calculatedAt: Timestamp;
}

// ============================================
// Points Configuration
// ============================================
export const F1_POINTS_CONFIG = {
  position: {
    exact: 25,      // Exact position match
    offBy1: 10,     // 1 position difference
    offBy2: 5,      // 2 positions difference
    inTop10: 2,     // In top 10 but >2 difference
  },
  polePosition: 10,
  fastestLap: 10,
  dnfCorrect: 5,    // Per correct DNF
} as const;

// ============================================
// Legacy Driver Type (compatible with old data.ts)
// ============================================
export interface LegacyDriver {
  firstName: string;
  lastName: string;
  shortName: string;
  team: string;
  teamColor?: string;
  teamColorAlt?: string;
  teamShortName: string;
  carImage?: string;
  number: number;
  numberImage?: string;
  country: string;
  image: string;
}

// Convert F1Driver + F1Team to LegacyDriver format for backward compatibility
export function toLegacyDriver(driver: F1Driver, team: F1Team): LegacyDriver {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    shortName: driver.shortName,
    team: team.name,
    teamColor: team.color,
    teamColorAlt: team.colorAlt,
    teamShortName: team.shortName,
    carImage: team.carImage,
    number: driver.number,
    numberImage: driver.numberImage,
    country: driver.country,
    image: driver.image,
  };
}

// ============================================
// Helper Types
// ============================================

// Document IDs
export type SeasonDocId = string;  // "2026"
export type TeamDocId = string;    // "alpine_2026"
export type DriverDocId = string;  // "GAS_2026"
export type RaceDocId = string;    // "2026_01"
export type PredictionDocId = string;  // "userId_2026_01"
export type StandingDocId = string;    // "userId_2026"

// Helper functions for document IDs
export function createRaceDocId(season: number, round: number): RaceDocId {
  return `${season}_${String(round).padStart(2, '0')}`;
}

export function createPredictionDocId(userId: string, season: number, round: number): PredictionDocId {
  return `${userId}_${season}_${String(round).padStart(2, '0')}`;
}

export function createStandingDocId(userId: string, season: number): StandingDocId {
  return `${userId}_${season}`;
}

export function createDriverDocId(shortName: string, season: number): DriverDocId {
  return `${shortName}_${season}`;
}

export function createTeamDocId(teamId: string, season: number): TeamDocId {
  return `${teamId}_${season}`;
}

// Parse document IDs
export function parseRaceDocId(docId: RaceDocId): { season: number; round: number } {
  const [season, round] = docId.split('_');
  return { season: parseInt(season), round: parseInt(round) };
}

export function parsePredictionDocId(docId: PredictionDocId): { userId: string; season: number; round: number } {
  const parts = docId.split('_');
  const round = parseInt(parts.pop()!);
  const season = parseInt(parts.pop()!);
  const userId = parts.join('_');
  return { userId, season, round };
}

// ============================================
// Collection Names
// ============================================
export const F1_COLLECTIONS = {
  SEASONS: 'seasons',
  TEAMS: 'teams',
  DRIVERS: 'drivers',
  RACES: 'races',
  RACE_RESULTS: 'raceResults',
  SUB_LEAGUES: 'subLeagues',
  PREDICTIONS: 'predictions',
  STANDINGS: 'standings',
  POINTS_HISTORY: 'pointsHistory',  // Subcollection
} as const;

// ============================================
// API Response Types
// ============================================
export interface F1ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface F1StandingsResponse {
  standings: (F1Standing & { userName?: string; userAvatar?: string })[];
  season: number;
  lastUpdated: string;
}

export interface F1RaceWithPrediction {
  race: F1Race;
  prediction: F1Prediction | null;
  result: F1RaceResult | null;
  points: number | null;
}
