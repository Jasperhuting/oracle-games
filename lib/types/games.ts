import { Timestamp } from 'firebase/firestore';

// ============================================================================
// GAME TYPES
// ============================================================================

export const GAME_TYPES = [
  'auctioneer',
  'slipstream',
  'last-man-standing',
  'poisoned-cup',
  'nations-cup',
  'rising-stars',
  'country-roads',
  'worldtour-manager',
  'fan-flandrien',
  'giorgio-armada',
  'marginal-gains',
] as const;

export type GameType = typeof GAME_TYPES[number];

export const RACE_TYPES = ['season', 'grand-tour', 'classics', 'single-race'] as const;
export type RaceType = typeof RACE_TYPES[number];

export const GAME_STATUSES = ['draft', 'registration', 'bidding', 'active', 'finished'] as const;
export type GameStatus = typeof GAME_STATUSES[number];

export const AUCTION_STATUSES = ['pending', 'active', 'closed', 'finalized'] as const;
export type AuctionStatus = typeof AUCTION_STATUSES[number];

export const PARTICIPANT_STATUSES = ['active', 'eliminated', 'withdrawn'] as const;
export type ParticipantStatus = typeof PARTICIPANT_STATUSES[number];

export const BID_STATUSES = ['active', 'outbid', 'won', 'lost'] as const;
export type BidStatus = typeof BID_STATUSES[number];

export const LEAGUE_VISIBILITIES = ['public', 'private', 'invite-only'] as const;
export type LeagueVisibility = typeof LEAGUE_VISIBILITIES[number];

export const ACQUISITION_TYPES = ['auction', 'selection', 'draft', 'pick'] as const;
export type AcquisitionType = typeof ACQUISITION_TYPES[number];

// ============================================================================
// GAME CONFIG TYPES (per game type)
// ============================================================================

export interface AuctionPeriod {
  name: string;                     // e.g., "Stage 1-5", "Pre-race"
  startDate: Timestamp;
  endDate: Timestamp;
  finalizeDate?: Timestamp;         // Optional: when to automatically finalize this auction period
  status: AuctionStatus;
  top200Only?: boolean;             // Only allow bidding on top 200 riders for this period
  neoProfsRequired?: number;        // Number of neo-professionals required (born after 01-01-2004)
  neoProfsMaxPoints?: number;       // Maximum points a neo-professional can have (e.g., 250)
  neoProfsMaxBudget?: number;       // Maximum budget allowed for neo-professionals combined
}

export interface CountingRace {
  raceId: string;                   // e.g., "tour-de-france_2025"
  raceSlug: string;                 // e.g., "tour-de-france"
  raceName: string;                 // e.g., "Tour de France"
  restDays?: number[];              // Stage numbers that are rest days (e.g., [9, 16])
  mountainPointsMultiplier?: number; // Multiplier for mountain points (default: 4 for Tour, 2 for Giro)
  sprintPointsMultiplier?: number;  // Multiplier for sprint points (default: 2)
}

export interface AuctioneerConfig {
  budget: number;                   // e.g., 100 credits
  maxRiders: number;                // e.g., 8
  auctionPeriods: AuctionPeriod[];  // Multiple auction windows
  auctionStatus: AuctionStatus;     // Overall status
  maxMinimumBid?: number;           // Optional cap on minimum bid (e.g., 3000 - even if rider is worth 4921, minimum bid is capped at 3000)
  allowSharedRiders?: boolean;      // Allow multiple users to buy the same rider (default: false)
  maxOwnersPerRider?: number;       // Maximum number of users who can own the same rider (only applies if allowSharedRiders is true, default: unlimited)
  countingRaces?: CountingRace[];   // Specific races that count for points
  countingClassifications?: string[]; // Race classifications that count (e.g., ["1.1", "1.2", "wc"])  
}

export interface CarryMeHomeConfig {
  allowReuse: boolean;              // false = each rider can only be picked once
  pointsSystem: 'time' | 'points';  // Score based on time or points
}

export interface LastManStandingConfig {
  budget: number;
  teamSize: number;
  eliminationSchedule: 'per-stage' | 'per-race';
}

export interface PoisonedCupConfig {
  teamSize: number;                 // e.g., 8
  budget: number;
  draftOrder: string[];             // Array of userIds in draft order
  currentDraftRound: number;
  currentDraftPick: string;         // userId whose turn it is
  snakeDraft: boolean;              // true for snake draft, false for linear
}

