import type { Timestamp } from "firebase-admin/firestore";

export const STATS_ADMIN_ROLES = ["owner", "stats_reader"] as const;
export const STATS_CHART_TYPES = ["bar", "line", "table", "pie", "scatter"] as const;
export const STATS_RUN_STATUSES = ["pending", "completed", "failed"] as const;
export const STATS_IDEA_STATUSES = ["proposed", "accepted", "rejected"] as const;
export const STATS_RUN_TYPES = ["idea_generation", "stat_run"] as const;
export const STATS_IDEA_SOURCES = ["llm", "template", "manual"] as const;
export const STATS_TOOL_NAMES = [
  "getTopScorers",
  "getMostSelected",
  "getBestValuePicks",
  "getBiggestMovers",
  "getTeamDistribution",
  "getTopPlayersByPoints",
  "getMostActivePlayers",
  "getBestAverageRankPlayers",
  "getF1BestPredictors",
  "getF1MostActivePredictors",
  "getF1BonusSpecialists",
  "getF1PopularWinnerPicks",
  "getF1MissedPredictionRisk",
] as const;

export type StatsAdminRole = (typeof STATS_ADMIN_ROLES)[number];
export type ChartType = (typeof STATS_CHART_TYPES)[number];
export type StatRunStatus = (typeof STATS_RUN_STATUSES)[number];
export type StatIdeaStatus = (typeof STATS_IDEA_STATUSES)[number];
export type StatRunType = (typeof STATS_RUN_TYPES)[number];
export type StatIdeaSource = (typeof STATS_IDEA_SOURCES)[number];
export type StatsToolName = (typeof STATS_TOOL_NAMES)[number];

export interface AdminProfile {
  uid: string;
  email: string;
  role: StatsAdminRole;
  allowedGames: string[];
  enabled: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StatsAdminGameOption {
  id: string;
  label: string;
  gameType?: string;
  year?: number;
  status?: string;
}

export interface StatIdea {
  id: string;
  gameId: string;
  title: string;
  description: string;
  whyInteresting: string;
  chartType: ChartType;
  requiredTool: StatsToolName;
  confidence: number;
  source: StatIdeaSource;
  status: StatIdeaStatus;
  createdByUid: string;
  createdAt: Timestamp;
}

export interface StatRun {
  id: string;
  gameId: string;
  requestedByUid: string;
  type: StatRunType;
  status: StatRunStatus;
  model: string;
  promptVersion: string;
  selectedIdeaId: string | null;
  inputSummary: string | null;
  errorMessage: string | null;
  createdAt: Timestamp;
  finishedAt: Timestamp | null;
}

export type GeneratedStatRow = Record<string, string | number | boolean | null>;

export interface GeneratedStat {
  id: string;
  gameId: string;
  ideaId: string | null;
  runId: string;
  sourceIdeaTitle?: string;
  sourceTool?: StatsToolName;
  title: string;
  summary: string;
  chartType: ChartType;
  data: GeneratedStatRow[];
  confidence: number;
  generatedAt: Timestamp;
  generatedByModel: string;
}

export type StatsToolRow = GeneratedStatRow;

export interface StatsEntitySnapshot {
  key: string;
  label: string;
  team: string;
  cost: number;
  points: number;
  scoringPoints: number;
  selectionCount: number;
  selectedByPct: number;
  valueScore: number;
  movementDelta: number;
}

export interface PlayerStatsSnapshot {
  userId: string;
  playerName: string;
  totalPoints: number;
  ranking: number | null;
  participations: number;
  averageRank: number | null;
}

export interface TeamDistributionRow {
  team: string;
  picks: number;
  percentage: number;
}
