"use client";

import { useMemo, useState, useEffect, Suspense, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from "@tanstack/react-table";
import { Trophy, ChevronUp, ChevronDown, Users, Plus, X, Copy, Check, World, Search, Settings, UserPlus, UserMinus, Lock, LockOpen } from "tabler-icons-react";
import { useF1Standings, useF1SubLeagues, useF1Participants, useF1UserPredictions, useF1RaceResults, useF1Races, useF1LegacyDrivers } from "../hooks";
import { useUserNames } from "../hooks/useUserNames";
import { F1SubLeague, F1Prediction, LegacyDriver } from "../types";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase/client";

interface Player {
    id: string;
    name: string;
    avatarUrl?: string;
    totalPoints: number;
    correctPredictions: number;
    racesParticipated: number;
    bestFinish: number | null;
    lastRacePoints: number | null;
}

interface CompareRaceRow {
    raceId: string;
    round: number;
    raceName: string;
    raceSubName: string;
    resultFinishOrder: string[];
    dnfDrivers: string[];
    resultPolePosition: string | null;
    resultFastestLap: string | null;
    myPrediction: string | null;
    myFinishOrder: string[];
    myPolePosition: string | null;
    myFastestLap: string | null;
    myDnfs: string[];
    theirPrediction: string | null;
    theirFinishOrder: string[];
    theirPolePosition: string | null;
    theirFastestLap: string | null;
    theirDnfs: string[];
    myPoints: number | null;
    theirPoints: number | null;
}

interface ComparePositionRow {
    driver: LegacyDriver | null;
    predictedPos: number;
    actualPos: number | null;
    penalty: number;
    isDnf: boolean;
}

const columnHelper = createColumnHelper<Player>();

const StandingsPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();

    const { races, loading: racesLoading } = useF1Races(2026);
    const { standings, loading: standingsLoading } = useF1Standings(2026);
    const { participants, loading: participantsLoading } = useF1Participants(2026);
    const { subLeagues, loading: subLeaguesLoading } = useF1SubLeagues();
    const { predictions: myPredictions, loading: myPredictionsLoading } = useF1UserPredictions(2026);
    const { results: raceResults, loading: raceResultsLoading } = useF1RaceResults(2026);
    const { drivers: legacyDrivers, loading: legacyDriversLoading } = useF1LegacyDrivers(2026);

    // Get user IDs from participants (not just standings) to fetch display names
    const userIds = useMemo(() => participants.map(p => p.userId), [participants]);
    const { names: userNames, avatars: userAvatars, loading: namesLoading } = useUserNames(userIds);

    const [sorting, setSorting] = useState<SortingState>([
        { id: "totalPoints", desc: false }
    ]);

    // Get subpoule from URL, default to null (algemeen)
    const subpouleFromUrl = searchParams.get('poule');
    const [selectedSubpoule, setSelectedSubpoule] = useState<string | null>(subpouleFromUrl);

    // Sync state with URL when URL changes (e.g., browser back/forward)
    useEffect(() => {
        setSelectedSubpoule(subpouleFromUrl);
    }, [subpouleFromUrl]);

    // Update URL when subpoule changes
    const handleSubpouleChange = (subpouleId: string | null) => {
        setSelectedSubpoule(subpouleId);
        if (subpouleId) {
            router.push(`/f1/standings?poule=${subpouleId}`, { scroll: false });
        } else {
            router.push('/f1/standings', { scroll: false });
        }
    };
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showBrowseModal, setShowBrowseModal] = useState(false);
    const [newPouleName, setNewPouleName] = useState("");
    const [newPouleIsPublic, setNewPouleIsPublic] = useState(false);
    const [newPouleDescription, setNewPouleDescription] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [selectedComparePlayerId, setSelectedComparePlayerId] = useState<string | null>(null);
    const [selectedCompareRound, setSelectedCompareRound] = useState<number | null>(null);
    const [comparePredictions, setComparePredictions] = useState<F1Prediction[]>([]);
    const [compareLoading, setCompareLoading] = useState(false);
    const [publicSubLeagues, setPublicSubLeagues] = useState<F1SubLeague[]>([]);
    const [pendingUserNames, setPendingUserNames] = useState<Record<string, string>>({});
    const [browseLoading, setBrowseLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [requestingJoin, setRequestingJoin] = useState<string | null>(null);
    const [managingSubLeague, setManagingSubLeague] = useState<F1SubLeague | null>(null);
    const [isClient, setIsClient] = useState(false);

    // Get current user
    const { user } = useAuth();

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Calculate total pending requests for user's subleagues (for badge)
    const totalPendingRequests = useMemo(() => {
        if (!user) return 0;
        return subLeagues
            .filter(sl => sl.createdBy === user.uid)
            .reduce((sum, sl) => sum + (sl.pendingMemberIds?.length || 0), 0);
    }, [subLeagues, user]);

    // Fetch public subleagues when browse modal opens
    useEffect(() => {
        if (showBrowseModal) {
            setBrowseLoading(true);
            (async () => {
                try {
                    const idToken = await auth.currentUser?.getIdToken();
                    const headers: HeadersInit = {};
                    if (idToken) {
                        headers['Authorization'] = `Bearer ${idToken}`;
                    }
                    const res = await fetch('/api/f1/subleagues?public=true', { headers });
                    const data = await res.json();
                    if (data.success) {
                        setPublicSubLeagues(data.data);
                    } else {
                        console.error('Failed to fetch public subleagues:', data.error);
                    }
                } catch (error) {
                    console.error('Error fetching public subleagues:', error);
                } finally {
                    setBrowseLoading(false);
                }
            })();
        }
    }, [showBrowseModal]);

    // Fetch pending user names when managing a subleague
    useEffect(() => {
        if (managingSubLeague && managingSubLeague.pendingMemberIds?.length > 0) {
            const pendingIds = managingSubLeague.pendingMemberIds;
            fetch(`/api/users/names?ids=${pendingIds.join(',')}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setPendingUserNames(data.data);
                    }
                })
                .catch(console.error);
        }
    }, [managingSubLeague]);

    // Convert participants to Player format, merging with standings data
    // This ensures ALL participants appear, even those with 0 points
    const players: Player[] = useMemo(() => {
        // Create a map of standings by userId for quick lookup
        const standingsMap = new Map(standings.map(s => [s.userId, s]));

        return participants.map(p => {
            const standing = standingsMap.get(p.userId);
            return {
                id: p.userId,
                name: standing?.visibleName || p.displayName || userNames[p.userId] || p.userId.substring(0, 8) + '...',
                avatarUrl: userAvatars[p.userId],
                totalPoints: standing?.totalPoints ?? 0,
                correctPredictions: standing?.correctPredictions ?? 0,
                racesParticipated: standing?.racesParticipated ?? 0,
                bestFinish: standing?.bestFinish ?? null,
                lastRacePoints: standing?.lastRacePoints ?? null,
            };
        });
    }, [participants, standings, userNames, userAvatars]);

    const standingsByUserId = useMemo(
        () => new Map(standings.map((standing) => [standing.userId, standing])),
        [standings]
    );

    const driversByShortName = useMemo(
        () => new Map(legacyDrivers.map((driver) => [driver.shortName, driver])),
        [legacyDrivers]
    );

    const currentUserAvatarUrl = user?.uid ? userAvatars[user.uid] : undefined;
    const shouldPromptAvatar = Boolean(user?.uid && !currentUserAvatarUrl && participants.some((participant) => participant.userId === user.uid));

    const hasFinishedRace = useMemo(
        () => races.some((race) => race.status === 'done'),
        [races]
    );

    // Filter players based on selected subpoule
    const filteredPlayers = useMemo(() => {
        if (!selectedSubpoule) return players;
        const subpoule = subLeagues.find(sp => sp.id === selectedSubpoule);
        if (!subpoule) return players;
        return players.filter(p => subpoule.memberIds.includes(p.id));
    }, [selectedSubpoule, players, subLeagues]);

    // Sort filtered players by penalty points (lower is better)
    const sortedPlayers = useMemo(() => {
        return [...filteredPlayers].sort((a, b) => a.totalPoints - b.totalPoints);
    }, [filteredPlayers]);

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: "position",
                header: "#",
                size: 40, // Same width as avatar column (40px)
                cell: (info) => {
                    const position = info.row.index + 1;
                    const getPositionStyle = () => {
                        if (position === 1) return "bg-gradient-to-r from-yellow-500 to-yellow-400 text-black";
                        if (position === 2) return "bg-gradient-to-r from-gray-400 to-gray-300 text-black";
                        if (position === 3) return "bg-gradient-to-r from-amber-700 to-amber-600 text-white";
                        return "bg-gray-700 text-white";
                    };
                    return (
                        <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-black text-sm ${getPositionStyle()}`}>
                            {position}
                        </span>
                    );
                },
            }),
            columnHelper.accessor("avatarUrl", {
                header: "",
                size: 40, // Slightly larger to accommodate 10x10 avatar
                cell: (info) => {
                    const avatarUrl = info.getValue();
                    if (avatarUrl) {
                        return (
                            <div className="w-10 h-10 rounded-full overflow-hidden">
                                <img
                                    src={avatarUrl}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        );
                    }
                    return (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                            {info.row.original.name.charAt(0).toUpperCase()}
                        </div>
                    );
                }
            }),
            columnHelper.accessor("name", {
                header: "Speler",
                cell: (info) => {
                    const isCurrentUser = info.row.original.id === user?.uid;

                    if (!hasFinishedRace) {
                        return (
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{info.getValue()}</span>
                                {isCurrentUser && (
                                    <>
                                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                            Jij
                                        </span>
                                        {shouldPromptAvatar && (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    router.push("/account/settings");
                                                }}
                                                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-500/20"
                                            >
                                                Voeg avatar toe
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    }

                    if (isCurrentUser) {
                        return (
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{info.getValue()}</span>
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                    Jij
                                </span>
                                {shouldPromptAvatar && (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            router.push("/account/settings");
                                        }}
                                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-500/20"
                                    >
                                        Voeg avatar toe
                                    </button>
                                )}
                            </div>
                        );
                    }

                    return (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleOpenComparison(info.row.original.id);
                            }}
                            className="group flex items-center gap-2 font-semibold text-white hover:text-red-300"
                        >
                            <span className="hover:underline">{info.getValue()}</span>
                            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300 transition-colors group-hover:border-red-400 group-hover:bg-red-500/20">
                                Vergelijk
                            </span>
                        </button>
                    );
                },
            }),
            columnHelper.accessor("totalPoints", {
                header: "Strafpunten",
                cell: (info) => (
                    <span className="text-xl font-black text-red-400">{info.getValue()}</span>
                ),
            }),
            columnHelper.accessor("correctPredictions", {
                header: "Correct",
                cell: (info) => (
                    <span className="text-gray-300">{info.getValue()}</span>
                ),
            }),
            columnHelper.accessor("racesParticipated", {
                header: "Races",
                cell: (info) => (
                    <span className="text-gray-300">{info.getValue()}</span>
                ),
            }),
            columnHelper.accessor("bestFinish", {
                header: "Beste",
                cell: (info) => {
                    const value = info.getValue();
                    if (value === null) return <span className="text-gray-500">-</span>;
                    if (value === 1) return <span className="text-yellow-400 font-bold">🥇 1e</span>;
                    if (value === 2) return <span className="text-gray-300 font-bold">🥈 2e</span>;
                    if (value === 3) return <span className="text-amber-600 font-bold">🥉 3e</span>;
                    return <span className="text-gray-400">{value}e</span>;
                },
            }),
            columnHelper.accessor("lastRacePoints", {
                header: "Laatste race",
                cell: (info) => {
                    const value = info.getValue();
                    if (value === null) return <span className="text-gray-500">-</span>;
                    return <span className="text-gray-300">{value}</span>;
                },
            }),
        ],
        [hasFinishedRace, router, shouldPromptAvatar, user?.uid]
    );

    const table = useReactTable({
        data: sortedPlayers,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const handleCreatePoule = async () => {
        if (!newPouleName.trim()) return;
        setActionLoading(true);
        setActionMessage(null);

        try {
            // Get ID token for authentication
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                setActionMessage({ type: 'error', text: 'Je bent niet ingelogd' });
                setActionLoading(false);
                return;
            }

            const response = await fetch('/api/f1/subleagues', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    name: newPouleName.trim(),
                    isPublic: newPouleIsPublic,
                    description: newPouleDescription.trim() || undefined,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setActionMessage({ type: 'success', text: `Poule "${newPouleName}" aangemaakt! Code: ${data.data.code}` });
                setNewPouleName("");
                setNewPouleIsPublic(false);
                setNewPouleDescription("");
                setShowCreateModal(false);
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Kon poule niet aanmaken' });
            }
        } catch {
            setActionMessage({ type: 'error', text: 'Netwerkfout bij aanmaken' });
        } finally {
            setActionLoading(false);
            setTimeout(() => setActionMessage(null), 5000);
        }
    };

    const handleJoinPoule = async () => {
        if (!joinCode.trim()) return;
        setActionLoading(true);
        setActionMessage(null);

        try {
            // Get ID token for authentication
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                setActionMessage({ type: 'error', text: 'Je bent niet ingelogd' });
                setActionLoading(false);
                return;
            }

            const response = await fetch('/api/f1/subleagues', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
            });

            const data = await response.json();

            if (data.success) {
                setActionMessage({ type: 'success', text: `Je bent toegevoegd aan "${data.data.name}"!` });
                setJoinCode("");
                setShowJoinModal(false);
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Kon niet deelnemen aan poule' });
            }
        } catch {
            setActionMessage({ type: 'error', text: 'Netwerkfout bij deelnemen' });
        } finally {
            setActionLoading(false);
            setTimeout(() => setActionMessage(null), 5000);
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    // Handle request to join a public subleague
    const handleRequestJoin = async (subLeagueId: string) => {
        setRequestingJoin(subLeagueId);
        setActionMessage(null);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                setActionMessage({ type: 'error', text: 'Je bent niet ingelogd' });
                setRequestingJoin(null);
                return;
            }

            const response = await fetch(`/api/f1/subleagues/${subLeagueId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ action: 'request' }),
            });

            const data = await response.json();

            if (data.success) {
                setActionMessage({ type: 'success', text: data.message });
                // Refresh public subleagues list
                const refreshRes = await fetch('/api/f1/subleagues?public=true');
                const refreshData = await refreshRes.json();
                if (refreshData.success) {
                    setPublicSubLeagues(refreshData.data);
                }
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Kon verzoek niet versturen' });
            }
        } catch {
            setActionMessage({ type: 'error', text: 'Netwerkfout' });
        } finally {
            setRequestingJoin(null);
            setTimeout(() => setActionMessage(null), 5000);
        }
    };

    // Handle cancel join request
    const handleCancelRequest = async (subLeagueId: string) => {
        setRequestingJoin(subLeagueId);
        setActionMessage(null);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                setActionMessage({ type: 'error', text: 'Je bent niet ingelogd' });
                setRequestingJoin(null);
                return;
            }

            const response = await fetch(`/api/f1/subleagues/${subLeagueId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ action: 'cancel' }),
            });

            const data = await response.json();

            if (data.success) {
                setActionMessage({ type: 'success', text: data.message });
                // Refresh public subleagues list
                const refreshRes = await fetch('/api/f1/subleagues?public=true');
                const refreshData = await refreshRes.json();
                if (refreshData.success) {
                    setPublicSubLeagues(refreshData.data);
                }
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Kon verzoek niet annuleren' });
            }
        } catch {
            setActionMessage({ type: 'error', text: 'Netwerkfout' });
        } finally {
            setRequestingJoin(null);
            setTimeout(() => setActionMessage(null), 5000);
        }
    };

    // Handle approve/reject pending member
    const handleMemberAction = async (action: 'approve' | 'reject', targetUserId: string) => {
        if (!managingSubLeague) return;
        setActionLoading(true);
        setActionMessage(null);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                setActionMessage({ type: 'error', text: 'Je bent niet ingelogd' });
                setActionLoading(false);
                return;
            }

            const response = await fetch(`/api/f1/subleagues/${managingSubLeague.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ action, targetUserId }),
            });

            const data = await response.json();

            if (data.success) {
                setActionMessage({ type: 'success', text: data.message });
                // Refresh the managing subleague data
                const refreshRes = await fetch(`/api/f1/subleagues/${managingSubLeague.id}`);
                const refreshData = await refreshRes.json();
                if (refreshData.success) {
                    setManagingSubLeague(refreshData.data);
                }
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Actie mislukt' });
            }
        } catch {
            setActionMessage({ type: 'error', text: 'Netwerkfout' });
        } finally {
            setActionLoading(false);
            setTimeout(() => setActionMessage(null), 5000);
        }
    };

    const handleDeletePoule = async () => {
        if (!managingSubLeague) return;
        if (user?.uid !== managingSubLeague.createdBy) return;
        if (!confirm(`Weet je zeker dat je de poule "${managingSubLeague.name}" wilt verwijderen? Dit kan niet ongedaan worden.`)) return;

        setActionLoading(true);
        setActionMessage(null);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                setActionMessage({ type: 'error', text: 'Je bent niet ingelogd' });
                return;
            }

            const response = await fetch(`/api/f1/subleagues/${managingSubLeague.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });
            const data = await response.json();

            if (data.success) {
                setActionMessage({ type: 'success', text: 'Poule verwijderd' });
                if (selectedSubpoule === managingSubLeague.id) {
                    handleSubpouleChange(null);
                }
                setManagingSubLeague(null);
                // Refresh lists (public browse + page state)
                if (showBrowseModal) {
                    try {
                        const refreshRes = await fetch('/api/f1/subleagues?public=true');
                        const refreshData = await refreshRes.json();
                        if (refreshData.success) {
                            setPublicSubLeagues(refreshData.data);
                        }
                    } catch {
                        // No-op: keep existing public list
                    }
                }
                router.refresh();
            } else {
                setActionMessage({ type: 'error', text: data.error || 'Verwijderen mislukt' });
            }
        } catch {
            setActionMessage({ type: 'error', text: 'Netwerkfout' });
        } finally {
            setActionLoading(false);
            setTimeout(() => setActionMessage(null), 5000);
        }
    };

    // Fetch prediction when player is selected
    const handleOpenComparison = async (playerId: string) => {
        setSelectedComparePlayerId(playerId);
        setSelectedCompareRound(null);
        setCompareLoading(true);
        setComparePredictions([]);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const headers: HeadersInit = {};
            if (idToken) {
                headers.Authorization = `Bearer ${idToken}`;
            }

            const response = await fetch(`/f1/api/predictions?season=2026&userId=${playerId}`, { headers });
            const data = await response.json();
            if (data.success && data.data) {
                setComparePredictions(data.data);
            } else {
                console.error('Failed to fetch compare predictions:', data?.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Failed to fetch compare predictions:', error);
        } finally {
            setCompareLoading(false);
        }
    };

    const formatTop3 = (finishOrder: string[] | undefined): string | null => {
        if (!finishOrder || finishOrder.length === 0) return null;
        return finishOrder.slice(0, 3).map((shortName, index) => `${index + 1}. ${shortName}`).join(', ');
    };

    const comparePlayer = selectedComparePlayerId
        ? players.find((player) => player.id === selectedComparePlayerId) || null
        : null;

    useEffect(() => {
        if (!isClient || !comparePlayer) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [comparePlayer, isClient]);

    const compareRows = useMemo<CompareRaceRow[]>(() => {
        if (!comparePlayer) return [];

        const myPredictionsByRound = new Map(myPredictions.map((prediction) => [prediction.round, prediction]));
        const comparePredictionsByRound = new Map(comparePredictions.map((prediction) => [prediction.round, prediction]));
        const myStanding = user?.uid ? standingsByUserId.get(user.uid) : undefined;
        const theirStanding = standingsByUserId.get(comparePlayer.id);

        return races
            .filter((race) => race.status === 'done')
            .sort((a, b) => a.round - b.round)
            .map((race) => {
                const raceId = `2026_${String(race.round).padStart(2, '0')}`;
                const result = raceResults.find((item) => item.round === race.round);
                const myPrediction = myPredictionsByRound.get(race.round);
                const theirPrediction = comparePredictionsByRound.get(race.round);

                return {
                    raceId,
                    round: race.round,
                    raceName: race.name,
                    raceSubName: race.subName,
                    resultFinishOrder: result?.finishOrder ?? [],
                    dnfDrivers: result?.dnfDrivers ?? [],
                    resultPolePosition: result?.polePosition ?? null,
                    resultFastestLap: result?.fastestLap ?? null,
                    myPrediction: formatTop3(myPrediction?.finishOrder),
                    myFinishOrder: myPrediction?.finishOrder?.slice(0, 10) ?? [],
                    myPolePosition: myPrediction?.polePosition ?? null,
                    myFastestLap: myPrediction?.fastestLap ?? null,
                    myDnfs: [myPrediction?.dnf1, myPrediction?.dnf2].filter((value): value is string => Boolean(value)),
                    theirPrediction: formatTop3(theirPrediction?.finishOrder),
                    theirFinishOrder: theirPrediction?.finishOrder?.slice(0, 10) ?? [],
                    theirPolePosition: theirPrediction?.polePosition ?? null,
                    theirFastestLap: theirPrediction?.fastestLap ?? null,
                    theirDnfs: [theirPrediction?.dnf1, theirPrediction?.dnf2].filter((value): value is string => Boolean(value)),
                    myPoints: myStanding?.racePoints?.[raceId] ?? null,
                    theirPoints: theirStanding?.racePoints?.[raceId] ?? null,
                };
            });
    }, [comparePlayer, comparePredictions, myPredictions, raceResults, races, standingsByUserId, user?.uid]);

    useEffect(() => {
        if (compareRows.length === 0) {
            setSelectedCompareRound(null);
            return;
        }

        const hasSelectedRound = selectedCompareRound !== null
            && compareRows.some((row) => row.round === selectedCompareRound);

        if (!hasSelectedRound) {
            setSelectedCompareRound(compareRows[compareRows.length - 1].round);
        }
    }, [compareRows, selectedCompareRound]);

    const selectedCompareRow = useMemo(
        () => compareRows.find((row) => row.round === selectedCompareRound) ?? compareRows[compareRows.length - 1] ?? null,
        [compareRows, selectedCompareRound]
    );

    const buildComparisonRows = useCallback((predictionFinishOrder: string[], actualFinishOrder: string[], dnfDrivers: string[]): ComparePositionRow[] => {
        return predictionFinishOrder.slice(0, 10).map((shortName, index) => {
            const actualPos = actualFinishOrder.indexOf(shortName);
            const isDnf = dnfDrivers.includes(shortName);
            const penalty = isDnf
                ? 10
                : actualPos === -1
                    ? 10
                    : Math.min(10, Math.abs(index - actualPos));

            return {
                driver: driversByShortName.get(shortName) ?? null,
                predictedPos: index + 1,
                actualPos: actualPos === -1 ? null : actualPos + 1,
                penalty,
                isDnf,
            };
        });
    }, [driversByShortName]);

    const myComparePositionRows = useMemo(
        () => selectedCompareRow
            ? buildComparisonRows(selectedCompareRow.myFinishOrder, selectedCompareRow.resultFinishOrder, selectedCompareRow.dnfDrivers)
            : [],
        [buildComparisonRows, selectedCompareRow]
    );

    const theirComparePositionRows = useMemo(
        () => selectedCompareRow
            ? buildComparisonRows(selectedCompareRow.theirFinishOrder, selectedCompareRow.resultFinishOrder, selectedCompareRow.dnfDrivers)
            : [],
        [buildComparisonRows, selectedCompareRow]
    );

    const renderComparisonTable = (title: string, playerName: string, points: number | null, rows: ComparePositionRow[]) => (
        <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="relative px-4 py-4 border-b border-gray-700">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')]"></div>
                <div className="flex flex-col gap-2 pt-1 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                        <h3 className="text-white font-black text-base tracking-tight uppercase">{title}</h3>
                        <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                    </div>
                    <div className="text-sm text-gray-400">
                        <span className="text-white font-semibold">{playerName}</span>
                        <span className="ml-2 text-red-400 font-black">{points ?? '-'}</span>
                        <span className="ml-1">strafpunten</span>
                    </div>
                </div>
            </div>

            {rows.length > 0 ? (
                <div className="overflow-x-auto xl:overflow-visible">
                    <table className="w-full table-fixed min-w-[640px] xl:min-w-0">
                        <thead className="bg-black/30">
                            <tr>
                                <th className="w-[96px] px-3 py-3 text-left text-[11px] font-bold text-gray-300 uppercase tracking-wider">Voorspeld</th>
                                <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-300 uppercase tracking-wider">Coureur</th>
                                <th className="w-[92px] px-3 py-3 text-center text-[11px] font-bold text-gray-300 uppercase tracking-wider">Werkelijk</th>
                                <th className="w-[110px] px-3 py-3 text-center text-[11px] font-bold text-gray-300 uppercase tracking-wider">Verschil</th>
                                <th className="w-[118px] px-3 py-3 text-center text-[11px] font-bold text-gray-300 uppercase tracking-wider">Strafpunten</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {rows.map(({ driver, predictedPos, actualPos, penalty, isDnf }) => {
                                const rowColor = penalty === 0
                                    ? 'bg-green-950/35'
                                    : penalty >= 10
                                        ? 'bg-red-950/35'
                                        : 'bg-yellow-950/25';

                                return (
                                    <tr key={`${title}-${driver?.shortName ?? predictedPos}`} className={rowColor}>
                                        <td className="px-3 py-2.5">
                                            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-gray-800 border border-gray-600 px-2 text-sm font-black text-white">
                                                P{predictedPos}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {driver ? (
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span
                                                        style={{ backgroundColor: driver.teamColor || '#666' }}
                                                        className="rounded-full overflow-hidden bg-gray-200 w-[34px] h-[34px] relative shrink-0"
                                                    >
                                                        <img src={driver.image} alt={driver.lastName} className="w-[46px] h-auto absolute top-0 left-0" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="truncate font-semibold text-white text-[15px] leading-tight">{driver.firstName} {driver.lastName}</div>
                                                        <div className="text-xs text-gray-400">{driver.shortName}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-semibold text-white">Onbekende coureur</div>
                                                    <div className="text-xs text-gray-400">Niet gevonden</div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`font-semibold text-[15px] ${actualPos && actualPos <= 10 ? 'text-white' : 'text-amber-400'}`}>
                                                {isDnf ? 'DNF' : actualPos ? `P${actualPos}` : 'Niet geklasseerd'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-sm text-gray-300">
                                            {isDnf ? 'uitgevallen' : actualPos === null ? '-' : penalty === 0 ? 'exact' : `${penalty} plaatsen`}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`inline-flex min-w-11 justify-center rounded-full px-2 py-1 text-sm font-black ${
                                                penalty === 0 ? 'bg-green-600/20 text-green-300' : penalty < 10 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-600/20 text-red-300'
                                            }`}>
                                                {penalty > 0 ? `+${penalty}` : '0'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="px-4 py-8 text-center text-gray-400">Niet ingevuld</div>
            )}
        </div>
    );

    const renderDriverTag = (shortName: string | null, label: string, actualValue?: string | null) => {
        const driver = shortName ? driversByShortName.get(shortName) ?? null : null;
        const isCorrect = shortName && actualValue && shortName === actualValue;

        return (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{label}</div>
                {driver ? (
                    <div className="flex items-center gap-3">
                        <span
                            style={{ backgroundColor: driver.teamColor || '#666' }}
                            className="rounded-full overflow-hidden bg-gray-200 w-9 h-9 relative shrink-0"
                        >
                            <img src={driver.image} alt={driver.lastName} className="w-[50px] h-auto absolute top-0 left-0" />
                        </span>
                        <div className="min-w-0">
                            <div className={`font-semibold ${isCorrect ? 'text-green-300' : 'text-white'}`}>{driver.firstName} {driver.lastName}</div>
                            <div className="text-xs text-gray-400">{driver.shortName}</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">Niet ingevuld</div>
                )}
            </div>
        );
    };

    const renderDnfTags = (shortNames: string[], actualDnfs: string[]) => (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">DNFs</div>
            {shortNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {shortNames.map((shortName) => {
                        const driver = driversByShortName.get(shortName) ?? null;
                        const isCorrect = actualDnfs.includes(shortName);
                        return (
                            <div
                                key={shortName}
                                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 ${
                                    isCorrect
                                        ? 'border-green-500/40 bg-green-500/10 text-green-200'
                                        : 'border-gray-600 bg-gray-900 text-gray-200'
                                }`}
                            >
                                {driver && (
                                    <span
                                        style={{ backgroundColor: driver.teamColor || '#666' }}
                                        className="rounded-full overflow-hidden bg-gray-200 w-6 h-6 relative shrink-0"
                                    >
                                        <img src={driver.image} alt={driver.lastName} className="w-8 h-auto absolute top-0 left-0" />
                                    </span>
                                )}
                                <span className="text-sm font-medium">{shortName}</span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-sm text-gray-500">Niet ingevuld</div>
            )}
        </div>
    );

    // Mobile card component
    const PlayerCard = ({ player, position }: { player: Player; position: number }) => {
        const getPositionStyle = () => {
            if (position === 1) return "bg-gradient-to-r from-yellow-500 to-yellow-400 text-black";
            if (position === 2) return "bg-gradient-to-r from-gray-400 to-gray-300 text-black";
            if (position === 3) return "bg-gradient-to-r from-amber-700 to-amber-600 text-white";
            return "bg-gray-700 text-white";
        };

        const getBorderStyle = () => {
            if (position === 1) return "border-yellow-500";
            if (position === 2) return "border-gray-400";
            if (position === 3) return "border-amber-600";
            return "border-gray-700";
        };

        return (
            <div 
                className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getBorderStyle()} cursor-pointer hover:bg-gray-700/50 transition-colors`}
                onClick={() => {
                    if (!hasFinishedRace) return;
                    if (player.id === user?.uid) return;
                    handleOpenComparison(player.id);
                }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${getPositionStyle()}`}>
                            {position}
                        </span>
                        {player.avatarUrl ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden">
                                <img
                                    src={player.avatarUrl}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                                {player.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="font-semibold text-white">{player.name}</div>
                                {player.id === user?.uid && (
                                    <>
                                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                            Jij
                                        </span>
                                        {shouldPromptAvatar && (
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    router.push("/account/settings");
                                                }}
                                                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-500/20"
                                            >
                                                Voeg avatar toe
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="text-xs text-gray-400">{player.racesParticipated} races</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-2xl font-black text-red-400">{player.totalPoints}</div>
                            <div className="text-xs text-gray-400">strafpunten</div>
                        </div>
                        {hasFinishedRace && player.id !== user?.uid && <Users size={18} className="text-gray-500" />}
                    </div>
                </div>
                <div className="flex justify-between mt-3 pt-3 border-t border-gray-700 text-sm">
                    <div className="text-gray-400">
                        <span className="text-white font-semibold">{player.correctPredictions}</span> correct
                    </div>
                    {player.lastRacePoints !== null && (
                        <div className="text-gray-400">
                            Laatste: <span className="text-green-400 font-semibold">+{player.lastRacePoints}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (racesLoading || standingsLoading || participantsLoading || subLeaguesLoading || namesLoading || legacyDriversLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-gray-400">Laden...</div>
            </div>
        );
    }

    return (
        <>
            {/* Action message */}
            {actionMessage && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                    actionMessage.type === 'success'
                        ? 'bg-green-900/50 text-green-400 border border-green-700'
                        : 'bg-red-900/50 text-red-400 border border-red-700'
                }`}>
                    {actionMessage.text}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center">
                            <Trophy size={28} className="text-yellow-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white">Tussenstand</h1>
                            <p className="text-gray-400 text-sm">F1 2026 Voorspellingen</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowBrowseModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Search size={16} />
                            <span className="hidden sm:inline">Zoeken</span>
                        </button>
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Users size={16} />
                            <span className="hidden sm:inline">Code</span>
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors relative"
                        >
                            <Plus size={16} />
                            <span className="hidden sm:inline">Nieuw</span>
                            {totalPendingRequests > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                                    {totalPendingRequests}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Subpoule selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    <button
                        onClick={() => handleSubpouleChange(null)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                            selectedSubpoule === null
                                ? "bg-red-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                        }`}
                    >
                        <World size={16} />
                        Algemeen
                    </button>
                    {subLeagues.map((subpoule) => {
                        const isAdmin = user?.uid === subpoule.createdBy;
                        const pendingCount = subpoule.pendingMemberIds?.length || 0;
                        return (
                            <button
                                key={subpoule.id}
                                onClick={() => handleSubpouleChange(subpoule.id || null)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors relative ${
                                    selectedSubpoule === subpoule.id
                                        ? "bg-red-600 text-white"
                                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                                }`}
                            >
                                {subpoule.isPublic ? <LockOpen size={16} /> : <Lock size={16} />}
                                {subpoule.name}
                                <span className="text-xs opacity-70">({subpoule.memberIds.length})</span>
                                {isAdmin && pendingCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Selected subpoule info */}
                {selectedSubpoule && (() => {
                    const selectedLeague = subLeagues.find(sp => sp.id === selectedSubpoule);
                    const isAdmin = user?.uid === selectedLeague?.createdBy;
                    const pendingCount = selectedLeague?.pendingMemberIds?.length || 0;
                    return (
                        <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {selectedLeague?.isPublic ? <LockOpen size={20} className="text-green-400" /> : <Lock size={20} className="text-gray-400" />}
                                <div>
                                    <span className="text-white font-medium">
                                        {selectedLeague?.name}
                                    </span>
                                    {isAdmin && (
                                        <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                                            Admin
                                        </span>
                                    )}
                                    <span className="text-gray-500 text-sm ml-2">
                                        {sortedPlayers.length} deelnemers
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    <button
                                        onClick={() => setManagingSubLeague(selectedLeague || null)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors relative"
                                    >
                                        <Settings size={14} />
                                        Beheer
                                        {pendingCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                                                {pendingCount}
                                            </span>
                                        )}
                                    </button>
                                )}
                                <span className="text-gray-500 text-sm">Code:</span>
                                <code className="bg-gray-900 px-2 py-1 rounded text-sm text-gray-300">
                                    {selectedLeague?.code}
                                </code>
                                <button
                                    onClick={() => handleCopyCode(selectedLeague?.code || "")}
                                    className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                >
                                    {copiedCode === selectedLeague?.code ? (
                                        <Check size={16} className="text-green-500" />
                                    ) : (
                                        <Copy size={16} className="text-gray-400" />
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })()}

                {shouldPromptAvatar && (
                    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-gray-900 to-amber-500/5 px-4 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="text-sm font-semibold text-white">Val meer op in de F1-stand</div>
                                <div className="text-sm text-amber-100/80">Voeg een avatar toe zodat andere deelnemers je direct herkennen in het klassement en in vergelijkingen.</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push("/account/settings")}
                                className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-300 transition-colors"
                            >
                                Avatar instellen
                            </button>
                        </div>
                    </div>
                )}

                {hasFinishedRace && (
                    <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-4 py-3">
                        <div className="text-sm font-semibold text-white">Vergelijk voorspellingen per deelnemer</div>
                        <div className="text-sm text-sky-100/80">Klik op een naam in het klassement om jouw voorspellingen direct naast die van een andere deelnemer te zetten.</div>
                    </div>
                )}
            </div>

            {/* Top 3 Podium - Desktop */}
            <div className="hidden md:flex justify-center items-end gap-4 mb-8 max-w-2xl mx-auto">
                {/* P2 */}
                {sortedPlayers[1] && (
                    <div className="flex flex-col items-center flex-1">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-xl mb-2 border-4 border-gray-400">
                            {sortedPlayers[1].name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-white font-semibold text-sm mb-1">{sortedPlayers[1].name}</div>
                        <div className="text-red-400 font-black text-lg">{sortedPlayers[1].totalPoints} pt</div>
                        <div className="bg-gradient-to-b from-gray-400 to-gray-500 w-full h-20 flex items-center justify-center rounded-t-lg mt-2">
                            <span className="text-4xl font-black text-white">2</span>
                        </div>
                    </div>
                )}
                {/* P1 */}
                {sortedPlayers[0] && (
                    <div className="flex flex-col items-center flex-1">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-2xl mb-2 border-4 border-yellow-400">
                            {sortedPlayers[0].name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-white font-semibold mb-1">{sortedPlayers[0].name}</div>
                        <div className="text-red-400 font-black text-xl">{sortedPlayers[0].totalPoints} pt</div>
                        <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 w-full h-28 flex items-center justify-center rounded-t-lg mt-2">
                            <span className="text-5xl font-black text-white">1</span>
                        </div>
                    </div>
                )}
                {/* P3 */}
                {sortedPlayers[2] && (
                    <div className="flex flex-col items-center flex-1">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-lg mb-2 border-4 border-amber-600">
                            {sortedPlayers[2].name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-white font-semibold text-sm mb-1">{sortedPlayers[2].name}</div>
                        <div className="text-red-400 font-black text-lg">{sortedPlayers[2].totalPoints} pt</div>
                        <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-16 flex items-center justify-center rounded-t-lg mt-2">
                            <span className="text-3xl font-black text-white">3</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Checkered floor under podium - Desktop */}
            <div className="hidden md:block h-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] max-w-2xl mx-auto rounded-b mb-8"></div>

            {/* Mobile view - card list */}
            <div className="md:hidden flex flex-col gap-3">
                {sortedPlayers.map((player, index) => (
                    <PlayerCard key={player.id} player={player} position={index + 1} />
                ))}
            </div>

            {/* Desktop view - table */}
            <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <table className="w-full">
                    <thead className="bg-gray-900 border-b border-gray-700">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className={`py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white transition-colors ${
                                            header.id === 'position' ? 'pr-0 pl-2' : 
                                            header.id === 'avatarUrl' ? 'pr-0 pl-0' : 
                                            header.id === 'name' ? 'pr-2 pl-0' : 
                                            'px-4'
                                        }`}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-1">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                            {header.column.getIsSorted() === "asc" && <ChevronUp size={14} />}
                                            {header.column.getIsSorted() === "desc" && <ChevronDown size={14} />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {table.getRowModel().rows.map((row) => (
                            <tr 
                                key={row.id} 
                                className={hasFinishedRace ? "hover:bg-gray-700/50 transition-colors cursor-pointer" : ""}
                                onClick={() => {
                                    if (!hasFinishedRace) return;
                                    if (row.original.id === user?.uid) return;
                                    handleOpenComparison(row.original.id);
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className={`py-3 ${
                                        cell.column.id === 'position' ? 'pr-0 pl-2' : 
                                        cell.column.id === 'avatarUrl' ? 'pr-0 pl-0' : 
                                        cell.column.id === 'name' ? 'pr-2 pl-0' : 
                                        'px-4'
                                    }`}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Poule Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">Nieuwe poule aanmaken</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Naam van de poule</label>
                            <input
                                type="text"
                                value={newPouleName}
                                onChange={(e) => setNewPouleName(e.target.value)}
                                placeholder="bijv. Vrienden, Kantoor, Familie"
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        {/* Public/Private toggle */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Zichtbaarheid</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setNewPouleIsPublic(false)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                                        !newPouleIsPublic
                                            ? 'bg-red-600 border-red-600 text-white'
                                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                                    }`}
                                >
                                    <Lock size={16} />
                                    Privé
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewPouleIsPublic(true)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                                        newPouleIsPublic
                                            ? 'bg-green-600 border-green-600 text-white'
                                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                                    }`}
                                >
                                    <LockOpen size={16} />
                                    Publiek
                                </button>
                            </div>
                            <p className="text-gray-500 text-xs mt-2">
                                {newPouleIsPublic
                                    ? 'Iedereen kan je poule vinden en een verzoek sturen om deel te nemen.'
                                    : 'Alleen met de unieke code kunnen anderen deelnemen.'}
                            </p>
                        </div>

                        {/* Description (only for public) */}
                        {newPouleIsPublic && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Beschrijving (optioneel)</label>
                                <textarea
                                    value={newPouleDescription}
                                    onChange={(e) => setNewPouleDescription(e.target.value)}
                                    placeholder="Beschrijf je poule zodat anderen weten waar het over gaat..."
                                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                    rows={3}
                                    maxLength={200}
                                />
                                <p className="text-gray-500 text-xs mt-1 text-right">{newPouleDescription.length}/200</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewPouleName("");
                                    setNewPouleIsPublic(false);
                                    setNewPouleDescription("");
                                }}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleCreatePoule}
                                disabled={!newPouleName.trim() || actionLoading}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                {actionLoading ? 'Bezig...' : 'Aanmaken'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Join Poule Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">Deelnemen aan poule</h2>
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">
                            Voer de code in die je hebt ontvangen om deel te nemen aan een poule.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Poule code</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="bijv. VRD2026"
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 uppercase tracking-wider text-center text-lg font-mono"
                                maxLength={10}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleJoinPoule}
                                disabled={!joinCode.trim()}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                Deelnemen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Compare Modal */}
            {isClient && comparePlayer && createPortal(
                <div className="fixed inset-0 bg-black/70 z-[9999] p-4">
                    <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-[96vw] 2xl:max-w-[1800px] flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
                        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">Vergelijk voorspellingen</h2>
                                <p className="text-gray-400 text-sm">Per race jouw voorspelling versus een andere speler</p>
                            </div>
                            <button
                                onClick={() => setSelectedComparePlayerId(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] mb-4">
                                <div className="rounded-lg border-2 border-red-500/50 bg-gradient-to-br from-red-950/40 to-gray-900 p-4 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <div className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                                            Jij
                                        </div>
                                        <div className="text-xs font-semibold uppercase tracking-wide text-red-200">Jouw voorspellingen</div>
                                    </div>
                                    <div className="text-xl font-black text-white">{players.find((player) => player.id === user?.uid)?.name || 'Jij'}</div>
                                    <div className="text-3xl font-black text-red-400 mt-2">{standingsByUserId.get(user?.uid || '')?.totalPoints ?? 0}</div>
                                    <div className="text-sm text-gray-400">strafpunten totaal</div>
                                </div>
                                <div className="hidden md:flex items-center justify-center text-gray-500 font-bold text-2xl">VS</div>
                                <div className="rounded-lg border border-blue-500/35 bg-gradient-to-br from-blue-950/25 to-gray-900 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-blue-200/75 mb-1">Andere deelnemer</div>
                                            <div className="text-xl font-black text-white">{comparePlayer.name}</div>
                                            <div className="text-xs text-gray-400">Kies hieronder iemand anders om direct te vergelijken</div>
                                        </div>
                                        <select
                                            value={comparePlayer.id}
                                            onChange={(event) => handleOpenComparison(event.target.value)}
                                            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {players
                                                .filter((player) => player.id !== user?.uid)
                                                .map((player) => (
                                                    <option key={player.id} value={player.id}>
                                                        {player.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="text-3xl font-black text-red-400 mt-2">{standingsByUserId.get(comparePlayer.id)?.totalPoints ?? 0}</div>
                                    <div className="text-sm text-gray-400">strafpunten totaal</div>
                                </div>
                            </div>

                            {compareLoading || myPredictionsLoading || raceResultsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-gray-400">Laden...</div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Kies wedstrijd</div>
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {compareRows.map((row) => (
                                                <button
                                                    key={row.raceId}
                                                    type="button"
                                                    onClick={() => setSelectedCompareRound(row.round)}
                                                    className={`min-w-fit rounded-lg border px-3 py-2 text-left transition-colors ${
                                                        selectedCompareRow?.round === row.round
                                                            ? 'border-red-500 bg-red-600 text-white'
                                                            : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600 hover:text-white'
                                                    }`}
                                                >
                                                    <div className="text-sm font-semibold">{row.raceName}</div>
                                                    <div className={`text-xs ${selectedCompareRow?.round === row.round ? 'text-red-100' : 'text-gray-500'}`}>
                                                        Race {row.round}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedCompareRow ? (
                                        <div className="space-y-4">
                                            <div className="bg-gray-900 rounded-lg border border-gray-700 p-5">
                                                <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                                                    <div>
                                                        <div className="text-xl font-bold text-white">{selectedCompareRow.raceName}</div>
                                                        <div className="text-sm text-gray-500">{selectedCompareRow.raceSubName}</div>
                                                    </div>
                                                    <div className="text-sm text-gray-400">Race {selectedCompareRow.round}</div>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 xl:grid-cols-2">
                                                {renderComparisonTable(
                                                    'Jouw voorspelde top 10 vs einduitslag',
                                                    players.find((player) => player.id === user?.uid)?.name || 'Jij',
                                                    selectedCompareRow.myPoints,
                                                    myComparePositionRows
                                                )}
                                                {renderComparisonTable(
                                                    `${comparePlayer.name} top 10 vs einduitslag`,
                                                    comparePlayer.name,
                                                    selectedCompareRow.theirPoints,
                                                    theirComparePositionRows
                                                )}
                                            </div>

                                            <div className="grid gap-4 xl:grid-cols-2">
                                                <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-3">
                                                    <div className="text-sm font-bold uppercase tracking-wide text-white">Jouw extra voorspellingen</div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        {renderDriverTag(selectedCompareRow.myPolePosition, 'Pole position', selectedCompareRow.resultPolePosition)}
                                                        {renderDriverTag(selectedCompareRow.myFastestLap, 'Snelste ronde', selectedCompareRow.resultFastestLap)}
                                                    </div>
                                                    {renderDnfTags(selectedCompareRow.myDnfs, selectedCompareRow.dnfDrivers)}
                                                </div>

                                                <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-3">
                                                    <div className="text-sm font-bold uppercase tracking-wide text-white">{comparePlayer.name} extra voorspellingen</div>
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        {renderDriverTag(selectedCompareRow.theirPolePosition, 'Pole position', selectedCompareRow.resultPolePosition)}
                                                        {renderDriverTag(selectedCompareRow.theirFastestLap, 'Snelste ronde', selectedCompareRow.resultFastestLap)}
                                                    </div>
                                                    {renderDnfTags(selectedCompareRow.theirDnfs, selectedCompareRow.dnfDrivers)}
                                                </div>
                                            </div>

                                            <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                                                <div className="text-sm font-bold uppercase tracking-wide text-white mb-3">Officiële bonusuitslag</div>
                                                <div className="grid gap-3 md:grid-cols-3">
                                                    {renderDriverTag(selectedCompareRow.resultPolePosition, 'Pole position')}
                                                    {renderDriverTag(selectedCompareRow.resultFastestLap, 'Snelste ronde')}
                                                    {renderDnfTags(selectedCompareRow.dnfDrivers, selectedCompareRow.dnfDrivers)}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
                                            Geen afgeronde races beschikbaar om te vergelijken.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-700 px-6 py-4">
                            <button
                                onClick={() => setSelectedComparePlayerId(null)}
                                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Sluiten
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Browse Public Poules Modal */}
            {showBrowseModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700 my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Search size={20} />
                                Publieke Poules
                            </h2>
                            <button
                                onClick={() => setShowBrowseModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Search input */}
                        <div className="mb-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Zoek op naam..."
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        {/* Subleagues list */}
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {browseLoading ? (
                                <div className="text-center py-8 text-gray-400">Laden...</div>
                            ) : publicSubLeagues.filter(sl =>
                                sl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                sl.description?.toLowerCase().includes(searchQuery.toLowerCase())
                            ).length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    {searchQuery ? 'Geen poules gevonden' : 'Nog geen publieke poules beschikbaar'}
                                </div>
                            ) : (
                                publicSubLeagues
                                    .filter(sl =>
                                        sl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        sl.description?.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                    .map((sl) => {
                                        const isMember = sl.memberIds.includes(user?.uid || '');
                                        const isPending = sl.pendingMemberIds?.includes(user?.uid || '');
                                        const isCreator = sl.createdBy === user?.uid;
                                        const isFull = sl.memberIds.length >= sl.maxMembers;

                                        return (
                                            <div key={sl.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold text-white truncate">{sl.name}</h3>
                                                            {isCreator && (
                                                                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                                                                    Admin
                                                                </span>
                                                            )}
                                                        </div>
                                                        {sl.description && (
                                                            <p className="text-gray-400 text-sm mb-2 line-clamp-2">{sl.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Users size={12} />
                                                                {sl.memberIds.length}/{sl.maxMembers}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {isMember ? (
                                                            <span className="px-3 py-1.5 bg-green-900/30 text-green-400 text-sm font-medium rounded-lg">
                                                                Lid ✓
                                                            </span>
                                                        ) : isPending ? (
                                                            <button
                                                                onClick={() => handleCancelRequest(sl.id || '')}
                                                                disabled={requestingJoin === sl.id}
                                                                className="px-3 py-1.5 bg-yellow-900/30 text-yellow-400 text-sm font-medium rounded-lg hover:bg-yellow-900/50 transition-colors disabled:opacity-50"
                                                            >
                                                                {requestingJoin === sl.id ? '...' : 'Wachten ⏳'}
                                                            </button>
                                                        ) : isFull ? (
                                                            <span className="px-3 py-1.5 bg-gray-700 text-gray-400 text-sm font-medium rounded-lg">
                                                                Vol
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleRequestJoin(sl.id || '')}
                                                                disabled={requestingJoin === sl.id}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                <UserPlus size={14} />
                                                                {requestingJoin === sl.id ? '...' : 'Aanvragen'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>

                        <button
                            onClick={() => setShowBrowseModal(false)}
                            className="w-full mt-4 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Sluiten
                        </button>
                    </div>
                </div>
            )}

            {/* Admin Manage Modal */}
            {managingSubLeague && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700 my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings size={20} />
                                Beheer: {managingSubLeague.name}
                            </h2>
                            <button
                                onClick={() => setManagingSubLeague(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Poule info */}
                        <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm">Type:</span>
                                <span className={`flex items-center gap-1.5 text-sm font-medium ${managingSubLeague.isPublic ? 'text-green-400' : 'text-gray-400'}`}>
                                    {managingSubLeague.isPublic ? <LockOpen size={14} /> : <Lock size={14} />}
                                    {managingSubLeague.isPublic ? 'Publiek' : 'Privé'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm">Leden:</span>
                                <span className="text-white text-sm font-medium">{managingSubLeague.memberIds.length}/{managingSubLeague.maxMembers}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400 text-sm">Code:</span>
                                <div className="flex items-center gap-2">
                                    <code className="bg-gray-800 px-2 py-1 rounded text-sm text-gray-300">{managingSubLeague.code}</code>
                                    <button
                                        onClick={() => handleCopyCode(managingSubLeague.code)}
                                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                                    >
                                        {copiedCode === managingSubLeague.code ? (
                                            <Check size={14} className="text-green-500" />
                                        ) : (
                                            <Copy size={14} className="text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Pending requests */}
                        <div className="mb-4">
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <UserPlus size={16} className="text-yellow-400" />
                                Openstaande verzoeken
                                {(managingSubLeague.pendingMemberIds?.length || 0) > 0 && (
                                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
                                        {managingSubLeague.pendingMemberIds?.length}
                                    </span>
                                )}
                            </h3>
                            {(managingSubLeague.pendingMemberIds?.length || 0) === 0 ? (
                                <div className="text-gray-500 text-sm py-4 text-center bg-gray-900 rounded-lg">
                                    Geen openstaande verzoeken
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {managingSubLeague.pendingMemberIds?.map((userId) => (
                                        <div key={userId} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                                                    {(pendingUserNames[userId] || userId.substring(0, 1)).charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-white font-medium">
                                                    {pendingUserNames[userId] || userId.substring(0, 8) + '...'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleMemberAction('approve', userId)}
                                                    disabled={actionLoading}
                                                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                                    title="Accepteren"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleMemberAction('reject', userId)}
                                                    disabled={actionLoading}
                                                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                                    title="Afwijzen"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Current members */}
                        <div className="mb-4">
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Users size={16} className="text-gray-400" />
                                Huidige leden ({managingSubLeague.memberIds.length})
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {managingSubLeague.memberIds.map((memberId) => {
                                    const memberPlayer = players.find(p => p.id === memberId);
                                    const isCreator = memberId === managingSubLeague.createdBy;
                                    return (
                                        <div key={memberId} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                                                    {(memberPlayer?.name || memberId.substring(0, 1)).charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-white font-medium">
                                                    {memberPlayer?.name || memberId.substring(0, 8) + '...'}
                                                </span>
                                                {isCreator && (
                                                    <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded">
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            {!isCreator && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`Weet je zeker dat je ${memberPlayer?.name || 'deze gebruiker'} wilt verwijderen?`)) return;
                                                        setActionLoading(true);
                                                        try {
                                                            const idToken = await auth.currentUser?.getIdToken();
                                                            const response = await fetch(`/api/f1/subleagues/${managingSubLeague.id}`, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${idToken}`,
                                                                },
                                                                body: JSON.stringify({ action: 'remove', targetUserId: memberId }),
                                                            });
                                                            const data = await response.json();
                                                            if (data.success) {
                                                                setActionMessage({ type: 'success', text: data.message });
                                                                // Refresh the managing subleague data
                                                                const refreshRes = await fetch(`/api/f1/subleagues/${managingSubLeague.id}`);
                                                                const refreshData = await refreshRes.json();
                                                                if (refreshData.success) {
                                                                    setManagingSubLeague(refreshData.data);
                                                                }
                                                            } else {
                                                                setActionMessage({ type: 'error', text: data.error });
                                                            }
                                                        } catch {
                                                            setActionMessage({ type: 'error', text: 'Netwerkfout' });
                                                        } finally {
                                                            setActionLoading(false);
                                                            setTimeout(() => setActionMessage(null), 5000);
                                                        }
                                                    }}
                                                    disabled={actionLoading}
                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Verwijderen"
                                                >
                                                    <UserMinus size={16} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {user?.uid === managingSubLeague.createdBy && (
                            <button
                                onClick={handleDeletePoule}
                                disabled={actionLoading}
                                className="w-full mb-3 px-4 py-3 bg-red-700 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                Poule verwijderen
                            </button>
                        )}
                        <button
                            onClick={() => setManagingSubLeague(null)}
                            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Sluiten
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

// Wrap in Suspense for useSearchParams
export default function StandingsPageWrapper() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <div className="text-gray-400">Laden...</div>
            </div>
        }>
            <StandingsPage />
        </Suspense>
    );
}
