"use client";

import { useParams, usePathname } from "next/navigation";
import { RaceCard } from "./components/RaceCardComponent";
import { races2026 } from "./data";
import Link from "next/link";
import { Trophy, Flag } from "tabler-icons-react";
import { useEffect } from "react";

export default function F1Layout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const currentRound = params.round ? parseInt(params.round as string) : undefined;
    const isStandingsPage = pathname === "/f1/standings";

    // Override body background color for F1 pages
    useEffect(() => {
        const originalBg = document.body.style.backgroundColor;
        document.body.style.backgroundColor = '#101828'; // gray-900
        document.body.classList.remove('bg-gray-50');
        document.body.classList.add('bg-gray-900');
        
        return () => {
            document.body.style.backgroundColor = originalBg;
            document.body.classList.remove('bg-gray-900');
            document.body.classList.add('bg-gray-50');
        };
    }, []);

    return (
        <div className="bg-gray-900 min-h-screen -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-6 pb-8 relative z-0">
        <div className="container mx-auto px-4 md:px-6">
            {/* Navigation tabs */}
            <div className="flex items-center gap-2 mb-4">
                <Link
                    href="/f1"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                        !isStandingsPage
                            ? "bg-red-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                >
                    <Flag size={18} />
                    Races
                </Link>
                <Link
                    href="/f1/standings"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                        isStandingsPage
                            ? "bg-red-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                >
                    <Trophy size={18} />
                    Tussenstand
                </Link>
            </div>

            {/* Race cards - hide on standings page */}
            {!isStandingsPage && (
                <div title="races" className="flex w-full overflow-x-scroll gap-1 mb-6 pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    {races2026.map((race) => {
                        const now = new Date();
                        const raceEndDate = new Date(race.endDate);
                        const isDone = raceEndDate < now;
                        const isSelected = currentRound === race.round;

                        return (
                            <RaceCard
                                key={race.round}
                                race={race}
                                selected={isSelected}
                                done={isDone}
                            />
                        );
                    })}
                </div>
            )}

            {children}
        </div>
        </div>
    );
}
