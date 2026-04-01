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
  const n = text.toLowerCase();

  // F1-specific (check first — very specific phrases)
  if (n.includes("podium accuracy") || n.includes("podium prediction") || n.includes("podium hit")) {
    return "getF1PodiumAccuracy";
  }
  if (n.includes("constructor") || (n.includes("team") && n.includes("f1") && n.includes("popular"))) {
    return "getF1TeamPopularity";
  }
  if (n.includes("average predicted position") || n.includes("driver avg") || (n.includes("driver") && n.includes("position") && n.includes("predicted"))) {
    return "getF1DriverAvgPosition";
  }
  if (n.includes("winner pick") || n.includes("race winner pick") || (n.includes("pole") && n.includes("f1"))) {
    return "getF1PopularWinnerPicks";
  }
  if (n.includes("bonus specialist") || n.includes("bonus question") || n.includes("bonus hit")) {
    return "getF1BonusSpecialists";
  }
  if (n.includes("missed prediction") || n.includes("submission risk") || n.includes("prediction coverage")) {
    return "getF1MissedPredictionRisk";
  }
  if (n.includes("active predictor") || n.includes("prediction volume") || n.includes("prediction activity") || n.includes("prediction submission")) {
    return "getF1MostActivePredictors";
  }
  if (n.includes("best predictor") || n.includes("lowest penalty") || n.includes("f1 leaderboard") || (n.includes("f1") && n.includes("accurate"))) {
    return "getF1BestPredictors";
  }

  // Slipstream-specific
  if (n.includes("green jersey") || n.includes("groene trui") || n.includes("sprint point")) {
    return "getSlipstreamGreenJerseyKings";
  }
  if (n.includes("penalty") || n.includes("penalt") || n.includes("missed pick") || n.includes("dnf") || n.includes("dns") || n.includes("straf")) {
    return "getSlipstreamPenaltyReport";
  }

  // Draft-specific
  if (n.includes("draft round") || n.includes("roi per round") || n.includes("round value") || n.includes("pick return")) {
    return "getDraftPickROI";
  }
  if (n.includes("growth") || n.includes("groei") || n.includes("rising star") || n.includes("ontwikkeling")) {
    return "getRisingStarsGrowth";
  }

  // Auctioneer-specific
  if (n.includes("budget efficiency") || n.includes("points per coin") || n.includes("budget rendement") || n.includes("coin spent")) {
    return "getAuctionBudgetEfficiency";
  }
  if (n.includes("contested") || n.includes("most bids") || n.includes("bid competition") || n.includes("omstreden")) {
    return "getAuctionMostContested";
  }

  // Season-level
  if (n.includes("season top") || n.includes("seizoen top") || n.includes("season rider") || n.includes("global rider")) {
    return "getSeasonTopRiders";
  }

  // Player win rate
  if (n.includes("win rate") || n.includes("top-3") || n.includes("top 3 finish") || n.includes("podium finish") || n.includes("winnaar")) {
    return "getPlayerWinRate";
  }

  // Generic cycling
  if (n.includes("ownership") || n.includes("selected") || n.includes("underpicked") || n.includes("meest gekozen")) {
    return "getMostSelected";
  }
  if (n.includes("value") || n.includes("waarde")) {
    return "getBestValuePicks";
  }
  if (n.includes("mover") || n.includes("movement") || n.includes("momentum") || n.includes("trending")) {
    return "getBiggestMovers";
  }
  if (n.includes("team spread") || n.includes("team concentration") || n.includes("team distribution") || n.includes("ploeg verdeling")) {
    return "getTeamDistribution";
  }
  if (n.includes("top scorer") || n.includes("top scorers") || n.includes("scoring") || n.includes("fantasy scorer") || n.includes("hoogste punten")) {
    return "getTopScorers";
  }

  // Player tools
  if (n.includes("average rank") || n.includes("gemiddelde rank") || n.includes("consistent") || n.includes("gemiddeld klassement")) {
    return "getBestAverageRankPlayers";
  }
  if (n.includes("active") || n.includes("engaged") || n.includes("participat") || n.includes("meedoen") || n.includes("activity")) {
    return "getMostActivePlayers";
  }
  if (n.includes("manager") || n.includes("player") || n.includes("speler") || n.includes("user") || n.includes("strongest") || n.includes("sterkste")) {
    return "getTopPlayersByPoints";
  }

  return null;
}

