export interface MatchResult {
  date: string;
  opponent: string;
  teamScore: number;
  opponentScore: number;
  result: "W" | "D" | "L";
  competition: string;
}

export interface HeadToHeadMatch {
  date: string;
  team1Score: number;
  team2Score: number;
  competition: string;
}

export interface TeamHistoryResponse {
  team1Form: MatchResult[];
  team2Form: MatchResult[];
  headToHead: HeadToHeadMatch[];
}

export interface StoredTeamHistoryRecord {
  pairKey: string;
  teamA: string;
  teamB: string;
  data: TeamHistoryResponse;
  updatedAt: string;
  tags?: string[];
}

export type StoredTeamHistoryMap = Record<string, StoredTeamHistoryRecord>;

function normalizeTeamName(name: string) {
  return name.trim();
}

export function sortTeamNames(team1: string, team2: string): [string, string] {
  return [normalizeTeamName(team1), normalizeTeamName(team2)].sort((a, b) => a.localeCompare(b)) as [string, string];
}

export function createTeamHistoryPairKey(team1: string, team2: string) {
  return sortTeamNames(team1, team2).join("__");
}

export function reverseTeamHistory(history: TeamHistoryResponse): TeamHistoryResponse {
  return {
    team1Form: history.team2Form,
    team2Form: history.team1Form,
    headToHead: history.headToHead.map((match) => ({
      ...match,
      team1Score: match.team2Score,
      team2Score: match.team1Score,
    })),
  };
}

export function orientTeamHistory(
  history: TeamHistoryResponse,
  requestedTeam1: string,
  requestedTeam2: string
): TeamHistoryResponse {
  const [teamA] = sortTeamNames(requestedTeam1, requestedTeam2);
  return normalizeTeamName(requestedTeam1) === teamA ? history : reverseTeamHistory(history);
}
