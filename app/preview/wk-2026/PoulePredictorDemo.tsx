'use client';

import { useState } from 'react';
import { PoulePredictor, type PoulePredictorTeam, type PoulePredictorMatch } from '@/app/wk-2026/components/PoulePredictor';

// Demo teams using ISO codes as IDs so flags always render correctly
const DEMO_TEAMS: PoulePredictorTeam[] = [
  {
    id: 'nl',
    name: 'Nederland',
    squad: [
      { name: 'Bart Verbruggen', position: 'keeper' },
      { name: 'Virgil van Dijk', position: 'verdediger' },
      { name: 'Frenkie de Jong', position: 'middenvelder' },
      { name: 'Memphis Depay', position: 'spits' },
    ],
  },
  {
    id: 'de',
    name: 'Duitsland',
    squad: [
      { name: 'Marc-Andre ter Stegen', position: 'keeper' },
      { name: 'Antonio Rudiger', position: 'verdediger' },
      { name: 'Jamal Musiala', position: 'middenvelder' },
      { name: 'Kai Havertz', position: 'spits' },
    ],
  },
  {
    id: 'ma',
    name: 'Marokko',
    squad: [
      { name: 'Yassine Bounou', position: 'keeper' },
      { name: 'Achraf Hakimi', position: 'verdediger' },
      { name: 'Azzedine Ounahi', position: 'middenvelder' },
      { name: 'Youssef En-Nesyri', position: 'spits' },
    ],
  },
  {
    id: 'sn',
    name: 'Senegal',
    squad: [
      { name: 'Edouard Mendy', position: 'keeper' },
      { name: 'Kalidou Koulibaly', position: 'verdediger' },
      { name: 'Pape Matar Sarr', position: 'middenvelder' },
      { name: 'Nicolas Jackson', position: 'spits' },
    ],
  },
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
        team1GoalScorer: null,
        team2GoalScorer: null,
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

  const handleGoalScorerChange = (
    matchId: string,
    team: 'team1' | 'team2',
    scorer: string | null
  ) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, [team === 'team1' ? 'team1GoalScorer' : 'team2GoalScorer']: scorer }
          : m
      )
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
      onGoalScorerChange={handleGoalScorerChange}
    />
  );
}
