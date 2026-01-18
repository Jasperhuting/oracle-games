"use client";

import { useParams } from "next/navigation";
import { DriverCard } from "../../components/DriverCardComponent";
import { Button } from "@/components/Button";
import { useState, useRef, useEffect } from "react";
import { Driver, races2026, drivers } from "../../data";
import Link from "next/link";

// Compact driver picker for F1 cards
const F1DriverPicker = ({
    drivers,
    value,
    onChange,
    placeholder = "Selecteer coureur",
    excludeDrivers = [],
    theme = "dark"
}: {
    drivers: Driver[];
    value: string | null;
    onChange: (shortName: string | null) => void;
    placeholder?: string;
    excludeDrivers?: string[];
    theme?: "dark" | "purple" | "red";
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredDrivers = drivers
        .filter(d => !excludeDrivers.includes(d.shortName))
        .filter(d =>
            d.firstName.toLowerCase().includes(search.toLowerCase()) ||
            d.lastName.toLowerCase().includes(search.toLowerCase()) ||
            d.shortName.toLowerCase().includes(search.toLowerCase())
        );

    const selectedDriver = value ? drivers.find(d => d.shortName === value) : null;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const driverData = e.dataTransfer.getData("application/json");
        if (driverData) {
            try {
                const droppedDriver: Driver = JSON.parse(driverData);
                // Check if driver is not excluded
                if (!excludeDrivers.includes(droppedDriver.shortName)) {
                    onChange(droppedDriver.shortName);
                }
            } catch {
                // Invalid data, ignore
            }
        }
    };

    const bgColor = theme === "purple" ? "bg-gray-800" : theme === "red" ? "bg-red-950" : "bg-gray-800";
    const borderColor = theme === "purple" ? "border-gray-700" : theme === "red" ? "border-red-800" : "border-gray-700";
    const focusRing = theme === "purple" ? "ring-purple-500" : theme === "red" ? "ring-red-500" : "ring-gray-500";
    const dragOverColor = theme === "purple" ? "ring-purple-400 bg-purple-900/50" : theme === "red" ? "ring-red-400 bg-red-900/50" : "ring-yellow-400 bg-yellow-900/30";

    return (
        <div
            ref={containerRef}
            className="relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {selectedDriver ? (
                <div className={`flex items-center gap-2 ${bgColor} rounded px-2 py-1.5 h-[38px] ${isDragOver ? `ring-2 ${dragOverColor}` : ''}`}>
                    <span className="w-6 h-6 rounded-full overflow-hidden relative flex-shrink-0" style={{ backgroundColor: selectedDriver.teamColor }}>
                        <img src={selectedDriver.image} alt={selectedDriver.lastName} className="w-8 h-auto absolute top-0 left-0" />
                    </span>
                    <span className="text-white text-sm font-bold">{selectedDriver.shortName}</span>
                    <span className="text-gray-400 text-xs truncate">{selectedDriver.lastName}</span>
                    <button
                        onClick={() => onChange(null)}
                        className="ml-auto text-gray-400 hover:text-white flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>
            ) : (
                <div className={`relative ${isDragOver ? `ring-2 ${dragOverColor} rounded` : ''}`}>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        placeholder={placeholder}
                        className={`w-full px-2 py-1.5 ${bgColor} text-white border ${borderColor} rounded text-sm focus:outline-none focus:ring-2 ${focusRing} h-[38px] ${isDragOver ? 'pointer-events-none' : ''}`}
                    />
                    {isDragOver && (
                        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50 pointer-events-none">
                            <span className="text-white text-xs font-bold">Drop hier</span>
                        </div>
                    )}
                </div>
            )}
            {isOpen && !selectedDriver && !isDragOver && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                    {filteredDrivers.length === 0 ? (
                        <div className="px-3 py-2 text-gray-400 text-sm">Geen resultaten</div>
                    ) : (
                        filteredDrivers.map((driver) => (
                            <button
                                key={driver.shortName}
                                onClick={() => {
                                    onChange(driver.shortName);
                                    setIsOpen(false);
                                    setSearch("");
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 text-left"
                            >
                                <span className="w-6 h-6 rounded-full overflow-hidden relative flex-shrink-0" style={{ backgroundColor: driver.teamColor }}>
                                    <img src={driver.image} alt={driver.lastName} className="w-8 h-auto absolute top-0 left-0" />
                                </span>
                                <span className="text-white text-sm">{driver.firstName}</span>
                                <span className="text-gray-400 text-sm">{driver.lastName}</span>
                                <span className="text-gray-500 text-xs ml-auto">{driver.team}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

interface StartingGridElementProps {
    driver: Driver | null;
    even: boolean;
    position: number;
    onDrop: (position: number, driver: Driver) => void;
    onDragStart: (position: number, e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent, position: number) => void;
    disabled?: boolean;
}

const StartingGridElement = ({ driver, even, position, onDrop, onDragStart, onDragEnd, disabled }: StartingGridElementProps) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragOver(false);
        const driverData = e.dataTransfer.getData("application/json");
        if (driverData) {
            const droppedDriver: Driver = JSON.parse(driverData);
            onDrop(position, droppedDriver);
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (disabled) return;
        if (driver) {
            e.dataTransfer.setData("application/json", JSON.stringify(driver));
            onDragStart(position, e);

            const emptyImg = document.createElement('img');
            emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(emptyImg, 0, 0);
        }
    };

    // Podium colors for top 3
    const getPositionStyle = () => {
        if (position === 1) return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black';
        if (position === 2) return 'bg-gradient-to-r from-gray-400 to-gray-300 text-black';
        if (position === 3) return 'bg-gradient-to-r from-amber-700 to-amber-600 text-white';
        return 'bg-gray-700 text-white';
    };

    return (
        <div
            className={`relative flex items-center gap-1 p-0.5 rounded transition-all ${isDragOver ? 'ring-2 ring-green-400 bg-green-900/30' : ''} ${driver && !disabled ? 'cursor-grab active:cursor-grabbing' : ''} ${disabled ? 'opacity-70' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!!driver && !disabled}
            onDragStart={handleDragStart}
            onDragEnd={(e) => onDragEnd(e, position)}
        >
            {/* Position number */}
            <div className={`w-6 h-6 flex items-center justify-center rounded text-xs font-black ${getPositionStyle()}`}>
                {position}
            </div>

            {/* Driver slot */}
            <div className={`flex-1 h-8 rounded flex items-center gap-1.5 px-1.5 transition-colors ${driver ? 'bg-gray-800' : 'bg-gray-800/50 border border-dashed border-gray-600'}`}>
                {driver ? (
                    <>
                        <span
                            className="w-5 h-5 rounded-full overflow-hidden relative flex-shrink-0"
                            style={{ backgroundColor: driver.teamColor }}
                        >
                            <img
                                src={driver.image}
                                alt={driver.lastName}
                                className="w-7 h-auto absolute top-0 left-0 pointer-events-none"
                            />
                        </span>
                        <span className="text-white text-xs font-bold pointer-events-none">{driver.shortName}</span>
                        <div
                            className="w-0.5 h-4 rounded-full ml-auto"
                            style={{ backgroundColor: driver.teamColor }}
                        />
                    </>
                ) : (
                    <span className="text-gray-500 text-[10px]">Drop</span>
                )}
            </div>
        </div>
    );
};

export default function RacePage() {
    const params = useParams();
    const round = parseInt(params.round as string);
    const race = races2026.find(r => r.round === round);

    const now = new Date();
    const raceEndDate = race ? new Date(race.endDate) : now;
    const isRaceDone = raceEndDate < now;

    // Mock predictions for testing - round 0
    const getMockPrediction = (raceRound: number): (Driver | null)[] => {
        if (raceRound === 0) {
            // Mock prediction: VER, NOR, LEC, HAM, PIA, RUS, SAI, ALO, etc.
            const predictionOrder = ['VER', 'NOR', 'LEC', 'HAM', 'PIA', 'RUS', 'SAI', 'ALO', 'GAS', 'STR', 'HUL', 'BOR', 'OCO', 'BEA', 'ANT', 'LAW', 'LIN', 'HAD', 'COL', 'PER', 'BOT', 'ALB'];
            return predictionOrder.map(shortName => drivers.find(d => d.shortName === shortName) || null);
        }
        return Array(22).fill(null);
    };

    // Mock actual results for testing - round 0
    const getMockResult = (raceRound: number): (Driver | null)[] => {
        if (raceRound === 0) {
            // Mock result: NOR wins, VER second, HAM third (different from prediction)
            const resultOrder = ['NOR', 'VER', 'HAM', 'LEC', 'RUS', 'PIA', 'ALO', 'SAI', 'GAS', 'STR', 'OCO', 'HUL', 'BOR', 'BEA', 'ANT', 'LAW', 'LIN', 'HAD', 'COL', 'PER', 'BOT', 'ALB'];
            return resultOrder.map(shortName => drivers.find(d => d.shortName === shortName) || null);
        }
        return Array(22).fill(null);
    };

    const [grid, setGrid] = useState<(Driver | null)[]>(() => getMockPrediction(round));
    const actualResult = getMockResult(round);

    // Extra predictions
    const [fastestLap, setFastestLap] = useState<string | null>(null);
    const [polePosition, setPolePosition] = useState<string | null>(null);
    const [dnf1, setDnf1] = useState<string | null>(null);
    const [dnf2, setDnf2] = useState<string | null>(null);

    const [draggedFromGrid, setDraggedFromGrid] = useState<number | null>(null);
    const [draggingDriver, setDraggingDriver] = useState<string | null>(null);
    const [draggingDriverData, setDraggingDriverData] = useState<Driver | null>(null);
    const [isOutsideGrid, setIsOutsideGrid] = useState(false);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (draggedFromGrid === null) return;

        const handleDrag = (e: DragEvent) => {
            if (e.clientX === 0 && e.clientY === 0) return;

            setDragPosition({ x: e.clientX, y: e.clientY });

            if (gridRef.current) {
                const rect = gridRef.current.getBoundingClientRect();
                const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom;
                setIsOutsideGrid(!isInside);
            }
        };

        document.addEventListener('drag', handleDrag);
        return () => document.removeEventListener('drag', handleDrag);
    }, [draggedFromGrid]);

    const handleDropOnGrid = (position: number, droppedDriver: Driver) => {
        setGrid((prevGrid) => {
            const newGrid = [...prevGrid];
            const existingDriver = newGrid[position - 1];

            if (draggedFromGrid !== null) {
                newGrid[draggedFromGrid - 1] = existingDriver;
            }

            newGrid[position - 1] = droppedDriver;
            return newGrid;
        });
        setDraggedFromGrid(null);
        setDraggingDriver(null);
    };

    const handleDragStartFromGrid = (position: number, e: React.DragEvent) => {
        setDraggedFromGrid(position);
        const driver = grid[position - 1];
        if (driver) {
            setDraggingDriver(driver.shortName);
            setDraggingDriverData(driver);
            setIsOutsideGrid(false);
            // Set initial position immediately to prevent "fly-in" effect
            setDragPosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleDragStartFromCard = (e: React.DragEvent, driver: Driver) => {
        e.dataTransfer.setData("application/json", JSON.stringify(driver));
        setDraggedFromGrid(null);
        setDraggingDriver(driver.shortName);

        const dragImage = document.createElement('div');
        dragImage.textContent = driver.shortName;
        dragImage.style.cssText = `
            background: linear-gradient(to right, ${driver.teamColor || '#666'}, ${driver.teamColorAlt || '#333'});
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 18px;
            position: absolute;
            top: -1000px;
            left: -1000px;
        `;
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 40, 20);
        setTimeout(() => document.body.removeChild(dragImage), 0);
    };

    const handleDragEnd = () => {
        setDraggingDriver(null);
        setDraggedFromGrid(null);
        setDraggingDriverData(null);
        setIsOutsideGrid(false);
    };

    const handleGridDragEnd = (e: React.DragEvent, position: number) => {
        if (e.dataTransfer.dropEffect === 'none') {
            setGrid((prevGrid) => {
                const newGrid = [...prevGrid];
                newGrid[position - 1] = null;
                return newGrid;
            });
        }
        setDraggingDriver(null);
        setDraggedFromGrid(null);
        setDraggingDriverData(null);
        setIsOutsideGrid(false);
    };

    const handleSavePrediction = () => {
        // TODO: Save prediction to database
        console.log("Saving prediction:", grid);
        alert("Voorspelling opgeslagen!");
    };

    // Calculate penalty points for each predicted driver
    const calculatePenalties = () => {
        if (!isRaceDone || !actualResult.some(d => d !== null)) return null;

        const penalties: { driver: Driver; predictedPos: number; actualPos: number; penalty: number }[] = [];
        let totalPenalty = 0;

        grid.forEach((predictedDriver, predictedIndex) => {
            if (!predictedDriver) return;

            const predictedPos = predictedIndex + 1;
            const actualIndex = actualResult.findIndex(d => d?.shortName === predictedDriver.shortName);
            const actualPos = actualIndex !== -1 ? actualIndex + 1 : 22; // If not found, assume last place

            const penalty = Math.abs(predictedPos - actualPos);
            totalPenalty += penalty;

            if (penalty > 0) {
                penalties.push({
                    driver: predictedDriver,
                    predictedPos,
                    actualPos,
                    penalty
                });
            }
        });

        // Sort by penalty descending
        penalties.sort((a, b) => b.penalty - a.penalty);

        return { penalties, totalPenalty, correctPredictions: grid.filter((d, i) => d && actualResult[i]?.shortName === d.shortName).length };
    };

    const penaltyData = calculatePenalties();

    if (!race) {
        return (
            <div>
                <h1 className="text-3xl font-bold mb-6">Race niet gevonden</h1>
                <Link href="/f1" className="text-blue-500 hover:underline">Terug naar overzicht</Link>
            </div>
        );
    }

    return (
        <>
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm bg-gray-600 text-white rounded-full w-8 h-8 inline-flex items-center justify-center tabular-nums font-bold">{race.round}</span>
                    <h2 className="text-2xl font-bold">{race.name}</h2>
                    {isRaceDone && <span className="bg-green-500 text-white text-sm px-3 py-1 rounded-full">Afgelopen</span>}
                    {!isRaceDone && <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full">Aankomend</span>}
                </div>
                <p className="text-gray-500 text-sm">{race.subName}</p>
                <p className="text-gray-600">{new Date(race.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} - {new Date(race.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            

            {isRaceDone ? (
                <div className="flex flex-col gap-6">
                    {/* Podium with top 3 */}
                    {actualResult[0] && actualResult[1] && actualResult[2] && (
                        <div className="mb-4">
                            <h3 className="text-xl font-bold mb-4 text-center">Podium</h3>
                            <div className="flex justify-center items-end gap-2">
                                {/* P2 - Second place (left, shorter) */}
                                <div className="flex flex-col items-center">
                                    <div className="w-40 lg:w-48">
                                        <DriverCard driver={actualResult[1]} />
                                    </div>
                                    <div className="bg-gray-300 w-full h-16 flex items-center justify-center rounded-t-lg mt-2">
                                        <span className="text-2xl font-bold text-gray-600">2</span>
                                    </div>
                                </div>

                                {/* P1 - First place (center, tallest) */}
                                <div className="flex flex-col items-center">
                                    <div className="w-44 lg:w-56">
                                        <DriverCard driver={actualResult[0]} />
                                    </div>
                                    <div className="bg-yellow-400 w-full h-24 flex items-center justify-center rounded-t-lg mt-2">
                                        <span className="text-3xl font-bold text-yellow-800">1</span>
                                    </div>
                                </div>

                                {/* P3 - Third place (right, shortest) */}
                                <div className="flex flex-col items-center">
                                    <div className="w-36 lg:w-44">
                                        <DriverCard driver={actualResult[2]} />
                                    </div>
                                    <div className="bg-amber-600 w-full h-12 flex items-center justify-center rounded-t-lg mt-2">
                                        <span className="text-xl font-bold text-amber-100">3</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Summary stats */}
                    {penaltyData && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-600">{penaltyData.correctPredictions}</div>
                                <div className="text-xs text-green-700">Correct</div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-red-600">{penaltyData.totalPenalty}</div>
                                <div className="text-xs text-red-700">Strafpunten</div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-600">{penaltyData.penalties.length}</div>
                                <div className="text-xs text-blue-700">Fout</div>
                            </div>
                        </div>
                    )}

                    {/* Full results table sorted by actual ranking */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-2 py-3 text-left text-sm font-semibold text-gray-700 w-12">Pos</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Coureur</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Team</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">#</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Voorspeld</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Straf</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {actualResult.map((driver, index) => {
                                    if (!driver) return null;
                                    const actualPos = index + 1;
                                    const predictedPos = grid.findIndex(d => d?.shortName === driver.shortName) + 1;
                                    const penalty = predictedPos > 0 ? Math.abs(actualPos - predictedPos) : 0;
                                    const isCorrect = predictedPos === actualPos;

                                    return (
                                        <tr key={driver.shortName} className={isCorrect ? 'bg-green-50' : penalty >= 5 ? 'bg-red-50' : penalty >= 3 ? 'bg-yellow-50' : ''}>
                                            <td className="px-2 py-3 w-12">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${actualPos === 1 ? 'bg-yellow-400 text-yellow-800' : actualPos === 2 ? 'bg-gray-300 text-gray-700' : actualPos === 3 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                    {actualPos}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 overflow-hidden relative">
                                                    <span style={{ backgroundColor: driver.teamColor || '#666' }} className="rounded-full overflow-hidden bg-gray-200 w-[36px] h-[36px] relative">
                                                    <img src={driver.image} alt={driver.lastName} className="w-[50px] h-auto absolute top-0 -left-0" />
                                                    </span>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{driver.firstName} {driver.lastName}</div>
                                                        <div className="text-xs text-gray-500">{driver.shortName}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="w-1 h-8 rounded"
                                                        style={{ backgroundColor: driver.teamColor || '#666' }}
                                                    />
                                                    <span>{driver.team}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-sm text-white flex justify-center items-center">
                                                {driver.numberImage ? <span className="bg-gray-300 rounded-full p-2">
                                                    <img className="w-[14px] h-[14px]" src={driver.numberImage} alt={driver.lastName} />
                                                </span> : <span className="text-xl w-[30px] tabular-nums justify-center items-center content-center flex font-bold h-[30px] p-3 font-sans rounded-full bg-gray-300">{driver.number}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {predictedPos > 0 ? (
                                                    <span className={`font-mono text-sm ${isCorrect ? 'text-green-600 font-bold' : 'text-gray-600'}`}>
                                                        P{predictedPos}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {predictedPos > 0 ? (
                                                    isCorrect ? (
                                                        <span className="text-green-600 font-bold">✓</span>
                                                    ) : (
                                                        <span className={`font-bold flex items-center justify-center gap-1 ${actualPos < predictedPos ? 'text-red-600' : 'text-green-600'}`}>
                                                            {actualPos < predictedPos ? (
                                                                <>
                                                                    <span>↑</span>
                                                                    <span>+{penalty}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>↓</span>
                                                                    <span>-{penalty}</span>
                                                                </>
                                                            )}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <>
                <div className="flex flex-row gap-4 w-full">
                <div className="bg-blue-50 flex-1 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-800">Sleep de coureurs naar de startgrid om je voorspelling te maken.</p>
                </div>
                  {!isRaceDone && (
                <div className="flex justify-end items-center content-center gap-4 mb-4">
                    <Button onClick={() => setGrid(Array(22).fill(null))}>Reset</Button>
                    <Button onClick={handleSavePrediction}>Voorspelling opslaan</Button>
                </div>
                
            )}</div>
                {/* Extra predictions */}
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-4">Extra voorspellingen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Pole Position - P1 style */}
                        <div className="bg-black rounded-lg overflow-visible">
                            <div className="flex items-stretch">
                                <div className="bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 w-16 flex flex-col items-center justify-center rounded-l-lg relative">
                                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9ImJsYWNrIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3N2Zz4=')] opacity-30 rounded-l-lg"></div>
                                    <span className="text-3xl font-black text-black drop-shadow-sm relative z-10">P1</span>
                                </div>
                                <div className="flex-1 p-3 overflow-visible">
                                    <div className="text-yellow-400 text-xs font-bold mb-2 uppercase tracking-wider">Pole Position</div>
                                    <F1DriverPicker
                                        drivers={drivers}
                                        value={polePosition}
                                        onChange={setPolePosition}
                                        theme="dark"
                                        placeholder="Selecteer coureur"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Fastest Lap - Purple style */}
                        <div className="bg-black rounded-lg overflow-visible">
                            <div className="flex items-stretch">
                                <div className="bg-purple-600 w-16 flex items-center justify-center rounded-l-lg">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                        <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
                                    </svg>
                                </div>
                                <div className="flex-1 p-3 overflow-visible">
                                    <div className="text-purple-400 text-xs font-bold mb-2 uppercase tracking-wider italic">Fastest Lap</div>
                                    <F1DriverPicker
                                        drivers={drivers}
                                        value={fastestLap}
                                        onChange={setFastestLap}
                                        theme="purple"
                                        placeholder="Selecteer coureur"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* DNF 1 - Red style */}
                        <div className="bg-red-900 rounded-lg overflow-visible">
                            <div className="flex items-stretch">
                                <div className="bg-red-600 w-16 flex items-center justify-center rounded-l-lg">
                                    <span className="text-2xl font-black text-white tracking-tighter">DNF</span>
                                </div>
                                <div className="flex-1 p-3 overflow-visible">
                                    <div className="text-red-300 text-xs font-bold mb-2 uppercase tracking-wider">Did Not Finish #1</div>
                                    <F1DriverPicker
                                        drivers={drivers}
                                        value={dnf1}
                                        onChange={setDnf1}
                                        theme="red"
                                        placeholder="Selecteer coureur"
                                        excludeDrivers={dnf2 ? [dnf2] : []}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* DNF 2 - Red style */}
                        <div className="bg-red-900 rounded-lg overflow-visible">
                            <div className="flex items-stretch">
                                <div className="bg-red-600 w-16 flex items-center justify-center rounded-l-lg">
                                    <span className="text-2xl font-black text-white tracking-tighter">DNF</span>
                                </div>
                                <div className="flex-1 p-3 overflow-visible">
                                    <div className="text-red-300 text-xs font-bold mb-2 uppercase tracking-wider">Did Not Finish #2</div>
                                    <F1DriverPicker
                                        drivers={drivers}
                                        value={dnf2}
                                        onChange={setDnf2}
                                        theme="red"
                                        placeholder="Selecteer coureur"
                                        excludeDrivers={dnf1 ? [dnf1] : []}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* For upcoming races: Driver cards + Starting grid */}
                <div className="flex flex-row gap-4">
                    <div className="flex-5/6 mb-4 grid grid-cols-1 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-2 gap-2 lg:gap-2 auto-rows-min">
                        {drivers.map((driver) => {
                            const gridIndex = grid.findIndex((gridDriver) => gridDriver?.shortName === driver.shortName);
                            const gridPosition = gridIndex !== -1 ? gridIndex + 1 : undefined;
                            const isOnGrid = gridPosition !== undefined;
                            const isDragging = draggingDriver === driver.shortName;

                            return (
                                <div key={driver.lastName} className="relative">
                                    <div
                                        draggable={!isOnGrid}
                                        onDragStart={(e) => handleDragStartFromCard(e, driver)}
                                        onDragEnd={handleDragEnd}
                                        className={`select-none transition-opacity duration-200 cursor-grab active:cursor-grabbing ${isOnGrid ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'} ${isDragging ? 'opacity-50' : ''}`}
                                    >
                                        <div className="pointer-events-none">
                                            <DriverCard driver={driver} />
                                        </div>
                                    </div>
                                    {gridPosition && (
                                        <div className="absolute right-1 bottom-1 md:top-1 md:bottom-auto lg:bottom-3 lg:top-auto lg:right-3 z-10 bg-white text-gray-600 font-nunito font-black text-xs md:text-xs lg:text-xl xl:text-xl px-1 md:px-1 py-0 md:py-0 xl:py-1 rounded-lg shadow-2xl">
                                            P{gridPosition}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div ref={gridRef} className="rounded-lg flex-1/6 min-w-[340px] max-w-[380px] mb-4 relative bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4 h-fit shadow-xl border border-gray-700" title="grid">
                        {/* Header with F1 logo style */}
                        <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-gray-700">
                            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                            <span className="text-white font-black text-lg tracking-tight uppercase">Starting Grid</span>
                            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                        </div>

                        {/* Checkered flag pattern at top */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] rounded-t-lg"></div>

                        {/* Grid positions - 2 column F1-style staggered layout */}
                        <div className="flex flex-col gap-0.5">
                            {Array.from({ length: 11 }, (_, rowIndex) => {
                                const leftPosition = rowIndex * 2 + 1; // 1, 3, 5, 7, ...
                                const rightPosition = rowIndex * 2 + 2; // 2, 4, 6, 8, ...
                                return (
                                    <div key={rowIndex} className="flex gap-1">
                                        {/* Left side - odd positions */}
                                        <div className="flex-1">
                                            <StartingGridElement
                                                driver={grid[leftPosition - 1]}
                                                even={false}
                                                position={leftPosition}
                                                onDrop={handleDropOnGrid}
                                                onDragStart={handleDragStartFromGrid}
                                                onDragEnd={handleGridDragEnd}
                                                disabled={false}
                                            />
                                        </div>
                                        {/* Right side - even positions (slightly offset down) */}
                                        <div className="flex-1 mt-3">
                                            <StartingGridElement
                                                driver={grid[rightPosition - 1]}
                                                even={true}
                                                position={rightPosition}
                                                onDrop={handleDropOnGrid}
                                                onDragStart={handleDragStartFromGrid}
                                                onDragEnd={handleGridDragEnd}
                                                disabled={false}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Finish line at bottom */}
                        <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-center">
                            <span className="text-gray-500 text-xs uppercase tracking-wider">Finish Line</span>
                        </div>
                        <div className="h-2 mt-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] rounded-b"></div>
                    </div>
                </div>
                </>
            )}

          

            {draggingDriverData && draggedFromGrid !== null && dragPosition.x > 0 && (
                <div
                    className="fixed pointer-events-none z-50 flex items-center px-4 py-2 rounded font-bold text-lg text-white"
                    style={{
                        left: dragPosition.x + 10,
                        top: dragPosition.y - 20,
                        background: `linear-gradient(to right, ${draggingDriverData.teamColor || '#666'}, ${draggingDriverData.teamColorAlt || '#333'})`,
                    }}
                >
                    <span>{draggingDriverData.shortName}</span>
                    {isOutsideGrid && (
                        <span className="ml-2 text-red-400 text-xl">✕</span>
                    )}
                </div>
            )}
        </>
    );
}
