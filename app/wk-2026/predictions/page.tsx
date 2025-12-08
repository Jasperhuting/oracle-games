'use client';
export const dynamic = "force-dynamic";

import { Flag } from "@/components/Flag";
import { useEffect, useState } from "react";
import countriesList from '@/lib/country.json';
import { POULES, TeamInPoule } from "../page";
import { useAuth } from "@/hooks/useAuth";

interface Match {
    id: string;
    pouleId: string;
    team1Id: string;
    team2Id: string;
    team1Score: number | null;
    team2Score: number | null;
}

interface PouleRanking {
    pouleId: string;
    rankings: (TeamInPoule | null)[]; // Array of 4 positions
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

export default function PlayerPredictionsPage() {
    const { user } = useAuth();
    const [poules, setPoules] = useState<PouleRanking[]>([]); // Team assignments from admin
    const [manualRankings, setManualRankings] = useState<PouleRanking[]>([]); // Player's predicted rankings
    const [matches, setMatches] = useState<Match[]>([]); // Player's predicted scores
    const [selectedPoule, setSelectedPoule] = useState<string>('a');
    const [draggedTeam, setDraggedTeam] = useState<TeamInPoule | null>(null);
    const [draggedFromPosition, setDraggedFromPosition] = useState<number | null>(null);

    const fetchPoulesAndPredictions = async () => {
        try {
            // Fetch admin's poules (official team assignments)
            const poulesResponse = await fetch('/api/wk-2026/getPoules');
            const poulesData = await poulesResponse.json();

            // Transform poules data into rankings
            const poulesRankings: PouleRanking[] = POULES.map(pouleId => {
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
                                position: teamData.position
                            };
                        }
                    });

                    return { pouleId, rankings };
                }