const PLAYER_TOOLS = new Set<StatsToolName>([
  "getTopPlayersByPoints",
  "getMostActivePlayers",
  "getBestAverageRankPlayers",
  "getPlayerWinRate",
  "getSlipstreamPenaltyReport",
  "getAuctionBudgetEfficiency",
]);

function isPlayerTool(toolName: StatsToolName) {
  return PLAYER_TOOLS.has(toolName);
}

function isLegacyEntityTool(toolName: StatsToolName) {
  return !isPlayerTool(toolName);
}

// ─── Generic ideas (auctioneer, full-grid, worldtour-manager, marginal-gains) ─

const AUCTIONEER_PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Sterkste spelers in dit spel",
    description: "Rank the strongest players in the selected game by total points.",
    whyInteresting: "Lets admins immediately see which managers are leading the field.",
    chartType: "bar",
    requiredTool: "getTopPlayersByPoints",
    confidence: 0.88,
  },
  {
    title: "Budget efficiëntie per speler",
    description: "Compare each player's total points against the budget they spent to build their team.",
    whyInteresting: "Shows who is getting the most out of every coin — the true bargain hunters.",
    chartType: "bar",
    requiredTool: "getAuctionBudgetEfficiency",
    confidence: 0.86,
  },
  {
    title: "Meest omstreden renners in de veiling",
    description: "Show which riders attracted the most competing bids and who ultimately paid the highest price.",
    whyInteresting: "Reveals the hottest commodities in the auction and how competitive the bidding was.",
    chartType: "table",
    requiredTool: "getAuctionMostContested",
    confidence: 0.84,
  },
  {
    title: "Top scorers vs prijs",
    description: "Compare the highest fantasy scorers against their auction price.",
    whyInteresting: "Quickly surfaces premium picks that delivered versus those that disappointed.",
    chartType: "bar",
    requiredTool: "getTopScorers",
    confidence: 0.82,
  },
  {
    title: "Beste waarde renners",
    description: "Rank riders by value score (points per coin) to identify the most efficient picks.",
    whyInteresting: "Supports hindsight analysis of which budget decisions paid off best.",
    chartType: "table",
    requiredTool: "getBestValuePicks",
    confidence: 0.81,
  },
  {
    title: "Meest geselecteerde renners",
    description: "Show which riders were selected by the most players and whether their points justified the popularity.",
    whyInteresting: "Highlights chalk picks and whether the consensus was right.",
    chartType: "bar",
    requiredTool: "getMostSelected",
    confidence: 0.79,
  },
  {
    title: "Ploegverdeling van selecties",
    description: "Show how rider selections are distributed across cycling teams.",
    whyInteresting: "Makes team concentration and stacking patterns immediately visible.",
    chartType: "pie",
    requiredTool: "getTeamDistribution",
    confidence: 0.75,
  },
  {
    title: "Meest actieve spelers dit seizoen",
    description: "Find which users participate in the most games during the same year.",
    whyInteresting: "Useful for understanding your most engaged core players.",
    chartType: "bar",
    requiredTool: "getMostActivePlayers",
    confidence: 0.77,
  },
  {
    title: "Beste gemiddelde ranking",
    description: "Compare players by their average finishing rank across games in the same year.",
    whyInteresting: "Surfaces players who perform consistently well across multiple games.",
    chartType: "table",
    requiredTool: "getBestAverageRankPlayers",
    confidence: 0.8,
  },
  {
    title: "Top seizoensrenners",
    description: "Show the top-scoring riders in the global season points table for this year.",
    whyInteresting: "Useful as a reference to compare game selections against real-world performance.",
    chartType: "bar",
    requiredTool: "getSeasonTopRiders",
    confidence: 0.78,
  },
];

// ─── Slipstream & Last Man Standing ideas ─────────────────────────────────────

