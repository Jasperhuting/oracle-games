'use client';
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check } from "tabler-icons-react";
import { POULES, TeamInPoule } from "../page";
import { useAuth } from "@/hooks/useAuth";
import { useWk2026Participant } from "../hooks";
import { authorizedFetch } from "@/lib/auth/token-service";
import { usePathname, useSearchParams } from "next/navigation";
import {
    createTeamHistoryPairKey,
    reverseTeamHistory,
    type StoredTeamHistoryMap,
    type TeamHistoryResponse,
} from "@/lib/wk-2026/team-history-types";
import { PoulePredictor } from "@/app/wk-2026/components/PoulePredictor";
import type { FixtureEntry } from "@/app/api/wk-2026/all-fixtures/route";

interface Match {
    id: string;
    pouleId: string;
    team1Id: string;
    team2Id: string;
    team1Score: number | null;
    team2Score: number | null;
    date?: string;
    time?: string;
}

interface PouleRanking {
    pouleId: string;
    rankings: (TeamInPoule | null)[];
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

// ---------- Main page ----------

export default function PlayerPredictionsPage() {
    const { user } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isParticipant, loading: participantLoading, refresh: refreshParticipant } = useWk2026Participant(user?.uid || null, 2026);
    const [poules, setPoules] = useState<PouleRanking[]>([]);
    const [manualRankings, setManualRankings] = useState<PouleRanking[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedPoule, setSelectedPoule] = useState<string>('a');
    const [isJoining, setIsJoining] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

    const fetchedHistoryPairsRef = useRef<Set<string>>(new Set());
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
            // Fetch admin's poules (official team assignments) + fixtures for dates
            const [poulesResponse, fixturesResponse] = await Promise.all([
                fetch('/api/wk-2026/getPoules'),
                fetch('/api/wk-2026/all-fixtures'),
            ]);
            const poulesData = await poulesResponse.json();
            const fixturesData = await fixturesResponse.json();
            const groupFixtures: FixtureEntry[] = (fixturesData.fixtures ?? []).filter(
                (f: FixtureEntry) => f.type === 'group'
            );

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

                        // Look up date from official fixtures by matching team names and group
                        const fixture = groupFixtures.find(f =>
                            f.group === poule.pouleId &&
                            (
                                (f.team1?.name === teams[i].name && f.team2?.name === teams[j].name) ||
                                (f.team1?.name === teams[j].name && f.team2?.name === teams[i].name)
                            )
                        );

                        allMatches.push({
                            id: matchId,
                            pouleId: poule.pouleId,
                            team1Id: teams[i].id,
                            team2Id: teams[j].id,
                            team1Score: predictedMatch?.team1Score ?? null,
                            team2Score: predictedMatch?.team2Score ?? null,
                            date: fixture?.date,
                            time: fixture?.time,
                        });
                    }
                }
            });

            allMatches.sort((a, b) => {
                const dateA = `${a.date ?? '9999-99-99'} ${a.time ?? '99:99'}`;
                const dateB = `${b.date ?? '9999-99-99'} ${b.time ?? '99:99'}`;
                return dateA.localeCompare(dateB);
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
        if (fetchedHistoryPairsRef.current.has(pairKey)) return;
        fetchedHistoryPairsRef.current.add(pairKey);

        try {
            const response = await fetch(
                `/api/wk-2026/team-history?team1=${encodeURIComponent(team1Name)}&team2=${encodeURIComponent(team2Name)}`
            );

            if (!response.ok) return;

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
            fetchedHistoryPairsRef.current.delete(pairKey);
        }
    }, []);

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
                void fetchMissingTeamHistory(team.name, opponent.name);
            });
        });
    }, [selectedPoule, poules, fetchMissingTeamHistory]);

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

    const handleSelectPoule = useCallback((pouleId: string) => {
        setSelectedPoule(pouleId);

        const params = new URLSearchParams(searchParams.toString());
        params.set('poule', pouleId);
        window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }, [pathname, searchParams]);

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

    const selectedPouleTeams = (poules.find(p => p.pouleId === selectedPoule)?.rankings.filter(Boolean) ?? []) as TeamInPoule[];

    return (
        <div className="p-6 mt-9 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-2 text-gray-900">Mijn WK 2026 Voorspellingen</h1>
            <p className="text-sm text-gray-500 mb-6">Selecteer een poule en vul je voorspellingen in.</p>

            {/* Poule Selector */}
            <div className="mb-8">
                <div className="flex flex-wrap gap-2">
                    {POULES.map(pouleId => (
                        <button
                            key={pouleId}
                            onClick={() => handleSelectPoule(pouleId)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                selectedPoule === pouleId
                                    ? 'bg-[#ff9900] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Poule {pouleId.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Shared PoulePredictor component */}
            <PoulePredictor
                pouleLabel={selectedPoule.toUpperCase()}
                teams={selectedPouleTeams}
                rankings={selectedManualRanking?.rankings ?? [null, null, null, null]}
                matches={selectedPouleMatches}
                onRankingsChange={(newRankings) => {
                    // Re-derive positions from array index to keep TeamInPoule.position consistent
                    const withPositions = newRankings.map((team, idx) =>
                        team ? { ...(team as TeamInPoule), position: idx } : null
                    ) as (TeamInPoule | null)[];
                    setManualRankings(manualRankings.map(p =>
                        p.pouleId === selectedPoule ? { ...p, rankings: withPositions } : p
                    ));
                }}
                onScoreChange={handleScoreChange}
                teamHistory={teamHistory}
                historyLoading={historyLoading}
            />

            {/* Save Button */}
            <div className="sticky bottom-4 z-20 mt-8 flex justify-end">
                <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-white/90 p-2 shadow-lg backdrop-blur">
                    {saveFeedback && (
                        <div
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
                                saveFeedback.type === 'success'
                                    ? 'border-orange-200 bg-orange-50 text-orange-900'
                                    : 'border-red-200 bg-red-50 text-red-800'
                            }`}
                        >
                            <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                    saveFeedback.type === 'success'
                                        ? 'bg-[#ff9900] text-white'
                                        : 'bg-red-600 text-white'
                                }`}
                            >
                                {saveFeedback.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            </span>
                            <div className="leading-tight">
                                <div className="font-semibold">{saveFeedback.text}</div>
                                {saveFeedback.type === 'success' && lastSavedAt && (
                                    <div className="text-xs text-[#ff9900]">Laatst opgeslagen om {lastSavedAt}</div>
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
