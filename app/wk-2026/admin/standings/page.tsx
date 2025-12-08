'use client';
export const dynamic = "force-dynamic";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { POULES, TeamInPoule } from '../../page';

interface PouleRanking {
  pouleId: string;
  rankings: (TeamInPoule | null)[];
}

interface PredictionDoc {
  id: string; // Firestore doc id (userId)
  userId: string;
  rankings: PouleRanking[];
  matches?: Match[];
}

interface Match {
  id: string;
  pouleId: string;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
  isLive?: boolean;
}

interface TeamStats {
  teamId: string;
  team: TeamInPoule;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export default function StandingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [allPredictions, setAllPredictions] = useState<PredictionDoc[]>([]);
  const [selectedPoule, setSelectedPoule] = useState<string>('a');
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [actualPoules, setActualPoules] = useState<PouleRanking[]>([]);
  const [actualMatches, setActualMatches] = useState<Match[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [baseMatches, setBaseMatches] = useState<Match[]>([]);

  const [liveScoresData, setLiveScoresData] = useState<unknown[]>([]);

  console.log('liveScoresData', liveScoresData)

  useEffect(() => {
    const fetchLiveScores = async () => {
      try {
        const response = await fetch('/api/wk-2026/livescores');
        const data = await response.json();
        setLiveScoresData(data);
      } catch (error) {
        console.error('Error fetching live scores:', error);
      }
    };

    fetchLiveScores();
    // Refresh live scores every 30 seconds
    const interval = setInterval(fetchLiveScores, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTeamById = (teamId: string): TeamInPoule | null => {
    for (const poule of actualPoules) {
      const team = poule.rankings.find((t) => t?.id === teamId);
      if (team) return team as TeamInPoule;
    }
    return null;
  };

  // Update matches when live scores change
  useEffect(() => {
    if (baseMatches.length === 0) {
      setActualMatches([]);
      return;
    }

    const updatedMatches = baseMatches.map((match) => {
      const team1 = getTeamById(match.team1Id);
      const team2 = getTeamById(match.team2Id);

      if (!team1 || !team2) return match;

      // Try to find matching live score
      const liveScore = liveScoresData.find((ls) => {
        const matchesForward = ls.homeTeam === team1.id && ls.awayTeam === team2.id;
        const matchesReverse = ls.homeTeam === team2.id && ls.awayTeam === team1.id;
        return matchesForward || matchesReverse;
      });


      // If live score found and game is not finished, use live scores
      if (liveScore && !liveScore.gameIsFinished) {
        const isReversed = liveScore.homeTeam === team2.id;
        return {
          ...match,
          team1Score: isReversed ? liveScore.awayScore : liveScore.homeScore,
          team2Score: isReversed ? liveScore.homeScore : liveScore.awayScore,
          isLive: true,
        };
      }

      return { ...match, isLive: false };
    });

    setActualMatches(updatedMatches);
  }, [liveScoresData, baseMatches, actualPoules]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/wk-2026/predictions');
      return;
    }

    const checkAdminAndLoad = async () => {
      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (!response.ok) {
          router.push('/wk-2026/predictions');
          return;
        }

        const userData = await response.json();
        if (userData.userType !== 'admin') {
          router.push('/wk-2026/predictions');
          return;
        }

        setIsLoadingPredictions(true);

        const predsResponse = await fetch('/api/wk-2026/predictions');
        const predsData = await predsResponse.json();
        const predictions: PredictionDoc[] = predsData.predictions || [];
        setAllPredictions(predictions);

        try {
          const [poulesResponse, matchesResponse] = await Promise.all([
            fetch('/api/wk-2026/getPoules'),
            fetch('/api/wk-2026/getMatches'),
          ]);

          const poulesData = await poulesResponse.json();
          const matchesData = await matchesResponse.json();

          const poulesRankings: PouleRanking[] = POULES.map((pouleId) => {
            const pouleData = poulesData.poules?.find((p: any) => p.pouleId === pouleId); // eslint-disable-line @typescript-eslint/no-explicit-any

            if (pouleData?.teams) {
              const rankings: (TeamInPoule | null)[] = [null, null, null, null];

              Object.entries(pouleData.teams).forEach(([teamId, teamData]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                if (teamData.position !== null && teamData.position !== undefined) {
                  rankings[teamData.position] = {
                    id: teamId,
                    name: teamData.name,
                    pot: teamData.pot,
                    poule: pouleId,
                    position: teamData.position,
                  };
                }
              });

              return { pouleId, rankings };
            }

            return { pouleId, rankings: [null, null, null, null] };
          });

          setActualPoules(poulesRankings);

          const allMatches: Match[] = [];
          poulesRankings.forEach((poule) => {
            const teams = poule.rankings.filter((t) => t !== null) as TeamInPoule[];

            for (let i = 0; i < teams.length; i++) {
              for (let j = i + 1; j < teams.length; j++) {
                const matchId = `${poule.pouleId}-${teams[i].id}-${teams[j].id}`;
                const savedMatch = matchesData.matches?.find((m: any) => m.id === matchId); // eslint-disable-line @typescript-eslint/no-explicit-any

                allMatches.push({
                  id: matchId,
                  pouleId: poule.pouleId,
                  team1Id: teams[i].id,
                  team2Id: teams[j].id,
                  team1Score: savedMatch?.team1Score ?? null,
                  team2Score: savedMatch?.team2Score ?? null,
                });
              }
            }
          });

          setBaseMatches(allMatches);
        } catch (error) {
          console.error('Error loading actual poules or matches:', error);
        }

        try {
          const entries = await Promise.all(
            predictions.map(async (prediction) => {
              try {
                const userRes = await fetch(`/api/getUser?userId=${prediction.userId}`);
                if (!userRes.ok) return [prediction.userId, prediction.userId] as [string, string];
                const userData = await userRes.json();
                const name = userData.playername || userData.firstName || userData.email || prediction.userId;
                return [prediction.userId, name] as [string, string];
              } catch {
                return [prediction.userId, prediction.userId] as [string, string];
              }
            })
          );

          const nameMap: Record<string, string> = {};
          entries.forEach(([id, name]) => {
            nameMap[id] = name;
          });
          setUserNames(nameMap);
        } catch (error) {
          console.error('Error loading user names for predictions:', error);
        }
      } catch (error) {
        console.error('Error loading standings:', error);
        router.push('/wk-2026/predictions');
      } finally {
        setIsLoadingPredictions(false);
      }
    };

    checkAdminAndLoad();
  }, [user, loading, router]);

  const hasPredictions = allPredictions.length > 0;

  const selectedPouleLabel = selectedPoule.toUpperCase();

  const calculateStandings = (pouleId: string): TeamStats[] => {
    const pouleData = actualPoules.find((p) => p.pouleId === pouleId);
    if (!pouleData) return [];

    const teams = pouleData.rankings.filter((t) => t !== null) as TeamInPoule[];
    const pouleMatches = actualMatches.filter((m) => m.pouleId === pouleId);

    const statsMap: { [teamId: string]: TeamStats } = {};
    teams.forEach((team) => {
      statsMap[team.id] = {
        teamId: team.id,
        team,
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
      if (match.team1Score !== null && match.team2Score !== null) {
        const team1Stats = statsMap[match.team1Id];
        const team2Stats = statsMap[match.team2Id];

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

    return Object.values(statsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  };

  // Calculate best third-placed teams across all groups
  const calculateBestThirdPlaced = (): TeamStats[] => {
    const allThirdPlaced: TeamStats[] = [];

    POULES.forEach((pouleId) => {
      const standings = calculateStandings(pouleId);
      if (standings.length >= 3) {
        const thirdPlace = standings[2];
        allThirdPlaced.push(thirdPlace);
      }
    });

    // Sort by same criteria: points, goal difference, goals for, wins
    return allThirdPlaced.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.won - a.won;
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">WK 2026 Predictions - Standings</h1>

      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-2">Poule</h2>
          <div className="flex gap-2 flex-wrap">
            {POULES.map((pouleId) => (
              <button
                key={pouleId}
                onClick={() => setSelectedPoule(pouleId)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  selectedPoule === pouleId
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Poule {pouleId.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Best Third-Placed Teams Table */}
      {!isLoadingPredictions && hasPredictions && (
        <div className="bg-white border-2 border-gray-300 rounded-lg overflow-x-auto mb-8">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-xl font-semibold">Stand best third-placed teams</h2>
            <p className="text-xs text-gray-600 mt-1">
              The first 8 third-placed teams qualify for the knockout phase
            </p>
          </div>
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Grp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Team</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Wed</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">W</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">G</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">V</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Ptn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">DV</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">DT</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">+/−</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qualification</th>
              </tr>
            </thead>
            <tbody>
              {calculateBestThirdPlaced().map((teamStats, idx) => {
                const qualifies = idx < 8;
                return (
                  <tr
                    key={`${teamStats.team.poule}-${teamStats.teamId}`}
                    className={`border-t ${qualifies ? 'bg-green-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{teamStats.team.poule?.toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{teamStats.team.name}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{teamStats.played}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{teamStats.won}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{teamStats.drawn}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{teamStats.lost}</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{teamStats.points}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{teamStats.goalsFor}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">{teamStats.goalsAgainst}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900">
                      {teamStats.goalDifference > 0 ? '+' : ''}{teamStats.goalDifference}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {qualifies ? 'To the knock-out phase' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-gray-600 border-t">
            <p className="mb-1">The first match(es) will be played on 11 June 2026.</p>
            <p>
              <strong>Stand rules:</strong> 1) Most points; 2) Goal difference; 3) Goals for;
              4) Number of wins; 5) Lower total number of disciplinary points
            </p>
          </div>
        </div>
      )}

      {isLoadingPredictions && (
        <div className="text-gray-600 mb-4">Loading predictions...</div>
      )}

      {!isLoadingPredictions && !hasPredictions && (
        <div className="text-gray-600">No predictions saved yet.</div>
      )}

      {!isLoadingPredictions && hasPredictions && (
        <div className="bg-white border-2 border-gray-300 rounded-lg overflow-x-auto mb-8">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Poule {selectedPouleLabel} - Position 1
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Poule {selectedPouleLabel} - Position 2
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Poule {selectedPouleLabel} - Position 3
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Poule {selectedPouleLabel} - Position 4
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Correct (Poule {selectedPouleLabel})
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const standings = calculateStandings(selectedPoule);
                const actualRanking = standings.map((s) => s.team);

                return (
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">Actual outcome</td>
                    {Array.from({ length: 4 }).map((_, idx) => {
                      const team = actualRanking[idx];
                      return (
                        <td key={idx} className="px-4 py-3 text-sm text-gray-900">
                          {team ? team.name : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm text-center text-gray-900">-</td>
                  </tr>
                );
              })()}

              {allPredictions.map((prediction) => {
                const standings = calculateStandings(selectedPoule);
                const actualRanking = standings.map((s) => s.team);
                const pouleRanking =
                  prediction.rankings?.find((p) => p.pouleId === selectedPoule) ||
                  ({ pouleId: selectedPoule, rankings: [null, null, null, null] } as PouleRanking);

                const correctCount = pouleRanking.rankings.reduce((acc, team, idx) => {
                  const actualTeam = actualRanking[idx] || null;
                  if (team && actualTeam && team.id === actualTeam.id) {
                    return acc + 1;
                  }
                  return acc;
                }, 0);

                return (
                  <tr key={prediction.id} className="border-t">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {userNames[prediction.userId] || prediction.userId}
                    </td>
                    {pouleRanking.rankings.map((team, idx) => {
                      const actualTeam = actualRanking[idx] || null;
                      const isCorrect = team && actualTeam && team.id === actualTeam.id;

                      return (
                        <td
                          key={idx}
                          className={`px-4 py-3 text-sm ${
                            isCorrect ? 'bg-green-100 text-green-800 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {team ? team.name : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm text-center font-semibold text-gray-800">
                      {correctCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoadingPredictions && hasPredictions && (
        <div className="bg-white border-2 border-gray-300 rounded-lg overflow-x-auto">
          <h2 className="text-xl font-semibold px-4 pt-4 pb-2">
            Match Score Predictions - Poule {selectedPouleLabel}
          </h2>
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Match</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actual</th>
                {allPredictions.map((prediction) => (
                  <th
                    key={prediction.id}
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase whitespace-nowrap"
                  >
                    {userNames[prediction.userId] || prediction.userId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actualMatches
                .filter((m) => m.pouleId === selectedPoule)
                .map((match) => {
                  const team1 = getTeamById(match.team1Id);
                  const team2 = getTeamById(match.team2Id);

                  const actualLabel =
                    match.team1Score !== null && match.team2Score !== null
                      ? `${match.team1Score}-${match.team2Score}`
                      : '-';

                  if (!team1 || !team2) return null;

                  return (
                    <tr key={match.id} className="border-t">
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {team1.name} - {team2.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">
                        <div className="flex items-center justify-center gap-2">
                          {actualLabel}
                          {match.isLive && match.team1Score !== null && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-semibold">
                              LIVE
                            </span>
                          )}
                        </div>
                      </td>
                      {allPredictions.map((prediction) => {
                        const predictedMatch = prediction.matches?.find((m) => m.id === match.id);
                        const predictedLabel =
                          predictedMatch &&
                          predictedMatch.team1Score !== null &&
                          predictedMatch.team2Score !== null
                            ? `${predictedMatch.team1Score}-${predictedMatch.team2Score}`
                            : '-';

                        const isExact =
                          predictedMatch &&
                          match.team1Score !== null &&
                          match.team2Score !== null &&
                          predictedMatch.team1Score === match.team1Score &&
                          predictedMatch.team2Score === match.team2Score;

                        return (
                          <td
                            key={prediction.id}
                            className={`px-4 py-3 text-sm text-center whitespace-nowrap ${
                              isExact ? 'bg-green-100 text-green-800 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {predictedLabel}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
