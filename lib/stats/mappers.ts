import { generatedStatResponseSchema, statIdeaResponseSchema } from "@/lib/stats/schemas";
import type {
  ChartType,
  GeneratedStatRow,
  StatIdeaSource,
  StatsToolName,
} from "@/lib/stats/types";

type IdeaTemplate = {
  title: string;
  description: string;
  whyInteresting: string;
  chartType: ChartType;
  requiredTool: StatsToolName;
  confidence: number;
};

function inferToolFromIdeaText(text: string): StatsToolName | null {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("winner pick") ||
    normalized.includes("race winner pick") ||
    normalized.includes("pole") ||
    normalized.includes("p1")
  ) {
    return "getF1PopularWinnerPicks";
  }

  if (normalized.includes("bonus specialist") || normalized.includes("bonus question")) {
    return "getF1BonusSpecialists";
  }

  if (
    normalized.includes("missed prediction") ||
    normalized.includes("submission risk") ||
    normalized.includes("prediction coverage")
  ) {
    return "getF1MissedPredictionRisk";
  }

  if (
    normalized.includes("active predictor") ||
    normalized.includes("prediction volume") ||
    normalized.includes("prediction activity")
  ) {
    return "getF1MostActivePredictors";
  }

  if (
    normalized.includes("best predictor") ||
    normalized.includes("lowest penalty") ||
    normalized.includes("f1 leaderboard")
  ) {
    return "getF1BestPredictors";
  }

  if (
    normalized.includes("ownership") ||
    normalized.includes("selected") ||
    normalized.includes("underpicked")
  ) {
    return "getMostSelected";
  }

  if (normalized.includes("value") || normalized.includes("budget efficiency")) {
    return "getBestValuePicks";
  }

  if (normalized.includes("mover") || normalized.includes("movement") || normalized.includes("momentum")) {
    return "getBiggestMovers";
  }

  if (
    normalized.includes("team spread") ||
    normalized.includes("team concentration") ||
    normalized.includes("team distribution")
  ) {
    return "getTeamDistribution";
  }

  if (
    normalized.includes("top scorer") ||
    normalized.includes("top scorers") ||
    normalized.includes("scoring") ||
    normalized.includes("fantasy scorer")
  ) {
    return "getTopScorers";
  }

  if (
    normalized.includes("active") ||
    normalized.includes("engaged") ||
    normalized.includes("participat") ||
    normalized.includes("meedoen") ||
    normalized.includes("activity")
  ) {
    return "getMostActivePlayers";
  }

  if (
    normalized.includes("average rank") ||
    normalized.includes("gemiddelde rank") ||
    normalized.includes("ranking") ||
    normalized.includes("consistent")
  ) {
    return "getBestAverageRankPlayers";
  }

  if (
    normalized.includes("manager") ||
    normalized.includes("player") ||
    normalized.includes("speler") ||
    normalized.includes("user") ||
    normalized.includes("strongest")
  ) {
    return "getTopPlayersByPoints";
  }

  return null;
}

function isPlayerTool(toolName: StatsToolName) {
  return (
    toolName === "getTopPlayersByPoints" ||
    toolName === "getMostActivePlayers" ||
    toolName === "getBestAverageRankPlayers"
  );
}

function isLegacyEntityTool(toolName: StatsToolName) {
  return !isPlayerTool(toolName);
}

const PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Top managers in this game",
    description: "Rank the strongest players in the selected game by total points.",
    whyInteresting: "Lets admins inspect which users are currently outperforming the field.",
    chartType: "bar",
    requiredTool: "getTopPlayersByPoints",
    confidence: 0.85,
  },
  {
    title: "Most active players this year",
    description: "Find which users are participating in the most games during the same year.",
    whyInteresting: "Useful for understanding your most engaged core players.",
    chartType: "bar",
    requiredTool: "getMostActivePlayers",
    confidence: 0.8,
  },
  {
    title: "Best average ranking players",
    description: "Compare players by their average ranking across games in the same year.",
    whyInteresting: "Surfaces players who perform consistently well across multiple games.",
    chartType: "table",
    requiredTool: "getBestAverageRankPlayers",
    confidence: 0.83,
  },
  {
    title: "Under-the-radar strong players",
    description: "Compare average ranking and participation count to find players who perform well without being the most active.",
    whyInteresting: "Helps spot quality players that can be missed when only total volume is considered.",
    chartType: "table",
    requiredTool: "getBestAverageRankPlayers",
    confidence: 0.79,
  },
  {
    title: "High-volume vs high-performance players",
    description: "Contrast players who join many games with players who convert those entries into strong results.",
    whyInteresting: "Shows the difference between engagement and actual competitive quality.",
    chartType: "scatter",
    requiredTool: "getMostActivePlayers",
    confidence: 0.76,
  },
  {
    title: "Top scorers vs price",
    description: "Compare the highest fantasy scorers against their budget cost.",
    whyInteresting: "Quickly surfaces premium picks that are actually delivering.",
    chartType: "bar",
    requiredTool: "getTopScorers",
    confidence: 0.78,
  },
  {
    title: "Ownership pressure check",
    description: "Look at the most-selected picks and whether their output justifies the ownership.",
    whyInteresting: "Helps spot chalk picks that are safe versus overowned.",
    chartType: "bar",
    requiredTool: "getMostSelected",
    confidence: 0.74,
  },
  {
    title: "Best value picks",
    description: "Rank riders by value score to identify efficient budget usage.",
    whyInteresting: "Supports lineup construction around cost-efficient performers.",
    chartType: "table",
    requiredTool: "getBestValuePicks",
    confidence: 0.76,
  },
  {
    title: "Biggest movers",
    description: "Highlight which picks gained or lost the most momentum over the latest window.",
    whyInteresting: "Useful for detecting hype swings and market corrections.",
    chartType: "line",
    requiredTool: "getBiggestMovers",
    confidence: 0.72,
  },
  {
    title: "Team concentration",
    description: "Show how selections are distributed across teams.",
    whyInteresting: "Makes concentration risk and stacking patterns visible immediately.",
    chartType: "pie",
    requiredTool: "getTeamDistribution",
    confidence: 0.7,
  },
];

