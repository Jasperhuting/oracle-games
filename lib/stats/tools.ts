import {
  loadAuctionBudgetEfficiencyRows,
  loadAuctionMostContestedRows,
  loadDraftPickROIRows,
  loadF1BestPredictorRows,
  loadF1BonusSpecialistRows,
  loadF1DriverAvgPositionRows,
  loadF1PodiumAccuracyRows,
  loadF1PopularWinnerPickRows,
  loadF1PredictionActivityRows,
  loadF1TeamPopularityRows,
  loadPlayerActivityStats,
  loadPlayerStats,
  loadPlayerWinRateRows,
  loadRisingStarsGrowthRows,
  loadSeasonTopRidersRows,
  loadSlipstreamGreenJerseyRows,
  loadSlipstreamPenaltyRows,
  loadStatsEntities,
  loadTeamDistribution,
} from "@/lib/stats/adapters";
import type { StatsToolName } from "@/lib/stats/types";

// ─── Generic cycling tools (playerTeams / stagePicks via loadStatsEntities) ──

export async function getTopScorers(gameId: string, limit = 5) {
  const rows = await loadStatsEntities(gameId);
  return rows
    .slice()
    .sort((a, b) => b.scoringPoints - a.scoringPoints)
    .slice(0, limit)
    .map((row) => ({
      player: row.label,
      team: row.team,
      points: row.scoringPoints,
      cost: row.cost,
    }));
}

export async function getMostSelected(gameId: string, limit = 5) {
  const rows = await loadStatsEntities(gameId);
  return rows
    .slice()
    .sort((a, b) => b.selectionCount - a.selectionCount || b.selectedByPct - a.selectedByPct)
    .slice(0, limit)
    .map((row) => ({
      player: row.label,
      team: row.team,
      selectionCount: row.selectionCount,
      selectedByPct: row.selectedByPct,
      points: row.points,
    }));
}

export async function getBestValuePicks(gameId: string, limit = 5) {
  const rows = await loadStatsEntities(gameId);
  return rows
    .slice()
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, limit)
    .map((row) => ({
      player: row.label,
      team: row.team,
      valueScore: row.valueScore,
      cost: row.cost,
      points: row.points,
    }));
}

export async function getBiggestMovers(
  gameId: string,
  _from?: string,
  _to?: string,
  limit = 5
) {
  const rows = await loadStatsEntities(gameId);
  return rows
    .slice()
    .sort((a, b) => Math.abs(b.movementDelta) - Math.abs(a.movementDelta))
    .slice(0, limit)
    .map((row) => ({
      player: row.label,
      team: row.team,
      movementDelta: row.movementDelta,
      selectedByPct: row.selectedByPct,
    }));
}

export async function getTeamDistribution(gameId: string) {
  return loadTeamDistribution(gameId);
}

// ─── Player-level tools (gameParticipants-based) ─────────────────────────────

export async function getTopPlayersByPoints(gameId: string, limit = 5) {
  const rows = await loadPlayerStats(gameId);
  return rows
    .filter((row) => row.totalPoints > 0 || row.ranking !== null)
    .slice()
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, limit)
    .map((row) => ({
      player: row.playerName,
      totalPoints: row.totalPoints,
      ranking: row.ranking,
    }));
}

export async function getMostActivePlayers(gameId: string, limit = 5) {
  const rows = await loadPlayerActivityStats(gameId);
  return rows
    .slice()
    .sort((a, b) => b.participations - a.participations || b.totalPoints - a.totalPoints)
    .slice(0, limit)
    .map((row) => ({
      player: row.playerName,
      participations: row.participations,
      totalPointsAcrossGames: row.totalPoints,
      averageRank: row.averageRank,
    }));
}

export async function getBestAverageRankPlayers(gameId: string, limit = 5) {
  const rows = await loadPlayerActivityStats(gameId);
  return rows
    .filter((row) => row.averageRank !== null)
    .slice()
    .sort(
      (a, b) =>
        (a.averageRank ?? Number.POSITIVE_INFINITY) -
        (b.averageRank ?? Number.POSITIVE_INFINITY)
    )
    .slice(0, limit)
    .map((row) => ({
      player: row.playerName,
      averageRank: row.averageRank,
      participations: row.participations,
      totalPointsAcrossGames: row.totalPoints,
    }));
}

export async function getPlayerWinRate(gameId: string, limit = 5) {
  const rows = await loadPlayerWinRateRows(gameId);
  return rows.slice(0, limit);
}

// ─── Slipstream / stage-pick tools ───────────────────────────────────────────

export async function getSlipstreamGreenJerseyKings(gameId: string, limit = 5) {
  const rows = await loadSlipstreamGreenJerseyRows(gameId);
  return rows.slice(0, limit);
}

export async function getSlipstreamPenaltyReport(gameId: string, limit = 5) {
  const rows = await loadSlipstreamPenaltyRows(gameId);
  return rows.slice(0, limit);
}

// ─── Draft game tools ─────────────────────────────────────────────────────────

export async function getDraftPickROI(gameId: string, limit = 10) {
  const rows = await loadDraftPickROIRows(gameId);
  return rows.slice(0, limit);
}

