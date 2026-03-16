import type { StatIdea, StatsToolName } from "@/lib/stats/types";

const TOOL_DESCRIPTIONS: Record<StatsToolName, string> = {
  getTopScorers: "Returns top fantasy scorers with points and budget cost.",
  getMostSelected: "Returns the most selected picks with ownership and points.",
  getBestValuePicks: "Returns the strongest value picks based on value score, points and cost.",
  getBiggestMovers: "Returns players with the largest ownership movement delta.",
  getTeamDistribution: "Returns selection distribution aggregated by team.",
  getTopPlayersByPoints: "Returns the highest-scoring game participants for the selected game.",
  getMostActivePlayers: "Returns players with the most participations across games in the same year.",
  getBestAverageRankPlayers: "Returns players with the best average ranking across games in the same year.",
  getF1BestPredictors: "Returns F1 participants with the lowest total penalty points in season standings.",
  getF1MostActivePredictors: "Returns F1 participants with the highest prediction submission volume and rate.",
  getF1BonusSpecialists: "Returns F1 participants with the most correct bonus hits across scored races.",
  getF1PopularWinnerPicks: "Returns the drivers most often predicted as race winners in F1 predictions.",
  getF1MissedPredictionRisk: "Returns F1 participants with the most missed prediction opportunities.",
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
          ? "For F1 games, focus on predictor quality, submission behavior, bonus-question skill, popular winner picks and missed prediction risk."
          : null,
        "Secondary themes: budget efficiency, ownership vs output, biggest movers, sleeper picks, team spread, consistency vs explosiveness, value over time, underpicked performers.",
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
