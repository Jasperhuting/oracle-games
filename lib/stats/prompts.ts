import type { StatIdea, StatsToolName } from "@/lib/stats/types";

const TOOL_DESCRIPTIONS: Record<StatsToolName, string> = {
  // Generic cycling tools
  getTopScorers: "Returns top fantasy scorers (riders) with points and budget cost. Suitable for auctioneer and budget-based cycling games.",
  getMostSelected: "Returns the most selected/picked riders with selection count, ownership % and points. Works for all game types.",
  getBestValuePicks: "Returns the strongest value picks based on value score (points/cost). Suitable for budget-based games.",
  getBiggestMovers: "Returns riders with the largest ownership movement delta (trending up or down in bids). Auctioneer games only.",
  getTeamDistribution: "Returns how rider selections are distributed across professional cycling teams.",
  // Player tools
  getTopPlayersByPoints: "Returns the highest-scoring game participants by total points for the selected game.",
  getMostActivePlayers: "Returns players with the most game participations across all games in the same year.",
  getBestAverageRankPlayers: "Returns players with the best average finishing rank across games in the same year.",
  getPlayerWinRate: "Returns players ranked by top-3 finishing rate and average ranking across games of the same type and year.",
  // Slipstream tools
  getSlipstreamGreenJerseyKings: "Returns riders who generated the most green jersey points across all stage picks. Slipstream/stage-pick games only.",
  getSlipstreamPenaltyReport: "Returns players with the most DNF/DNS/missed-pick penalties in a slipstream game, with breakdown by penalty type.",
  // Draft game tools
  getDraftPickROI: "Returns average points per draft round to show which rounds produced the best value. Draft games (Poisoned Cup, Rising Stars) only.",
  getRisingStarsGrowth: "Returns riders with the highest year-over-year points growth. Rising Stars game only.",
  // Auctioneer tools
  getAuctionBudgetEfficiency: "Returns players ranked by points earned per coin spent (budget efficiency). Auctioneer games only.",
  getAuctionMostContested: "Returns riders who attracted the most competing bids, showing auction competition intensity. Auctioneer games only.",
  // Season tool
  getSeasonTopRiders: "Returns the top-scoring riders of the current season from the global seasonPoints collection (independent of a single game).",
  // F1 tools
  getF1BestPredictors: "Returns F1 participants with the lowest total penalty points in season standings (lower = more accurate predictions).",
  getF1MostActivePredictors: "Returns F1 participants with the highest prediction submission volume and submission rate percentage.",
  getF1BonusSpecialists: "Returns F1 participants with the most correct bonus hits (pole, fastest lap, DNF) across scored races.",
  getF1PopularWinnerPicks: "Returns the F1 drivers most often predicted as race winner, with pick count and percentage.",
  getF1MissedPredictionRisk: "Returns F1 participants with the most missed prediction opportunities, sorted by missing count.",
  getF1TeamPopularity: "Returns F1 constructors ranked by how often their drivers are predicted as race winner.",
  getF1PodiumAccuracy: "Returns F1 participants ranked by how accurately they predict the top-3 podium, with exact winner hit rate.",
  getF1DriverAvgPosition: "Returns F1 drivers ranked by average predicted finishing position across all predictions, with top-3 prediction rate.",
};

export function getAvailableToolSummary() {
  return Object.entries(TOOL_DESCRIPTIONS)
    .map(([toolName, description]) => `- ${toolName}: ${description}`)
    .join("\n");
}

export function buildIdeaGenerationMessages(params: {
  gameId: string;
  maxIdeas: number;
  gameType?: string | null;
}) {
  const { gameId, maxIdeas, gameType } = params;

  return [
    {
      role: "system" as const,
      content:
        "You are an internal Oracle Games stats ideation assistant. Return JSON only. " +
        "Propose concise, fantasy-relevant statistics ideas. Do not mention unavailable tools or external data. " +
        "Only choose from the allowed requiredTool values provided by the user.",
    },
    {
      role: "user" as const,
      content: [
        `Generate at most ${maxIdeas} statistic ideas for gameId "${gameId}".`,
        gameType ? `Game type: ${gameType}` : null,
        "Focus on fantasy-game usefulness and admin analysis value.",
        "Prioritize player-centric ideas first: strongest managers, most active players, best average ranks, under-the-radar strong players, high-volume versus high-performance players.",
        "Use manager/player/user wording only for player tools. Use scorer/pick/ownership/value/team wording for rider or selection tools.",
        gameType === "f1-prediction"
          ? "For F1 games: focus on predictor quality (getF1BestPredictors), submission behavior (getF1MostActivePredictors, getF1MissedPredictionRisk), bonus-question skill (getF1BonusSpecialists), popular winner picks (getF1PopularWinnerPicks), constructor popularity (getF1TeamPopularity), podium prediction accuracy (getF1PodiumAccuracy), driver average predicted position (getF1DriverAvgPosition)."
          : null,
        gameType === "slipstream" || gameType === "last-man-standing"
          ? "For slipstream/stage-pick games: focus on most selected riders (getMostSelected), green jersey specialists (getSlipstreamGreenJerseyKings), penalty leaders (getSlipstreamPenaltyReport), top players by points (getTopPlayersByPoints), team distribution (getTeamDistribution)."
          : null,
        gameType === "poisoned-cup" || gameType === "rising-stars"
          ? "For draft games: focus on ROI per draft round (getDraftPickROI), top players by points (getTopPlayersByPoints), best average ranks (getBestAverageRankPlayers). For Rising Stars specifically also use getRisingStarsGrowth."
          : null,
        gameType === "auctioneer" || gameType === "worldtour-manager" || gameType === "full-grid" || gameType === "marginal-gains"
          ? "For auction/budget games: focus on budget efficiency (getAuctionBudgetEfficiency), most contested riders (getAuctionMostContested), top scorers (getTopScorers), best value picks (getBestValuePicks), biggest movers (getBiggestMovers)."
          : null,
        "Secondary themes: budget efficiency, ownership vs output, biggest movers, sleeper picks, team spread, consistency vs explosiveness, value over time, underpicked performers, player win rate (getPlayerWinRate), season top riders (getSeasonTopRiders).",
        "Use only these fixed read-only tools:",
        getAvailableToolSummary(),
        "Return concise JSON only.",
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
    },
  ];
}

export function buildStatExplanationMessages(params: {
  gameId: string;
  idea: StatIdea;
  toolRows: unknown[];
}) {
  const { gameId, idea, toolRows } = params;

  return [
    {
      role: "system" as const,
      content:
        "You are an internal Oracle Games stats analysis assistant. Return JSON only. " +
        "Summarize the provided normalized tool output without inventing fields or changing the underlying meaning. " +
        "Recommend a chart type that fits the data.",
    },
    {
      role: "user" as const,
      content: [
        `Game: ${gameId}`,
        `Idea title: ${idea.title}`,
        `Idea description: ${idea.description}`,
        `Why interesting: ${idea.whyInteresting}`,
        `Required tool: ${idea.requiredTool}`,
        `Preferred chart type: ${idea.chartType}`,
        "Normalized tool output JSON:",
        JSON.stringify(toolRows, null, 2),
        "Return JSON only.",
      ].join("\n\n"),
    },
  ];
}