                return { pouleId, rankings: [null, null, null, null] };
            });

            setPoules(poulesRankings);

            // Fetch player's predictions
            const predictionsResponse = await fetch(`/api/wk-2026/predictions/${user?.uid}`);
            const predictionsData = await predictionsResponse.json();

            // Initialize manual rankings from player's predictions or default to admin's poules
            if (predictionsData.predictions?.rankings) {
                setManualRankings(predictionsData.predictions.rankings);
            } else {
                setManualRankings(JSON.parse(JSON.stringify(poulesRankings)));
            }

            // Generate matches for each poule
            const allMatches: Match[] = [];
            poulesRankings.forEach(poule => {
                const teams = poule.rankings.filter(t => t !== null) as TeamInPoule[];

                // Generate all combinations (round-robin)
                for (let i = 0; i < teams.length; i++) {
                    for (let j = i + 1; j < teams.length; j++) {
                        const matchId = `${poule.pouleId}-${teams[i].id}-${teams[j].id}`;

                        // Check if player has predicted this match
                        const predictedMatch = predictionsData.predictions?.matches?.find((m: any) => m.id === matchId); // eslint-disable-line @typescript-eslint/no-explicit-any

                        allMatches.push({
                            id: matchId,
                            pouleId: poule.pouleId,
                            team1Id: teams[i].id,
                            team2Id: teams[j].id,
                            team1Score: predictedMatch?.team1Score ?? null,
                            team2Score: predictedMatch?.team2Score ?? null
                        });
                    }
                }
            });

            setMatches(allMatches);

        } catch (error) {
            console.error('Error fetching poules and predictions:', error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchPoulesAndPredictions();
        }
    }, [user]);

    const handleScoreChange = (matchId: string, team: 'team1' | 'team2', score: string) => {
        const scoreValue = score === '' ? null : parseInt(score);

        setMatches(matches.map(match => {
            if (match.id === matchId) {
                const updatedMatch = {
                    ...match,
                    [team === 'team1' ? 'team1Score' : 'team2Score']: scoreValue
                };

                // If one score is set and the other is null, set the other to 0
                if (team === 'team1' && scoreValue !== null && match.team2Score === null) {
                    updatedMatch.team2Score = 0;
                } else if (team === 'team2' && scoreValue !== null && match.team1Score === null) {
                    updatedMatch.team1Score = 0;
                }

                return updatedMatch;
            }
            return match;
        }));
    };

    const selectedPouleData = poules.find(p => p.pouleId === selectedPoule);
    const selectedManualRanking = manualRankings.find(p => p.pouleId === selectedPoule);
    const selectedPouleMatches = matches.filter(m => m.pouleId === selectedPoule);

    const getTeamById = (teamId: string): TeamInPoule | null => {
        for (const poule of poules) {
            const team = poule.rankings.find(t => t?.id === teamId);
            if (team) return team;
        }
        return null;
    };

    const handleDragStart = (team: TeamInPoule, position: number) => {
        setDraggedTeam(team);
        setDraggedFromPosition(position);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDropToPosition = (position: number) => {
        if (!draggedTeam || !selectedManualRanking) return;

        const teamAtPosition = selectedManualRanking.rankings[position];

        if (teamAtPosition && teamAtPosition.id !== draggedTeam.id) {
            // Swap positions
            const updatedRankings = [...selectedManualRanking.rankings];
            if (draggedFromPosition !== null) {
                updatedRankings[draggedFromPosition] = { ...teamAtPosition, position: draggedFromPosition };
            }
            updatedRankings[position] = { ...draggedTeam, position };

            setManualRankings(manualRankings.map(p =>
                p.pouleId === selectedPoule
                    ? { ...p, rankings: updatedRankings }
                    : p
            ));
        } else {
            // Simply place in empty position
            const updatedRankings = [...selectedManualRanking.rankings];
            if (draggedFromPosition !== null) {
                updatedRankings[draggedFromPosition] = null;
            }
            updatedRankings[position] = { ...draggedTeam, position };

            setManualRankings(manualRankings.map(p =>
                p.pouleId === selectedPoule
                    ? { ...p, rankings: updatedRankings }
                    : p
            ));
        }

        setDraggedTeam(null);
        setDraggedFromPosition(null);
    };

    const calculateStandings = (pouleId: string): TeamStats[] => {
        const pouleData = poules.find(p => p.pouleId === pouleId);
        if (!pouleData) return [];

        const teams = pouleData.rankings.filter(t => t !== null) as TeamInPoule[];
        const pouleMatches = matches.filter(m => m.pouleId === pouleId);

        const statsMap: { [teamId: string]: TeamStats } = {};
        teams.forEach(team => {
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
                points: 0
            };
        });

        pouleMatches.forEach(match => {
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

    const savePredictions = async () => {
        if (!user) {
            alert('You must be logged in to save predictions');
            return;
        }

        try {
            const response = await fetch('/api/wk-2026/predictions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    rankings: manualRankings,
                    matches: matches
                })
            });

            if (response.ok) {
                alert('Predictions saved successfully!');
            } else {
                alert('Error saving predictions');
            }
        } catch (error) {
            console.error('Error saving predictions:', error);
            alert('Error saving predictions');
        }
    };

    if (!user) {
        return (
            <div className="p-6">
                <h1 className="text-3xl font-bold mb-6">Please log in to make predictions</h1>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">My WK 2026 Predictions</h1>

            {/* Poule Selector */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Select Poule:</h2>
                <div className="flex gap-2 flex-wrap">
                    {POULES.map(pouleId => (
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

            {/* Manual Ranking Prediction */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">My Predicted Ranking - Poule {selectedPoule.toUpperCase()}</h2>
                <p className="text-sm text-gray-600 mb-4">Drag teams to predict the final ranking</p>

                <div className="bg-white border-2 border-gray-300 rounded-lg p-4 max-w-md">
                    <div className="space-y-2">
                        {[0, 1, 2, 3].map((position) => {
                            const teamAtPosition = selectedManualRanking?.rankings[position];

                            if (teamAtPosition) {
                                const country = countriesList.find((c: any) => c.name === teamAtPosition.name); // eslint-disable-line @typescript-eslint/no-explicit-any
                                return (
                                    <div
                                        key={position}
                                        draggable
                                        onDragStart={() => handleDragStart(teamAtPosition, position)}
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDropToPosition(position)}
                                        className="flex items-center p-3 bg-white border-2 border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow"
                                    >
                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-blue-500 text-white rounded-full text-sm font-bold mr-3">
                                            {position + 1}
                                        </div>
                                        <div className="flex-shrink-0">
                                            <Flag countryCode={country?.code || teamAtPosition.id} width={28} />
                                        </div>
                                        <span className="ml-3 font-medium">{teamAtPosition.name}</span>
                                    </div>
                                );
                            } else {
                                return (
                                    <div
                                        key={position}
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDropToPosition(position)}
                                        className="flex items-center p-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg min-h-[56px] hover:border-blue-400 hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-gray-200 text-gray-700 rounded-full text-sm font-bold mr-3">
                                            {position + 1}
                                        </div>
                                        <span className="text-sm text-gray-400">Drop team here</span>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
            </div>

            {/* Auto-Calculated Standings based on predictions */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Predicted Standings - Poule {selectedPoule.toUpperCase()}</h2>
                <p className="text-sm text-gray-600 mb-4">Based on your predicted match scores</p>

                <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden max-w-4xl">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Team</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">P</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">W</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">D</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">L</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GF</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GA</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GD</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calculateStandings(selectedPoule).map((stats, index) => {
                                const country = countriesList.find((c: any) => c.name === stats.team.name); // eslint-disable-line @typescript-eslint/no-explicit-any
                                const isQualified = index < 2;

                                return (
                                    <tr
                                        key={stats.teamId}
                                        className={`border-t ${isQualified ? 'bg-green-50' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-700 rounded-full text-sm font-bold">
                                                {index + 1}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center">
                                                <Flag countryCode={country?.code || stats.team.id} width={24} />
                                                <span className="ml-2 font-medium">{stats.team.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">{stats.played}</td>
                                        <td className="px-4 py-3 text-center">{stats.won}</td>
                                        <td className="px-4 py-3 text-center">{stats.drawn}</td>
                                        <td className="px-4 py-3 text-center">{stats.lost}</td>
                                        <td className="px-4 py-3 text-center">{stats.goalsFor}</td>
                                        <td className="px-4 py-3 text-center">{stats.goalsAgainst}</td>
                                        <td className="px-4 py-3 text-center font-medium">
                                            {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-lg">{stats.points}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    <span className="inline-block w-3 h-3 bg-green-50 border border-green-200 mr-1"></span>
                    Top 2 teams qualify for knockout stage
                </p>
            </div>

            {/* Matches Prediction */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Match Score Predictions - Poule {selectedPoule.toUpperCase()}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                    {selectedPouleMatches.map((match, index) => {
                        const team1 = getTeamById(match.team1Id);
                        const team2 = getTeamById(match.team2Id);

                        if (!team1 || !team2) return null;

                        const country1 = countriesList.find((c: any) => c.name === team1.name); // eslint-disable-line @typescript-eslint/no-explicit-any
                        const country2 = countriesList.find((c: any) => c.name === team2.name); // eslint-disable-line @typescript-eslint/no-explicit-any

                        return (
                            <div key={match.id} className="bg-white border-2 border-gray-300 rounded-lg p-4">
                                <div className="text-sm text-gray-500 mb-2">Match {index + 1}</div>

                                {/* Team 1 */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center flex-1">
                                        <Flag countryCode={country1?.code || team1.id} width={24} />
                                        <span className="ml-2 font-medium">{team1.name}</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        value={match.team1Score ?? ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                                        className="w-16 px-2 py-1 border-2 border-gray-300 rounded text-center font-bold text-lg"
                                        placeholder="0"
                                    />
                                </div>

                                {/* Team 2 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-1">
                                        <Flag countryCode={country2?.code || team2.id} width={24} />
                                        <span className="ml-2 font-medium">{team2.name}</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        value={match.team2Score ?? ''}
                                        onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                                        className="w-16 px-2 py-1 border-2 border-gray-300 rounded text-center font-bold text-lg"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-4">
                <button
                    onClick={savePredictions}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                >
                    Save My Predictions
                </button>
            </div>
        </div>
    );
}
