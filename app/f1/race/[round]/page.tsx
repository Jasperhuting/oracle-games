"use client";

import { useParams } from "next/navigation";
import { DriverCard } from "../../components/DriverCardComponent";
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

// Combined grid element showing actual result vs prediction with position difference
interface CombinedGridElementProps {
    actualDriver: Driver | null;
    predictedDriver: Driver | null;
    position: number;
    predictedPosition: number | null; // Position where this actual driver was predicted
}

const CombinedGridElement = ({ actualDriver, predictedDriver, position, predictedPosition }: CombinedGridElementProps) => {
    if (!actualDriver) return null;

    const isCorrect = predictedDriver?.shortName === actualDriver.shortName;
    const positionDiff = predictedPosition ? predictedPosition - position : null;

    // Podium colors for top 3
    const getPositionStyle = () => {
        if (position === 1) return 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black';
        if (position === 2) return 'bg-gradient-to-r from-gray-400 to-gray-300 text-black';
        if (position === 3) return 'bg-gradient-to-r from-amber-700 to-amber-600 text-white';
        return 'bg-gray-700 text-white';
    };

    return (
        <div className={`relative flex items-center gap-1 p-0.5 rounded ${isCorrect ? 'ring-1 ring-green-500/50' : ''}`}>
            {/* Position number */}
            <div className={`w-6 h-6 flex items-center justify-center rounded text-xs font-black ${getPositionStyle()}`}>
                {position}
            </div>

            {/* Driver slot */}
            <div className={`flex-1 h-8 rounded flex items-center gap-1.5 px-1.5 bg-gray-800 ${isCorrect ? 'bg-green-900/30' : ''}`}>
                <span
                    className="w-5 h-5 rounded-full overflow-hidden relative flex-shrink-0"
                    style={{ backgroundColor: actualDriver.teamColor }}
                >
                    <img
                        src={actualDriver.image}
                        alt={actualDriver.lastName}
                        className="w-7 h-auto absolute top-0 left-0 pointer-events-none"
                    />
                </span>
                <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-xs font-bold ${isCorrect ? 'text-green-400' : 'text-white'}`}>
                        {actualDriver.shortName}
                    </span>
                    {!isCorrect && predictedDriver && (
                        <span className="text-[9px] text-gray-500 line-through">
                            {predictedDriver.shortName}
                        </span>
                    )}
                </div>
                <div
                    className="w-0.5 h-4 rounded-full"
                    style={{ backgroundColor: actualDriver.teamColor }}
                />
            </div>

            {/* Position difference badge */}
            {positionDiff !== null && positionDiff !== 0 && (
                <div className={`absolute -right-1 -top-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${positionDiff > 0 ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                    {positionDiff > 0 ? `+${positionDiff}` : positionDiff}
                </div>
            )}
            {isCorrect && (
                <div className="absolute -right-1 -top-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-green-600 text-white">
                    ✓
                </div>
            )}
        </div>
    );
};

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
            className={`relative flex items-center gap-0.5 md:gap-1 p-0.5 rounded transition-all touch-none ${isDragOver ? 'ring-2 ring-green-400 bg-green-900/30' : ''} ${driver && !disabled ? 'cursor-grab active:cursor-grabbing' : ''} ${disabled ? 'opacity-70' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!!driver && !disabled}
            onDragStart={handleDragStart}
            onDragEnd={(e) => onDragEnd(e, position)}
        >
            {/* Position number */}
            <div className={`w-4 h-4 md:w-6 md:h-6 flex items-center justify-center rounded text-[8px] md:text-xs font-black ${getPositionStyle()}`}>
                {position}
            </div>

            {/* Driver slot */}
            <div className={`flex-1 h-5 md:h-8 rounded flex items-center gap-0.5 md:gap-1.5 px-0.5 md:px-1.5 transition-colors ${driver ? 'bg-gray-800' : 'bg-gray-800/50 border border-dashed border-gray-600'}`}>
                {driver ? (
                    <>
                        <span
                            className="w-3 h-3 md:w-5 md:h-5 rounded-full overflow-hidden relative flex-shrink-0"
                            style={{ backgroundColor: driver.teamColor }}
                        >
                            <img
                                src={driver.image}
                                alt={driver.lastName}
                                className="w-4 md:w-7 h-auto absolute top-0 left-0 pointer-events-none"
                            />
                        </span>
                        <span className="text-white text-[7px] md:text-xs font-bold pointer-events-none truncate">{driver.shortName}</span>
                        <div
                            className="w-0.5 h-3 md:h-4 rounded-full ml-auto hidden md:block"
                            style={{ backgroundColor: driver.teamColor }}
                        />
                    </>
                ) : (
                    <span className="text-gray-500 text-[7px] md:text-[10px]">Drop</span>
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
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
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
            // Don't set initial position - wait for first drag event to avoid fly-in effect
            setDragPosition(null);
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
        setDragPosition(null);
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
        setDragPosition(null);
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
            {/* F1-styled race header */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-lg p-4 md:p-6 mb-6 border border-gray-700 relative overflow-hidden">
                {/* Checkered flag pattern */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')]"></div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 md:w-14 md:h-14 bg-red-600 rounded-lg flex items-center justify-center">
                            <span className={`text-xl md:text-2xl font-black text-white z-10 absolute ${race.raceRoundPosition[0] === 'center' && race.raceRoundPosition[1] === 'center' ? 'opacity-75' : ''}`} style={{ [race.raceRoundPosition[0]]: '4px', [race.raceRoundPosition[1]]: '4px'}}>{race.round}</span>
                            {race.raceImage && <img src={race.raceImage} alt={race.name} className="w-12 h-12 absolute opacity-70 z-0" />}
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-white">{race.name}</h2>
                            <p className="text-gray-400 text-sm">{race.subName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-gray-400 text-xs uppercase tracking-wider">Datum</p>
                            <p className="text-white text-sm">{new Date(race.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {new Date(race.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        {isRaceDone ? (
                            <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Afgelopen</span>
                        ) : (
                            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Aankomend</span>
                        )}
                    </div>
                </div>
            </div>

            {isRaceDone ? (
                <div className="flex flex-col gap-6">
                    {/* F1-styled Podium */}
                    {actualResult[0] && actualResult[1] && actualResult[2] && (
                        <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                            {/* Podium header */}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                                <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-wider">Podium</h3>
                                <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                            </div>

                            <div className="flex justify-center items-end gap-2 md:gap-4 max-w-2xl mx-auto">
                                {/* P2 - Second place (left, shorter) */}
                                <div className="flex flex-col items-center flex-1 max-w-[140px] md:max-w-[180px]">
                                    <div className="w-full mb-2">
                                        <div className="bg-gray-800 rounded-t-lg p-2 text-center border-t border-x border-gray-600">
                                            <span className="text-white font-bold text-xs md:text-sm">{actualResult[1].shortName}</span>
                                            <span className="text-gray-400 text-xs ml-1 hidden md:inline">{actualResult[1].team}</span>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-b from-gray-400 to-gray-500 w-full h-20 md:h-24 flex flex-col items-center justify-center rounded-t-lg relative">
                                        <span className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">2</span>
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-gray-400" style={{ backgroundColor: actualResult[1].teamColor }}>
                                            <img src={actualResult[1].image} alt={actualResult[1].lastName} className="w-10 md:w-12 h-auto absolute top-0 left-0" />
                                        </div>
                                    </div>
                                </div>

                                {/* P1 - First place (center, tallest) */}
                                <div className="flex flex-col items-center flex-1 max-w-[160px] md:max-w-[200px]">
                                    <div className="w-full mb-2">
                                        <div className="bg-gray-800 rounded-t-lg p-2 text-center border-t border-x border-yellow-500">
                                            <span className="text-yellow-400 font-bold text-xs md:text-sm">{actualResult[0].shortName}</span>
                                            <span className="text-gray-400 text-xs ml-1 hidden md:inline">{actualResult[0].team}</span>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 w-full h-28 md:h-36 flex flex-col items-center justify-center rounded-t-lg relative">
                                        <span className="text-5xl md:text-6xl font-black text-white drop-shadow-lg">1</span>
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-yellow-400" style={{ backgroundColor: actualResult[0].teamColor }}>
                                            <img src={actualResult[0].image} alt={actualResult[0].lastName} className="w-12 md:w-14 h-auto absolute top-0 left-0" />
                                        </div>
                                    </div>
                                </div>

                                {/* P3 - Third place (right, shortest) */}
                                <div className="flex flex-col items-center flex-1 max-w-[130px] md:max-w-[160px]">
                                    <div className="w-full mb-2">
                                        <div className="bg-gray-800 rounded-t-lg p-2 text-center border-t border-x border-amber-600">
                                            <span className="text-amber-500 font-bold text-xs md:text-sm">{actualResult[2].shortName}</span>
                                            <span className="text-gray-400 text-xs ml-1 hidden md:inline">{actualResult[2].team}</span>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-b from-amber-600 to-amber-800 w-full h-16 md:h-20 flex flex-col items-center justify-center rounded-t-lg relative">
                                        <span className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">3</span>
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 md:w-9 md:h-9 rounded-full overflow-hidden border-2 border-amber-600" style={{ backgroundColor: actualResult[2].teamColor }}>
                                            <img src={actualResult[2].image} alt={actualResult[2].lastName} className="w-9 md:w-11 h-auto absolute top-0 left-0" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Checkered floor */}
                            <div className="h-3 mt-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] max-w-2xl mx-auto rounded-b"></div>
                        </div>
                    )}

                    {/* F1-styled Summary stats */}
                    {penaltyData && (
                        <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div className="bg-gradient-to-b from-gray-900 to-gray-800 border border-green-600 rounded-lg p-3 md:p-4 text-center">
                                <div className="text-2xl md:text-3xl font-black text-green-500">{penaltyData.correctPredictions}</div>
                                <div className="text-xs text-gray-400 uppercase tracking-wider">Correct</div>
                            </div>
                            <div className="bg-gradient-to-b from-gray-900 to-gray-800 border border-red-600 rounded-lg p-3 md:p-4 text-center">
                                <div className="text-2xl md:text-3xl font-black text-red-500">{penaltyData.totalPenalty}</div>
                                <div className="text-xs text-gray-400 uppercase tracking-wider">Strafpunten</div>
                            </div>
                            <div className="bg-gradient-to-b from-gray-900 to-gray-800 border border-orange-500 rounded-lg p-3 md:p-4 text-center">
                                <div className="text-2xl md:text-3xl font-black text-orange-500">{penaltyData.penalties.length}</div>
                                <div className="text-xs text-gray-400 uppercase tracking-wider">Fout</div>
                            </div>
                        </div>
                    )}

                    {/* Combined Results Grid - F1 style */}
                    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
                        {/* Header */}
                        <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-gray-700">
                            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                            <span className="text-white font-black text-lg tracking-tight uppercase">Resultaat vs Voorspelling</span>
                            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                        </div>

                        {/* Checkered flag pattern at top */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] rounded-t-lg"></div>

                        {/* Grid positions - 2 column F1-style staggered layout */}
                        <div className="flex flex-col gap-0.5">
                            {Array.from({ length: 11 }, (_, rowIndex) => {
                                const leftPosition = rowIndex * 2 + 1;
                                const rightPosition = rowIndex * 2 + 2;
                                const leftActualDriver = actualResult[leftPosition - 1];
                                const rightActualDriver = actualResult[rightPosition - 1];
                                const leftPredictedDriver = grid[leftPosition - 1];
                                const rightPredictedDriver = grid[rightPosition - 1];
                                // Where did user predict this actual driver would finish?
                                const leftPredictedPos = leftActualDriver ? grid.findIndex(d => d?.shortName === leftActualDriver.shortName) + 1 : null;
                                const rightPredictedPos = rightActualDriver ? grid.findIndex(d => d?.shortName === rightActualDriver.shortName) + 1 : null;

                                return (
                                    <div key={rowIndex} className="flex gap-1">
                                        {/* Left side - odd positions */}
                                        <div className="flex-1">
                                            <CombinedGridElement
                                                actualDriver={leftActualDriver}
                                                predictedDriver={leftPredictedDriver}
                                                position={leftPosition}
                                                predictedPosition={leftPredictedPos || null}
                                            />
                                        </div>
                                        {/* Right side - even positions (slightly offset down) */}
                                        <div className="flex-1 mt-3">
                                            <CombinedGridElement
                                                actualDriver={rightActualDriver}
                                                predictedDriver={rightPredictedDriver}
                                                position={rightPosition}
                                                predictedPosition={rightPredictedPos || null}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 pt-3 border-t border-gray-700 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white">✓</div>
                                <span>Correct</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-[8px] text-white">+3</div>
                                <span>Te laag voorspeld</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-[8px] text-white">-2</div>
                                <span>Te hoog voorspeld</span>
                            </div>
                        </div>
                    </div>

                    {/* Full results table sorted by actual ranking - desktop only */}
                    <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden mb-10">
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
                {/* Extra predictions */}
                <div className="mb-6">
                    <h3 className="font-bold text-lg mb-4 text-white">Extra voorspellingen</h3>
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

                <div className="flex flex-row gap-2 md:gap-4 justify-between items-start">
                    
                    <div className="mb-4 grid md:flex-1 grid-cols-2 content-center md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-1 md:gap-2">
                        <div className="relative hidden lg:block">
                            <div className="select-none">
                                <div className="group rounded-md p-1 pl-2 justify-center items-center content-center md:p-3 relative overflow-hidden h-[32px] lg:h-[140px]">
                                    <div
                                        style={{ background: "linear-gradient(to left, #111827, #374151)" }}
                                        className="absolute inset-0 transition-opacity duration-300 bg-gray-600"
                                    />
                                    <div className="relative z-10 flex flex-row md:flex-col min-w-0 overflow-hidden">
                                        <span className="block text-xs lg:hidden text-white font-lato font-black">TRK</span>
                                        <span className="text-md lg:text-3xl xl:text-2xl text-white font-lato font-black hidden lg:block truncate">
                                            {race.name}
                                        </span>
                                        <span className="text-md lg:text-2xl xl:text-xl text-white font-lato font-regular hidden lg:block">Circuit</span>
                                        <span className="text-xs lg:text-lg xl:text-base text-white font-lato font-regular whitespace-nowrap ml-2 md:ml-0 hidden md:block truncate">{race.subName}</span>
                                    </div>
                                    {race.raceImage && (
                                        <img
                                            className="absolute hidden lg:block top-0 z-[5] w-3/5 xl:w-4/5 right-5 opacity-70"
                                            src={race.raceImage}
                                            alt={race.name}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="relative hidden lg:block">
                            <div className="select-none">
                                <div className="group rounded-md p-1 pl-2 justify-center items-center content-center md:p-3 relative overflow-hidden h-[32px] lg:h-[140px]">
                                    <div
                                        style={{ background: "linear-gradient(to left, #1d4ed8, #0f172a)" }}
                                        className="absolute inset-0 transition-opacity duration-300 bg-gray-600"
                                    />
                                    <div className="relative z-10 flex flex-row md:flex-col min-w-0 overflow-hidden">
                                        <span className="block text-xs lg:hidden text-white font-lato font-black">INFO</span>
                                        <span className="text-md lg:text-3xl xl:text-2xl text-white font-lato font-black hidden lg:block">
                                            Ronde {race.round}
                                        </span>
                                        <span className="text-md lg:text-2xl xl:text-xl text-white font-lato font-regular hidden lg:block">
                                            {isRaceDone
                                                ? "Afgelopen"
                                                : now < new Date(race.startDate)
                                                    ? `Start over ${Math.max(0, Math.ceil((new Date(race.startDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))} d`
                                                    : "Bezig"}
                                        </span>
                                        <span className="text-xs lg:text-lg xl:text-base text-white font-lato font-regular whitespace-nowrap ml-2 md:ml-0 hidden md:block">
                                            {new Date(race.startDate).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                                            {" - "}
                                            {new Date(race.endDate).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                        className={`select-none transition-opacity duration-200 cursor-grab active:cursor-grabbing touch-none h-full ${isOnGrid ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'} ${isDragging ? 'opacity-50' : ''}`}
                                    >
                                        <div className="pointer-events-none h-full">
                                            <DriverCard driver={driver} />
                                        </div>
                                    </div>
                                    {gridPosition && (
                                        <div className="absolute right-1 bottom-1 md:top-1 md:bottom-auto lg:bottom-3 lg:top-auto lg:right-3 z-10 bg-white text-gray-600 font-lato font-black text-xs md:text-xs lg:text-xl xl:text-xl px-1 md:px-1 py-0 md:py-0 xl:py-1 rounded-lg shadow-2xl">
                                            P{gridPosition}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                    </div>
               
                    

                    <div ref={gridRef} className="rounded-lg min-w-[180px] flex-1 md:min-w-[340px] md:max-w-[380px] mb-4 relative bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-2 md:p-4 h-fit shadow-xl border border-gray-700 flex-shrink-0" title="grid">
                        {/* Header with F1 logo style */}
                        <div className="flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-4 pb-2 md:pb-3 border-b border-gray-700">
                            <div className="w-0.5 md:w-1 h-4 md:h-6 bg-red-600 rounded-full"></div>
                            <span className="text-white font-black text-[10px] md:text-lg tracking-tight uppercase">Grid</span>
                            <div className="w-0.5 md:w-1 h-4 md:h-6 bg-red-600 rounded-full"></div>
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
                                        <div className="flex-1 mt-1.5 md:mt-3">
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

                        {/* Finish line at bottom - hidden on mobile */}
                        <div className="hidden md:flex mt-4 pt-3 border-t border-gray-700 items-center justify-center">
                            <span className="text-gray-500 text-xs uppercase tracking-wider">Finish Line</span>
                        </div>
                        <div className="hidden md:block h-2 mt-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] rounded-b"></div>
                    </div>
                </div>
                      {/* F1-styled info bar with actions */}
                <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-lg p-3 md:p-4 mb-6 border border-gray-700">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-8 bg-red-600 rounded-full hidden md:block"></div>
                            <p className="text-gray-300 text-sm md:text-base">
                                <span className="text-white font-semibold">Tip:</span> Sleep de coureurs naar de startgrid om je voorspelling te maken.
                            </p>
                        </div>
                        {!isRaceDone && (
                            <div className="flex gap-2 md:gap-3">
                                <button
                                    onClick={() => setGrid(Array(22).fill(null))}
                                    className="flex-1 md:flex-none px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={handleSavePrediction}
                                    className="flex-1 md:flex-none px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Opslaan
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                </>
            )}

          

            {draggingDriverData && draggedFromGrid !== null && dragPosition && (
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
