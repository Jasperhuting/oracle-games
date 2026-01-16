"use client";

import { useState, useRef, useEffect } from "react";
import { DriverCard } from "./components/DriverCardComponent";
import { Button } from "@/components/Button";

export interface Driver {
    firstName: string;
    lastName: string;
    shortName: string;
    team: string;
    teamColor?: string;
    teamColorAlt?: string;
    number: number;
    numberImage?: string;
    country: string;
    image: string;
}

interface StartingGridElementProps {
    driver: Driver | null;
    even: boolean;
    position: number;
    onDrop: (position: number, driver: Driver) => void;
    onDragStart: (position: number) => void;
    onDragEnd: (e: React.DragEvent, position: number) => void;
}

export const StartingGridElement = ({ driver, even, position, onDrop, onDragStart, onDragEnd }: StartingGridElementProps) => {
    const [isDragOver, setIsDragOver] = useState(false);

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
            const droppedDriver: Driver = JSON.parse(driverData);
            onDrop(position, droppedDriver);
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (driver) {
            e.dataTransfer.setData("application/json", JSON.stringify(driver));
            onDragStart(position);

            // Hide native drag image - we use a custom overlay instead
            const emptyImg = document.createElement('img');
            emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(emptyImg, 0, 0);
        }
    };

    return (
        <span
            className={`h-10 relative border-2 border-l-2 border-r-2 border-b-0 border-t-2 border-white ${even ? 'mt-10' : 'mb-5 mt-5'} transition-colors ${isDragOver ? 'bg-white/30 border-green-400' : ''} ${driver ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!!driver}
            onDragStart={handleDragStart}
            onDragEnd={(e) => onDragEnd(e, position)}
        >
            <span className="text-white absolute -top-4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-nunito font-black">{position}</span>
            {driver && (
                <span className="text-white text-2xl font-nunito font-black content-center flex justify-center items-center mt-2 pointer-events-none">{driver.shortName}</span>
            )}
        </span>
    );
};

const F1Page = () => {


    const drivers: Driver[] = [
        {
            firstName: "Pierre",
            lastName: "Gasly",
            shortName: "GAS",
            team: "Alpine",
            teamColor: "#00A1E8",
            teamColorAlt: "#005081",
            number: 10,
            country: "fr",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/alpine/piegas01/2026alpinepiegas01numberwhitefrless.webp",
        },
        {
            firstName: "Franco",
            lastName: "Colapinto",
            shortName: "COL",
            team: "Alpine",
            teamColor: "#00A1E8",
            teamColorAlt: "#005081",
            number: 43,
            country: "ar",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/alpine/fracol01/2026alpinefracol01numberwhitefrless.webp",
        },

        {
            firstName: "Fernando",
            lastName: "Alonso",
            shortName: "ALO",
            team: "Aston Martin",
            teamColor: "#229971",
            teamColorAlt: "#00482C",
            number: 14,
            country: "es",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01numberwhitefrless.webp",
        },
        {
            firstName: "Lance",
            lastName: "Stroll",
            shortName: "STR",
            team: "Aston Martin",
            teamColor: "#229971",
            teamColorAlt: "#00482C",
            number: 18,
            country: "ca",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01numberwhitefrless.webp",
        },

        {
            firstName: "Nico",
            lastName: "Hulkenberg",
            shortName: "HUL",
            team: "Audi",
            teamColor: "#F50537",
            teamColorAlt: "#6B0015",
            number: 27,
            country: "de",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/audi/nichul01/2026audinichul01right.webp",
        },
        {
            firstName: "Gabriel",
            lastName: "Bortoleto",
            shortName: "BOR",
            team: "Audi",
            teamColor: "#F50537",
            teamColorAlt: "#6B0015",
            number: 5,
            country: "br",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp",
        },

        {
            firstName: "Sergio",
            lastName: "Perez",
            shortName: "PER",
            team: "Cadillac",
            number: 11,
            country: "mx",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp",
        },
        {
            firstName: "Valtteri",
            lastName: "Bottas",
            shortName: "BOT",
            team: "Cadillac",
            number: 77,
            country: "fi",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp",
        },

        {
            firstName: "Charles",
            lastName: "Leclerc",
            shortName: "LEC",
            team: "Ferrari",
            teamColor: "#ED1131",
            teamColorAlt: "#710006",
            number: 16,
            country: "mc",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/ferrari/chalec01/2026ferrarichalec01numberwhitefrless.webp",
        },
        {
            firstName: "Lewis",
            lastName: "Hamilton",
            shortName: "HAM",
            team: "Ferrari",
            teamColor: "#ED1131",
            teamColorAlt: "#710006",
            number: 44,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/ferrari/lewham01/2026ferrarilewham01numberwhitefrless.webp",
        },

        {
            firstName: "Esteban",
            lastName: "Ocon",
            shortName: "OCO",
            team: "Haas F1 Team",
            teamColor: "#9C9FA2",
            teamColorAlt: "#4D5052",
            number: 31,
            country: "fr",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/haas/estoco01/2026haasestoco01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/haas/estoco01/2026haasestoco01numberwhitefrless.webp",
        },
        {
            firstName: "Oliver",
            lastName: "Bearman",
            shortName: "BEA",
            team: "Haas F1 Team",
            teamColor: "#9C9FA2",
            teamColorAlt: "#4D5052",
            number: 87,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/haas/olibea01/2026haasolibea01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/haas/olibea01/2026haasolibea01numberwhitefrless.webp",
        },

        {
            firstName: "Lando",
            lastName: "Norris",
            shortName: "NOR",
            team: "McLaren",
            teamColor: "#F47600",
            teamColorAlt: "#863400",
            number: 1,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp"
        },
        {
            firstName: "Oscar",
            lastName: "Piastri",
            shortName: "PIA",
            team: "McLaren",
            teamColor: "#F47600",
            teamColorAlt: "#863400",
            number: 81,
            country: "au",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01numberwhitefrless.webp",
        },

        {
            firstName: "George",
            lastName: "Russell",
            shortName: "RUS",
            team: "Mercedes",
            teamColor: "#00D7B6",
            teamColorAlt: "#007560",
            number: 63,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mercedes/georus01/2026mercedesgeorus01numberwhitefrless.webp",
        },
        {
            firstName: "Kimi",
            lastName: "Antonelli",
            shortName: "ANT",
            team: "Mercedes",
            teamColor: "#00D7B6",
            teamColorAlt: "#007560",
            number: 12,
            country: "it",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/mercedes/andant01/2026mercedesandant01numberwhitefrless.webp",
        },

        {
            firstName: "Liam",
            lastName: "Lawson",
            shortName: "LAW",
            team: "Racing Bulls",
            teamColor: "#6C98FF",
            teamColorAlt: "#2345AB",
            number: 30,
            country: "nz",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01numberwhitefrless.webp",
        },
        {
            firstName: "Arvid",
            lastName: "Lindblad",
            shortName: "LIN",
            team: "Racing Bulls",
            teamColor: "#6C98FF",
            teamColorAlt: "#2345AB",
            number: 41,
            country: "gb",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp",
        },

        {
            firstName: "Max",
            lastName: "Verstappen",
            shortName: "VER",
            team: "Red Bull Racing",
            teamColor: "#4781D7",
            teamColorAlt: "#003282",
            number: 3,
            country: "nl",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp",
        },
        {
            firstName: "Isack",
            lastName: "Hadjar",
            shortName: "HAD",
            team: "Red Bull Racing",
            teamColor: "#4781D7",
            teamColorAlt: "#003282",
            number: 6,
            country: "fr",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp",
        },

        {
            firstName: "Carlos",
            lastName: "Sainz",
            shortName: "SAI",
            team: "Williams",
            teamColor: "#1868DB",
            teamColorAlt: "#000681",
            number: 55,
            country: "es",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/williams/carsai01/2026williamscarsai01numberwhitefrless.webp",
        },
        {
            firstName: "Alexander",
            lastName: "Albon",
            shortName: "ALB",
            team: "Williams",
            teamColor: "#1868DB",
            teamColorAlt: "#000681",
            number: 23,
            country: "th",
            image:
                "https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000000/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp",
            numberImage:
                "https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2026/williams/alealb01/2026williamsalealb01numberwhitefrless.webp",
        },
    ];

    // Grid state: array of 22 positions, each can hold a driver or null
    const [grid, setGrid] = useState<(Driver | null)[]>(Array(22).fill(null));
    const [draggedFromGrid, setDraggedFromGrid] = useState<number | null>(null);
    const [draggingDriver, setDraggingDriver] = useState<string | null>(null);
    const [draggingDriverData, setDraggingDriverData] = useState<Driver | null>(null);
    const [isOutsideGrid, setIsOutsideGrid] = useState(false);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const gridRef = useRef<HTMLDivElement>(null);

    // Track mouse position during drag from grid
    useEffect(() => {
        if (draggedFromGrid === null) return;

        const handleDrag = (e: DragEvent) => {
            if (e.clientX === 0 && e.clientY === 0) return; // Ignore invalid positions

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

            // If dropped from another grid position, swap
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

        // Create custom drag image with shortName
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

        // Clean up the element after drag starts
        setTimeout(() => document.body.removeChild(dragImage), 0);
    };

    const handleDragEnd = () => {
        setDraggingDriver(null);
        setDraggedFromGrid(null);
        setDraggingDriverData(null);
        setIsOutsideGrid(false);
    };

    // Remove driver from grid when dropped outside
    const handleGridDragEnd = (e: React.DragEvent, position: number) => {
        // Check if dropped on a valid drop target (the grid elements handle their own drops)
        // If dropEffect is 'none', it means it wasn't dropped on a valid target
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

    return <div className="container mx-auto mt-5">
        <h1 className="text-3xl font-bold mb-6">F1 Starting Grid</h1>
        <div className="flex justify-end my-4"><Button onClick={() => setGrid(Array(22).fill(null))}>Reset</Button></div>

        <div className="flex flex-row gap-4">

        <div className="flex-5/6 mb-4 grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-4 md:grid-cols-2 sm:grid-cols-2 gap-4">
            {drivers.map((driver) => {
                const gridIndex = grid.findIndex((gridDriver) => gridDriver?.shortName === driver.shortName);
                const gridPosition = gridIndex !== -1 ? gridIndex + 1 : undefined;
                const isOnGrid = gridPosition !== undefined;
                const isDragging = draggingDriver === driver.shortName;

                return (
                    <div
                        key={driver.lastName}
                        className="relative"
                    >
                        <div
                            draggable={!isOnGrid}
                            onDragStart={(e) => handleDragStartFromCard(e, driver)}
                            onDragEnd={handleDragEnd}
                            className={`cursor-grab active:cursor-grabbing select-none transition-opacity duration-200 ${isOnGrid ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'} ${isDragging ? 'opacity-50' : ''}`}
                        >
                            <div className="pointer-events-none">
                                <DriverCard driver={driver} />
                            </div>
                        </div>
                        {gridPosition && (
                            <div className="absolute bottom-3 left-3 z-10 bg-white text-gray-600 font-nunito font-black text-2xl px-4 py-2 rounded-lg shadow-2xl">
                                P{gridPosition}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        
        <div ref={gridRef} className="rounded-md flex-1/6 min-w-[250px] mb-4 pt-15 relative grid grid-cols-2 bg-gray-600 gap-x-8 p-8 auto-rows-[80px] h-fit" title="grid">
            <div className="absolute flex left-0 right-0 top-0 content-center items-center justify-center w-full z-10 text-white font-nunito font-regular text-xl px-4 py-2 rounded-lg bg-white/10">Starting Grid</div>
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
                    />
                );
            })}

        </div>
        </div>

        {/* Custom drag overlay for grid items */}
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

    </div>
};

export default F1Page;