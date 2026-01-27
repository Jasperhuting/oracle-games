"use client";

import { useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from "@tanstack/react-table";
import { races2026, Race } from "./data";
import Link from "next/link";
import { Check, Clock, Edit } from "tabler-icons-react";

interface RaceTableRow {
    race: Race;
    status: "done" | "upcoming" | "open";
    prediction: string | null;
    actualResult: string | null;
    points: number | null;
}

const columnHelper = createColumnHelper<RaceTableRow>();

const F1Page = () => {
    const now = new Date();

    // Mock data for testing - round 0
    const mockPredictions: Record<number, string> = {
        0: "1. VER, 2. NOR, 3. LEC",
    };
    const mockResults: Record<number, string> = {
        0: "1. NOR, 2. VER, 3. HAM",
    };
    const mockPoints: Record<number, number> = {
        0: 15,
    };

    const tableData: RaceTableRow[] = useMemo(() => {
        return races2026.map((race) => {
            const raceEndDate = new Date(race.endDate);
            const raceStartDate = new Date(race.startDate);

            let status: "done" | "upcoming" | "open";
            if (raceEndDate < now) {
                status = "done";
            } else if (raceStartDate <= now && raceEndDate >= now) {
                status = "open";
            } else {
                status = "upcoming";
            }

            // Use mock data for round 0, otherwise null
            return {
                race,
                status,
                prediction: mockPredictions[race.round] ?? null,
                actualResult: mockResults[race.round] ?? null,
                points: mockPoints[race.round] ?? null,
            };
        });
    }, []);

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
        []
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
                    {row.status === "upcoming" && !row.prediction && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <span className="inline-flex items-center gap-1 text-blue-400 text-sm">
                                <Edit size={14} /> Voorspelling invullen
                            </span>
                        </div>
                    )}
                    {row.status === "open" && !row.prediction && (
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

    return (
        <>
            <h1 className="text-2xl text-white md:text-3xl font-bold mb-4 md:mb-6">F1 2026 Voorspellingen</h1>

            {/* Stats cards - optimized for mobile */}
            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
                    <div className="text-xs md:text-sm text-gray-400">Totaal punten</div>
                    <div className="text-xl md:text-3xl font-bold text-green-500">{totalPoints}</div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
                    <div className="text-xs md:text-sm text-gray-400">Races</div>
                    <div className="text-xl md:text-3xl font-bold text-white">{completedRaces}/{races2026.length}</div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
                    <div className="text-xs md:text-sm text-gray-400">Ingevuld</div>
                    <div className="text-xl md:text-3xl font-bold text-white">{predictedRaces}/{races2026.length}</div>
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
