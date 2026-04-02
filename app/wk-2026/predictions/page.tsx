'use client';
export const dynamic = "force-dynamic";

import { Flag } from "@/components/Flag";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check } from "tabler-icons-react";
import countriesList from '@/lib/country.json';
import { POULES, TeamInPoule } from "../page";
import { useAuth } from "@/hooks/useAuth";
import { useWk2026Participant } from "../hooks";
import { authorizedFetch } from "@/lib/auth/token-service";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    createTeamHistoryPairKey,
    orientTeamHistory,
    reverseTeamHistory,
    type HeadToHeadMatch,
    type MatchResult,
    type StoredTeamHistoryMap,
    type TeamHistoryResponse,
} from "@/lib/wk-2026/team-history-types";

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

function normalizeManualRankings(
    currentPoules: PouleRanking[],
    savedRankings?: PouleRanking[]
): PouleRanking[] {
    if (!savedRankings?.length) {
        return JSON.parse(JSON.stringify(currentPoules));
    }

    return currentPoules.map((currentPoule) => {
        const savedPoule = savedRankings.find((ranking) => ranking.pouleId === currentPoule.pouleId);
        const officialTeams = currentPoule.rankings.filter(Boolean) as TeamInPoule[];
        const officialTeamsById = new Map(officialTeams.map((team) => [team.id, team]));
        const usedTeamIds = new Set<string>();
        const mergedRankings: (TeamInPoule | null)[] = [null, null, null, null];

        savedPoule?.rankings.forEach((team, position) => {
            if (!team) return;

            const officialTeam = officialTeamsById.get(team.id);
            if (!officialTeam || usedTeamIds.has(team.id)) return;

            mergedRankings[position] = {
                ...officialTeam,
                position,
            };
            usedTeamIds.add(team.id);
        });

        const remainingTeams = officialTeams.filter((team) => !usedTeamIds.has(team.id));
        for (let position = 0; position < mergedRankings.length; position++) {
            if (!mergedRankings[position] && remainingTeams.length > 0) {
                const nextTeam = remainingTeams.shift();
                if (nextTeam) {
                    mergedRankings[position] = {
                        ...nextTeam,
                        position,
                    };
                }
            }
        }

        return {
            pouleId: currentPoule.pouleId,
            rankings: mergedRankings,
        };
    });
}

