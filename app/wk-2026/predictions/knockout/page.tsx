'use client';
export const dynamic = "force-dynamic";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { KNOCKOUT_MATCHES, KnockoutMatch, ROUND_LABELS } from '@/lib/types/knockout';
import { TeamInPoule, POULES } from '../../page';

interface KnockoutPrediction {
  userId: string;
  matches: KnockoutMatch[];
  updatedAt: string;
}

export default function KnockoutPredictionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [matches, setMatches] = useState<KnockoutMatch[]>([]);
  const [actualPoules, setActualPoules] = useState<unknown[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calculate standings for a poule
  const calculateStandings = (pouleId: string, poules: unknown[], allMatches: unknown[]) => {
    const pouleData = poules.find((p: any) => p.pouleId === pouleId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!pouleData || !pouleData.teams) return [];

    const teams = Object.keys(pouleData.teams);
    const pouleMatches = allMatches.filter((m: any) => m.pouleId === pouleId); // eslint-disable-line @typescript-eslint/no-explicit-any

    const stats: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    teams.forEach(teamId => {
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

    pouleMatches.forEach((match: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (match.team1Score !== null && match.team2Score !== null) {
        const team1Stats = stats[match.team1Id];
        const team2Stats = stats[match.team2Id];

        if (team1Stats && team2Stats) {
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
        }
      }
    });

    return Object.values(stats).sort((a: any, b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  };

  // Calculate all qualified teams based on group standings
  const calculateQualifiedTeams = (poules: unknown[], allMatches: unknown[]) => {
    const qualified: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Get winners and runners-up from each group
    POULES.forEach(pouleId => {
      const standings: any = calculateStandings(pouleId, poules, allMatches); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (standings.length >= 2) {
        qualified[`1${pouleId.toUpperCase()}`] = standings[0].teamId;
        qualified[`2${pouleId.toUpperCase()}`] = standings[1].teamId;
      }
    });

    // Get best third-placed teams
    const allThirdPlaced: unknown[] = [];
    POULES.forEach(pouleId => {
      const standings: any = calculateStandings(pouleId, poules, allMatches); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (standings.length >= 3) {
        allThirdPlaced.push({
          ...standings[2],
          poule: pouleId.toUpperCase(),
        });
      }
    });

    // Sort third-placed teams
    const sortedThirdPlaced = allThirdPlaced.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.won - a.won;
    });

    // Assign third-placed teams to their slots
    // The mapping is complex, but follows FIFA's predetermined schedule
    const thirdPlaceSlots = [
      { slot: '3A/B/C/D/F', groups: ['A', 'B', 'C', 'D', 'F'] },
      { slot: '3C/D/F/G/H', groups: ['C', 'D', 'F', 'G', 'H'] },
      { slot: '3C/E/F/H/I', groups: ['C', 'E', 'F', 'H', 'I'] },
      { slot: '3E/H/I/J/K', groups: ['E', 'H', 'I', 'J', 'K'] },
      { slot: '3B/E/F/I/J', groups: ['B', 'E', 'F', 'I', 'J'] },
      { slot: '3A/E/H/I/J', groups: ['A', 'E', 'H', 'I', 'J'] },
      { slot: '3E/F/G/I/J', groups: ['E', 'F', 'G', 'I', 'J'] },
      { slot: '3D/E/I/J/L', groups: ['D', 'E', 'I', 'J', 'L'] },
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
  };

  // Initialize knockout matches with qualified teams
  const initializeKnockoutMatches = (qualifiedTeams: any): KnockoutMatch[] => { // eslint-disable-line @typescript-eslint/no-explicit-any
    return KNOCKOUT_MATCHES.map(m => {
      const team1 = qualifiedTeams[m.team1Source] || null;
      const team2 = qualifiedTeams[m.team2Source] || null;

      return {
        ...m,
        team1,
        team2,
        team1Score: null,
        team2Score: null,
        winner: null,
      };
    });
  };

  // Update existing matches with qualified teams and propagate winners
  const updateMatchesWithQualifiedTeams = (
    existingMatches: KnockoutMatch[],
    qualifiedTeams: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): KnockoutMatch[] => {
    const updated = [...existingMatches];

    // First pass: update Round of 32 with qualified teams
    updated.forEach(match => {
      if (match.round === 'round_of_32') {
        match.team1 = qualifiedTeams[match.team1Source] || match.team1;
        match.team2 = qualifiedTeams[match.team2Source] || match.team2;
      }
    });

    // Second pass: propagate winners through the bracket
    updated.forEach(match => {
      if (match.round !== 'round_of_32') {
        // Check if team1Source is a winner reference
        if (match.team1Source.startsWith('winner_')) {
          const sourceMatchNum = parseInt(match.team1Source.replace('winner_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner) {
            match.team1 = sourceMatch.winner;
          }
        } else if (match.team1Source.startsWith('loser_')) {
          const sourceMatchNum = parseInt(match.team1Source.replace('loser_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner && sourceMatch?.team1 && sourceMatch?.team2) {
            match.team1 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
          }
        }

        // Same for team2
        if (match.team2Source.startsWith('winner_')) {
          const sourceMatchNum = parseInt(match.team2Source.replace('winner_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner) {
            match.team2 = sourceMatch.winner;
          }
        } else if (match.team2Source.startsWith('loser_')) {
          const sourceMatchNum = parseInt(match.team2Source.replace('loser_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner && sourceMatch?.team1 && sourceMatch?.team2) {
            match.team2 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
          }
        }
      }
    });

    return updated;
  };

  const loadData = async () => {
    try {
      // Load poules to determine qualified teams
      const poulesResponse = await fetch('/api/wk-2026/getPoules');
      const poulesData = await poulesResponse.json();
      const poules = poulesData.poules || [];
      setActualPoules(poules);

      console.log('Loaded poules:', poules);

      // Load matches to calculate standings
      const matchesResponse = await fetch('/api/wk-2026/getMatches');
      const matchesData = await matchesResponse.json();
      const allMatches = matchesData.matches || [];

      console.log('Loaded matches:', allMatches.length);

      // Calculate qualified teams
      const qualifiedTeams = calculateQualifiedTeams(poules, allMatches);

      console.log('Qualified teams:', qualifiedTeams);

      // Load user's knockout predictions
      const predictionsResponse = await fetch(`/api/wk-2026/knockout-predictions?userId=${user?.uid}`);
      const predictionsData = await predictionsResponse.json();

      if (predictionsData.prediction && predictionsData.prediction.matches) {
        // Update existing predictions with latest qualified teams
        const updatedMatches = updateMatchesWithQualifiedTeams(
          predictionsData.prediction.matches,
          qualifiedTeams
        );
        console.log('Updated matches:', updatedMatches.slice(0, 3));
        setMatches(updatedMatches);
      } else {
        // Initialize with qualified teams
        const initialMatches = initializeKnockoutMatches(qualifiedTeams);
        console.log('Initial matches:', initialMatches.slice(0, 3));
        setMatches(initialMatches);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load predictions' });
    }
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/wk-2026');
      return;
    }

    loadData();
  }, [user, loading, router]);

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', score: string) => {
    const scoreValue = score === '' ? null : parseInt(score, 10);
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 0)) return;

    setMatches(prev => {
      const updated = prev.map(m => {
        if (m.id === matchId) {
          const updatedMatch = { ...m, [`${team}Score`]: scoreValue };

          // Determine winner if both scores are set
          if (updatedMatch.team1Score !== null && updatedMatch.team2Score !== null) {
            if (updatedMatch.team1Score > updatedMatch.team2Score) {
              updatedMatch.winner = updatedMatch.team1 || null;
            } else if (updatedMatch.team2Score > updatedMatch.team1Score) {
              updatedMatch.winner = updatedMatch.team2 || null;
            } else {
              // For tied scores, don't set winner automatically - let user choose via dropdown
              // Keep existing winner if there is one, otherwise set to null
              if (!updatedMatch.winner) {
                updatedMatch.winner = null;
              }
            }
          } else {
            updatedMatch.winner = null;
          }

          return updatedMatch;
        }
        return m;
      });

      // Propagate winners to subsequent rounds
      return propagateWinners(updated);
    });
  };

  const handleWinnerSelect = (matchId: string, winnerId: string) => {
    setMatches(prev => {
      const updated = prev.map(m => {
        if (m.id === matchId) {
          return { ...m, winner: winnerId || null };
        }
        return m;
      });
      // Propagate winners through the bracket
      return propagateWinners(updated);
    });
  };

  // Propagate winners through the knockout bracket
  const propagateWinners = (matches: KnockoutMatch[]): KnockoutMatch[] => {
    const updated = [...matches];

    updated.forEach(match => {
      if (match.round !== 'round_of_32') {
        // Update team1 based on source
        if (match.team1Source.startsWith('winner_')) {
          const sourceMatchNum = parseInt(match.team1Source.replace('winner_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner) {
            match.team1 = sourceMatch.winner;
          } else {
            match.team1 = null;
          }
        } else if (match.team1Source.startsWith('loser_')) {
          const sourceMatchNum = parseInt(match.team1Source.replace('loser_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner && sourceMatch?.team1 && sourceMatch?.team2) {
            match.team1 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
          } else {
            match.team1 = null;
          }
        }

        // Update team2 based on source
        if (match.team2Source.startsWith('winner_')) {
          const sourceMatchNum = parseInt(match.team2Source.replace('winner_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner) {
            match.team2 = sourceMatch.winner;
          } else {
            match.team2 = null;
          }
        } else if (match.team2Source.startsWith('loser_')) {
          const sourceMatchNum = parseInt(match.team2Source.replace('loser_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner && sourceMatch?.team1 && sourceMatch?.team2) {
            match.team2 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
          } else {
            match.team2 = null;
          }
        }
      }
    });

    return updated;
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/wk-2026/knockout-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          matches,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save predictions');
      }

      setMessage({ type: 'success', text: 'Predictions saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving predictions:', error);
      setMessage({ type: 'error', text: 'Failed to save predictions' });
    } finally {
      setSaving(false);
    }
  };

  const getTeamName = (teamId: string | null | undefined): string => {
    if (!teamId) return '?';

    // Find team in poules
    for (const poule of actualPoules) {
      if (poule.teams && poule.teams[teamId]) {
        return poule.teams[teamId].name;
      }
    }

    // If not found, return the team ID (fallback)
    return teamId;
  };

  // Get potential teams when winner isn't decided yet - recursively
  const getPotentialTeams = (teamSource: string): string[] => {
    if (teamSource.startsWith('winner_') || teamSource.startsWith('loser_')) {
      const matchNum = parseInt(teamSource.replace('winner_', '').replace('loser_', ''));
      const sourceMatch = matches.find(m => m.matchNumber === matchNum);

      if (sourceMatch) {
        // If the source match has both teams directly, return them
        if (sourceMatch.team1 && sourceMatch.team2) {
          return [sourceMatch.team1, sourceMatch.team2];
        }

        // Otherwise, recursively get potential teams from the source match's sources
        const team1Potentials = sourceMatch.team1Source ? getPotentialTeams(sourceMatch.team1Source) : [];
        const team2Potentials = sourceMatch.team2Source ? getPotentialTeams(sourceMatch.team2Source) : [];

        // Combine all potential teams
        return [...team1Potentials, ...team2Potentials];
      }
    }
    return [];
  };

  // Display team or potential teams
  const displayTeam = (teamId: string | null | undefined, teamSource: string): JSX.Element => {
    if (teamId) {
      return <span>{getTeamName(teamId)}</span>;
    }

    // Check if we can show potential teams
    const potentialTeams = getPotentialTeams(teamSource);

    if (potentialTeams.length > 0) {
      return (
        <span className="text-gray-600 italic text-sm">
          {potentialTeams.map(team => getTeamName(team)).join(' / ')}
        </span>
      );
    }

    // If no potential teams found but we have a winner_ or loser_ source, show the match reference
    if (teamSource.startsWith('winner_') || teamSource.startsWith('loser_')) {
      const matchNum = parseInt(teamSource.replace('winner_', '').replace('loser_', ''));
      return <span className="text-gray-500 italic text-sm">{teamSource.startsWith('winner_') ? 'W' : 'L'}{matchNum}</span>;
    }

    return <span>?</span>;
  };

  const groupMatchesByRound = () => {
    const grouped: { [key: string]: KnockoutMatch[] } = {
      round_of_32: [],
      round_of_16: [],
      quarterfinals: [],
      semifinals: [],
      third_place: [],
      final: [],
    };

    matches.forEach(match => {
      grouped[match.round].push(match);
    });

    return grouped;
  };

  const grouped = groupMatchesByRound();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">WK 2026 - Knockout Fase Predictions</h1>

      {message && (
        <div
          className={`mb-6 p-4 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save predictions'}
        </button>
      </div>

      {Object.entries(grouped).map(([round, roundMatches]) => {
        if (roundMatches.length === 0) return null;

        return (
          <div key={round} className="mb-8 bg-white border-2 border-gray-300 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">{ROUND_LABELS[round as keyof typeof ROUND_LABELS]}</h2>

            <div className="space-y-4">
              {roundMatches.map(match => (
                <div key={match.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      Match {match.matchNumber} - {match.date}
                    </div>
                    <div className="text-xs text-gray-500">
                      {match.stadium}, {match.location}
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-4 items-center">
                    <div className="col-span-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">
                        {match.team1Source}
                      </div>
                      <div className="text-lg font-semibold">
                        {displayTeam(match.team1, match.team1Source)}
                      </div>
                    </div>

                    <div className="col-span-1 flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={match.team1Score ?? ''}
                        onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        type="number"
                        min="0"
                        value={match.team2Score ?? ''}
                        onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-3 text-right">
                      <div className="text-sm font-medium text-gray-700 mb-1">
                        {match.team2Source}
                      </div>
                      <div className="text-lg font-semibold">
                        {displayTeam(match.team2, match.team2Source)}
                      </div>
                    </div>
                  </div>

                  {match.team1Score === match.team2Score && match.team1Score !== null && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Winner after penalties:
                      </label>
                      <select
                        value={match.winner || ''}
                        onChange={(e) => handleWinnerSelect(match.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
                      >
                        <option value="">Select winner...</option>
                        {match.team1 && (
                          <option value={match.team1}>{getTeamName(match.team1)}</option>
                        )}
                        {match.team2 && (
                          <option value={match.team2}>{getTeamName(match.team2)}</option>
                        )}
                      </select>
                    </div>
                  )}

                  {match.winner && match.team1Score !== match.team2Score && (
                    <div className="mt-2 text-sm text-green-700 font-semibold">
                      Winner: {getTeamName(match.winner)}
                    </div>
                  )}

                  {match.winner && match.team1Score === match.team2Score && match.team1Score !== null && (
                    <div className="mt-2 text-sm text-green-700 font-semibold">
                      Winner after penalties: {getTeamName(match.winner)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save predictions'}
        </button>
      </div>
    </div>
  );
}