export async function getRisingStarsGrowth(gameId: string, limit = 5) {
  const rows = await loadRisingStarsGrowthRows(gameId);
  return rows.slice(0, limit);
}

// ─── Auctioneer tools ─────────────────────────────────────────────────────────

export async function getAuctionBudgetEfficiency(gameId: string, limit = 5) {
  const rows = await loadAuctionBudgetEfficiencyRows(gameId);
  return rows.slice(0, limit);
}

export async function getAuctionMostContested(gameId: string, limit = 5) {
  const rows = await loadAuctionMostContestedRows(gameId);
  return rows.slice(0, limit);
}

// ─── Season-level tools ───────────────────────────────────────────────────────

export async function getSeasonTopRiders(gameId: string, limit = 10) {
  const rows = await loadSeasonTopRidersRows(gameId);
  return rows.slice(0, limit);
}

// ─── F1 prediction tools ──────────────────────────────────────────────────────

export async function getF1BestPredictors(gameId: string, limit = 5) {
  const rows = await loadF1BestPredictorRows(gameId);
  return rows.slice(0, limit);
}

export async function getF1MostActivePredictors(gameId: string, limit = 5) {
  const rows = await loadF1PredictionActivityRows(gameId);
  return rows
    .slice()
    .sort(
      (a, b) =>
        b.submittedPredictions - a.submittedPredictions ||
        b.submissionRatePct - a.submissionRatePct
    )
    .slice(0, limit);
}

export async function getF1BonusSpecialists(gameId: string, limit = 5) {
  const rows = await loadF1BonusSpecialistRows(gameId);
  return rows.slice(0, limit);
}

export async function getF1PopularWinnerPicks(gameId: string, limit = 5) {
  const rows = await loadF1PopularWinnerPickRows(gameId);
  return rows.slice(0, limit);
}

export async function getF1MissedPredictionRisk(gameId: string, limit = 5) {
  const rows = await loadF1PredictionActivityRows(gameId);
  return rows
    .slice()
    .sort(
      (a, b) =>
        b.missingPredictions - a.missingPredictions ||
        a.submissionRatePct - b.submissionRatePct
    )
    .slice(0, limit);
}

export async function getF1TeamPopularity(gameId: string, limit = 5) {
  const rows = await loadF1TeamPopularityRows(gameId);
  return rows.slice(0, limit);
}

export async function getF1PodiumAccuracy(gameId: string, limit = 5) {
  const rows = await loadF1PodiumAccuracyRows(gameId);
  return rows.slice(0, limit);
}

export async function getF1DriverAvgPosition(gameId: string, limit = 10) {
  const rows = await loadF1DriverAvgPositionRows(gameId);
  return rows.slice(0, limit);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function runStatsTool(toolName: StatsToolName, gameId: string, limit?: number) {
  switch (toolName) {
    case "getTopScorers":
      return getTopScorers(gameId, limit);
    case "getMostSelected":
      return getMostSelected(gameId, limit);
    case "getBestValuePicks":
      return getBestValuePicks(gameId, limit);
    case "getBiggestMovers":
      return getBiggestMovers(gameId, undefined, undefined, limit);
    case "getTeamDistribution":
      return getTeamDistribution(gameId);
    case "getTopPlayersByPoints":
      return getTopPlayersByPoints(gameId, limit);
    case "getMostActivePlayers":
      return getMostActivePlayers(gameId, limit);
    case "getBestAverageRankPlayers":
      return getBestAverageRankPlayers(gameId, limit);
    case "getPlayerWinRate":
      return getPlayerWinRate(gameId, limit);
    case "getSlipstreamGreenJerseyKings":
      return getSlipstreamGreenJerseyKings(gameId, limit);
    case "getSlipstreamPenaltyReport":
      return getSlipstreamPenaltyReport(gameId, limit);
    case "getDraftPickROI":
      return getDraftPickROI(gameId, limit);
    case "getRisingStarsGrowth":
      return getRisingStarsGrowth(gameId, limit);
    case "getAuctionBudgetEfficiency":
      return getAuctionBudgetEfficiency(gameId, limit);
    case "getAuctionMostContested":
      return getAuctionMostContested(gameId, limit);
    case "getSeasonTopRiders":
      return getSeasonTopRiders(gameId, limit);
    case "getF1BestPredictors":
      return getF1BestPredictors(gameId, limit);
    case "getF1MostActivePredictors":
      return getF1MostActivePredictors(gameId, limit);
    case "getF1BonusSpecialists":
      return getF1BonusSpecialists(gameId, limit);
    case "getF1PopularWinnerPicks":
      return getF1PopularWinnerPicks(gameId, limit);
    case "getF1MissedPredictionRisk":
      return getF1MissedPredictionRisk(gameId, limit);
    case "getF1TeamPopularity":
      return getF1TeamPopularity(gameId, limit);
    case "getF1PodiumAccuracy":
      return getF1PodiumAccuracy(gameId, limit);
    case "getF1DriverAvgPosition":
      return getF1DriverAvgPosition(gameId, limit);
  }
}
