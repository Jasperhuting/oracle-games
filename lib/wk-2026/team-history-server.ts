import { getServerFirebase, getServerFirebaseFootball } from "@/lib/firebase/server";
import type { KnockoutMatch } from "@/lib/types/knockout";
import {
  GroupData,
  GroupStageMatch,
  calculateQualifiedTeams,
  initializeKnockoutMatches,
  updateKnockoutMatchesWithQualifiedTeams,
} from "@/lib/wk-2026/knockout-utils";
import {
  createTeamHistoryPairKey,
  sortTeamNames,
  StoredTeamHistoryMap,
  StoredTeamHistoryRecord,
  TeamHistoryResponse,
} from "@/lib/wk-2026/team-history-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const WK_TEAM_HISTORY_COLLECTION = "wk2026TeamHistory";
const TEAM_HISTORY_REFRESH_TTL_MS = 1000 * 60 * 60 * 20;
const TEAM_HISTORY_REFRESH_CONCURRENCY = 4;
const TEAM_HISTORY_REQUEST_TIMEOUT_MS = 20000;

class TeamHistoryFetchError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "TeamHistoryFetchError";
    this.statusCode = statusCode;
  }
}

interface RefreshPair {
  team1: string;
  team2: string;
  tag: string;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function buildPrompt(team1: string, team2: string): string {
  return `Return historical football data for national teams "${team1}" and "${team2}".

Return a JSON object with this exact structure:
{
  "team1Form": [
    { "date": "YYYY-MM-DD", "opponent": "Country Name", "teamScore": 2, "opponentScore": 1, "result": "W", "competition": "Competition Name" }
  ],
  "team2Form": [
    { "date": "YYYY-MM-DD", "opponent": "Country Name", "teamScore": 0, "opponentScore": 0, "result": "D", "competition": "Competition Name" }
  ],
  "headToHead": [
    { "date": "YYYY-MM-DD", "team1Score": 2, "team2Score": 1, "competition": "Competition Name" }
  ]
}

Rules:
- team1Form: last 5 international matches for "${team1}" (most recent last), use real historical results
- team2Form: last 5 international matches for "${team2}" (most recent last), use real historical results
- headToHead: last 5 matches between "${team1}" and "${team2}" (most recent last), or fewer if less exist
- result: "W" if teamScore > opponentScore, "D" if equal, "L" if teamScore < opponentScore
- Use real matches from FIFA World Cup, UEFA/CONMEBOL qualifiers, Nations League, friendlies, etc.
- Only use real men's senior international matches between national teams
- Never include esports, eFootball, cyber, simulated, virtual, fantasy, youth, women, club, training or unofficial matches
- Never invent matches or infer meetings from betting, stats or game-simulation sites
- If teams have never met, return an empty headToHead array
- Dates must be real match dates
- Only return the JSON object, nothing else`;
}

const INVALID_COMPETITION_KEYWORDS = [
  "esport",
  "esports",
  "e-sport",
  "efootball",
  "cyber",
  "simulated",
  "simulation",
  "virtual",
  "fantasy",
  "friendly game",
  "training",
  "women",
  "womens",
  "u17",
  "u18",
  "u19",
  "u20",
  "u21",
  "u23",
  "youth",
  "olympic",
  "futsal",
  "beachsoccer",
  "beach soccer",
];

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidHistoricalDate(value: string) {
  if (!isIsoDate(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  return year >= 1900 && timestamp <= Date.now();
}

function isPlausibleScore(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 25;
}

function containsInvalidCompetitionKeyword(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return INVALID_COMPETITION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function computeResult(teamScore: number, opponentScore: number): "W" | "D" | "L" {
  if (teamScore > opponentScore) {
    return "W";
  }

  if (teamScore < opponentScore) {
    return "L";
  }

  return "D";
}

function sanitizeTeamHistoryResponse(payload: Partial<TeamHistoryResponse> | null | undefined): TeamHistoryResponse {
  const sanitizeFormMatch = (match: TeamHistoryResponse["team1Form"][number]) => {
    const date = String(match.date || "");
    const opponent = String(match.opponent || "").trim();
    const teamScore = Number(match.teamScore ?? 0);
    const opponentScore = Number(match.opponentScore ?? 0);
    const competition = String(match.competition || "").trim();

    if (
      !isValidHistoricalDate(date) ||
      !opponent ||
      !competition ||
      !isPlausibleScore(teamScore) ||
      !isPlausibleScore(opponentScore) ||
      containsInvalidCompetitionKeyword(competition)
    ) {
      return null;
    }

    return {
      date,
      opponent,
      teamScore,
      opponentScore,
      result: computeResult(teamScore, opponentScore),
      competition,
    };
  };

  const sanitizeHeadToHeadMatch = (match: TeamHistoryResponse["headToHead"][number]) => {
    const date = String(match.date || "");
    const team1Score = Number(match.team1Score ?? 0);
    const team2Score = Number(match.team2Score ?? 0);
    const competition = String(match.competition || "").trim();

    if (
      !isValidHistoricalDate(date) ||
      !competition ||
      !isPlausibleScore(team1Score) ||
      !isPlausibleScore(team2Score) ||
      containsInvalidCompetitionKeyword(competition)
    ) {
      return null;
    }

    return {
      date,
      team1Score,
      team2Score,
      competition,
    };
  };

  return {
    team1Form: (payload?.team1Form || []).map(sanitizeFormMatch).filter((match) => match !== null).slice(0, 5),
    team2Form: (payload?.team2Form || []).map(sanitizeFormMatch).filter((match) => match !== null).slice(0, 5),
    headToHead: (payload?.headToHead || [])
      .map(sanitizeHeadToHeadMatch)
      .filter((match) => match !== null)
      .slice(0, 5),
  };
}

function createEmptyTeamHistoryResponse(): TeamHistoryResponse {
  return {
    team1Form: [],
    team2Form: [],
    headToHead: [],
  };
}

function getCollection() {
  return getServerFirebaseFootball().collection(WK_TEAM_HISTORY_COLLECTION);
}

function getDocumentIdForPair(team1: string, team2: string) {
  return encodeURIComponent(createTeamHistoryPairKey(team1, team2));
}

function normalizeStoredRecord(doc: FirebaseFirestore.DocumentData): StoredTeamHistoryRecord {
  return {
    pairKey: String(doc.pairKey || ""),
    teamA: String(doc.teamA || ""),
    teamB: String(doc.teamB || ""),
    data: sanitizeTeamHistoryResponse(doc.data),
    updatedAt: String(doc.updatedAt || ""),
    tags: Array.isArray(doc.tags) ? doc.tags.map((tag) => String(tag)) : [],
  };
}

async function fetchTeamHistoryFromAi(teamA: string, teamB: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEAM_HISTORY_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://oracle-games.vercel.app",
        "X-Title": process.env.OPENROUTER_APP_TITLE || "Oracle Games WK 2026",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You are a football statistics expert with comprehensive knowledge of international football history. Always respond with valid JSON only.',
          },
          { role: "user", content: buildPrompt(teamA, teamB) },
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TeamHistoryFetchError(`OpenRouter request failed: ${response.status} ${errorText}`, response.status);
    }

    const payload = await response.json();
    const rawContent = extractTextContent(payload.choices?.[0]?.message?.content);
    const content = stripCodeFences(rawContent);
    if (!content) {
      throw new Error("OpenRouter returned empty content");
    }

    const parsed = JSON.parse(content) as TeamHistoryResponse;
    return sanitizeTeamHistoryResponse(parsed);
  } catch (error) {
    if (error instanceof TeamHistoryFetchError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new TeamHistoryFetchError("OpenRouter request timed out", 408);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function collectGroupData() {
  const db = getServerFirebaseFootball();
  const poulesSnapshot = await db.collection("poules").get();

  const poules: GroupData[] = [];
  const matches: GroupStageMatch[] = [];

  poulesSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const pouleId = String(data.pouleId || doc.id);

    poules.push({
      pouleId,
      teams: (data.teams || {}) as GroupData["teams"],
    });

    if (data.matches) {
      Object.values(data.matches as Record<string, GroupStageMatch>).forEach((match) => {
        matches.push({
          pouleId,
          team1Id: String(match.team1Id),
          team2Id: String(match.team2Id),
          team1Score: match.team1Score ?? null,
          team2Score: match.team2Score ?? null,
        });
      });
    }
  });

  return { poules, matches };
}

function buildGroupStagePairs(poules: GroupData[]): RefreshPair[] {
  const pairs: RefreshPair[] = [];

  poules.forEach((poule) => {
    const entries = Object.values(poule.teams || {});
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (!entries[i]?.name || !entries[j]?.name) {
          continue;
        }

        pairs.push({
          team1: entries[i].name,
          team2: entries[j].name,
          tag: `group:${poule.pouleId}`,
        });
      }
    }
  });

