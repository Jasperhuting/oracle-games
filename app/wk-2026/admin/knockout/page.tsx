'use client';
export const dynamic = "force-dynamic";

import { JSX, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { KNOCKOUT_MATCHES, KnockoutMatch, ROUND_LABELS } from '@/lib/types/knockout';
import { POULES } from '../../page';
import { Flag } from '@/components/Flag';

import countriesList from '@/lib/country.json';

interface KnockoutPrediction {
  userId: string;
  matches: KnockoutMatch[];
  updatedAt: string;
}

export default function AdminKnockoutPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [actualMatches, setActualMatches] = useState<KnockoutMatch[]>([]);
  const [allPredictions, setAllPredictions] = useState<KnockoutPrediction[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [actualPoules, setActualPoules] = useState<unknown[]>([]);
  const [saving, setSaving] = useState(false);
  const [contenders, setContenders] = useState<unknown[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {

    // api getTeams
    const getTeams = async () => {
      const response = await fetch('/api/wk-2026/getTeams');
      const data = await response.json();
      setContenders(data.teams);
    };

    getTeams();

  }, []);

  // Calculate standings for a poule (same logic as user predictions page)
  const calculateStandings = (pouleId: string, poules: unknown[], allMatches: unknown[]) => {
    const pouleData = poules.find((p: any) => p.pouleId === pouleId);
    if (!pouleData || !pouleData.teams) return [];

    const teams = Object.keys(pouleData.teams);
    const pouleMatches = allMatches.filter((m: any) => m.pouleId === pouleId);

    const stats: any = {};
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

    pouleMatches.forEach((match: any) => {
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

    return Object.values(stats).sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  };

  // Calculate all qualified teams based on group standings
  const calculateQualifiedTeams = (poules: unknown[], allMatches: unknown[]) => {
    const qualified: any = {};

    // Get winners and runners-up from each group
    POULES.forEach(pouleId => {
      const standings: any = calculateStandings(pouleId, poules, allMatches);
      if (standings.length >= 2) {
        qualified[`1${pouleId.toUpperCase()}`] = standings[0].teamId;
        qualified[`2${pouleId.toUpperCase()}`] = standings[1].teamId;
      }
    });

    // Get best third-placed teams
    const allThirdPlaced: unknown[] = [];
    POULES.forEach(pouleId => {
      const standings: any = calculateStandings(pouleId, poules, allMatches);
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
  const initializeKnockoutMatches = (qualifiedTeams: any): KnockoutMatch[] => {
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

  // Propagate winners through the bracket
  const propagateWinners = (matches: KnockoutMatch[]): KnockoutMatch[] => {
    const updated = [...matches];

    updated.forEach(match => {
      if (match.round !== 'round_of_32') {
        // Handle team1Source
        if (match.team1Source.startsWith('winner_')) {
          const sourceMatchNum = parseInt(match.team1Source.replace('winner_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner) {
            match.team1 = sourceMatch.winner;
          } else {
            match.team1 = null;
          }
        } else if (match.team1Source.startsWith('loser_')) {
          // For third-place match
          const sourceMatchNum = parseInt(match.team1Source.replace('loser_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.team1 && sourceMatch?.team2 && sourceMatch?.winner) {
            match.team1 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
          } else {
            match.team1 = null;
          }
        }

        // Handle team2Source
        if (match.team2Source.startsWith('winner_')) {
          const sourceMatchNum = parseInt(match.team2Source.replace('winner_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.winner) {
            match.team2 = sourceMatch.winner;
          } else {
            match.team2 = null;
          }
        } else if (match.team2Source.startsWith('loser_')) {
          // For third-place match
          const sourceMatchNum = parseInt(match.team2Source.replace('loser_', ''));
          const sourceMatch = updated.find(m => m.matchNumber === sourceMatchNum);
          if (sourceMatch?.team1 && sourceMatch?.team2 && sourceMatch?.winner) {
            match.team2 = sourceMatch.winner === sourceMatch.team1 ? sourceMatch.team2 : sourceMatch.team1;
          } else {
            match.team2 = null;
          }
        }
      }
    });

    return updated;
  };

  const loadData = async () => {
    try {
      // Load poules
      const poulesResponse = await fetch('/api/wk-2026/getPoules');
      const poulesData = await poulesResponse.json();
      const poules = poulesData.poules || [];
      setActualPoules(poules);

      // Load matches to calculate standings
      const matchesResponse = await fetch('/api/wk-2026/getMatches');
      const matchesData = await matchesResponse.json();
      const allMatches = matchesData.matches || [];

      // Calculate qualified teams
      const qualifiedTeams = calculateQualifiedTeams(poules, allMatches);
      console.log('Admin - Qualified teams:', qualifiedTeams);

      // Load actual knockout results
      const actualResponse = await fetch('/api/wk-2026/knockout-actual');
      const actualData = await actualResponse.json();

      if (actualData.matches && actualData.matches.length > 0) {
        // Update existing matches with qualified teams for round of 32
        const updated = actualData.matches.map((m: KnockoutMatch) => {
          if (m.round === 'round_of_32') {
            return {
              ...m,
              team1: qualifiedTeams[m.team1Source] || m.team1,
              team2: qualifiedTeams[m.team2Source] || m.team2,
            };
          }
          return m;
        });

        // Propagate winners through the bracket
        const propagated = propagateWinners(updated);
        setActualMatches(propagated);
      } else {
        // Initialize with qualified teams
        const initialMatches = initializeKnockoutMatches(qualifiedTeams);
        setActualMatches(initialMatches);
      }

      // Load all user predictions
      const predictionsResponse = await fetch('/api/wk-2026/knockout-predictions/all');
      const predictionsData = await predictionsResponse.json();
      setAllPredictions(predictionsData.predictions || []);

      // Load user names
      const predictions = predictionsData.predictions || [];
      const names: Record<string, string> = {};
      for (const prediction of predictions) {
        try {
          const userRes = await fetch(`/api/getUser?userId=${prediction.userId}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            names[prediction.userId] = userData.playername || userData.firstName || userData.email || prediction.userId;
          }
        } catch {
          names[prediction.userId] = prediction.userId;
        }
      }
      setUserNames(names);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/wk-2026');
      return;
    }

    const checkAdminAndLoad = async () => {
      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (!response.ok) {
          router.push('/wk-2026');
          return;
        }

        const userData = await response.json();
        if (userData.userType !== 'admin') {
          router.push('/wk-2026');
          return;
        }

        await loadData();
      } catch (error) {
        console.error('Error checking admin:', error);
        router.push('/wk-2026');
      }
    };

    checkAdminAndLoad();
  }, [user, loading, router]);

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', score: string) => {
    const scoreValue = score === '' ? null : parseInt(score, 10);
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 0)) return;

    setActualMatches(prev => {
      const updated = prev.map(m => {
        if (m.id === matchId) {
          const updatedMatch = { ...m, [`${team}Score`]: scoreValue };

          // Determine winner if both scores are set
          if (updatedMatch.team1Score !== null && updatedMatch.team2Score !== null) {
            if ((updatedMatch.team1Score || 0) > (updatedMatch.team2Score || 0)) {
              updatedMatch.winner = updatedMatch.team1 || null;
            } else if ((updatedMatch.team2Score || 0) > (updatedMatch.team1Score || 0)) {
              updatedMatch.winner = updatedMatch.team2 || null;
            } else {
              // For tied scores, don't set winner automatically - let admin choose via dropdown
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

      // Propagate winners through the bracket
      return propagateWinners(updated);
    });
  };

  const handleWinnerSelect = (matchId: string, winnerId: string) => {
    setActualMatches(prev => {
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

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/wk-2026/knockout-actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: actualMatches }),
      });

      if (!response.ok) {
        throw new Error('Failed to save actual results');
      }

      setMessage({ type: 'success', text: 'Results saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving results:', error);
      setMessage({ type: 'error', text: 'Failed to save results' });
    } finally {
      setSaving(false);
    }
  };

  const getTeamName = (teamId: string | null | undefined): string => {
    if (!teamId) return '?';

    for (const poule of actualPoules) {
      if (poule.teams && poule.teams[teamId]) {
        return poule.teams[teamId].name;
      }
    }
    return teamId;
  };

    const getTeamNameId = (teamId: string | null | undefined): string => {
    if (!teamId) return '?';

    for (const poule of actualPoules) {
      if (poule.teams && poule.teams[teamId]) {
        const country = countriesList.find((c: any) => c.name.toLowerCase() === contenders.find((team) => team.id === teamId)?.name.toLowerCase());
        return country?.code || teamId;
      }
    }
    return teamId;
  };

  // Get potential teams when winner isn't decided yet - recursively
  const getPotentialTeams = (teamSource: string): string[] => {
    if (teamSource.startsWith('winner_') || teamSource.startsWith('loser_')) {
      const matchNum = parseInt(teamSource.replace('winner_', '').replace('loser_', ''));
      const sourceMatch = actualMatches.find(m => m.matchNumber === matchNum);

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
      return <span><Flag countryCode={getTeamNameId(teamId)} width={28} /> {getTeamName(teamId)}</span>;
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

    actualMatches.forEach(match => {
      grouped[match.round].push(match);
    });

    return grouped;
  };

  const calculateCorrectPredictions = (userId: string): number => {
    const userPrediction = allPredictions.find(p => p.userId === userId);
    if (!userPrediction) return 0;

    let correct = 0;
    actualMatches.forEach(actualMatch => {
      const predictedMatch = userPrediction.matches.find(m => m.id === actualMatch.id);
      if (
        predictedMatch &&
        actualMatch.team1Score !== null &&
        actualMatch.team2Score !== null &&
        predictedMatch.team1Score === actualMatch.team1Score &&
        predictedMatch.team2Score === actualMatch.team2Score
      ) {
        correct++;
      }
    });
    return correct;
  };

  const grouped = groupMatchesByRound();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">WK 2026 Admin - Knockout Fase</h1>

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
          {saving ? 'Opslaan...' : 'Uitslagen Opslaan'}
        </button>
      </div>

      {/* Actual Results Input */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Daadwerkelijke Uitslagen Invoeren</h2>

        {Object.entries(grouped).map(([round, roundMatches]) => {
          if (roundMatches.length === 0) return null;
          

          return (
            <div key={round} className="mb-8 bg-white border-2 border-gray-300 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">{ROUND_LABELS[round as keyof typeof ROUND_LABELS]}</h3>

              <div className="space-y-4">
                {roundMatches.map(match => {

                  console.log('match', match)

                  return (<div key={match.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">
                        Wedstrijd {match.matchNumber} - {match.date}
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
                          {match.team1 && <option value={match.team1}>{getTeamName(match.team1)}</option>}
                          {match.team2 && <option value={match.team2}>{getTeamName(match.team2)}</option>}
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
                  </div>)
                }
                  
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* User Predictions Overview */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">User Predictions</h2>

        <div className="bg-white border-2 border-gray-300 rounded-lg overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Correct Predictions
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {allPredictions.map(prediction => (
                <tr key={prediction.userId} className="border-t">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {userNames[prediction.userId] || prediction.userId}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-900">
                    {calculateCorrectPredictions(prediction.userId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-600">
                    {new Date(prediction.updatedAt).toLocaleDateString('nl-NL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
