'use client';

import { useState } from 'react';
import { PoulePredictor, type PoulePredictorTeam, type PoulePredictorMatch } from '@/app/wk-2026/components/PoulePredictor';

// Demo teams using ISO codes as IDs so flags always render correctly
const DEMO_TEAMS: PoulePredictorTeam[] = [
  { id: 'nl', name: 'Nederland' },
  { id: 'de', name: 'Duitsland' },
  { id: 'ma', name: 'Marokko' },
  { id: 'sn', name: 'Senegal' },
];

function generateDemoMatches(teams: PoulePredictorTeam[]): PoulePredictorMatch[] {
  const matches: PoulePredictorMatch[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        id: `demo-${teams[i].id}-${teams[j].id}`,
        team1Id: teams[i].id,
        team2Id: teams[j].id,
        team1Score: null,
        team2Score: null,
      });
    }
  }
  return matches;
}

export function PoulePredictorDemo() {
  const [rankings, setRankings] = useState<(PoulePredictorTeam | null)[]>([...DEMO_TEAMS]);
  const [matches, setMatches] = useState<PoulePredictorMatch[]>(generateDemoMatches(DEMO_TEAMS));

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', score: string) => {
    const scoreValue = score === '' ? null : parseInt(score, 10);
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 0)) return;

    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        const updated = { ...m, [team === 'team1' ? 'team1Score' : 'team2Score']: scoreValue };
        if (team === 'team1' && scoreValue !== null && m.team2Score === null) updated.team2Score = 0;
        if (team === 'team2' && scoreValue !== null && m.team1Score === null) updated.team1Score = 0;
        return updated;
      })
    );
  };

  return (
    <PoulePredictor
      pouleLabel="A"
      teams={DEMO_TEAMS}
      rankings={rankings}
      matches={matches}
      onRankingsChange={setRankings}
      onScoreChange={handleScoreChange}
    />
  );
}
