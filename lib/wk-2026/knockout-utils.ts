import { POULES } from "@/app/wk-2026/page";
import { KNOCKOUT_MATCHES, KnockoutMatch } from "@/lib/types/knockout";

export interface GroupTeamEntry {
  name: string;
}

export interface GroupData {
  pouleId: string;
  teams?: Record<string, GroupTeamEntry>;
}

export interface GroupStageMatch {
  pouleId: string;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
}

export interface GroupStanding {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface ThirdPlacedStanding extends GroupStanding {
  poule: string;
}

export function calculateGroupStandings(
  pouleId: string,
  poules: GroupData[],
  allMatches: GroupStageMatch[]
): GroupStanding[] {
  const pouleData = poules.find((poule) => poule.pouleId === pouleId);
  if (!pouleData?.teams) return [];

  const teams = Object.keys(pouleData.teams);
  const pouleMatches = allMatches.filter((match) => match.pouleId === pouleId);

  const stats: Record<string, GroupStanding> = {};
  teams.forEach((teamId) => {
    stats[teamId] = {
      teamId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  });

  pouleMatches.forEach((match) => {
    if (match.team1Score === null || match.team2Score === null) {
      return;
    }

    const team1Stats = stats[match.team1Id];
    const team2Stats = stats[match.team2Id];

    if (!team1Stats || !team2Stats) {
      return;
    }

    team1Stats.played++;
    team2Stats.played++;
    team1Stats.goalsFor += match.team1Score;
    team1Stats.goalsAgainst += match.team2Score;
    team2Stats.goalsFor += match.team2Score;
    team2Stats.goalsAgainst += match.team1Score;

    if (match.team1Score > match.team2Score) {
      team1Stats.won++;
      team1Stats.points += 3;
      team2Stats.lost++;
    } else if (match.team1Score < match.team2Score) {
      team2Stats.won++;
      team2Stats.points += 3;
      team1Stats.lost++;
    } else {
      team1Stats.drawn++;
      team2Stats.drawn++;
      team1Stats.points += 1;
      team2Stats.points += 1;
    }

    team1Stats.goalDifference = team1Stats.goalsFor - team1Stats.goalsAgainst;
    team2Stats.goalDifference = team2Stats.goalsFor - team2Stats.goalsAgainst;
  });

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.won - a.won;
  });
}

export function calculateQualifiedTeams(
  poules: GroupData[],
  allMatches: GroupStageMatch[],
  thirdPlacedOverride?: Array<{ teamId: string; poule: string }> | null
) {
  const qualified: Record<string, string> = {};

  POULES.forEach((pouleId) => {
    const standings = calculateGroupStandings(pouleId, poules, allMatches);
    if (standings.length >= 2) {
      qualified[`1${pouleId.toUpperCase()}`] = standings[0].teamId;
      qualified[`2${pouleId.toUpperCase()}`] = standings[1].teamId;
    }
  });

  let sortedThirdPlaced: ThirdPlacedStanding[];

  if (thirdPlacedOverride && thirdPlacedOverride.length > 0) {
    const allThirdPlaced: ThirdPlacedStanding[] = [];
    POULES.forEach((pouleId) => {
      const standings = calculateGroupStandings(pouleId, poules, allMatches);
      if (standings.length >= 3) {
        allThirdPlaced.push({ ...standings[2], poule: pouleId.toUpperCase() });
      }
    });
    const statsMap = new Map(allThirdPlaced.map((t) => [t.teamId, t]));
    sortedThirdPlaced = thirdPlacedOverride
      .map((entry) => statsMap.get(entry.teamId) ?? { teamId: entry.teamId, poule: entry.poule, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 })
      .filter((t) => t !== undefined) as ThirdPlacedStanding[];
  } else {
    const allThirdPlaced: ThirdPlacedStanding[] = [];
    POULES.forEach((pouleId) => {
      const standings = calculateGroupStandings(pouleId, poules, allMatches);
      if (standings.length >= 3) {
        allThirdPlaced.push({
          ...standings[2],
          poule: pouleId.toUpperCase(),
        });
      }
    });

    sortedThirdPlaced = allThirdPlaced.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.won - a.won;
    });
  }

  const thirdPlaceSlots = [
    { slot: "3A/B/C/D/F", groups: ["A", "B", "C", "D", "F"] },
    { slot: "3C/D/F/G/H", groups: ["C", "D", "F", "G", "H"] },
    { slot: "3C/E/F/H/I", groups: ["C", "E", "F", "H", "I"] },
    { slot: "3E/H/I/J/K", groups: ["E", "H", "I", "J", "K"] },
    { slot: "3B/E/F/I/J", groups: ["B", "E", "F", "I", "J"] },
    { slot: "3A/E/H/I/J", groups: ["A", "E", "H", "I", "J"] },
    { slot: "3E/F/G/I/J", groups: ["E", "F", "G", "I", "J"] },
    { slot: "3D/E/I/J/L", groups: ["D", "E", "I", "J", "L"] },
  ];

  thirdPlaceSlots.forEach(({ slot, groups }) => {
    for (const team of sortedThirdPlaced) {
      if (groups.includes(team.poule) && !Object.values(qualified).includes(team.teamId)) {
        qualified[slot] = team.teamId;
        break;
      }
    }
  });

  return qualified;
}

