'use client';
import { useEffect, useState } from 'react';
import { Flag } from '@/components/Flag';
import { WkAdminNav } from '@/components/WkAdminNav';
import countriesList from '@/lib/country.json';
import { getCountryDisplayNameNL } from '@/lib/country-nl';

interface PotTeam {
    id?: string;
    name?: string;
    possibleTeams?: string[];
}

interface PotRecord {
    id?: string;
    pouleId?: string;
    teams?: Record<string, PotTeam>;
}

interface TeamDetails extends PotTeam {
    id: string;
}

export default function PotsPage() {

    const [pots, setPots] = useState<PotRecord[]>([]);
    const [teamDetailsById, setTeamDetailsById] = useState<Record<string, TeamDetails>>({});

    const fetchPots = async () => {
        try {
            const [potsResponse, teamsResponse] = await Promise.all([
                fetch('/api/wk-2026/getPots'),
                fetch('/api/wk-2026/getTeams'),
            ]);

            const potsData = await potsResponse.json();
            const teamsData = await teamsResponse.json();

            const teamDetails = (teamsData.teams || []).reduce((accumulator: Record<string, TeamDetails>, team: TeamDetails) => {
                accumulator[team.id] = team;
                return accumulator;
            }, {});

            setTeamDetailsById(teamDetails);
            setPots(potsData.poules || []);
        } catch (error) {
            console.error('Error fetching pots:', error);
        }
    };

    // Call fetchPots when component mounts
    useEffect(() => {
        fetchPots();
    }, []);

    return (
        <div className="p-8 mt-9 max-w-7xl mx-auto">
            <WkAdminNav />
            <h1 className="text-3xl font-bold mb-6">WK 2026 Admin - Pots</h1>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {pots.map((pot) => (
                    <div
                        key={pot.id || pot.pouleId}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                        <h2 className="mb-3 text-lg font-semibold text-[#7a3c00]">Pot {pot.pouleId}</h2>
                        <div className="space-y-2 text-sm text-gray-700">
                            {Object.entries(pot.teams || {}).length > 0 ? (
                                Object.entries(pot.teams || {}).map(([teamId, team], index) => {
                                    const mergedTeam = teamDetailsById[team.id || teamId] || team;
                                    const country = countriesList.find((entry: { name: string; code: string }) => entry.name === mergedTeam.name);
                                    const countryCode = country?.code || mergedTeam.id || teamId;

                                    return (
                                        <div
                                            key={`${pot.pouleId}-${mergedTeam.name || teamId || index}`}
                                            className="flex items-center gap-3 rounded-lg bg-[#fff7eb] px-3 py-2"
                                        >
                                            {mergedTeam.possibleTeams ? (
                                                <div className="flex flex-col gap-0">
                                                    <div className="flex flex-row gap-0">
                                                        {mergedTeam.possibleTeams.slice(0, 2).map((possibleTeam, possibleIndex) => {
                                                            const possibleCountry = countriesList.find((entry: { name: string; code: string }) => entry.name === possibleTeam);
                                                            return (
                                                                <Flag
                                                                    key={`${teamId}-possible-top-${possibleIndex}`}
                                                                    countryCode={possibleCountry?.code || possibleTeam}
                                                                    width={24}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex flex-row gap-0">
                                                        {mergedTeam.possibleTeams.slice(2, 4).map((possibleTeam, possibleIndex) => {
                                                            const possibleCountry = countriesList.find((entry: { name: string; code: string }) => entry.name === possibleTeam);
                                                            return (
                                                                <Flag
                                                                    key={`${teamId}-possible-bottom-${possibleIndex}`}
                                                                    countryCode={possibleCountry?.code || possibleTeam}
                                                                    width={24}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <Flag countryCode={countryCode} width={24} />
                                            )}
                                            <span>{mergedTeam.name ? getCountryDisplayNameNL(mergedTeam.name) : 'Onbekend team'}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="rounded-lg bg-gray-50 px-3 py-2 text-gray-500">Geen teams</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

}
