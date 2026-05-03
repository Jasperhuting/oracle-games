export interface MatchFirstGoalScorerState {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
  team1GoalScorer: string | null;
  team2GoalScorer: string | null;
}

export function getFirstGoalScorerSelection(match: Pick<
  MatchFirstGoalScorerState,
  'team1GoalScorer' | 'team2GoalScorer'
>) {
  if (match.team1GoalScorer) {
    return { team: 'team1' as const, scorer: match.team1GoalScorer };
  }

  if (match.team2GoalScorer) {
    return { team: 'team2' as const, scorer: match.team2GoalScorer };
  }

  return { team: null, scorer: null };
}

export function hasValidFirstGoalScorerSelection(match: MatchFirstGoalScorerState) {
  return validateFirstGoalScorerSelection(match) === null;
}

export function validateFirstGoalScorerSelection(match: MatchFirstGoalScorerState): string | null {
  const bothScoresKnown = match.team1Score !== null && match.team2Score !== null;
  const totalGoals = (match.team1Score ?? 0) + (match.team2Score ?? 0);
  const hasTeam1Scorer = !!match.team1GoalScorer;
  const hasTeam2Scorer = !!match.team2GoalScorer;

  if (!bothScoresKnown) {
    if (hasTeam1Scorer || hasTeam2Scorer) {
      return 'Vul eerst beide scores in voordat je de eerste doelpuntenmaker kiest.';
    }

    return null;
  }

  if (hasTeam1Scorer && hasTeam2Scorer) {
    return 'Kies maar één eerste doelpuntenmaker per wedstrijd.';
  }

  if (totalGoals === 0) {
    if (hasTeam1Scorer || hasTeam2Scorer) {
      return 'Bij een wedstrijd zonder doelpunten mag geen eerste doelpuntenmaker gekozen zijn.';
    }

    return null;
  }

  if (!hasTeam1Scorer && !hasTeam2Scorer) {
    return 'Kies de eerste doelpuntenmaker, of laat beide teams op geen doelpunt als het 0-0 wordt.';
  }

  if (hasTeam1Scorer && (match.team1Score ?? 0) === 0) {
    return 'Team 1 kan geen eerste doelpuntenmaker hebben als het team niet scoort.';
  }

  if (hasTeam2Scorer && (match.team2Score ?? 0) === 0) {
    return 'Team 2 kan geen eerste doelpuntenmaker hebben als het team niet scoort.';
  }

  return null;
}

export function isCorrectFirstGoalScorerPrediction(
  actualMatch: Pick<MatchFirstGoalScorerState, 'team1GoalScorer' | 'team2GoalScorer'>,
  predictedMatch: Pick<MatchFirstGoalScorerState, 'team1GoalScorer' | 'team2GoalScorer'> | null | undefined,
) {
  if (!predictedMatch) {
    return false;
  }

  return actualMatch.team1GoalScorer === (predictedMatch.team1GoalScorer ?? null)
    && actualMatch.team2GoalScorer === (predictedMatch.team2GoalScorer ?? null);
}