export interface NationsCupConfig {
  regions: string[];                // Array of regions/countries
  budgetPerRegion?: number;
}

export interface RisingStarsConfig {
  teamSize: number;
  draftOrder: string[];
  currentDraftRound: number;
  currentDraftPick: string;
}

export interface CountryRoadsConfig {
  poolCount: number;                // e.g., 12 pools
  pools: string[];                  // Pool IDs
}

export interface WorldTourManagerConfig {
  budget: number;                   // e.g., 12000 points
  minRiders: number;                // e.g., 27 (up to this number: no restrictions)
  maxRiders: number;                // e.g., 32 (if you have 28+: need at least 1 neo-prof)
  minNeoPros?: number;              // Deprecated: use minRiders instead (28+ riders requires 1 neo-prof)
  maxNeoProPoints?: number;         // e.g., 250 (max points per neo-pro in current year)
  maxNeoProAge?: number;            // e.g., 21 (maximum age for neo-professionals)
  auctionPeriods?: AuctionPeriod[]; // Auction periods with optional neo-pro rules
  auctionStatus?: AuctionStatus;    // Overall auction status
}

export interface FanFlandrienConfig {
  predictionsPerRace: number;       // e.g., 15 (top 15)
  races: string[];                  // Race slugs included
}

export interface GiorgioArmadaConfig {
  budget: number;
  teamsInRace: number;              // Number of teams participating
  riderValues: Record<string, number>; // nameId -> value (1-10)
}

export interface MarginalGainsConfig {
  teamSize: number;                 // e.g., 20 riders
  auctionPeriods?: AuctionPeriod[]; // Auction periods with optional rules
  auctionStatus?: AuctionStatus;    // Overall auction status
  currentYear: number;              // e.g., 2026 (the year we're tracking)
  // Note: Starting points come from rankings_{currentYear} (UCI points earned in previous year)
  // Current points come from seasonPoints_{currentYear} (points earned during current season)
}

export type GameConfig =
  | AuctioneerConfig
  | CarryMeHomeConfig
  | LastManStandingConfig
  | PoisonedCupConfig
  | NationsCupConfig
  | RisingStarsConfig
  | CountryRoadsConfig
  | WorldTourManagerConfig
  | FanFlandrienConfig
  | GiorgioArmadaConfig
  | MarginalGainsConfig;

// ============================================================================
// GAME DOCUMENT
// ============================================================================

export interface Game {
  id?: string;                      // Document ID
  name: string;                     // e.g., "Auctioneer - Tour de France 2025 - Division 1"
  gameType: GameType;

  // Race information (optional for season games)
  raceRef?: string; // Path to race document or DocumentReference
  raceType: RaceType;
  year: number;

  // Admin & timestamps
  createdBy: string;                // Admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Status
  status: GameStatus;
  registrationOpenDate?: Timestamp;
  registrationCloseDate?: Timestamp;
  teamSelectionDeadline?: Timestamp;  // Deadline for team selection/bidding

  // Division (for games with divisions)
  division?: string;                // e.g., "Division 1", "Hoofdklasse"
  divisionLevel?: number;           // For sorting (1 = highest)
  divisionCount?: number;           // Number of divisions (1 = single, >1 = multiple with manual assignment)

  // Participants
  playerCount: number;
  maxPlayers?: number;
  minPlayers?: number;

  // Race lineup - which teams and riders are participating
  eligibleTeams: string[];          // Team slugs
  eligibleRiders: string[];         // Rider nameIDs

  // Bidding flag
  bidding: boolean;                 // true for auctioneer games, false otherwise

  // Game-specific configuration
  config: GameConfig;

  // Auction finalization timestamp
  finalizedAt?: Timestamp;

}

// ============================================================================
// GAME PARTICIPANT
// ============================================================================

// Rider in GameParticipant's team array (denormalized for quick access)
export interface ParticipantTeamRider {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  jerseyImage?: string;
  pricePaid: number;
  acquiredAt: Timestamp;            // When the rider was acquired
}

export interface GameParticipant {
  id?: string;                      // Document ID
  gameId: string;
  userId: string;
  playername: string;
  userEmail?: string;               // User's email address

  joinedAt: Timestamp;
  status: ParticipantStatus;
  eliminatedAt?: Timestamp;         // For Last Man Standing

  // Budget tracking (for games with budget)
  budget?: number;
  spentBudget?: number;