const SLIPSTREAM_PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Meest gekozen renners in slipstream",
    description: "Show which riders were picked most often across all stages and by how many unique players.",
    whyInteresting: "Reveals the most popular stage picks and whether the consensus choices paid off.",
    chartType: "bar",
    requiredTool: "getMostSelected",
    confidence: 0.9,
  },
  {
    title: "Sterkste spelers in dit spel",
    description: "Rank players in this slipstream game by their total accumulated points.",
    whyInteresting: "Shows the current leaderboard and which managers made the best stage picks.",
    chartType: "bar",
    requiredTool: "getTopPlayersByPoints",
    confidence: 0.88,
  },
  {
    title: "Groene trui specialisten",
    description: "Show which riders generated the most green jersey sprint points across all stage picks.",
    whyInteresting: "Highlights which riders added the most bonus sprint value on top of their stage results.",
    chartType: "bar",
    requiredTool: "getSlipstreamGreenJerseyKings",
    confidence: 0.86,
  },
  {
    title: "Penalty rapport per speler",
    description: "Show which players suffered the most DNF, DNS, or missed-pick penalties, with a breakdown per type.",
    whyInteresting: "Useful to see who was affected by bad luck or poor pick timing throughout the race.",
    chartType: "table",
    requiredTool: "getSlipstreamPenaltyReport",
    confidence: 0.85,
  },
  {
    title: "Ploegverdeling van picks",
    description: "Show how stage picks are distributed across cycling teams.",
    whyInteresting: "Makes clear which cycling teams dominated the stage-pick choices.",
    chartType: "pie",
    requiredTool: "getTeamDistribution",
    confidence: 0.78,
  },
  {
    title: "Beste gemiddelde ranking over spellen",
    description: "Compare players by their average finishing rank across all slipstream games in the same year.",
    whyInteresting: "Surfaces consistently strong stage-pick managers beyond a single race.",
    chartType: "table",
    requiredTool: "getBestAverageRankPlayers",
    confidence: 0.8,
  },
  {
    title: "Spelerswinratio — wie eindigt vaker in top 3",
    description: "Rank players by how often they finish in the top 3 across slipstream games in the same year.",
    whyInteresting: "Identifies the most consistently dominant players, not just volume participants.",
    chartType: "bar",
    requiredTool: "getPlayerWinRate",
    confidence: 0.82,
  },
  {
    title: "Top seizoensrenners als referentie",
    description: "Show the top-scoring riders in the global season points table for this year.",
    whyInteresting: "Useful reference to compare which real-world top riders were or weren't selected in picks.",
    chartType: "bar",
    requiredTool: "getSeasonTopRiders",
    confidence: 0.76,
  },
];

// ─── Draft game ideas (Poisoned Cup, Rising Stars) ────────────────────────────

const DRAFT_PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Sterkste spelers in dit spel",
    description: "Rank players in this draft game by total points earned from their drafted riders.",
    whyInteresting: "Shows who built the best team through the draft process.",
    chartType: "bar",
    requiredTool: "getTopPlayersByPoints",
    confidence: 0.88,
  },
  {
    title: "ROI per draftronde",
    description: "Show the average points returned per draft round, from round 1 to the last.",
    whyInteresting: "Reveals which rounds produced the best value — is the drop-off after round 3 as steep as expected?",
    chartType: "bar",
    requiredTool: "getDraftPickROI",
    confidence: 0.87,
  },
  {
    title: "Beste groeiers — Rising Stars",
    description: "Rank drafted riders by their year-over-year points growth.",
    whyInteresting: "Shows which rising talents truly broke through compared to their previous season.",
    chartType: "bar",
    requiredTool: "getRisingStarsGrowth",
    confidence: 0.9,
  },
  {
    title: "Meest actieve spelers dit seizoen",
    description: "Find which users participate in the most draft games during the same year.",
    whyInteresting: "Highlights the most engaged competitors across all draft formats.",
    chartType: "bar",
    requiredTool: "getMostActivePlayers",
    confidence: 0.78,
  },
  {
    title: "Beste gemiddelde ranking",
    description: "Compare players by their average finishing rank across draft games in the same year.",
    whyInteresting: "Shows consistent performers who make smart picks in every draft.",
    chartType: "table",
    requiredTool: "getBestAverageRankPlayers",
    confidence: 0.82,
  },
  {
    title: "Spelerswinratio — wie eindigt vaker in top 3",
    description: "Rank players by how often they finish in the top 3 across draft games this year.",
    whyInteresting: "Identifies players who consistently build elite draft rosters.",
    chartType: "bar",
    requiredTool: "getPlayerWinRate",
    confidence: 0.83,
  },
  {
    title: "Ploegverdeling van draft picks",
    description: "Show how drafted riders are distributed across professional cycling teams.",
    whyInteresting: "Reveals which cycling teams dominated the draft selections.",
    chartType: "pie",
    requiredTool: "getTeamDistribution",
    confidence: 0.74,
  },
  {
    title: "Top seizoensrenners als referentie",
    description: "Show the top-scoring riders in the global season points table for this year.",
    whyInteresting: "Useful to see how well the draft field aligned with real-world top performers.",
    chartType: "bar",
    requiredTool: "getSeasonTopRiders",
    confidence: 0.76,
  },
];

