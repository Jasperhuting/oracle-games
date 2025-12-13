/**
 * Type definitions for all GET API endpoint responses
 * This ensures type safety across the application
 */

import { 
  ClientGame, 
  ClientGameParticipant, 
  ClientPlayerTeam, 
  ClientBid, 
  ClientMessage,
  ClientGameRule,
  GameStatus,
  GameType,
  GameConfig
} from './games';
import { Team } from '../scraper/types';

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  uid: string;
  email: string;
  playername: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
  userType: 'admin' | 'user';
  blocked?: boolean;
  blockedAt?: string;
  blockedBy?: string;
  blockedReason?: string;
  preferredLanguage?: 'en' | 'nl';
}

// ============================================================================
// ACTIVITY LOG TYPES
// ============================================================================

export interface ActivityLog {
  id: string;
  action: string;
  userId: string;
  userEmail: string;
  userName: string;
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

// ============================================================================
// RANKING TYPES
// ============================================================================

export interface Ranking {
  id: string;
  rank: number;
  name: string;
  nameID: string;
  retired: boolean;
  points: number;
  jerseyImage: string;
  age: number;
  country: string;
  team: Team | null;
}

export interface PaginationInfo {
  offset: number;
  limit: number;
  count: number;
  totalCount: number | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

// GET /api/games/list
export interface GamesListResponse {
  success: true;
  games: ClientGame[];
  count: number;
}

// GET /api/games/[gameId]
export interface GameResponse {
  success: true;
  game: ClientGame;
}

// GET /api/games/[gameId]/participants
export interface GameParticipantsResponse {
  success: true;
  participants: ClientGameParticipant[];
  count: number;
}

// GET /api/gameParticipants
export interface GameParticipantsQueryResponse {
  success: true;
  participants: ClientGameParticipant[];
  count: number;
}

// GET /api/games/[gameId]/team/list
export interface PlayerTeamListResponse {
  success: true;
  riders: ClientPlayerTeam[];
  count: number;
}

// GET /api/games/[gameId]/bids/list
export interface BidsListResponse {
  success: true;
  bids: ClientBid[];
  count: number;
}

// GET /api/getUser
export interface UserResponse {
  uid: string;
  email: string;
  playername: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
  userType: 'admin' | 'user';
}

// GET /api/getUsers
export interface UsersListResponse {
  users: User[];
}

// GET /api/getActivityLogs
export interface ActivityLogsResponse {
  logs: ActivityLog[];
}

// GET /api/getRankings
export interface RankingsResponse {
  riders: Ranking[];
  pagination: PaginationInfo;
}

// GET /api/messages
export interface MessagesResponse {
  messages: ClientMessage[];
}

// GET /api/messages/unread-count
export interface UnreadMessagesCountResponse {
  count: number;
}

// GET /api/gameRules
export interface GameRulesResponse {
  success: true;
  rules: ClientGameRule[];
}

// GET /api/gameRules?gameType=...
export interface GameRuleResponse {
  success: true;
  rule: ClientGameRule | null;
}

// ============================================================================
// ERROR RESPONSE TYPE
// ============================================================================

export interface ApiErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// POST/PUT/DELETE REQUEST & RESPONSE TYPES
// ============================================================================

// POST /api/games/create
export interface CreateGameRequest {
  adminUserId: string;
  name: string;
  gameType: GameType;
  year: number;
  raceType: 'season' | 'grand-tour' | 'classics' | 'single-race';
  raceSlug?: string;
  status?: GameStatus;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  division?: string;
  divisionLevel?: number;
  divisionCount?: number;
  maxPlayers?: number;
  minPlayers?: number;
  eligibleTeams?: string[];
  eligibleRiders?: string[];
  config: GameConfig; // Game-specific config (properly typed)
}

export interface CreateGameResponse {
  success: true;
  gameId: string;
  game: ClientGame;
}

export interface CreateMultipleGamesResponse {
  success: true;
  gamesCreated: number;
  games: Array<{ id: string; game: ClientGame }>;
  message: string;
}

// POST /api/games/[gameId]/join
export interface JoinGameRequest {
  userId: string;
}

export interface JoinGameResponse {
  success: true;
  participantId: string;
  participant: ClientGameParticipant;
}

// DELETE /api/games/[gameId]/join (leave game)
export interface LeaveGameResponse {
  success: true;
  message: string;
  deletionStats: {
    bids: number;
    playerTeams: number;
  };
}

// POST /api/games/[gameId]/bids/place
export interface PlaceBidRequest {
  userId: string;
  riderNameId: string;
  amount: number;
  riderName?: string;
  riderTeam?: string;
  jerseyImage?: string;
}

export interface PlaceBidResponse {
  success: true;
  bidId: string;
  bid: ClientBid;
}

// DELETE /api/games/[gameId]/bids/cancel
export interface CancelBidResponse {
  success: true;
  message: string;
}

// POST /api/games/[gameId]/team/add-rider
export interface AddRiderToTeamRequest {
  userId: string;
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  jerseyImage?: string;
  acquisitionType: 'auction' | 'selection' | 'draft' | 'pick';
  pricePaid?: number;
  draftRound?: number;
  draftPick?: number;
}

export interface AddRiderToTeamResponse {
  success: true;
  riderId: string;
  rider: ClientPlayerTeam;
}

// PATCH /api/games/[gameId]
export interface UpdateGameRequest {
  adminUserId: string;
  name?: string;
  status?: GameStatus;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  maxPlayers?: number;
  minPlayers?: number;
  eligibleTeams?: string[];
  eligibleRiders?: string[];
  config?: Partial<GameConfig>;
  [key: string]: any; // Allow other fields
}

export interface UpdateGameResponse {
  success: true;
  game: ClientGame;
}

// DELETE /api/games/[gameId]
export interface DeleteGameResponse {
  success: true;
  message: string;
  deletionStats: {
    bids: number;
    participants: number;
    playerTeams: number;
    leagues: number;
    stagePicks: number;
    draftPicks: number;
  };
}

// POST /api/messages/send
export interface SendMessageRequest {
  senderId: string;
  type: 'broadcast' | 'individual';
  recipientId?: string;
  subject: string;
  message: string;
}

export interface SendMessageResponse {
  success: true;
  messageId: string;
  message: ClientMessage;
}

// PATCH /api/messages/[messageId]/read
export interface MarkMessageReadResponse {
  success: true;
  message: string;
}

// POST /api/createUser
export interface CreateUserRequest {
  email: string;
  playername: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  userType?: 'admin' | 'user';
}

export interface CreateUserResponse {
  success: true;
  userId: string;
  user: User;
}

// POST /api/gameRules
export interface SaveGameRulesRequest {
  gameType: GameType;
  rules: string;
  userId: string;
}

export interface SaveGameRulesResponse {
  success: true;
  gameType: GameType;
  message: string;
}

// DELETE /api/games/[gameId]/bids/cancel
export interface CancelBidRequest {
  bidId: string;
  userId: string;
}

// POST /api/feedback
export interface SubmitFeedbackRequest {
  userId: string;
  userEmail: string;
  currentPage: string;
  message: string;
}

export interface SubmitFeedbackResponse {
  success: true;
  feedbackId: string;
  message: string;
}

// PATCH /api/changeUserType
export interface ChangeUserTypeRequest {
  userId: string;
  targetUserId: string;
  newUserType: 'admin' | 'user';
}

export interface ChangeUserTypeResponse {
  success: true;
  message: string;
}

// DELETE /api/deleteUser
export interface DeleteUserRequest {
  adminUserId: string;
  targetUserId: string;
}

export interface DeleteUserResponse {
  success: true;
  message: string;
}

// POST /api/games/[gameId]/status
export interface UpdateGameStatusRequest {
  adminUserId: string;
  status: GameStatus;
}

export interface UpdateGameStatusResponse {
  success: true;
  message: string;
  game: ClientGame;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic API response wrapper
 */
export type ApiResponse<T> = T | ApiErrorResponse;

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ApiErrorResponse).error === 'string'
  );
}