  // Team info
  teamName?: string;                // Optional custom team name
  team?: ParticipantTeamRider[];    // Denormalized team array (for quick access without joining playerTeams)
  rosterSize: number;
  rosterComplete: boolean;          // Is team complete?

  // Scores
  totalPoints: number;
  ranking: number;

  // For division system
  divisionRanking?: number;         // Ranking within division
  assignedDivision?: string;        // For multi-division games, which division user is assigned to
  divisionAssigned?: boolean;       // For multi-division games, whether admin has assigned division

  pendingGameBaseName?: string;
  pendingGameType?: string;
  pendingGameYear?: number;
  pendingGameId?: string;

  // League memberships
  leagueIds: string[];              // Which leagues is this player in
}

// ============================================================================
// PLAYER TEAM (Riders owned by a player in a game)
// ============================================================================

export interface PlayerTeam {
  id?: string;                      // Document ID
  gameId: string;
  userId: string;
  riderNameId: string;

  // Acquisition
  acquiredAt: Timestamp;
  acquisitionType: AcquisitionType;
  pricePaid?: number;               // For auction/budget games
  draftRound?: number;              // For draft games
  draftPick?: number;

  // Rider info (denormalized for performance)
  riderName: string;
  riderTeam: string;                // Professional team
  riderCountry: string;
  jerseyImage?: string;
  riderValue?: number;              // For Giorgio Armada (1-10)

  // Status
  active: boolean;
  benched?: boolean;

  // Performance
  pointsScored: number;
  stagesParticipated: number;

  // Race-specific performance tracking
  racePoints?: Record<string, {    // Key: raceSlug (e.g., "tour-de-france_2025")
    totalPoints: number;            // Total points for this race
    stagePoints: Record<string, {   // Key: stage number (e.g., "1", "2")
      stageResult?: number;         // Points from stage result
      gcPoints?: number;            // Points from GC
      pointsClass?: number;         // Points from points classification
      mountainsClass?: number;      // Points from mountains classification
      youthClass?: number;          // Points from youth classification
      mountainPoints?: number;      // Points from mountain points during stage
      sprintPoints?: number;        // Points from sprint points during stage
      combativityBonus?: number;    // Combativity bonus
      teamPoints?: number;          // Team classification points
      total: number;                // Total points for this stage
    }>;
  }>;

  // For Carry Me Home (track which stages this rider was used)
  usedInStages?: string[];          // Stage IDs
}

// ============================================================================
// BIDS (for Auctioneer games)
// ============================================================================

export interface Bid {
  id?: string;                      // Document ID
  gameId: string;
  userId: string;
  playername: string;
  riderNameId: string;

  amount: number;
  bidAt: string;
  status: BidStatus;
  deletedAt?: string;

  // Denormalized rider info
  riderName: string;
  riderTeam: string;
  jerseyImage?: string;

}

// ============================================================================
// STAGE PICKS (for Carry Me Home, Fan Flandrien, etc.)
// ============================================================================

export interface StagePick {
  id?: string;                      // Document ID
  gameId: string;
  userId: string;
  playername: string;

  // Stage info
  raceSlug: string;
  stageNumber: number | string;     // "stage-1" or 1

  // For Carry Me Home
  riderId?: string;                 // Chosen rider
  riderName?: string;
  finishTime?: string;              // Time achieved
  points?: number;                  // Points scored

  // For Fan Flandrien (top 15 prediction)
  predictions?: Prediction[];

  pickedAt: Timestamp;
  locked: boolean;                  // Cannot be changed anymore
}

export interface Prediction {
  position: number;                 // 1-15
  riderId: string;
  riderName: string;
}

// ============================================================================
// LEAGUES (friend leagues within games)
// ============================================================================

export interface League {
  id?: string;                      // Document ID
  name: string;                     // e.g., "Martijn's Friends"
  gameId: string;                   // Which game this league belongs to

  createdBy: string;                // User UID
  createdAt: Timestamp;

  // Access
  visibility: LeagueVisibility;
  password?: string;                // For private leagues
  inviteCode?: string;              // For invite-only

  // Members
  memberIds: string[];              // Array of userIds
  maxMembers?: number;

  // League standings (cached for performance)
  standings: LeagueStanding[];

  description?: string;
}

export interface LeagueStanding {
  userId: string;
  playername: string;
  points: number;
  ranking: number;
}

// ============================================================================
// RACE LINEUPS (which teams and riders participate in a race)
// ============================================================================

