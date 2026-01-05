/**
 * Joinable Games Types
 * Types for the joinable games UI components
 */

import { GameType } from "./games";

// Simplified Game type for joinable games list UI
// Note: gameType is string here because API responses may contain game types
// that aren't in the strict GameType union (for flexibility)
export interface JoinableGame {
  id: string;
  name: string;
  gameType: string;
  year: number;
  status: string;
  playerCount: number;
  maxPlayers?: number;
  division?: string;
  divisionCount?: number;
  divisionLevel?: number;
  description?: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  createdAt: string;
  raceRef?: string;
  bidding?: boolean;
  teamSelectionDeadline?: string;
}

// Group of games with the same base name (for multi-division games)
export interface JoinableGameGroup {
  baseName: string;
  games: JoinableGame[];
  isMultiDivision: boolean;
  totalPlayers: number;
  maxPlayers?: number;
}

// Simplified participant type for joinable games UI
export interface JoinableGameParticipant {
  id: string;
  gameId: string;
  userId: string;
  status: string;
  joinedAt: string;
  assignedDivision?: string;
  divisionAssigned?: boolean;
}

// Props interfaces for joinable games components
export interface GameCardProps {
  group: JoinableGameGroup;
  myGames: Set<string>;
  myParticipants: Map<string, JoinableGameParticipant>;
  isAdmin: boolean;
  availableRules: Set<GameType>;
  joining: string | null;
  leaving: string | null;
  onJoin: (gameId: string) => void;
  onLeave: (gameId: string) => void;
  onShowRules: (gameType: string, gameName: string) => void;
  isRegistrationOpen: (game: JoinableGame) => boolean;
  canJoin: (game: JoinableGame) => boolean;
  canLeave: (game: JoinableGame) => boolean;
  isSelectionBasedGame: (gameType: string) => boolean;
  getStatusLabel: (game: JoinableGame) => string;
  getStatusBadgeColor: (status: string) => string;
  formatDate: (date?: string) => string;
  formatDateTime: (date?: string) => string;
}

export interface GameCardBadgesProps {
  isJoined: boolean;
  isWaitingForDivision: boolean;
  status: string;
  statusLabel: string;
  getStatusBadgeColor: (status: string) => string;
}

export interface GameCardMetadataProps {
  game: Pick<JoinableGame, 'gameType' | 'year' | 'teamSelectionDeadline' | 'registrationOpenDate' | 'registrationCloseDate' | 'division' | 'description'>;
  group: Pick<JoinableGameGroup, 'baseName' | 'totalPlayers' | 'maxPlayers' | 'isMultiDivision' | 'games'>;
  participant?: Pick<JoinableGameParticipant, 'assignedDivision'>;
  availableRules: Set<GameType>;
  onShowRules: (gameType: string, gameName: string) => void;
  formatDateTime: (date?: string) => string;
  formatDate: (date?: string) => string;
}

export interface GameCardActionsProps {
  game: JoinableGame;
  group: JoinableGameGroup;
  joinedGame: JoinableGame | undefined;
  isAdmin: boolean;
  isJoined: boolean;
  isWaitingForDivision: boolean;
  joinable: boolean;
  leaveable: boolean;
  isFull: boolean;
  isRegistrationOpen: boolean;
  joining: string | null;
  leaving: string | null;
  onJoin: (gameId: string) => void;
  onLeave: (gameId: string) => void;
  isSelectionBasedGame: (gameType: string) => boolean;
}
