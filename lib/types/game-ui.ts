/**
 * Game UI Types
 * Types for game-related UI components, modals, and forms
 */

import { Game, ClientGame, AuctionPeriod, CountingRace, GameStatus } from './games';

// Form Input Types
export interface AuctionPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  finalizeDate?: string;
  top200Only?: boolean;
  neoProfsRequired?: number;
  neoProfsMaxPoints?: number;
  neoProfsMaxBudget?: number;
}

export interface CountingRaceInput {
  raceId: string;
  raceSlug: string;
  raceName: string;
  restDays?: number[];
  mountainPointsMultiplier?: number;
  sprintPointsMultiplier?: number;
}

export interface GameFormData {
  name: string;
  gameType: string;
  year: number;
  raceType?: string;
  budget?: number;
  maxRiders?: number;
  teamSize?: number;
  auctionPeriods?: AuctionPeriodInput[];
  countingRaces?: CountingRaceInput[];
  visibility?: string;
  maxParticipants?: number;
  description?: string;
}

export interface RaceFormData {
  name: string;
  year: number;
  type: string;
  startDate: string;
  endDate: string;
}

export interface Race {
  id: string;
  name: string;
  year: number;
  slug: string;
  description?: string;
  createdAt?: string;
  scrapedAt?: string;
  active?: boolean;
  startDate?: string;
  endDate?: string;
  stages?: number;
  classification?: string;
  country?: string;
  hasResults?: boolean;
  resultsCount?: number;
}

// Modal Props
export interface EditGameModalProps {
  game: Game;
  isOpen: boolean;
  onClose: () => void;
  onSave: (gameData: Partial<Game>) => void;
}

export interface GameDetailsModalProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface GameRulesModalProps {
  gameType: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface ManageDivisionsModalProps {
  games: ClientGame[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface TeamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameData: GameData;
  participants: ParticipantData[];
}

export interface DivisionAssignmentModalProps {
  gameId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export interface RaceLineupModalProps {
  raceId: string;
  raceName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Component Data Types
export interface GameGroup {
  type: string;
  games: Game[];
}

export interface Participant {
  id: string;
  playername: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  assignedDivision?: string;
  divisionAssigned?: boolean;
  status: string;
  joinedAt: string | Date;
}

export interface ParticipantData {
  id: string;
  name: string;
  email: string;
  division?: string;
  playername?: string;
}

export interface GameData {
  id: string;
  name: string;
  type: string;
  year: number;
}

export interface DivisionGame {
  id: string;
  name: string;
  participants: string[];
}

// Game Status Manager
export interface GameStatusManagerProps {
  gameId: string;
  currentStatus: GameStatus;
  onStatusChange: () => void;
  compact?: boolean;
}
