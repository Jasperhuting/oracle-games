"use client";

import { useParams, usePathname } from "next/navigation";
import { RaceCard } from "./components/RaceCardComponent";
import { useF1Races, useF1UserPredictions } from "./hooks";
import Link from "next/link";
import { Trophy, Flag } from "tabler-icons-react";
import { useEffect, useMemo } from "react";

export default function F1Layout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const currentRound = params.round ? parseInt(params.round as string) : undefined;
    const isStandingsPage = pathname === "/f1/standings";
    const isRoundOneRacePage = pathname === "/f1/race/1";
    
    const { races, loading: racesLoading } = useF1Races();
    const { predictions } = useF1UserPredictions(2026);

    // Create a map of prediction status by round
    const predictionStatusByRound = useMemo(() => {
        const statusMap: Record<number, 'none' | 'partial' | 'complete'> = {};
        predictions.forEach(p => {
            if (p.finishOrder.length === 0) {
                statusMap[p.round] = 'none';
            } else if (p.finishOrder.length === 10) {
                statusMap[p.round] = 'complete';
            } else {
                statusMap[p.round] = 'partial';
            }
        });
        return statusMap;
    }, [predictions]);

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

            {isRoundOneRacePage ? (
                <div className="mb-5 overflow-hidden rounded-lg border border-red-500/70 bg-gradient-to-r from-red-950/80 via-amber-950/70 to-red-950/80 shadow-[0_0_18px_rgba(239,68,68,0.12)]">
                    <div className="h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')]"></div>
                    <div className="px-4 py-4 md:px-5 md:py-4">
                        <div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-red-300">Belangrijke melding</div>
                        <p className="text-base font-black text-white md:text-lg">
                            De punten van ronde 1 tellen niet mee.
                        </p>
                        <p className="mt-1.5 max-w-3xl text-sm text-red-100/90">
                            Door een systeemfout is ronde 1 uitgesloten van de stand. Je voorspelling blijft zichtbaar, maar deze race levert geen punten of strafpunten op voor het klassement.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-900/30 px-4 py-3 text-amber-100">
                    <p className="text-sm font-medium">
                        Let op: door een systeemfout tellen de punten van ronde 1 helaas niet mee.
                    </p>
                </div>
            )}

            {/* Race cards - hide on standings page */}
            {!isStandingsPage && (
                <div title="races" className="flex w-full overflow-x-scroll gap-1 mb-6 pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    {racesLoading ? (
                        <div className="text-gray-400 text-sm py-4">Races laden...</div>
                    ) : (
                        races.map((race) => {
                            const isSelected = currentRound === race.round;
                            const predictionStatus = predictionStatusByRound[race.round] || 'none';

                            return (
                                <RaceCard
                                    key={race.round}
                                    race={race}
                                    selected={isSelected}
                                    predictionStatus={predictionStatus}
                                />
                            );
                        })
                    )}
                </div>
            )}

            {children}
        </div>
        </div>
    );
}