export interface RaceLineup {
  id?: string;                      // Document ID (race slug)
  raceRef: string;                  // Path to race document or DocumentReference
  year: number;
  updatedAt: Timestamp;
  updatedBy: string;                // Admin UID

  teams: RaceTeam[];
}

export interface RaceTeam {
  teamSlug: string;                 // e.g., "soudal-quick-step"
  teamName: string;
  teamClass: string;
  riders: RaceRider[];
}

export interface RaceRider {
  nameId: string;                   // e.g., "remco-evenepoel"
  name: string;
  startNumber?: string;
  jerseyImage?: string;
}

// ============================================================================
// DIVISIONS
// ============================================================================

export interface Division {
  id?: string;                      // Document ID
  name: string;                     // "Hoofdklasse", "Division 1"
  level: number;                    // 1 = highest
  gameType: GameType;               // Which game type
  season: number;                   // e.g., 2025

  description?: string;

  // Promotion/relegation
  promotionSlots?: number;          // Top X get promoted
  relegationSlots?: number;         // Bottom X get relegated

  // Members
  playerIds: string[];
  playerCount: number;
  maxPlayers?: number;
}

// ============================================================================
// DRAFT PICKS (for Poisoned Cup, Rising Stars)
// ============================================================================

export interface DraftPick {
  id?: string;                      // Document ID
  gameId: string;
  userId: string;
  playername: string;

  round: number;                    // Draft round
  pick: number;                     // Pick number in this round
  overallPick: number;              // Overall pick number

  riderId: string;
  riderName: string;
  riderTeam: string;
  jerseyImage?: string;

  pickedAt: Timestamp;

  // For Rising Stars
  riderPreviousPoints?: number;     // Points from previous year
  riderCurrentPoints?: number;      // Points this year
  growth?: number;                  // current - previous
}

// ============================================================================
// SEASON POINTS (for tracking rider points across seasons)
// ============================================================================

export interface SeasonPoints {
  id?: string;                      // Document ID (riderNameId)
  riderNameId: string;
  riderName: string;
  year: number;                     // e.g., 2025, 2026
  totalPoints: number;              // Total points for the season

  // Breakdown by race
  races: Record<string, {           // Key: raceSlug (e.g., "tour-de-france_2025")
    raceName: string;
    totalPoints: number;            // Total points for this race

    stages: Record<string, {        // Key: stage number (e.g., "1", "2")
      stageResult?: number;         // Points from stage finish
      gcPoints?: number;            // Points from GC
      pointsClass?: number;         // Points from points classification
      mountainsClass?: number;      // Points from mountains classification
      youthClass?: number;          // Points from youth classification
      mountainPoints?: number;      // Points from mountain points during stage
      sprintPoints?: number;        // Points from sprint points during stage
      combativityBonus?: number;    // Combativity bonus
      teamPoints?: number;          // Team classification points
      total: number;                // Total points for this stage
    }>;
  }>;

  updatedAt: Date | string;
}

export type ClientSeasonPoints = Omit<SeasonPoints, 'updatedAt'> & {
  updatedAt: string;
};

// ============================================================================
// RIDER POOLS (for Country Roads)
// ============================================================================

export interface RiderPool {
  id?: string;                      // Document ID
  gameId: string;
  poolName: string;                 // e.g., "Pool A - Climbers", "Pool B - Time Trial"
  poolNumber: number;               // 1-12

  criteria: string;                 // Description of criteria

  riders: PoolRider[];

  // Which players have selected from this pool
  selections: PoolSelection[];
}

export interface PoolRider {
  nameId: string;
  name: string;
  team: string;
  country: string;
  jerseyImage?: string;
}

export interface PoolSelection {
  userId: string;
  riderId: string;
}

// ============================================================================
// GAME CATEGORIES
// ============================================================================

