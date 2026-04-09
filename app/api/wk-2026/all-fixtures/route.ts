import { getServerFirebase, getServerFirebaseFootball } from '@/lib/firebase/server';
import { NextResponse } from 'next/server';
import { GROUP_STAGE_FIXTURES, TEAM_CODE_MAP } from '@/lib/wk-2026/group-stage-fixtures';
import { KNOCKOUT_MATCHES } from '@/lib/types/knockout';

export const runtime = 'nodejs';

export interface FixtureTeam {
  name: string;
  code: string;
  displaySource?: string; // e.g. "2A" for TBD knockout teams
}

export interface FixtureEntry {
  type: 'group' | 'knockout';
  matchNumber: number;
  round: string;
  group?: string;
  date: string;
  time: string;
  stadium: string;
  city: string;
  team1: FixtureTeam | null;
  team2: FixtureTeam | null;
  team1Score: number | null;
  team2Score: number | null;
}

// Dutch round labels
const ROUND_LABELS: Record<string, string> = {
  round_of_32: 'Laatste 32',
  round_of_16: 'Achtste finales',
  quarterfinals: 'Kwartfinales',
  semifinals: 'Halve finales',
  third_place: 'Troostfinale',
  final: 'Finale',
};

// Normalize name variations between FIFA and Firestore
const NAME_ALIASES: Record<string, string> = {
  'South Korea': 'Korea Republic',
  'Turkey': 'Türkiye',
  'Iran': 'IR Iran',
  'Czech Republic': 'Czechia',
  'Cape Verde': 'Cabo Verde',
  'DR Congo': 'Congo DR',
  'United States': 'USA',
  "Cote d'Ivoire": "Côte d'Ivoire",
  'Ivory Coast': "Côte d'Ivoire",
  'Curacao': 'Curaçao',
};

function normalizeName(name: string): string {
  return NAME_ALIASES[name] ?? name;
}

export async function GET() {
  try {
    const [footballDb, defaultDb] = [getServerFirebaseFootball(), getServerFirebase()];

    // --- Fetch group stage scores from Firestore ---
    const poulesSnapshot = await footballDb.collection('poules').get();

    // Build lookup: "group|nameA|nameB" (alphabetical) -> { scores per name }
    type ScoreEntry = { scoreByName: Record<string, number | null> };
    const scoreMap = new Map<string, ScoreEntry>();

    for (const pouleDoc of poulesSnapshot.docs) {
      const data = pouleDoc.data();
      if (!data.matches || !data.teams) continue;

      const pouleId: string = data.pouleId;
      const teamNames: Record<string, string> = {};
      for (const [teamId, teamData] of Object.entries(data.teams as Record<string, { name: string }>)) {
        teamNames[teamId] = normalizeName(teamData.name);
      }

      for (const matchData of Object.values(data.matches as Record<string, { team1Id: string; team2Id: string; team1Score?: number | null; team2Score?: number | null }>)) {
        const t1 = teamNames[matchData.team1Id];
        const t2 = teamNames[matchData.team2Id];
        if (!t1 || !t2) continue;

        const [sortedA, sortedB] = [t1, t2].sort();
        const key = `${pouleId}|${sortedA}|${sortedB}`;
        scoreMap.set(key, {
          scoreByName: {
            [t1]: matchData.team1Score ?? null,
            [t2]: matchData.team2Score ?? null,
          },
        });
      }
    }

    // --- Build group stage fixtures ---
    const groupFixtures: FixtureEntry[] = GROUP_STAGE_FIXTURES.map(fixture => {
      const [sortedA, sortedB] = [fixture.team1Name, fixture.team2Name].sort();
      const key = `${fixture.group}|${sortedA}|${sortedB}`;
      const scores = scoreMap.get(key);

      return {
        type: 'group',
        matchNumber: fixture.matchNumber,
        round: `Groepsfase - Groep ${fixture.group.toUpperCase()}`,
        group: fixture.group,
        date: fixture.date,
        time: fixture.time,
        stadium: fixture.stadium,
        city: fixture.city,
        team1: { name: fixture.team1Name, code: fixture.team1Code },
        team2: { name: fixture.team2Name, code: fixture.team2Code },
        team1Score: scores?.scoreByName[fixture.team1Name] ?? null,
        team2Score: scores?.scoreByName[fixture.team2Name] ?? null,
      };
    });

    // --- Fetch knockout actual scores ---
    const knockoutDoc = await defaultDb.collection('wk2026KnockoutActual').doc('results').get();
    const knockoutActual: Record<number, { team1?: string | null; team2?: string | null; team1Score?: number | null; team2Score?: number | null; winner?: string | null }> = {};

    if (knockoutDoc.exists) {
      const actualMatches = knockoutDoc.data()?.matches ?? [];
      for (const m of actualMatches) {
        if (m.matchNumber) knockoutActual[m.matchNumber] = m;
      }
    }

    // Build teamId -> name map from poules (for knockout team resolution)
    const allTeamNames: Record<string, string> = {};
    for (const pouleDoc of poulesSnapshot.docs) {
      const data = pouleDoc.data();
      if (!data.teams) continue;
      for (const [teamId, teamData] of Object.entries(data.teams as Record<string, { name: string; id?: string }>)) {
        allTeamNames[teamId] = teamData.name;
      }
    }

    // --- Build knockout fixtures ---
    const knockoutFixtures: FixtureEntry[] = KNOCKOUT_MATCHES.map(match => {
      const actual = knockoutActual[match.matchNumber];

      const resolveTeam = (source: string, actualId?: string | null): FixtureTeam | null => {
        if (actualId) {
          const name = allTeamNames[actualId] ?? actualId;
          return { name, code: TEAM_CODE_MAP[name] ?? 'xx', displaySource: source };
        }
        return null;
      };

      const team1 = resolveTeam(match.team1Source, actual?.team1);
      const team2 = resolveTeam(match.team2Source, actual?.team2);

      return {
        type: 'knockout',
        matchNumber: match.matchNumber,
        round: ROUND_LABELS[match.round] ?? match.round,
        date: match.date,
        time: '00:00', // Knockout times TBD
        stadium: match.stadium,
        city: match.location,
        team1: team1 ?? { name: match.team1Source, code: 'xx', displaySource: match.team1Source },
        team2: team2 ?? { name: match.team2Source, code: 'xx', displaySource: match.team2Source },
        team1Score: actual?.team1Score ?? null,
        team2Score: actual?.team2Score ?? null,
      };
    });

    // --- Combine and sort by date + matchNumber ---
    const allFixtures = [...groupFixtures, ...knockoutFixtures].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      const timeDiff = a.time.localeCompare(b.time);
      if (timeDiff !== 0) return timeDiff;
      return a.matchNumber - b.matchNumber;
    });

    return NextResponse.json({ fixtures: allFixtures });
  } catch (error) {
    console.error('Error fetching all fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures', fixtures: [] },
      { status: 500 }
    );
  }
}