export function initializeKnockoutMatches(qualifiedTeams: Record<string, string>): KnockoutMatch[] {
  return KNOCKOUT_MATCHES.map((match) => ({
    ...match,
    team1: qualifiedTeams[match.team1Source] || null,
    team2: qualifiedTeams[match.team2Source] || null,
    team1Score: null,
    team2Score: null,
    winner: null,
  }));
}

export function propagateKnownKnockoutTeams(matches: KnockoutMatch[]): KnockoutMatch[] {
  const updated = matches.map((match) => ({ ...match }));

  updated.forEach((match) => {
    if (match.round === "round_of_32") {
      return;
    }

    if (match.team1Source.startsWith("winner_")) {
      const sourceMatchNum = parseInt(match.team1Source.replace("winner_", ""), 10);
      const sourceMatch = updated.find((candidate) => candidate.matchNumber === sourceMatchNum);
      match.team1 = sourceMatch?.winner || null;
    } else if (match.team1Source.startsWith("loser_")) {
      const sourceMatchNum = parseInt(match.team1Source.replace("loser_", ""), 10);
      const sourceMatch = updated.find((candidate) => candidate.matchNumber === sourceMatchNum);
      if (sourceMatch?.winner && sourceMatch.team1 && sourceMatch.team2) {
        match.team1 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
      } else {
        match.team1 = null;
      }
    }

    if (match.team2Source.startsWith("winner_")) {
      const sourceMatchNum = parseInt(match.team2Source.replace("winner_", ""), 10);
      const sourceMatch = updated.find((candidate) => candidate.matchNumber === sourceMatchNum);
      match.team2 = sourceMatch?.winner || null;
    } else if (match.team2Source.startsWith("loser_")) {
      const sourceMatchNum = parseInt(match.team2Source.replace("loser_", ""), 10);
      const sourceMatch = updated.find((candidate) => candidate.matchNumber === sourceMatchNum);
      if (sourceMatch?.winner && sourceMatch.team1 && sourceMatch.team2) {
        match.team2 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
      } else {
        match.team2 = null;
      }
    }
  });

  return updated;
}

export function updateKnockoutMatchesWithQualifiedTeams(
  existingMatches: KnockoutMatch[],
  qualifiedTeams: Record<string, string>
): KnockoutMatch[] {
  const seededMatches = existingMatches.map((match) => ({ ...match }));

  seededMatches.forEach((match) => {
    if (match.round === "round_of_32") {
      const nextTeam1 = qualifiedTeams[match.team1Source] || null;
      const nextTeam2 = qualifiedTeams[match.team2Source] || null;
      const teamsChanged = match.team1 !== nextTeam1 || match.team2 !== nextTeam2;

      match.team1 = nextTeam1;
      match.team2 = nextTeam2;

      // If the seeded teams changed, any old score/winner belongs to a stale matchup.
      if (teamsChanged) {
        match.team1Score = null;
        match.team2Score = null;
        match.winner = null;
        return;
      }

      if (match.winner && match.winner !== match.team1 && match.winner !== match.team2) {
        match.winner = null;
      }
    }
  });

  return propagateKnownKnockoutTeams(seededMatches);
}