// ─── F1 prediction ideas ──────────────────────────────────────────────────────

const F1_PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Beste F1 voorspellers dit seizoen",
    description: "Rank participants by lowest accumulated penalty points in the F1 standings.",
    whyInteresting: "Shows who is consistently closest to the official race outcomes.",
    chartType: "table",
    requiredTool: "getF1BestPredictors",
    confidence: 0.88,
  },
  {
    title: "Podium voorspellingsnauwkeurigheid",
    description: "Rank players by how often they correctly predict drivers in the top 3, with exact winner hit rate.",
    whyInteresting: "Goes deeper than penalty totals — shows who truly understands race outcomes.",
    chartType: "table",
    requiredTool: "getF1PodiumAccuracy",
    confidence: 0.87,
  },
  {
    title: "Meest actieve F1 voorspellers",
    description: "Compare which participants submit the most race predictions across the season.",
    whyInteresting: "Highlights your most engaged F1 players and their submission rate.",
    chartType: "bar",
    requiredTool: "getF1MostActivePredictors",
    confidence: 0.84,
  },
  {
    title: "F1 bonus specialisten",
    description: "Find the players who most often hit pole, fastest lap and DNF bonus questions.",
    whyInteresting: "Surfaces users with strong intuition for the bonus layer of the game.",
    chartType: "bar",
    requiredTool: "getF1BonusSpecialists",
    confidence: 0.83,
  },
  {
    title: "Meest populaire racewinnaar picks",
    description: "Aggregate which drivers are most often predicted as race winner across all F1 predictions.",
    whyInteresting: "Useful for spotting consensus picks and dominant driver sentiment.",
    chartType: "bar",
    requiredTool: "getF1PopularWinnerPicks",
    confidence: 0.82,
  },
  {
    title: "Constructor populariteit in voorspellingen",
    description: "Show which F1 constructors have their drivers picked most often as race winner.",
    whyInteresting: "Reveals which teams the community trusts most — and whether that changes across the season.",
    chartType: "pie",
    requiredTool: "getF1TeamPopularity",
    confidence: 0.81,
  },
  {
    title: "Gemiddelde voorspelde positie per coureur",
    description: "Show where each driver is typically predicted to finish, averaged across all submitted predictions.",
    whyInteresting: "Reveals community consensus on the full grid pecking order.",
    chartType: "table",
    requiredTool: "getF1DriverAvgPosition",
    confidence: 0.8,
  },
  {
    title: "Gemiste voorspelkansen",
    description: "Show which active players are missing the most prediction opportunities.",
    whyInteresting: "Helps identify drop-off risk and inactive participants before it becomes visible elsewhere.",
    chartType: "bar",
    requiredTool: "getF1MissedPredictionRisk",
    confidence: 0.79,
  },
];

// ─── Generic fallback ideas ───────────────────────────────────────────────────

