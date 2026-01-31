"use client";

import { useMemo, useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from "@tanstack/react-table";
import { useF1Races, useF1UserPredictions, useF1LegacyDrivers, useF1UserStanding, useF1RaceResults, useF1Participant } from "./hooks";
import { F1Race, F1Prediction, F1RaceResult, LegacyDriver } from "./types";
import Link from "next/link";
import { Check, Clock, Edit, UserPlus } from "tabler-icons-react";
import { useAuth } from "@/hooks/useAuth";

interface RaceTableRow {
    race: F1Race;
    status: "done" | "upcoming" | "open";
    prediction: string | null;
    actualResult: string | null;
    points: number | null;
}

const columnHelper = createColumnHelper<RaceTableRow>();

const F1Page = () => {
    const { user, loading: authLoading } = useAuth();
    const { races, loading: racesLoading } = useF1Races(2026);
    const { predictions, loading: predictionsLoading } = useF1UserPredictions(2026);
    const { standing, loading: standingLoading } = useF1UserStanding(2026);
    const { results: raceResults, loading: resultsLoading } = useF1RaceResults(2026);
    const { drivers } = useF1LegacyDrivers();
    const { isParticipant, loading: participantLoading } = useF1Participant(user?.uid || null, 2026);
    const [isJoining, setIsJoining] = useState(false);
    const now = new Date();

    const handleJoinF1 = async () => {
        if (!user) return;
        setIsJoining(true);
        try {
            // Get the ID token for authentication
            const idToken = await user.getIdToken();

            const response = await fetch('/api/f1/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ season: 2026 }),
            });
            const data = await response.json();
            if (!data.success) {
                alert(data.error || 'Er ging iets mis bij het aanmelden');
            }
            // The useF1Participant hook will automatically update via onSnapshot
        } catch (error) {
            console.error('Error joining F1:', error);
            alert('Er ging iets mis bij het aanmelden');
        } finally {
            setIsJoining(false);
        }
    };

    // Create a map of predictions by round
    const predictionsByRound = useMemo(() => {
        const map: Record<number, F1Prediction> = {};
        predictions.forEach(p => {
            map[p.round] = p;
        });
        return map;
    }, [predictions]);

    // Create a map of race results by round
    const resultsByRound = useMemo(() => {
        const map: Record<number, F1RaceResult> = {};
        raceResults.forEach(r => {
            map[r.round] = r;
        });
        return map;
    }, [raceResults]);

    // Helper to format top 3 drivers
    const formatTop3 = (finishOrder: string[]): string => {
        return finishOrder.slice(0, 3).map((shortName, i) => `${i + 1}. ${shortName}`).join(', ');
    };

    const tableData: RaceTableRow[] = useMemo(() => {
        return races.map((race) => {
            const raceEndDate = new Date(race.endDate);
            const raceStartDate = new Date(race.startDate);

            let status: "done" | "upcoming" | "open";
            if (race.status === "done") {
                status = "done";
            } else if (raceStartDate <= now && raceEndDate >= now) {
                status = "open";
            } else {
                status = "upcoming";
            }

            const prediction = predictionsByRound[race.round];
            const result = resultsByRound[race.round];
            const racePoints = standing?.racePoints?.[`2026_${String(race.round).padStart(2, '0')}`] ?? null;

            return {
                race,
                status,
                prediction: prediction ? formatTop3(prediction.finishOrder) : null,
                actualResult: result ? formatTop3(result.finishOrder) : null,
                points: racePoints,
            };
        });
    }, [races, predictionsByRound, resultsByRound, standing]);

    const columns = useMemo(
        () => [
            columnHelper.accessor("race.round", {
                header: "#",
                cell: (info) => (
                    <span className="text-sm bg-gray-700 text-white rounded-full w-7 h-7 inline-flex items-center justify-center tabular-nums font-bold">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("race.name", {
                header: "Race",
                cell: (info) => (
                    <div className="flex flex-col">
                        <span className="font-semibold text-white">{info.getValue()}</span>
                        <span className="text-xs text-gray-500">{info.row.original.race.subName}</span>
                    </div>
                ),
            }),
            columnHelper.accessor("race.startDate", {
                header: "Datum",
                cell: (info) => {
                    const startDate = new Date(info.getValue());
                    const endDate = new Date(info.row.original.race.endDate);
                    return (
                        <span className="text-sm text-gray-400">
                            {startDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} - {endDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                        </span>
                    );
                },
            }),
            columnHelper.accessor("status", {
                header: "Status",
                cell: (info) => {
                    const status = info.getValue();
                    if (status === "done") {
                        return (
                            <span className="inline-flex items-center gap-1 text-green-500 text-sm">
                                <Check size={16} /> Afgelopen
                            </span>
                        );
                    } else if (status === "open") {
                        return (
                            <span className="inline-flex items-center gap-1 text-orange-400 text-sm">
                                <Clock size={16} /> Bezig
                            </span>
                        );
                    } else {
                        return (
                            <span className="inline-flex items-center gap-1 text-blue-400 text-sm">
                                <Clock size={16} /> Aankomend
                            </span>
                        );
                    }
                },
            }),
            columnHelper.accessor("prediction", {
                header: "Jouw voorspelling",
                cell: (info) => {
                    const prediction = info.getValue();
                    const status = info.row.original.status;

                    if (prediction) {
                        return <span className="text-sm text-gray-300">{prediction}</span>;
                    } else if (!isParticipant) {
                        return <span className="text-gray-500 text-sm">Meld je eerst aan</span>;
                    } else if (status === "upcoming") {
                        return (
                            <Link
                                href={`/f1/race/${info.row.original.race.round}`}
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                            >
                                <Edit size={16} /> Invullen
                            </Link>
                        );
                    } else if (status === "done") {
                        return <span className="text-gray-500 text-sm">Niet ingevuld</span>;
                    } else {
                        return (
                            <Link
                                href={`/f1/race/${info.row.original.race.round}`}
                                className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm"
                            >
                                <Edit size={16} /> Nog invullen!
                            </Link>
                        );
                    }
                },
            }),
            columnHelper.accessor("actualResult", {
                header: "Uitslag",
                cell: (info) => {
                    const result = info.getValue();
                    const status = info.row.original.status;

                    if (result) {
                        return <span className="text-sm text-gray-300">{result}</span>;
                    } else if (status === "done") {
                        return <span className="text-gray-500 text-sm">Wachten op uitslag</span>;
                    } else {
                        return <span className="text-gray-600 text-sm">-</span>;
                    }
                },
            }),
            columnHelper.accessor("points", {
                header: "Punten",
                cell: (info) => {
                    const points = info.getValue();
                    const status = info.row.original.status;

                    if (points !== null) {
                        return (
                            <span className={`font-bold text-sm ${points > 0 ? "text-green-500" : "text-gray-500"}`}>
                                {points}
                            </span>
                        );
                    } else if (status === "done") {
                        return <span className="text-gray-500 text-sm">-</span>;
                    } else {
                        return <span className="text-gray-600 text-sm">-</span>;
                    }
                },
            }),
            columnHelper.display({
                id: "actions",
                header: "",
                cell: (info) => (
                    <Link
                        href={`/f1/race/${info.row.original.race.round}`}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                        Bekijken →
                    </Link>
                ),
            }),
        ],
        [isParticipant]
    );

    const table = useReactTable({
        data: tableData,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const totalPoints = tableData.reduce((sum, row) => sum + (row.points || 0), 0);
    const completedRaces = tableData.filter((row) => row.status === "done").length;
    const predictedRaces = tableData.filter((row) => row.prediction !== null).length;

    // Mobile card component for races
    const RaceCard = ({ row }: { row: RaceTableRow }) => {
        const startDate = new Date(row.race.startDate);
        const endDate = new Date(row.race.endDate);

        const getStatusBadge = () => {
            if (row.status === "done") {
                return (
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs bg-green-900/30 px-2 py-1 rounded-full">
                        <Check size={14} /> Afgelopen
                    </span>
                );
            } else if (row.status === "open") {
                return (
                    <span className="inline-flex items-center gap-1 text-orange-400 text-xs bg-orange-900/30 px-2 py-1 rounded-full">
                        <Clock size={14} /> Bezig
                    </span>
                );
            } else {
                return (
                    <span className="inline-flex items-center gap-1 text-blue-400 text-xs bg-blue-900/30 px-2 py-1 rounded-full">
                        <Clock size={14} /> Aankomend
                    </span>
                );
            }
        };

        return (
            <Link href={`/f1/race/${row.race.round}`} className="block">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:bg-gray-750 hover:border-gray-600 transition-all">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-sm bg-gray-700 text-white rounded-full w-8 h-8 flex-shrink-0 flex items-center justify-center tabular-nums font-bold">
                                {row.race.round}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white truncate">{row.race.name}</div>
                                <div className="text-xs text-gray-500 truncate">{row.race.subName}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {startDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} - {endDate.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {getStatusBadge()}
                            {row.points !== null && (
                                <span className={`text-lg font-bold ${row.points > 0 ? "text-green-500" : "text-gray-500"}`}>
                                    {row.points} pt
                                </span>
                            )}
                        </div>
                    </div>
                    {!isParticipant && !row.prediction && row.status !== "done" && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <span className="text-gray-500 text-sm">Meld je eerst aan</span>
                        </div>
                    )}
                    {isParticipant && row.status === "upcoming" && !row.prediction && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <span className="inline-flex items-center gap-1 text-blue-400 text-sm">
                                <Edit size={14} /> Voorspelling invullen
                            </span>
                        </div>
                    )}
                    {isParticipant && row.status === "open" && !row.prediction && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <span className="inline-flex items-center gap-1 text-orange-400 text-sm font-medium">
                                <Edit size={14} /> Nog invullen!
                            </span>
                        </div>
                    )}
                </div>
            </Link>
        );
    };

    const loading = authLoading || racesLoading || predictionsLoading || standingLoading || resultsLoading || participantLoading;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-gray-400">Laden...</div>
            </div>
        );
    }

    return (
        <>
            <h1 className="text-2xl text-white md:text-3xl font-bold mb-4 md:mb-6">F1 2026 Voorspellingen</h1>

            {/* Registration Banner */}
            {!isParticipant && user && (
                <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg border border-red-500 p-4 mb-4 md:mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserPlus size={20} /> Meld je aan voor F1 2026
                            </h2>
                            <p className="text-red-100 text-sm mt-1">
                                Je moet je eerst aanmelden voordat je voorspellingen kunt invullen.
                            </p>
                        </div>
                        <button
                            onClick={handleJoinF1}
                            disabled={isJoining}
                            className="bg-white text-red-600 font-semibold px-6 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isJoining ? 'Bezig...' : 'Nu aanmelden'}
                        </button>
                    </div>
                </div>
            )}

            {!user && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4 md:mb-6">
                    <p className="text-gray-300 text-center">
                        <Link href="/login" className="text-blue-400 hover:text-blue-300 underline">Log in</Link> om je aan te melden en voorspellingen in te vullen.
                    </p>
                </div>
            )}

            {isParticipant && (
                <div className="bg-green-900/30 rounded-lg border border-green-700 p-3 mb-4 md:mb-6">
                    <p className="text-green-400 text-sm flex items-center gap-2">
                        <Check size={16} /> Je bent aangemeld voor F1 2026. Veel succes met je voorspellingen!
                    </p>
                </div>
            )}

            {/* Stats cards - optimized for mobile */}
            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
                    <div className="text-xs md:text-sm text-gray-400">Totaal punten</div>
                    <div className="text-xl md:text-3xl font-bold text-green-500">{totalPoints}</div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
                    <div className="text-xs md:text-sm text-gray-400">Races</div>
                    <div className="text-xl md:text-3xl font-bold text-white">{completedRaces}/{races.length}</div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
                    <div className="text-xs md:text-sm text-gray-400">Ingevuld</div>
                    <div className="text-xl md:text-3xl font-bold text-white">{predictedRaces}/{races.length}</div>
                </div>
            </div>

            {/* Mobile view - card list */}
            <div className="md:hidden flex flex-col gap-3">
                {tableData.map((row) => (
                    <RaceCard key={row.race.round} row={row} />
                ))}
            </div>

            {/* Desktop view - table */}
            <div className="hidden md:block bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-900 border-b border-gray-700">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-3 text-left text-sm font-semibold text-gray-400"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-700/50 transition-colors">
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-4 py-3">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default F1Page;