export interface GameCategory {
  id?: string;                      // Document ID
  name: string;                     // e.g., "Cycling", "Formula 1", "Football"
  slug: string;                     // e.g., "cycling", "formula-1", "football"
  order: number;                    // Display order
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ClientGameCategory = Omit<GameCategory, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// GAME RULES
// ============================================================================

export interface GameRule {
  id?: string;                      // Document ID (same as gameType)
  gameType: GameType;
  categoryId?: string;              // Reference to GameCategory
  displayName?: string;             // Display name for the game type
  rules: string;                    // HTML content from WYSIWYG editor
  updatedAt: Timestamp;
  updatedBy: string;                // Admin UID
}

export type ClientGameRule = Omit<GameRule, 'updatedAt'> & {
  updatedAt: string;
};

// ============================================================================
// FEEDBACK
// ============================================================================

export interface Feedback {
  id?: string;
  userId: string;
  userEmail: string;
  currentPage: string;
  message: string;
  createdAt: string;
  status?: 'new' | 'reviewed' | 'resolved';
  adminResponse?: string;
  adminResponseDate?: string;
}

export type ClientFeedback = Feedback;

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Type guard to check game type
export function isAuctioneer(game: Game): game is Game & { config: AuctioneerConfig } {
  return game.gameType === 'auctioneer';
}

export function isSlipstream(game: Game): game is Game & { config: CarryMeHomeConfig } {
  return game.gameType === 'slipstream';
}

export function isPoisonedCup(game: Game): game is Game & { config: PoisonedCupConfig } {
  return game.gameType === 'poisoned-cup';
}

export function isMarginalGains(game: Game): game is Game & { config: MarginalGainsConfig } {
  return game.gameType === 'marginal-gains';
}

export function isWorldTourManager(game: Game): game is Game & { config: WorldTourManagerConfig } {
  return game.gameType === 'worldtour-manager';
}

// Client-side version of AuctionPeriod with string timestamps
export type ClientAuctionPeriod = Omit<AuctionPeriod, 'startDate' | 'endDate' | 'finalizeDate'> & {
  startDate: string;
  endDate: string;
  finalizeDate?: string;
};

// Helper type for client-side game data (with string dates instead of Timestamps)
export type ClientGame = Omit<Game, 'createdAt' | 'updatedAt' | 'registrationOpenDate' | 'registrationCloseDate' | 'finalizedAt' | 'teamSelectionDeadline' | 'config'> & {
  createdAt: string;
  updatedAt: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  finalizedAt?: string;
  teamSelectionDeadline?: string;
  config: GameConfig; // Config with Timestamp converted to string dates
};

// Client-side version of ParticipantTeamRider with string timestamps
export type ClientParticipantTeamRider = Omit<ParticipantTeamRider, 'acquiredAt'> & {
  acquiredAt: string;
};

export type ClientGameParticipant = Omit<GameParticipant, 'joinedAt' | 'eliminatedAt' | 'team'> & {
  joinedAt: string;
  eliminatedAt?: string;
  team?: ClientParticipantTeamRider[];
};

export type ClientPlayerTeam = Omit<PlayerTeam, 'acquiredAt'> & {
  acquiredAt: string;
};

export type ClientBid = Omit<Bid, 'bidAt'> & {
  bidAt: string;
};

export type ClientStagePick = Omit<StagePick, 'pickedAt'> & {
  pickedAt: string;
};

export type ClientLeague = Omit<League, 'createdAt'> & {
  createdAt: string;
};

export type ClientRaceLineup = Omit<RaceLineup, 'updatedAt'> & {
  updatedAt: string;
};

export type ClientDraftPick = Omit<DraftPick, 'pickedAt'> & {
  pickedAt: string;
};

// ============================================================================
// MESSAGES (Inbox/Communication System)
// ============================================================================

export const MESSAGE_TYPES = ['broadcast', 'individual', 'game', 'game_division'] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

export interface Message {
  id?: string;                      // Document ID
  type: MessageType;                // 'broadcast', 'individual', 'game', or 'game_division'

  // Sender info
  senderId: string;                 // Admin UID
  senderName: string;               // Admin display name

  // Recipient info
  recipientId?: string;             // For individual messages, the user UID
  recipientName?: string;           // For individual messages, the user display name

  // Game-specific info (for 'game' and 'game_division' types)
  gameId?: string;                  // ID of the game
  gameName?: string;                // Name of the game (for display)
  division?: string;                // For 'game_division' type: specific division

  // Message content
  subject: string;
  message: string;

  // Timestamps
  sentAt: Timestamp;

  // Read status (for individual messages)
  read?: boolean;
  readAt?: Timestamp;

  // Email notification status
  emailNotificationSent?: boolean;
  emailNotificationSentAt?: Timestamp;

  // Soft delete (separate for sender and recipient)
  deletedAt?: Timestamp;          // Legacy field
  deletedBySender?: boolean;
  deletedByRecipient?: boolean;
}

export type ClientMessage = Omit<Message, 'sentAt' | 'readAt' | 'deletedAt'> & {
  sentAt: string;
  readAt?: string;
  deletedAt?: string;
  deletedBySender?: boolean;
  deletedByRecipient?: boolean;
};