const GENERIC_PHASE_ONE_IDEAS: IdeaTemplate[] = [
  {
    title: "Sterkste spelers in dit spel",
    description: "Rank the strongest players in the selected game by total points.",
    whyInteresting: "Lets admins immediately see which managers are leading the field.",
    chartType: "bar",
    requiredTool: "getTopPlayersByPoints",
    confidence: 0.88,
  },
  {
    title: "Meest actieve spelers dit seizoen",
    description: "Find which users are participating in the most games during the same year.",
    whyInteresting: "Useful for understanding your most engaged core players.",
    chartType: "bar",
    requiredTool: "getMostActivePlayers",
    confidence: 0.8,
  },
  {
    title: "Beste gemiddelde ranking",
    description: "Compare players by their average ranking across games in the same year.",
    whyInteresting: "Surfaces players who perform consistently well across multiple games.",
    chartType: "table",
    requiredTool: "getBestAverageRankPlayers",
    confidence: 0.83,
  },
  {
    title: "Spelerswinratio — wie eindigt vaker in top 3",
    description: "Rank players by how often they finish in the top 3 across games in the same year.",
    whyInteresting: "Identifies the most consistently dominant players beyond single-game performance.",
    chartType: "bar",
    requiredTool: "getPlayerWinRate",
    confidence: 0.82,
  },
  {
    title: "Top scorers vs prijs",
    description: "Compare the highest fantasy scorers against their budget cost.",
    whyInteresting: "Quickly surfaces premium picks that are actually delivering.",
    chartType: "bar",
    requiredTool: "getTopScorers",
    confidence: 0.78,
  },
  {
    title: "Meest geselecteerde renners",
    description: "Look at the most-selected picks and whether their output justifies the ownership.",
    whyInteresting: "Helps spot chalk picks that are safe versus overowned.",
    chartType: "bar",
    requiredTool: "getMostSelected",
    confidence: 0.74,
  },
  {
    title: "Beste waarde renners",
    description: "Rank riders by value score to identify efficient budget usage.",
    whyInteresting: "Supports lineup construction around cost-efficient performers.",
    chartType: "table",
    requiredTool: "getBestValuePicks",
    confidence: 0.76,
  },
  {
    title: "Ploegverdeling van selecties",
    description: "Show how selections are distributed across cycling teams.",
    whyInteresting: "Makes concentration risk and stacking patterns visible immediately.",
    chartType: "pie",
    requiredTool: "getTeamDistribution",
    confidence: 0.7,
  },
  {
    title: "Top seizoensrenners",
    description: "Show the top-scoring riders in the global season points table for this year.",
    whyInteresting: "Useful reference to compare selections against real-world performance.",
    chartType: "bar",
    requiredTool: "getSeasonTopRiders",
    confidence: 0.78,
  },
];

const DRAFT_GAME_TYPES = new Set(["poisoned-cup", "rising-stars"]);
const SLIPSTREAM_GAME_TYPES = new Set(["slipstream", "last-man-standing", "fan-flandrien"]);
const AUCTION_GAME_TYPES = new Set([
  "auctioneer",
  "worldtour-manager",
  "full-grid",
  "marginal-gains",
  "nations-cup",
  "country-roads",
]);

export function buildPhaseOneIdeas(maxIdeas: number, gameType?: string | null) {
  let sourceIdeas: IdeaTemplate[];

  if (gameType === "f1-prediction") {
    sourceIdeas = F1_PHASE_ONE_IDEAS;
  } else if (gameType && SLIPSTREAM_GAME_TYPES.has(gameType)) {
    sourceIdeas = SLIPSTREAM_PHASE_ONE_IDEAS;
  } else if (gameType && DRAFT_GAME_TYPES.has(gameType)) {
    sourceIdeas = DRAFT_PHASE_ONE_IDEAS;
  } else if (gameType && AUCTION_GAME_TYPES.has(gameType)) {
    sourceIdeas = AUCTIONEER_PHASE_ONE_IDEAS;
  } else {
    sourceIdeas = GENERIC_PHASE_ONE_IDEAS;
  }

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

    const tableTools = new Set<StatsToolName>([
      "getBestAverageRankPlayers",
      "getBestValuePicks",
      "getSlipstreamPenaltyReport",
      "getDraftPickROI",
      "getAuctionBudgetEfficiency",
      "getAuctionMostContested",
      "getF1BestPredictors",
      "getF1DriverAvgPosition",
      "getPlayerWinRate",
    ]);
    const pieTools = new Set<StatsToolName>([
      "getTeamDistribution",
      "getF1TeamPopularity",
    ]);
    const suggestedChartType: ChartType = tableTools.has(inferredTool)
      ? "table"
      : pieTools.has(inferredTool)
        ? "pie"
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
