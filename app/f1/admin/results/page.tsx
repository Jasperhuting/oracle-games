"use client";

import { useState, useEffect, useRef } from "react";
import { useF1Races, useF1LegacyDrivers } from "../../hooks";
import { F1Race, LegacyDriver } from "../../types";
import Link from "next/link";
import { ArrowLeft, Check, Trophy } from "tabler-icons-react";

type Driver = LegacyDriver;

export default function AdminResultsPage() {
    const { races, loading: racesLoading } = useF1Races(2026);
    const { drivers, loading: driversLoading } = useF1LegacyDrivers();
    
    const [selectedRace, setSelectedRace] = useState<F1Race | null>(null);
    const [resultGrid, setResultGrid] = useState<(Driver | null)[]>(Array(22).fill(null));
    const [polePosition, setPolePosition] = useState<string | null>(null);
    const [fastestLap, setFastestLap] = useState<string | null>(null);
    const [dnfDrivers, setDnfDrivers] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Position picker state
    const [activePosition, setActivePosition] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setActivePosition(null);
                setSearch("");
            }
        };
        if (activePosition !== null) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activePosition]);

    const handleSelectDriver = (position: number, driver: Driver) => {
        setResultGrid(prev => {
            const newGrid = [...prev];
            // If driver is already in grid, swap
            const existingIndex = newGrid.findIndex(d => d?.shortName === driver.shortName);
            if (existingIndex !== -1 && existingIndex !== position - 1) {
                newGrid[existingIndex] = newGrid[position - 1];
            }
            newGrid[position - 1] = driver;
            return newGrid;
        });
        setActivePosition(null);
        setSearch("");
    };

    const handleClearPosition = (position: number) => {
        setResultGrid(prev => {
            const newGrid = [...prev];
            newGrid[position - 1] = null;
            return newGrid;
        });
    };

    const toggleDnf = (shortName: string) => {
        setDnfDrivers(prev => 
            prev.includes(shortName) 
                ? prev.filter(d => d !== shortName)
                : [...prev, shortName]
        );
    };

    const handleSubmitResults = async () => {
        if (!selectedRace) return;

        const filledPositions = resultGrid.filter(d => d !== null).length;
        if (filledPositions < 22) {
            setMessage({ type: 'error', text: `Vul alle 22 posities in (${filledPositions}/22 ingevuld)` });
            return;
        }

        if (!polePosition) {
            setMessage({ type: 'error', text: 'Selecteer de pole position' });
            return;
        }

        if (!fastestLap) {
            setMessage({ type: 'error', text: 'Selecteer de snelste ronde' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const response = await fetch('/api/f1/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    season: 2026,
                    round: selectedRace.round,
                    finishOrder: resultGrid.map(d => d?.shortName || ''),
                    polePosition,
                    fastestLap,
                    dnfDrivers,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Uitslag opgeslagen en punten berekend!' });
            } else {
                setMessage({ type: 'error', text: data.error || 'Er ging iets mis' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Netwerkfout bij opslaan' });
        } finally {
            setSaving(false);
        }
    };

    const filteredDrivers = drivers.filter(d =>
        d.firstName.toLowerCase().includes(search.toLowerCase()) ||
        d.lastName.toLowerCase().includes(search.toLowerCase()) ||
        d.shortName.toLowerCase().includes(search.toLowerCase())
    );

    const getPositionStyle = (position: number) => {
        if (position === 1) return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black';
        if (position === 2) return 'bg-gradient-to-r from-gray-400 to-gray-300 text-black';
        if (position === 3) return 'bg-gradient-to-r from-amber-700 to-amber-600 text-white';
        return 'bg-gray-700 text-white';
    };

    if (racesLoading || driversLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-gray-400">Laden...</div>
            </div>
        );
    }

    // Race selection view
    if (!selectedRace) {
        const upcomingRaces = races.filter(r => r.status !== 'done');
        const completedRaces = races.filter(r => r.status === 'done');

        return (
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/f1" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <ArrowLeft size={24} className="text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Admin: Race Uitslagen</h1>
                        <p className="text-gray-400 text-sm">Selecteer een race om de uitslag in te voeren</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {upcomingRaces.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-white mb-3">Aankomende races</h2>
                            <div className="grid gap-2">
                                {upcomingRaces.map(race => (
                                    <button
                                        key={race.round}
                                        onClick={() => setSelectedRace(race)}
                                        className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-white">
                                                {race.round}
                                            </span>
                                            <div>
                                                <div className="font-semibold text-white">{race.name}</div>
                                                <div className="text-sm text-gray-400">{race.subName}</div>
                                            </div>
                                        </div>
                                        <span className="text-blue-400 text-sm">Uitslag invoeren →</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {completedRaces.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-white mb-3">Afgeronde races</h2>
                            <div className="grid gap-2">
                                {completedRaces.map(race => (
                                    <button
                                        key={race.round}
                                        onClick={() => setSelectedRace(race)}
                                        className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 bg-green-900 rounded-full flex items-center justify-center text-sm font-bold text-green-400">
                                                <Check size={16} />
                                            </span>
                                            <div>
                                                <div className="font-semibold text-white">{race.name}</div>
                                                <div className="text-sm text-gray-400">{race.subName}</div>
                                            </div>
                                        </div>
                                        <span className="text-gray-400 text-sm">Bekijken/Bewerken →</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Result entry view
    return (
        <div className="max-w-6xl mx-auto" ref={containerRef}>
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={() => setSelectedRace(null)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <ArrowLeft size={24} className="text-gray-400" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Uitslag: {selectedRace.name}</h1>
                    <p className="text-gray-400 text-sm">Ronde {selectedRace.round} - {selectedRace.subName}</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Result Grid */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Trophy size={20} className="text-yellow-400" />
                        Finish volgorde
                    </h2>
                    <div className="space-y-1">
                        {Array.from({ length: 22 }, (_, i) => i + 1).map(position => {
                            const driver = resultGrid[position - 1];
                            const isActive = activePosition === position;

                            return (
                                <div key={position} className="relative">
                                    <div
                                        onClick={() => {
                                            setActivePosition(isActive ? null : position);
                                            setSearch("");
                                        }}
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                            isActive ? 'bg-gray-700 ring-2 ring-red-500' : 'hover:bg-gray-700'
                                        }`}
                                    >
                                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${getPositionStyle(position)}`}>
                                            {position}
                                        </span>
                                        {driver ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <span
                                                    className="w-6 h-6 rounded-full overflow-hidden relative flex-shrink-0"
                                                    style={{ backgroundColor: driver.teamColor }}
                                                >
                                                    <img
                                                        src={driver.image}
                                                        alt={driver.lastName}
                                                        className="w-8 h-auto absolute top-0 left-0"
                                                    />
                                                </span>
                                                <span className="text-white text-sm font-medium">{driver.shortName}</span>
                                                <span className="text-gray-400 text-sm">{driver.lastName}</span>
                                                {dnfDrivers.includes(driver.shortName) && (
                                                    <span className="text-red-400 text-xs bg-red-900/50 px-1.5 py-0.5 rounded">DNF</span>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleClearPosition(position);
                                                    }}
                                                    className="ml-auto text-gray-500 hover:text-red-400 text-sm"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 text-sm">Klik om coureur te selecteren</span>
                                        )}
                                    </div>

                                    {/* Dropdown picker */}
                                    {isActive && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                                            <input
                                                type="text"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder="Zoek coureur..."
                                                className="w-full px-3 py-2 bg-gray-800 border-b border-gray-700 text-white text-sm focus:outline-none"
                                                autoFocus
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="max-h-48 overflow-y-auto">
                                                {filteredDrivers.map(d => (
                                                    <div
                                                        key={d.shortName}
                                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectDriver(position, d);
                                                        }}
                                                    >
                                                        <span
                                                            className="w-6 h-6 rounded-full overflow-hidden relative flex-shrink-0"
                                                            style={{ backgroundColor: d.teamColor }}
                                                        >
                                                            <img src={d.image} alt={d.lastName} className="w-8 h-auto absolute top-0 left-0" />
                                                        </span>
                                                        <span className="text-white text-sm font-medium">{d.shortName}</span>
                                                        <span className="text-gray-400 text-sm">{d.lastName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Extra info */}
                <div className="space-y-4">
                    {/* Pole Position */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-yellow-400 mb-3">Pole Position</h3>
                        <select
                            value={polePosition || ''}
                            onChange={(e) => setPolePosition(e.target.value || null)}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        >
                            <option value="">Selecteer coureur</option>
                            {drivers.map(d => (
                                <option key={d.shortName} value={d.shortName}>{d.shortName} - {d.lastName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Fastest Lap */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-purple-400 mb-3">Snelste Ronde</h3>
                        <select
                            value={fastestLap || ''}
                            onChange={(e) => setFastestLap(e.target.value || null)}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        >
                            <option value="">Selecteer coureur</option>
                            {drivers.map(d => (
                                <option key={d.shortName} value={d.shortName}>{d.shortName} - {d.lastName}</option>
                            ))}
                        </select>
                    </div>

                    {/* DNF Drivers */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-red-400 mb-3">DNF Coureurs</h3>
                        <div className="flex flex-wrap gap-2">
                            {resultGrid.filter(d => d !== null).map(driver => driver && (
                                <button
                                    key={driver.shortName}
                                    onClick={() => toggleDnf(driver.shortName)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        dnfDrivers.includes(driver.shortName)
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    {driver.shortName}
                                </button>
                            ))}
                        </div>
                        {resultGrid.filter(d => d !== null).length === 0 && (
                            <p className="text-gray-500 text-sm">Vul eerst de finish volgorde in</p>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <button
                            onClick={handleSubmitResults}
                            disabled={saving}
                            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                                saving
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-500 text-white'
                            }`}
                        >
                            {saving ? 'Opslaan...' : 'Uitslag opslaan & punten berekenen'}
                        </button>

                        {message && (
                            <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium ${
                                message.type === 'success'
                                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                                    : 'bg-red-900/50 text-red-400 border border-red-700'
                            }`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
