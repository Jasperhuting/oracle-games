"use client";

import { useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import Link from "next/link";
import { Trophy, ChevronUp, ChevronDown, Users, Plus, X, Copy, Check, World } from "tabler-icons-react";

interface Player {
    id: string;
    name: string;
    avatar?: string;
    totalPoints: number;
    correctPredictions: number;
    racesParticipated: number;
    bestFinish: number | null;
    lastRacePoints: number | null;
}

interface Subpoule {
    id: string;
    name: string;
    code: string;
    memberIds: string[];
    createdBy: string;
}

// Mock data - later te vervangen met echte data uit Firestore
const mockPlayers: Player[] = [
    { id: "1", name: "Max Verstansen", totalPoints: 156, correctPredictions: 12, racesParticipated: 5, bestFinish: 1, lastRacePoints: 28 },
    { id: "2", name: "Jasper H.", totalPoints: 142, correctPredictions: 10, racesParticipated: 5, bestFinish: 1, lastRacePoints: 32 },
    { id: "3", name: "Lewis Fan", totalPoints: 128, correctPredictions: 8, racesParticipated: 5, bestFinish: 2, lastRacePoints: 18 },
    { id: "4", name: "Ferrari Lover", totalPoints: 115, correctPredictions: 7, racesParticipated: 4, bestFinish: 2, lastRacePoints: 22 },
    { id: "5", name: "McLaren Mike", totalPoints: 98, correctPredictions: 6, racesParticipated: 5, bestFinish: 3, lastRacePoints: 15 },
    { id: "6", name: "Aston Martin Anna", totalPoints: 87, correctPredictions: 5, racesParticipated: 5, bestFinish: 4, lastRacePoints: 12 },
    { id: "7", name: "Red Bull Rick", totalPoints: 76, correctPredictions: 4, racesParticipated: 4, bestFinish: 5, lastRacePoints: 8 },
    { id: "8", name: "Mercedes Mark", totalPoints: 65, correctPredictions: 3, racesParticipated: 3, bestFinish: 6, lastRacePoints: null },
];

// Mock subpoules - later te vervangen met echte data uit Firestore
const mockSubpoules: Subpoule[] = [
    { id: "sp1", name: "Vrienden", code: "VRD2026", memberIds: ["1", "2", "5", "7"], createdBy: "2" },
    { id: "sp2", name: "Kantoor", code: "KNT2026", memberIds: ["2", "3", "4", "6", "8"], createdBy: "2" },
];

const columnHelper = createColumnHelper<Player>();

const StandingsPage = () => {
    const [sorting, setSorting] = useState<SortingState>([
        { id: "totalPoints", desc: true }
    ]);
    const [selectedSubpoule, setSelectedSubpoule] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [newPouleName, setNewPouleName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Filter players based on selected subpoule
    const filteredPlayers = useMemo(() => {
        if (!selectedSubpoule) return mockPlayers;
        const subpoule = mockSubpoules.find(sp => sp.id === selectedSubpoule);
        if (!subpoule) return mockPlayers;
        return mockPlayers.filter(p => subpoule.memberIds.includes(p.id));
    }, [selectedSubpoule]);

    // Sort filtered players by points
    const sortedPlayers = useMemo(() => {
        return [...filteredPlayers].sort((a, b) => b.totalPoints - a.totalPoints);
    }, [filteredPlayers]);

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: "position",
                header: "#",
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
            columnHelper.accessor("name", {
                header: "Speler",
                cell: (info) => (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                            {info.getValue().charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{info.getValue()}</span>
                    </div>
                ),
            }),
            columnHelper.accessor("totalPoints", {
                header: "Punten",
                cell: (info) => (
                    <span className="text-xl font-black text-green-500">{info.getValue()}</span>
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
                    return <span className="text-gray-300">+{value}</span>;
                },
            }),
        ],
        []
    );

    const table = useReactTable({
        data: sortedPlayers,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const handleCreatePoule = () => {
        if (!newPouleName.trim()) return;
        // TODO: Create subpoule in Firestore
        console.log("Creating poule:", newPouleName);
        setNewPouleName("");
        setShowCreateModal(false);
    };

    const handleJoinPoule = () => {
        if (!joinCode.trim()) return;
        // TODO: Join subpoule via code in Firestore
        console.log("Joining poule with code:", joinCode);
        setJoinCode("");
        setShowJoinModal(false);
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

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
            <div className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getBorderStyle()}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${getPositionStyle()}`}>
                            {position}
                        </span>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-white">{player.name}</div>
                            <div className="text-xs text-gray-400">{player.racesParticipated} races</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-green-500">{player.totalPoints}</div>
                        <div className="text-xs text-gray-400">punten</div>
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

    return (
        <>
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
                            onClick={() => setShowJoinModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Users size={16} />
                            <span className="hidden sm:inline">Deelnemen</span>
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            <span className="hidden sm:inline">Nieuwe poule</span>
                        </button>
                    </div>
                </div>

                {/* Subpoule selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    <button
                        onClick={() => setSelectedSubpoule(null)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                            selectedSubpoule === null
                                ? "bg-red-600 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                        }`}
                    >
                        <World size={16} />
                        Algemeen
                    </button>
                    {mockSubpoules.map((subpoule) => (
                        <button
                            key={subpoule.id}
                            onClick={() => setSelectedSubpoule(subpoule.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                                selectedSubpoule === subpoule.id
                                    ? "bg-red-600 text-white"
                                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                            }`}
                        >
                            <Users size={16} />
                            {subpoule.name}
                            <span className="text-xs opacity-70">({subpoule.memberIds.length})</span>
                        </button>
                    ))}
                </div>

                {/* Selected subpoule info */}
                {selectedSubpoule && (
                    <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users size={20} className="text-gray-400" />
                            <div>
                                <span className="text-white font-medium">
                                    {mockSubpoules.find(sp => sp.id === selectedSubpoule)?.name}
                                </span>
                                <span className="text-gray-500 text-sm ml-2">
                                    {sortedPlayers.length} deelnemers
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">Code:</span>
                            <code className="bg-gray-900 px-2 py-1 rounded text-sm text-gray-300">
                                {mockSubpoules.find(sp => sp.id === selectedSubpoule)?.code}
                            </code>
                            <button
                                onClick={() => handleCopyCode(mockSubpoules.find(sp => sp.id === selectedSubpoule)?.code || "")}
                                className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                            >
                                {copiedCode === mockSubpoules.find(sp => sp.id === selectedSubpoule)?.code ? (
                                    <Check size={16} className="text-green-500" />
                                ) : (
                                    <Copy size={16} className="text-gray-400" />
                                )}
                            </button>
                        </div>
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
                        <div className="text-green-500 font-black text-lg">{sortedPlayers[1].totalPoints} pt</div>
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
                        <div className="text-green-500 font-black text-xl">{sortedPlayers[0].totalPoints} pt</div>
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
                        <div className="text-green-500 font-black text-lg">{sortedPlayers[2].totalPoints} pt</div>
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
                                        className="px-4 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white transition-colors"
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
                        <p className="text-gray-400 text-sm mb-4">
                            Maak een privé poule aan en nodig je vrienden uit met een unieke code.
                        </p>
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
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Annuleren
                            </button>
                            <button
                                onClick={handleCreatePoule}
                                disabled={!newPouleName.trim()}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                Aanmaken
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
        </>
    );
};

export default StandingsPage;
