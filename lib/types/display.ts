/**
 * Display & Data Presentation Types
 * Types for data display components, stats, and visualizations
 */

import { Bid } from './games';

// Race & Points Display
export type StageMeta = {
  stage: number;
  url: string;
  lastModified: string | null;
};

export interface StagePoints {
  stage: number;
  points: number;
  date?: string;
}

export interface RacePoints {
  raceId: string;
  raceName: string;
  stages: StagePoints[];
  totalPoints: number;
}

export interface RacePointsBreakdownProps {
  userId: string;
  gameId: string;
  races: RacePoints[];
}

export interface StageMeta {
  stage: number;
  url: string;
  lastModified: string;
}

// Bid Extensions
export interface ExtendedBid extends Bid {
  price?: number;
}

// Team & Rider Data
export interface PlayerTeam {
  riderId: string;
  riderName: string;
  team?: string;
  points: number;
}

export interface RiderData {
  id: string;
  name: string;
  team?: string;
  country?: string;
  points?: number;
  price?: number;
}

export interface TeamData {
  id: string;
  name: string;
  country?: string;
  riders: RiderData[];
}

export interface PeriodRiders {
  periodName: string;
  riders: RiderData[];
}

export interface UserPurchases {
  userId: string;
  userName: string;
  riders: RiderData[];
  totalSpent: number;
  remainingBudget: number;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  totalPoints?: number;
  rank?: number;
}

export interface DivisionData {
  id: string;
  name: string;
  users: UserData[];
}

export interface GameGroupData {
  groupName: string;
  divisions: DivisionData[];
}

// Team Grouping
export interface TeamGroup {
  teamName: string;
  riders: RiderData[];
}