// ---------- Form-dot helpers ----------

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

    const label =
        match.result === 'W' ? 'W' : match.result === 'D' ? 'G' : 'V';

    const tooltip = `${match.teamScore}-${match.opponentScore} vs ${match.opponent} (${match.competition}, ${match.date})`;

    return (
        <div className="relative group">
            <div
                className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[9px] font-bold cursor-default`}
                title={tooltip}
            >
                {label}
            </div>
            {/* Custom tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    <span className="font-semibold">{match.teamScore}-{match.opponentScore}</span>{' '}
                    vs {match.opponent}
                    <br />
                    <span className="text-gray-400 text-[10px]">{match.competition} · {match.date}</span>
                </div>
                <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
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
        <div className="flex items-center justify-between text-xs text-gray-600 py-0.5">
            <span className="text-gray-400 w-20 shrink-0">{match.date.slice(0, 7)}</span>
            <span className={`font-semibold ${match.team1Score > match.team2Score ? 'text-green-600' : match.team1Score < match.team2Score ? 'text-red-500' : 'text-gray-500'}`}>
                {match.team1Score} – {match.team2Score}
            </span>
            <span className="text-gray-400 w-20 text-right shrink-0 truncate">{result}</span>
        </div>
    );
}

// ---------- Main page ----------

export default function PlayerPredictionsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isParticipant, loading: participantLoading, refresh: refreshParticipant } = useWk2026Participant(user?.uid || null, 2026);
    const [poules, setPoules] = useState<PouleRanking[]>([]); // Team assignments from admin
    const [manualRankings, setManualRankings] = useState<PouleRanking[]>([]); // Player's predicted rankings
    const [matches, setMatches] = useState<Match[]>([]); // Player's predicted scores
    const [selectedPoule, setSelectedPoule] = useState<string>('a');
    const [draggedTeam, setDraggedTeam] = useState<TeamInPoule | null>(null);
    const [draggedFromPosition, setDraggedFromPosition] = useState<number | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

    // Team history (H2H + form) keyed by sorted team pair "teamA__teamB"
    const [teamHistory, setTeamHistory] = useState<StoredTeamHistoryMap>({});
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        const pouleFromUrl = searchParams.get('poule')?.toLowerCase();
        if (pouleFromUrl && POULES.includes(pouleFromUrl) && pouleFromUrl !== selectedPoule) {
            setSelectedPoule(pouleFromUrl);
        }
    }, [searchParams, selectedPoule]);

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
                alert(data.error || 'Er ging iets mis bij het deelnemen');
            } else {
                await refreshParticipant();
            }
        } catch (error) {
            console.error('Error joining WK 2026:', error);
            alert('Er ging iets mis bij het deelnemen');
        } finally {
            setIsJoining(false);
        }
    };

    const fetchPoulesAndPredictions = useCallback(async () => {
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
                setManualRankings(
                    normalizeManualRankings(poulesRankings, predictionsData.predictions.rankings)
                );
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
    }, [user]);

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
            setTeamHistory(prev => ({
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

    useEffect(() => {
        if (user) {
            fetchPoulesAndPredictions();
            fetchAllTeamHistory();
        }
    }, [user, fetchPoulesAndPredictions, fetchAllTeamHistory]);

    useEffect(() => {
        const pouleData = poules.find(p => p.pouleId === selectedPoule);
        if (!pouleData) return;

        const teams = pouleData.rankings.filter(Boolean) as TeamInPoule[];
        teams.forEach((team, index) => {
            teams.slice(index + 1).forEach((opponent) => {
                const pairKey = createTeamHistoryPairKey(team.name, opponent.name);
                if (!teamHistory[pairKey]) {
                    void fetchMissingTeamHistory(team.name, opponent.name);
                }
            });
        });
    }, [selectedPoule, poules, teamHistory, fetchMissingTeamHistory]);

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

    const handleSelectPoule = useCallback((pouleId: string) => {
        setSelectedPoule(pouleId);

        const params = new URLSearchParams(searchParams.toString());
        params.set('poule', pouleId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    const savePredictions = async () => {
        if (!user) {
            setSaveFeedback({ type: 'error', text: 'Je moet ingelogd zijn om voorspellingen op te slaan.' });
            return;
        }

        setIsSaving(true);
        setSaveFeedback(null);

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
                const savedAt = new Date().toLocaleTimeString('nl-NL', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                setLastSavedAt(savedAt);
                setSaveFeedback({ type: 'success', text: 'Je voorspellingen zijn opgeslagen.' });
            } else {
                setSaveFeedback({ type: 'error', text: 'Opslaan is mislukt. Probeer het opnieuw.' });
            }
        } catch (error) {
            console.error('Error saving predictions:', error);
            setSaveFeedback({ type: 'error', text: 'Opslaan is mislukt. Probeer het opnieuw.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="p-8 mt-9">
                <h1 className="text-3xl font-bold mb-6">Please log in to make predictions</h1>
            </div>
        );
    }

    if (participantLoading) {
        return (
            <div className="p-8 mt-9 max-w-6xl mx-auto">
                <div className="rounded-2xl border border-[#ffd7a6] bg-white p-6 text-[#9a4d00]">
                    Deelnamestatus laden...
                </div>
            </div>
        );
    }

    if (!isParticipant) {
        return (
            <div className="p-8 mt-9 max-w-4xl mx-auto">
                <div className="rounded-3xl border border-[#ffd7a6] bg-white p-8 shadow-sm">
                    <span className="inline-flex rounded-full bg-[#fff0d9] px-3 py-1 text-sm font-semibold text-[#9a4d00]">
                        Eerst deelnemen
                    </span>
                    <h1 className="mt-4 text-3xl font-bold text-gray-900">Doe mee aan WK 2026</h1>
                    <p className="mt-3 max-w-2xl text-base text-gray-600">
                        Voor je voorspellingen kunt invullen, moet je eerst officieel deelnemen aan het WK-platform.
                        Daarna krijg je direct toegang tot de groepsfase, knockout en subpoules.
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

    return (
        <div className="p-8 mt-9">
            <h1 className="text-3xl font-bold mb-6">My WK 2026 Predictions</h1>

            {/* Poule Selector */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Select Poule:</h2>
                <div className="grid gap-2 flex-wrap grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-12">
                    {POULES.map(pouleId => (
                        <button
                            key={pouleId}
                            onClick={() => handleSelectPoule(pouleId)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors min-w-[100px] ${
                                selectedPoule === pouleId
                                    ? 'bg-[#ff9900] text-white'
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
                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-[#ff9900] text-white rounded-full text-sm font-bold mr-3">
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
                                        className="flex items-center p-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg min-h-[56px] hover:border-[#ff9900] hover:bg-orange-50 transition-colors"
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

                <div className="bg-white border-2 border-gray-300 rounded-lg max-w-4xl overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="sticky left-0 z-20 w-[52px] min-w-[52px] bg-gray-100 px-2 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                                <th className="sticky left-[52px] z-20 min-w-[180px] bg-gray-100 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Team</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">P</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">W</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">D</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">L</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GF</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GA</th>
                                <th className="min-w-[52px] px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GD</th>
                                <th className="min-w-[60px] px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase">Pts</th>
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
                                        <td className={`sticky left-0 z-10 px-2 py-3 ${isQualified ? 'bg-green-50' : 'bg-white'}`}>
                                            <div className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-700 rounded-full text-sm font-bold">
                                                {index + 1}
                                            </div>
                                        </td>
                                        <td className={`sticky left-[52px] z-10 px-4 py-3 ${isQualified ? 'bg-green-50' : 'bg-white'}`}>
                                            <div className="flex min-w-[180px] items-center">
                                                <Flag countryCode={country?.code || stats.team.id} width={24} className="min-w-[24px] min-h-[24px]" />
                                                <span className="ml-2 font-medium whitespace-nowrap">{stats.team.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">{stats.played}</td>
                                        <td className="px-3 py-3 text-center">{stats.won}</td>
                                        <td className="px-3 py-3 text-center">{stats.drawn}</td>
                                        <td className="px-3 py-3 text-center">{stats.lost}</td>
                                        <td className="px-3 py-3 text-center">{stats.goalsFor}</td>
                                        <td className="px-3 py-3 text-center">{stats.goalsAgainst}</td>
                                        <td className="px-3 py-3 text-center font-medium">
                                            {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                                        </td>
                                        <td className="px-3 py-3 text-center font-bold text-lg">{stats.points}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
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

                        const pairKey = createTeamHistoryPairKey(team1.name, team2.name);
                        const storedHistory = teamHistory[pairKey];
                        const history: TeamHistoryResponse | null = storedHistory
                            ? orientTeamHistory(storedHistory.data, team1.name, team2.name)
                            : null;
                        const t1Form = history?.team1Form || [];
                        const t2Form = history?.team2Form || [];
                        const h2h = history?.headToHead || [];
                        const h2hNewestFirst = [...h2h].reverse();

                        return (
                            <div key={match.id} className="bg-white border-2 border-gray-300 rounded-lg p-4">
                                <div className="text-sm text-gray-500 mb-2">Match {index + 1}</div>

                                {/* Team 1 */}
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center flex-1">
                                        <Flag countryCode={country1?.code || team1.id} width={24}  />
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

                                {/* Team 1 form dots */}
                                {t1Form.length > 0 && (
                                    <div className="flex items-center gap-1 mb-2 ml-7">
                                        {t1Form.map((m, i) => <FormDot key={i} match={m} />)}
                                    </div>
                                )}

                                {/* Team 2 */}
                                <div className="flex items-center justify-between mb-1 mt-2">
                                    <div className="flex items-center flex-1">
                                        <Flag countryCode={country2?.code || team2.id} width={24} className="min-w-[24px] min-h-[24px]" />
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

                                {/* Team 2 form dots */}
                                {t2Form.length > 0 && (
                                    <div className="flex items-center gap-1 mb-2 ml-7">
                                        {t2Form.map((m, i) => <FormDot key={i} match={m} />)}
                                    </div>
                                )}

                                {/* H2H section */}
                                {historyLoading && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 animate-pulse">
                                        Onderlinge resultaten laden...
                                    </div>
                                )}
                                {!historyLoading && h2h.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                            Onderling ({h2h.length}x)
                                        </div>
                                        {h2hNewestFirst.map((m, i) => (
                                            <H2HRow key={i} match={m} team1Name={team1.name} team2Name={team2.name} />
                                        ))}
                                    </div>
                                )}
                                {!historyLoading && history && h2h.length === 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                                        Nog nooit tegen elkaar gespeeld
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Save Button */}
            <div className="sticky bottom-4 z-20 mt-8 flex justify-end">
                <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-white/90 p-2 shadow-lg backdrop-blur">
                    {saveFeedback && (
                        <div
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
                                saveFeedback.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                    : 'border-red-200 bg-red-50 text-red-800'
                            }`}
                        >
                            <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                    saveFeedback.type === 'success'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-red-600 text-white'
                                }`}
                            >
                                {saveFeedback.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            </span>
                            <div className="leading-tight">
                                <div className="font-semibold">{saveFeedback.text}</div>
                                {saveFeedback.type === 'success' && lastSavedAt && (
                                    <div className="text-xs text-emerald-700">Laatst opgeslagen om {lastSavedAt}</div>
                                )}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={savePredictions}
                        disabled={isSaving}
                        className="px-6 py-3 bg-[#ff9900] text-white rounded-lg hover:bg-[#e68a00] transition-colors font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSaving ? 'Opslaan...' : 'Save My Predictions'}
                    </button>
                </div>
            </div>
        </div>
    );
}
