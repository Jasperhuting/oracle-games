/**
 * Page-Specific Types
 * Types used by specific page components
 */

import { Rider } from './rider';
import { GameType, RaceType, GameStatus, AuctionPeriod } from './games';
import { SerializedFirestoreTimestamp } from '../utils/timestamp';

// Rider Points Page
export interface StagePoint {
  date: Date;
  stage: number;
  raceSlug: string;
  raceName: string;
  points: number;
  breakdown: {
    stageResult?: number;
    gcPoints?: number;
    pointsClass?: number;
    mountainsClass?: number;
    youthClass?: number;
    mountainPoints?: number;
    sprintPoints?: number;
    combativityBonus?: number;
    teamPoints?: number;
  };
}

export interface DayData {
  date: Date;
  dateString: string;
  stages: StagePoint[];
}

export interface RiderPointsData {
  riderId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  jerseyImage?: string;
  totalPoints: number;
  pointsByDate: StagePoint[];
  pointsByDay: DayData[];
}

// Scraper Page
export interface ScrapingResult {
  success: boolean;
  message?: string;
  error?: string;
  dataCount?: number;
  timestamp: SerializedFirestoreTimestamp | string;
  // For all-stages results
  type?: string;
  totalStages?: number;
  successfulStages?: number;
  failedStages?: number;
  totalDataCount?: number;
  results?: Array<{
    stage: number;
    success: boolean;
    dataCount?: number;
    error?: string;
  }>;
}

export interface BulkJob {
  id: string;
  race: string;
  year: number;
  totalStages: number;
  status: 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: Array<{
    stage: number;
    success: boolean;
    dataCount?: number;
    error?: string;
  }>;
  errors: Array<{
    stage: number;
    error: string;
  }>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// Admin Finalize Overview Page
export interface FinalizePlayerTeam {
  id: string;
  gameId: string;
  userId: string;
  playername: string;
  riderNameId: string;
  riderName: string;
  riderTeam?: string;
  pricePaid: number;
  acquiredAt: Date;
  acquisitionType: string;
}

export interface FinalizeGame {
  id: string;
  name: string;
  division?: string;
  divisionLevel?: number;
  gameType: string;
  status: string;
}

export interface DivisionData {
  game: FinalizeGame;
  purchases: FinalizePlayerTeam[];
}

export interface GameGroupData {
  baseName: string;
  divisions: DivisionData[];
}

// Admin Simulate Results Page
export interface SimulateRace {
  id: string;
  name: string;
  slug: string;
  year: number;
}

// Auction Page
export interface AuctionGameData {
  id: string;
  name: string;
  gameType: GameType;
  year: number;
  status: GameStatus;
  division?: string;
  raceType: RaceType;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  playerCount: number;
  teamSelectionDeadline?: string; 
  eligibleTeams: string[];
  config: Record<string, unknown> & {
    budget?: number;
    maxRiders?: number;
    minRiders?: number;
    teamSize?: number;
    auctionStatus?: 'pending' | 'active' | 'closed' | 'finalized';
    maxMinimumBid?: number;
    // WorldTour Manager specific
    minNeoPros?: number;
    maxNeoProPoints?: number;
    maxNeoProAge?: number;
    auctionPeriods?: AuctionPeriod[];
  };
  eligibleRiders: string[];
  bidding: boolean;
}

export interface AuctionParticipantData {
  id: string;
  userId: string;
  budget?: number;
  spentBudget?: number;
  rosterSize: number;
  rosterComplete: boolean;
  playername?: string;
  assignedDivision?: string;
  name?: string;
  email?: string;
}

export interface RiderWithBid extends Rider {
  highestBid?: number;
  highestBidder?: string;
  myBid?: number;
  myBidStatus?: string;
  myBidId?: string;
  effectiveMinBid?: number; // The actual minimum bid after applying maxMinimumBid cap
  soldTo?: string; // Player name who owns this rider (from previous auction rounds)
  isSold?: boolean; // Whether this rider is already sold
  pricePaid?: number; // Price paid for this rider in the auction
}

// Auction Teams Page
export interface AuctionTeamsRider {
  riderId: string;
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  baseValue: number;
  pricePaid: number;
  percentageDiff: number;
  pointsScored: number;
  acquiredAt: Date;
  bidAt: Date;
  acquisitionType: string;
}

export interface AuctionTeam {
  participantId: string;
  userId: string;
  playername: string;
  budget: number;
  spentBudget: number;
  remainingBudget: number;
  rosterSize: number;
  rosterComplete: boolean;
  totalPoints: number;
  ranking: number;
  riders: AuctionTeamsRider[];
  totalRiders: number;
  totalBaseValue: number;
  totalSpent: number;
  totalDifference: number;
  totalPercentageDiff: number;
  averagePrice: number;
  averageValue: number;
}

