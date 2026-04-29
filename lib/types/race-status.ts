// lib/types/race-status.ts
// Shared types used by race-status API and admin dashboard.
// No server-only imports — safe to use in 'use client' components.

export interface StageStatus {
  stageNumber: number | string;
  status: 'scraped' | 'pending' | 'failed' | 'empty';
  scrapedAt: string | null;
  riderCount: number;
  hasValidationErrors: boolean;
  validationWarnings: number;
  docId: string;
  stageDate: string | null;
  isRestDay?: boolean;
}

export interface RaceStatus {
  raceSlug: string;
  raceName: string;
  year: number;
  totalStages: number;
  scrapedStages: number;
  failedStages: number;
  pendingStages: number;
  hasStartlist: boolean;
  startlistRiderCount: number;
  lastScrapedAt: string | null;
  hasValidationErrors: boolean;
  isSingleDay: boolean;
  hasPrologue: boolean;
  stages: StageStatus[];
  startDate: string | null;
  endDate: string | null;
  raceStatus: 'upcoming' | 'in-progress' | 'finished' | 'unknown';
  classification: string | null;
  excludeFromScraping: boolean;
  restDays: string[];
}

export interface RaceStatusResponse {
  races: RaceStatus[];
  summary: {
    totalRaces: number;
    racesWithData: number;
    totalStagesScraped: number;
    totalStagesFailed: number;
    validationErrors: number;
  };
}
