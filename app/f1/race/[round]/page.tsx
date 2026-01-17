"use client";

import { useParams } from "next/navigation";
import { DriverCard } from "../../components/DriverCardComponent";
import { Button } from "@/components/Button";
import { useState, useRef, useEffect } from "react";
import { Driver, races2026, drivers } from "../../data";
import Link from "next/link";

interface StartingGridElementProps {
    driver: Driver | null;
    even: boolean;
    position: number;
    onDrop: (position: number, driver: Driver) => void;
    onDragStart: (position: number) => void;
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
            onDragStart(position);

            const emptyImg = document.createElement('img');
            emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(emptyImg, 0, 0);
        }
    };

    return (
        <span
            className={`xl:h-10 h-8 relative border-2 border-l-2 border-r-2 border-b-0 border-t-2 border-white ${even ? 'mt-10 lg:mt-4' : 'mb-5 mt-5 lg:mt-1 lg:mb-1'} transition-colors ${isDragOver ? 'bg-white/30 border-green-400' : ''} ${driver && !disabled ? 'cursor-grab active:cursor-grabbing' : ''} ${disabled ? 'opacity-70' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!!driver && !disabled}
            onDragStart={handleDragStart}
            onDragEnd={(e) => onDragEnd(e, position)}
        >
            <span className="text-white absolute -top-4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 xl:text-xl text-lg font-nunito font-black">{position}</span>
            {driver && (
                <span className="text-white xl:text-xl text-lg font-nunito font-black content-center flex justify-center items-center xl:mt-1 mt-0 pointer-events-none">{driver.shortName}</span>
            )}
        </span>
    );
};

export default function RacePage() {
    const params = useParams();
    const round = parseInt(params.round as string);
    const race = races2026.find(r => r.round === round);

    const now = new Date();
    const raceEndDate = race ? new Date(race.endDate) : now;
    const isRaceDone = raceEndDate < now;

    const [grid, setGrid] = useState<(Driver | null)[]>(Array(22).fill(null));
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

    const handleDragStartFromGrid = (position: number) => {
        setDraggedFromGrid(position);
        const driver = grid[position - 1];
        if (driver) {
            setDraggingDriver(driver.shortName);
            setDraggingDriverData(driver);
            setIsOutsideGrid(false);
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
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800">Deze race is al geweest. Hier zie je jouw voorspelling en de daadwerkelijke uitslag.</p>
                </div>
            ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-800">Sleep de coureurs naar de startgrid om je voorspelling te maken.</p>
                </div>
            )}

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
                                    draggable={!isOnGrid && !isRaceDone}
                                    onDragStart={(e) => handleDragStartFromCard(e, driver)}
                                    onDragEnd={handleDragEnd}
                                    className={`cursor-grab active:cursor-grabbing select-none transition-opacity duration-200 ${isOnGrid ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'} ${isDragging ? 'opacity-50' : ''} ${isRaceDone ? 'cursor-default' : ''}`}
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

                <div ref={gridRef} className="rounded-md flex-1/6 min-w-[250px] mb-4 pt-15 relative grid grid-cols-2 bg-gray-600 gap-x-8 p-8 xl:auto-rows-[70px] auto-rows-[60px] h-fit" title="grid">
                    <div className="absolute flex left-0 right-0 top-0 content-center items-center justify-center w-full z-10 text-white font-nunito font-regular text-xl px-4 py-2 rounded-lg bg-white/10">
                        {isRaceDone ? "Jouw voorspelling" : "Starting Grid"}
                    </div>
                    {Array.from({ length: 22 }, (_, index) => {
                        const position = index + 1;
                        return (
                            <StartingGridElement
                                key={index}
                                driver={grid[index]}
                                even={position % 2 === 0}
                                position={position}
                                onDrop={handleDropOnGrid}
                                onDragStart={handleDragStartFromGrid}
                                onDragEnd={handleGridDragEnd}
                                disabled={isRaceDone}
                            />
                        );
                    })}
                </div>
            </div>

            {!isRaceDone && (
                <div className="flex justify-end gap-4 mt-4">
                    <Button onClick={() => setGrid(Array(22).fill(null))}>Reset</Button>
                    <Button onClick={handleSavePrediction}>Voorspelling opslaan</Button>
                </div>
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