const F1_PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Best F1 predictors this season",
    description: "Rank participants by lowest accumulated penalty points in the F1 standings.",
    whyInteresting: "Shows who is consistently closest to the official race outcomes.",
    chartType: "table",
    requiredTool: "getF1BestPredictors",
    confidence: 0.88,
  },
  {
    title: "Most active F1 predictors",
    description: "Compare which participants submit the most race predictions across the season.",
    whyInteresting: "Highlights your most engaged F1 players and their submission rate.",
    chartType: "bar",
    requiredTool: "getF1MostActivePredictors",
    confidence: 0.84,
  },
  {
    title: "F1 bonus specialists",
    description: "Find the players who most often hit pole, fastest lap and DNF bonus questions.",
    whyInteresting: "Surfaces users with strong intuition for the bonus layer of the game.",
    chartType: "bar",
    requiredTool: "getF1BonusSpecialists",
    confidence: 0.83,
  },
  {
    title: "Most popular race winner picks",
    description: "Aggregate which drivers are most often predicted as race winner across all F1 predictions.",
    whyInteresting: "Useful for spotting consensus picks and dominant driver sentiment.",
    chartType: "bar",
    requiredTool: "getF1PopularWinnerPicks",
    confidence: 0.82,
  },
  {
    title: "F1 missed prediction risk",
    description: "Show which active players are missing the most prediction opportunities.",
    whyInteresting: "Helps identify drop-off risk and inactive participants before it becomes visible elsewhere.",
    chartType: "bar",
    requiredTool: "getF1MissedPredictionRisk",
    confidence: 0.8,
  },
];

export function buildPhaseOneIdeas(maxIdeas: number, gameType?: string | null) {
  const sourceIdeas = gameType === "f1-prediction" ? F1_PHASE_ONE_IDEAS : PHASE_ONE_IDEAS;
  return statIdeaResponseSchema.parse({
    ideas: sourceIdeas.slice(0, maxIdeas),
  }).ideas;
}

export function normalizeGeneratedIdeas<T extends IdeaTemplate>(ideas: T[]) {
  return ideas.map((idea) => {
    const inferredTool = inferToolFromIdeaText(`${idea.title} ${idea.description} ${idea.whyInteresting}`);

    if (!inferredTool) {
      return idea;
    }

    const suggestedChartType =
      inferredTool === "getBestAverageRankPlayers"
        ? "table"
        : inferredTool === "getMostActivePlayers"
          ? "bar"
          : "bar";

    return {
      ...idea,
      requiredTool: inferredTool,
      chartType: suggestedChartType,
    };
  });
}

export function resolveIdeaTool(params: {
  title: string;
  description: string;
  whyInteresting: string;
  requiredTool: StatsToolName;
}) {
  const inferredTool = inferToolFromIdeaText(`${params.title} ${params.description} ${params.whyInteresting}`);

  if (!inferredTool) {
    return params.requiredTool;
  }

  if (inferredTool === params.requiredTool) {
    return params.requiredTool;
  }

  if (isPlayerTool(inferredTool) && isLegacyEntityTool(params.requiredTool)) {
    return inferredTool;
  }

  if (isLegacyEntityTool(inferredTool) && isPlayerTool(params.requiredTool)) {
    return inferredTool;
  }

  return params.requiredTool;
}

export function summarizeIdeaGeneration(gameId: string) {
  return `Phase 1 deterministic idea generation for ${gameId} using fixed read-only stats tools.`;
}

export function summarizeToolOutput(toolName: StatsToolName, rows: GeneratedStatRow[]) {
  return `${toolName} returned ${rows.length} rows of normalized read-only stats data.`;
}

export function buildGeneratedStatDraft(params: {
  title: string;
  chartType: ChartType;
  rows: GeneratedStatRow[];
  source: StatIdeaSource;
}) {
  const { title, chartType, rows, source } = params;
  const summary =
    rows.length === 0
      ? "No rows were returned by the selected read-only tool."
      : `Built from ${rows.length} rows via a fixed read-only tool in ${source} mode.`;

  return generatedStatResponseSchema.parse({
    title,
    summary,
    chartType,
    data: rows,
    confidence: rows.length > 0 ? 0.72 : 0.35,
  });
}
