'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import { Flag } from '@/components/Flag';
import { KnockoutMatchCard } from '@/app/wk-2026/components/KnockoutMatchCard';
import { ROUND_LABELS } from '@/lib/types/knockout';

interface DemoMatch {
  id: string;
  matchNumber: number;
  round: 'round_of_16' | 'quarterfinals' | 'semifinals' | 'final';
  date: string;
  stadium: string;
  location: string;
  team1Id: string | null;
  team2Id: string | null;
  team1Source: string;
  team2Source: string;
  team1Score: number | null;
  team2Score: number | null;
  winner: string | null;
}

// Demo teams: ISO code as key, display name as value
const DEMO_TEAMS: Record<string, string> = {
  nl: 'Nederland',
  fr: 'Frankrijk',
  br: 'Brazilië',
  ar: 'Argentinië',
  pt: 'Portugal',
  de: 'Duitsland',
  es: 'Spanje',
  gb_eng: 'Engeland',
};

const INITIAL_MATCHES: DemoMatch[] = [
  {
    id: 'qf1', matchNumber: 97, round: 'quarterfinals', date: '9 juli 2026',
    stadium: 'Gillette Stadium', location: 'Foxborough',
    team1Id: 'nl', team2Id: 'pt', team1Source: 'Winnaar A', team2Source: 'Winnaar B',
    team1Score: null, team2Score: null, winner: null,
  },
  {
    id: 'qf2', matchNumber: 98, round: 'quarterfinals', date: '10 juli 2026',
    stadium: 'SoFi Stadium', location: 'Inglewood',
    team1Id: 'fr', team2Id: 'de', team1Source: 'Winnaar C', team2Source: 'Winnaar D',
    team1Score: null, team2Score: null, winner: null,
  },
  {
    id: 'qf3', matchNumber: 99, round: 'quarterfinals', date: '11 juli 2026',
    stadium: 'Hard Rock Stadium', location: 'Miami Gardens',
    team1Id: 'br', team2Id: 'es', team1Source: 'Winnaar E', team2Source: 'Winnaar F',
    team1Score: null, team2Score: null, winner: null,
  },
  {
    id: 'qf4', matchNumber: 100, round: 'quarterfinals', date: '11 juli 2026',
    stadium: 'Arrowhead Stadium', location: 'Kansas City',
    team1Id: 'ar', team2Id: 'gb_eng', team1Source: 'Winnaar G', team2Source: 'Winnaar H',
    team1Score: null, team2Score: null, winner: null,
  },
  {
    id: 'sf1', matchNumber: 101, round: 'semifinals', date: '14 juli 2026',
    stadium: 'AT&T Stadium', location: 'Arlington',
    team1Id: null, team2Id: null, team1Source: 'Winnaar KF1', team2Source: 'Winnaar KF2',
    team1Score: null, team2Score: null, winner: null,
  },
  {
    id: 'sf2', matchNumber: 102, round: 'semifinals', date: '15 juli 2026',
    stadium: 'Mercedes-Benz Stadium', location: 'Atlanta',
    team1Id: null, team2Id: null, team1Source: 'Winnaar KF3', team2Source: 'Winnaar KF4',
    team1Score: null, team2Score: null, winner: null,
  },
  {
    id: 'final', matchNumber: 104, round: 'final', date: '19 juli 2026',
    stadium: 'MetLife Stadium', location: 'East Rutherford',
    team1Id: null, team2Id: null, team1Source: 'Winnaar HF1', team2Source: 'Winnaar HF2',
    team1Score: null, team2Score: null, winner: null,
  },
];

function propagateWinners(matches: DemoMatch[]): DemoMatch[] {
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));

  return matches.map((m) => {
    if (m.id === 'sf1') {
      return { ...m, team1Id: byId['qf1']?.winner ?? null, team2Id: byId['qf2']?.winner ?? null };
    }
    if (m.id === 'sf2') {
      return { ...m, team1Id: byId['qf3']?.winner ?? null, team2Id: byId['qf4']?.winner ?? null };
    }
    if (m.id === 'final') {
      return { ...m, team1Id: byId['sf1']?.winner ?? null, team2Id: byId['sf2']?.winner ?? null };
    }
    return m;
  });
}

const ROUNDS: DemoMatch['round'][] = ['quarterfinals', 'semifinals', 'final'];

export function KnockoutDemo() {
  const [matches, setMatches] = useState<DemoMatch[]>(INITIAL_MATCHES);

  const getTeamName = (teamId: string | null | undefined): string => {
    if (!teamId) return '?';
    return DEMO_TEAMS[teamId] ?? teamId;
  };

  const renderTeamDisplay = (teamId: string | null | undefined): ReactElement => {
    if (teamId && DEMO_TEAMS[teamId]) {
      return (
        <span className="inline-flex items-center">
          <Flag countryCode={teamId} width={30} />
        </span>
      );
    }
    return <span className="text-sm text-gray-400 italic">Volgt...</span>;
  };

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', score: string) => {
    const scoreValue = score === '' ? null : parseInt(score, 10);
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 0)) return;

    setMatches((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== matchId) return m;
        const upd = { ...m, [team === 'team1' ? 'team1Score' : 'team2Score']: scoreValue };
        const t1 = upd.team1Score;
        const t2 = upd.team2Score;
        if (t1 !== null && t2 !== null) {
          if (t1 > t2) upd.winner = upd.team1Id;
          else if (t2 > t1) upd.winner = upd.team2Id;
          else upd.winner = null;
        } else {
          upd.winner = null;
        }
        return upd;
      });
      return propagateWinners(updated);
    });
  };

  const handleWinnerSelect = (matchId: string, winnerId: string) => {
    setMatches((prev) => {
      const updated = prev.map((m) =>
        m.id === matchId ? { ...m, winner: winnerId || null } : m
      );
      return propagateWinners(updated);
    });
  };

  return (
    <div className="space-y-8">
      {ROUNDS.map((round) => {
        const roundMatches = matches.filter((m) => m.round === round);
        if (roundMatches.length === 0) return null;

        return (
          <div key={round}>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              {ROUND_LABELS[round]}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roundMatches.map((match) => (
                <KnockoutMatchCard
                  key={match.id}
                  matchId={match.id}
                  matchNumber={match.matchNumber}
                  date={match.date}
                  stadium={match.stadium}
                  location={match.location}
                  team1Id={match.team1Id}
                  team2Id={match.team2Id}
                  team1Source={match.team1Source}
                  team2Source={match.team2Source}
                  team1Score={match.team1Score}
                  team2Score={match.team2Score}
                  winnerId={match.winner}
                  getTeamName={getTeamName}
                  renderTeamDisplay={(teamId) => renderTeamDisplay(teamId)}
                  onScoreChange={handleScoreChange}
                  onWinnerSelect={handleWinnerSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
