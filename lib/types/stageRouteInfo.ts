export type StageType = 'sprint' | 'hilly' | 'mountain' | 'high_mountain' | 'time_trial' | 'unknown';
export type FinishType = 'flat_sprint' | 'uphill_sprint' | 'climb_finish' | 'unknown';

export interface StageRouteInfo {
  stageNumber: number;
  pcsUrl: string;

  startLocation?: string;
  finishLocation?: string;
  distanceKm?: number;

  profileScore?: number;
  verticalMeters?: number;
  finalKmGradient?: number;
  psFinal25k?: number;

  stageType?: StageType;
  finishType?: FinishType;

  lastUpdatedAt: string;
}

export function deriveStageType(profileScore?: number, isTimeTrial?: boolean): StageType {
  if (isTimeTrial) return 'time_trial';
  if (profileScore === undefined) return 'unknown';
  if (profileScore < 20) return 'sprint';
  if (profileScore < 80) return 'hilly';
  if (profileScore < 200) return 'mountain';
  return 'high_mountain';
}

export function deriveFinishType(finalKmGradient?: number): FinishType {
  if (finalKmGradient === undefined) return 'unknown';
  if (finalKmGradient < 2) return 'flat_sprint';
  if (finalKmGradient < 5) return 'uphill_sprint';
  return 'climb_finish';
}

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  sprint: 'Sprint',
  hilly: 'Heuvelachtig',
  mountain: 'Berg',
  high_mountain: 'Hoge berg',
  time_trial: 'Tijdrit',
  unknown: 'Onbekend',
};

export const FINISH_TYPE_LABELS: Record<FinishType, string> = {
  flat_sprint: 'Vlakke sprint',
  uphill_sprint: 'Lichte aankomst',
  climb_finish: 'Bergaankomst',
  unknown: 'Onbekend',
};
