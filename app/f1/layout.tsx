"use client";

import { useParams } from "next/navigation";
import { RaceCard } from "./components/RaceCardComponent";
import { races2026 } from "./data";

export default function F1Layout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const currentRound = params.round ? parseInt(params.round as string) : undefined;

    return (
        <div className="container mx-auto mt-5 px-4 md:px-6">
            <h1 className="text-3xl font-bold mb-6">F1 2026</h1>

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

            {children}
        </div>
    );
}
