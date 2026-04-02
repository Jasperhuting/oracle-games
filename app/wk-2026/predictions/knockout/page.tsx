'use client';
export const dynamic = "force-dynamic";

import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { authorizedFetch } from '@/lib/auth/token-service';
import { KnockoutMatch, ROUND_LABELS } from '@/lib/types/knockout';
import { useWk2026Participant } from '../../hooks';
import { Flag } from '@/components/Flag';
import countriesList from '@/lib/country.json';
import {
  GroupData,
  GroupStageMatch,
  calculateQualifiedTeams,
  initializeKnockoutMatches,
  updateKnockoutMatchesWithQualifiedTeams,
} from '@/lib/wk-2026/knockout-utils';
import {
  createTeamHistoryPairKey,
  orientTeamHistory,
  reverseTeamHistory,
  type HeadToHeadMatch,
  type MatchResult,
  type StoredTeamHistoryMap,
  type TeamHistoryResponse,
} from '@/lib/wk-2026/team-history-types';

interface FormDotProps {
  match: MatchResult;
}

function FormDot({ match }: FormDotProps) {
  const color =
    match.result === 'W'
      ? 'bg-green-500'
      : match.result === 'D'
      ? 'bg-orange-400'
      : 'bg-red-500';

  const label = match.result === 'W' ? 'W' : match.result === 'D' ? 'G' : 'V';
  const tooltip = `${match.teamScore}-${match.opponentScore} vs ${match.opponent} (${match.competition}, ${match.date})`;

  return (
    <div className="relative group">
      <div
        className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[9px] font-bold cursor-default`}
        title={tooltip}
      >
        {label}
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 group-hover:block">
        <div className="whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
          <span className="font-semibold">{match.teamScore}-{match.opponentScore}</span>{' '}
          vs {match.opponent}
          <br />
          <span className="text-[10px] text-gray-400">{match.competition} · {match.date}</span>
        </div>
        <div className="mx-auto -mt-1 h-2 w-2 rotate-45 bg-gray-900" />
      </div>
    </div>
  );
}

interface H2HRowProps {
  match: HeadToHeadMatch;
  team1Name: string;
  team2Name: string;
}

function H2HRow({ match, team1Name, team2Name }: H2HRowProps) {
  const result =
    match.team1Score > match.team2Score
      ? `${team1Name} won`
      : match.team1Score < match.team2Score
      ? `${team2Name} won`
      : 'Gelijkspel';

  return (
    <div className="flex items-center justify-between py-0.5 text-xs text-gray-600">
      <span className="w-20 shrink-0 text-gray-400">{match.date.slice(0, 7)}</span>
      <span
        className={`font-semibold ${
          match.team1Score > match.team2Score
            ? 'text-green-600'
            : match.team1Score < match.team2Score
            ? 'text-red-500'
            : 'text-gray-500'
        }`}
      >
        {match.team1Score} – {match.team2Score}
      </span>
      <span className="w-20 shrink-0 truncate text-right text-gray-400">{result}</span>
    </div>
  );
}

export default function KnockoutPredictionsPage() {
  const { user, loading } = useAuth();
  const { isParticipant, loading: participantLoading, refresh: refreshParticipant } = useWk2026Participant(user?.uid || null, 2026);
  const router = useRouter();

  const [matches, setMatches] = useState<KnockoutMatch[]>([]);
  const [actualPoules, setActualPoules] = useState<GroupData[]>([]);
  const [teamHistory, setTeamHistory] = useState<StoredTeamHistoryMap>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinWk = async () => {
    if (!user) return;

    setIsJoining(true);

    try {
      const response = await authorizedFetch('/api/wk-2026/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: 2026 }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage({ type: 'error', text: data.error || 'Deelnemen aan WK 2026 is mislukt' });
      } else {
        await refreshParticipant();
      }
    } catch (error) {
      console.error('Error joining WK 2026:', error);
      setMessage({ type: 'error', text: 'Deelnemen aan WK 2026 is mislukt' });
    } finally {
      setIsJoining(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      // Load poules to determine qualified teams
      const poulesResponse = await fetch('/api/wk-2026/getPoules');
      const poulesData = await poulesResponse.json();
      const poules: GroupData[] = poulesData.poules || [];
      setActualPoules(poules);

      console.log('Loaded poules:', poules);

      // Load matches to calculate standings
      const matchesResponse = await fetch('/api/wk-2026/getMatches');
      const matchesData = await matchesResponse.json();
      const allMatches: GroupStageMatch[] = matchesData.matches || [];

      console.log('Loaded matches:', allMatches.length);

      // Calculate qualified teams
      const qualifiedTeams = calculateQualifiedTeams(poules, allMatches);

      console.log('Qualified teams:', qualifiedTeams);

      // Load user's knockout predictions
      const predictionsResponse = await fetch(`/api/wk-2026/knockout-predictions?userId=${user?.uid}`);
      const predictionsData = await predictionsResponse.json();

      if (predictionsData.prediction && predictionsData.prediction.matches) {
        // Update existing predictions with latest qualified teams
        const updatedMatches = updateKnockoutMatchesWithQualifiedTeams(
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
  }, [user?.uid]);

  const fetchAllTeamHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/wk-2026/team-history?all=1');
      const data = await response.json();
      setTeamHistory(data.histories || {});
    } catch (error) {
      console.error('Error fetching stored team history:', error);
      setTeamHistory({});
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchMissingTeamHistory = useCallback(async (team1Name: string, team2Name: string) => {
    const pairKey = createTeamHistoryPairKey(team1Name, team2Name);
    if (teamHistory[pairKey]) {
      return;
    }

    try {
      const response = await fetch(
        `/api/wk-2026/team-history?team1=${encodeURIComponent(team1Name)}&team2=${encodeURIComponent(team2Name)}`
      );

      if (!response.ok) {
        return;
      }

      const data: TeamHistoryResponse = await response.json();
      const [teamA, teamB] = [team1Name, team2Name].sort();

      setTeamHistory((prev) => ({
        ...prev,
        [pairKey]: {
          pairKey,
          teamA,
          teamB,
          data: team1Name === teamA ? data : reverseTeamHistory(data),
          updatedAt: new Date().toISOString(),
          tags: ['manual-fallback'],
        },
      }));
    } catch (error) {
      console.error('Error fetching missing team history:', error);
    }
  }, [teamHistory]);

  const getTeamName = useCallback((teamId: string | null | undefined): string => {
    if (!teamId) return '?';

    for (const poule of actualPoules) {
      if (poule.teams && poule.teams[teamId]) {
        return poule.teams[teamId].name;
      }
    }

    return teamId;
  }, [actualPoules]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/wk-2026');
      return;
    }

    if (participantLoading || !isParticipant) {
      return;
    }

    loadData();
    fetchAllTeamHistory();
  }, [user, loading, router, participantLoading, isParticipant, loadData, fetchAllTeamHistory]);

  useEffect(() => {
    matches.forEach((match) => {
      if (!match.team1 || !match.team2) {
        return;
      }

      const team1Name = getTeamName(match.team1);
      const team2Name = getTeamName(match.team2);
      const pairKey = createTeamHistoryPairKey(team1Name, team2Name);

      if (!teamHistory[pairKey]) {
        void fetchMissingTeamHistory(team1Name, team2Name);
      }
    });
  }, [matches, teamHistory, fetchMissingTeamHistory, getTeamName]);

  if (loading || participantLoading) {
    return (
      <div className="mt-9 max-w-6xl mx-auto p-8">
        <div className="rounded-2xl border border-[#ffd7a6] bg-white p-6 text-[#9a4d00]">
          Deelnamestatus laden...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isParticipant) {
    return (
      <div className="mt-9 max-w-4xl mx-auto p-8">
        <div className="rounded-3xl border border-[#ffd7a6] bg-white p-8 shadow-sm">
          <span className="inline-flex rounded-full bg-[#fff0d9] px-3 py-1 text-sm font-semibold text-[#9a4d00]">
            Eerst deelnemen
          </span>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Nog niet klaar voor de knockout</h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600">
            Meld je eerst aan voor WK 2026. Daarna kun je meteen ook je knockout predictions invullen.
          </p>
          <button
            type="button"
            onClick={handleJoinWk}
            disabled={isJoining}
            className="mt-6 rounded-xl bg-[#ff9900] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#e68a00] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJoining ? 'Bezig met aanmelden...' : 'Deelnemen aan WK 2026'}
          </button>
        </div>
      </div>
    );
  }

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', score: string) => {
    const scoreValue = score === '' ? null : parseInt(score, 10);
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 0)) return;

    setMatches(prev => {
      const updated = prev.map(m => {
        if (m.id === matchId) {
          const updatedMatch: KnockoutMatch = team === 'team1'
            ? { ...m, team1Score: scoreValue }
            : { ...m, team2Score: scoreValue };

          // Determine winner if both scores are set
          const team1Score = updatedMatch.team1Score;
          const team2Score = updatedMatch.team2Score;

          if (team1Score !== null && team2Score !== null && team1Score !== undefined && team2Score !== undefined) {
            if (team1Score > team2Score) {
              updatedMatch.winner = updatedMatch.team1 || null;
            } else if (team2Score > team1Score) {
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

  const getTeamFlagCode = (teamId: string | null | undefined): string => {
    if (!teamId) return '';

    const teamName = getTeamName(teamId);
    const country = countriesList.find((entry: { name: string; code: string }) =>
      entry.name.toLowerCase() === teamName.toLowerCase()
    );

    return country?.code || teamId;
  };

  const renderTeamFlag = (teamId: string, size = 30): ReactElement => (
    <span className="inline-flex items-center" title={getTeamName(teamId)}>
      <Flag countryCode={getTeamFlagCode(teamId)} width={size} />
    </span>
  );

  const getHistoryForMatch = (team1Id: string | null | undefined, team2Id: string | null | undefined): TeamHistoryResponse | null => {
    if (!team1Id || !team2Id) {
      return null;
    }

    const team1Name = getTeamName(team1Id);
    const team2Name = getTeamName(team2Id);
    const pairKey = createTeamHistoryPairKey(team1Name, team2Name);
    const storedHistory = teamHistory[pairKey];

    if (!storedHistory) {
      return null;
    }

    return orientTeamHistory(storedHistory.data, team1Name, team2Name);
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
  const displayTeam = (teamId: string | null | undefined, teamSource: string): ReactElement => {
    if (teamId) {
      return renderTeamFlag(teamId, 32);
    }

    // Check if we can show potential teams
    const potentialTeams = getPotentialTeams(teamSource);

    let gridCols = potentialTeams.length;

    if (potentialTeams.length >= 8) {
      gridCols = 4;
    }
    

    if (potentialTeams.length > 0) {
      return (
        <span className={`grid grid-cols-${gridCols}  items-center gap-2`}>
          {potentialTeams.map((team) => (
            <span key={team} className="inline-flex items-center" title={getTeamName(team)}>
              <Flag countryCode={getTeamFlagCode(team)} width={24} />
            </span>
          ))}
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
    <div className="p-8 mt-9 max-w-7xl mx-auto">
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

      {Object.entries(grouped).map(([round, roundMatches]) => {
        if (roundMatches.length === 0) return null;

        return (
          <div key={round} className="mb-8 bg-white border-2 border-gray-300 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">{ROUND_LABELS[round as keyof typeof ROUND_LABELS]}</h2>

            <div className="space-y-4">
              {roundMatches.map(match => {
                const history = getHistoryForMatch(match.team1, match.team2);
                const team1Name = match.team1 ? getTeamName(match.team1) : null;
                const team2Name = match.team2 ? getTeamName(match.team2) : null;

                return (
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
                        <div className="text-lg font-semibold flex flex-start">
                          {displayTeam(match.team1, match.team1Source)}
                        </div>
                      </div>

                      <div className="col-span-1 flex items-center justify-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={match.team1Score ?? ''}
                          onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                          className="w-16 min-w-[32px] px-2 py-1 border border-gray-300 rounded text-center"
                          placeholder="0"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                          type="number"
                          min="0"
                          value={match.team2Score ?? ''}
                          onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                          className="w-16 min-w-[32px] px-2 py-1 border border-gray-300 rounded text-center"
                          placeholder="0"
                        />
                      </div>

                      <div className="col-span-3 text-right">
                        <div className="text-sm font-medium text-gray-700 mb-1">
                          {match.team2Source}
                        </div>
                        <div className="flex w-full justify-end text-lg font-semibold">
                          {displayTeam(match.team2, match.team2Source)}
                        </div>
                      </div>
                    </div>

                    {historyLoading && (
                      <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 animate-pulse">
                        Historische resultaten laden...
                      </div>
                    )}

                    {!historyLoading && history && team1Name && team2Name && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <div className="space-y-2">
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              Laatste 5: {team1Name}
                            </div>
                            <div className="flex items-center gap-1">
                              {history.team1Form.map((formMatch, index) => (
                                <FormDot key={`${match.id}-team1-${index}`} match={formMatch} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              Laatste 5: {team2Name}
                            </div>
                            <div className="flex items-center gap-1">
                              {history.team2Form.map((formMatch, index) => (
                                <FormDot key={`${match.id}-team2-${index}`} match={formMatch} />
                              ))}
                            </div>
                          </div>
                        </div>

                        {history.headToHead.length > 0 ? (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              Onderling ({history.headToHead.length}x)
                            </div>
                            {[...history.headToHead].reverse().map((headToHeadMatch, index) => (
                              <H2HRow
                                key={`${match.id}-h2h-${index}`}
                                match={headToHeadMatch}
                                team1Name={team1Name}
                                team2Name={team2Name}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                            Nog nooit tegen elkaar gespeeld
                          </div>
                        )}
                      </div>
                    )}

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
                        Winner: <span className="ml-1 inline-flex align-middle">{renderTeamFlag(match.winner, 24)}</span>
                      </div>
                    )}

                    {match.winner && match.team1Score === match.team2Score && match.team1Score !== null && (
                      <div className="mt-2 text-sm text-green-700 font-semibold">
                        Winner after penalties: <span className="ml-1 inline-flex align-middle">{renderTeamFlag(match.winner, 24)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-4 z-30 mt-8 flex justify-end">
        <div className="rounded-xl border border-[#ffd699] bg-white/95 p-3 shadow-lg backdrop-blur">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-[#ff9900] text-white rounded-lg font-semibold hover:bg-[#e68a00] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save predictions'}
          </button>
        </div>
      </div>
    </div>
  );
}