  return pairs;
}

function buildKnockoutMatchesFromActual(
  qualifiedTeams: Record<string, string>,
  actualMatches: KnockoutMatch[]
): KnockoutMatch[] {
  const baseMatches = initializeKnockoutMatches(qualifiedTeams);
  const actualById = new Map(actualMatches.map((match) => [match.id, match]));

  const mergedMatches = baseMatches.map((baseMatch) => ({
    ...baseMatch,
    ...actualById.get(baseMatch.id),
  }));

  return updateKnockoutMatchesWithQualifiedTeams(mergedMatches, qualifiedTeams);
}

async function collectKnownKnockoutPairs(
  poules: GroupData[],
  matches: GroupStageMatch[]
): Promise<RefreshPair[]> {
  const qualifiedTeams = calculateQualifiedTeams(poules, matches);
  const defaultDb = getServerFirebase();
  const knockoutActualDoc = await defaultDb.collection("wk2026KnockoutActual").doc("results").get();
  const actualMatches = Array.isArray(knockoutActualDoc.data()?.matches)
    ? (knockoutActualDoc.data()?.matches as KnockoutMatch[])
    : [];

  const knownMatches = buildKnockoutMatchesFromActual(qualifiedTeams, actualMatches);

  return knownMatches
    .filter((match) => match.team1 && match.team2)
    .map((match) => ({
      team1: String(match.team1),
      team2: String(match.team2),
      tag: `knockout:${match.id}`,
    }));
}

