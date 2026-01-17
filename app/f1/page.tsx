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
                    <span className="text-sm bg-gray-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center tabular-nums font-bold">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("race.name", {
                header: "Race",
                cell: (info) => (
                    <div className="flex flex-col">
                        <span className="font-semibold">{info.getValue()}</span>
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
                        <span className="text-sm text-gray-600">
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
                            <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                <Check size={16} /> Afgelopen
                            </span>
                        );
                    } else if (status === "open") {
                        return (
                            <span className="inline-flex items-center gap-1 text-orange-500 text-sm">
                                <Clock size={16} /> Bezig
                            </span>
                        );
                    } else {
                        return (
                            <span className="inline-flex items-center gap-1 text-blue-500 text-sm">
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
                        return <span className="text-sm">{prediction}</span>;
                    } else if (status === "upcoming") {
                        return (
                            <Link
                                href={`/f1/race/${info.row.original.race.round}`}
                                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 text-sm"
                            >
                                <Edit size={16} /> Invullen
                            </Link>
                        );
                    } else if (status === "done") {
                        return <span className="text-gray-400 text-sm">Niet ingevuld</span>;
                    } else {
                        return (
                            <Link
                                href={`/f1/race/${info.row.original.race.round}`}
                                className="inline-flex items-center gap-1 text-orange-500 hover:text-orange-700 text-sm"
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
                        return <span className="text-sm">{result}</span>;
                    } else if (status === "done") {
                        return <span className="text-gray-400 text-sm">Wachten op uitslag</span>;
                    } else {
                        return <span className="text-gray-300 text-sm">-</span>;
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
                            <span className={`font-bold text-sm ${points > 0 ? "text-green-600" : "text-gray-500"}`}>
                                {points}
                            </span>
                        );
                    } else if (status === "done") {
                        return <span className="text-gray-400 text-sm">-</span>;
                    } else {
                        return <span className="text-gray-300 text-sm">-</span>;
                    }
                },
            }),
            columnHelper.display({
                id: "actions",
                header: "",
                cell: (info) => (
                    <Link
                        href={`/f1/race/${info.row.original.race.round}`}
                        className="text-blue-500 hover:text-blue-700 text-sm"
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

    return (
        <>
            <h1 className="text-3xl font-bold mb-6">F1 2026 Voorspellingen</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Totaal punten</div>
                    <div className="text-3xl font-bold text-green-600">{totalPoints}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Races afgerond</div>
                    <div className="text-3xl font-bold">{completedRaces} / {races2026.length}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Voorspellingen ingevuld</div>
                    <div className="text-3xl font-bold">{predictedRaces} / {races2026.length}</div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700"
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
                    <tbody className="divide-y divide-gray-100">
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
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