function mergeRefreshPairs(pairs: RefreshPair[]) {
  const merged = new Map<string, { team1: string; team2: string; tags: Set<string> }>();

  pairs.forEach((pair) => {
    const pairKey = createTeamHistoryPairKey(pair.team1, pair.team2);
    const existing = merged.get(pairKey);

    if (existing) {
      existing.tags.add(pair.tag);
      return;
    }

    merged.set(pairKey, {
      team1: pair.team1,
      team2: pair.team2,
      tags: new Set([pair.tag]),
    });
  });

  return merged;
}

export async function loadStoredTeamHistory(team1: string, team2: string) {
  const doc = await getCollection().doc(getDocumentIdForPair(team1, team2)).get();
  const data = doc.data();
  if (!doc.exists || !data) {
    return null;
  }

  return normalizeStoredRecord(data);
}

export async function loadAllStoredTeamHistories(): Promise<StoredTeamHistoryMap> {
  const snapshot = await getCollection().get();
  const histories: StoredTeamHistoryMap = {};

  snapshot.docs.forEach((doc) => {
    const record = normalizeStoredRecord(doc.data());
    if (record.pairKey) {
      histories[record.pairKey] = record;
    }
  });

  return histories;
}

export async function refreshSingleTeamHistory(params: {
  team1: string;
  team2: string;
  tags?: string[];
  force?: boolean;
}) {
  const [teamA, teamB] = sortTeamNames(params.team1, params.team2);
  const pairKey = createTeamHistoryPairKey(teamA, teamB);
  const docRef = getCollection().doc(getDocumentIdForPair(teamA, teamB));
  const existingDoc = await docRef.get();
  const existingData = existingDoc.data();
  const existingRecord = existingDoc.exists && existingData ? normalizeStoredRecord(existingData) : null;

  const updatedRecently =
    existingRecord?.updatedAt &&
    Date.now() - new Date(existingRecord.updatedAt).getTime() < TEAM_HISTORY_REFRESH_TTL_MS;

  if (updatedRecently && !params.force) {
    return { pairKey, status: "skipped" as const };
  }

  const tags = Array.from(new Set([...(existingRecord?.tags || []), ...(params.tags || [])])).sort();
  const updatedAt = new Date().toISOString();

  try {
    const data = await fetchTeamHistoryFromAi(teamA, teamB);

    await docRef.set({
      pairKey,
      teamA,
      teamB,
      data,
      tags,
      updatedAt,
    });

    return { pairKey, status: "refreshed" as const };
  } catch (error) {
    if (error instanceof TeamHistoryFetchError && (error.statusCode === 429 || error.statusCode === 408)) {
      const failureTag = error.statusCode === 429 ? "openrouter-rate-limited" : "openrouter-timeout";

      await docRef.set({
        pairKey,
        teamA,
        teamB,
        data: createEmptyTeamHistoryResponse(),
        tags: Array.from(new Set([...tags, failureTag, "fallback-empty"])).sort(),
        updatedAt,
      });

      return { pairKey, status: "fallback-empty" as const };
    }

    throw error;
  }
}

export async function refreshAllWkTeamHistories(options?: { force?: boolean }) {
  const { poules, matches } = await collectGroupData();
  const refreshPairs = mergeRefreshPairs([
    ...buildGroupStagePairs(poules),
    ...(await collectKnownKnockoutPairs(poules, matches)),
  ]);

  const queue = Array.from(refreshPairs.values());
  const summary = {
    totalPairs: queue.length,
    refreshed: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queue.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const pair = queue[currentIndex];

      try {
        const result = await refreshSingleTeamHistory({
          team1: pair.team1,
          team2: pair.team2,
          tags: Array.from(pair.tags),
          force: options?.force,
        });

        if (result.status === "refreshed") {
          summary.refreshed += 1;
        } else {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.failed += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        summary.errors.push(`${pair.team1} vs ${pair.team2}: ${message}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(TEAM_HISTORY_REFRESH_CONCURRENCY, queue.length || 1) }, () => worker())
  );

  return summary;
}
