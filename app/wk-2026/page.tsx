
'use client';

import { Flag } from "@/components/Flag";
import { useEffect, useState } from "react";

import countriesList from '@/lib/country.json';

export const POULES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']

export interface TeamInPoule {
    id: string;
    name: string;
    pot: number;
    poule: string | null;
    position: number | null; // 0, 1, 2, or 3 for positions within a poule
}

export const WK2026Page = () => {
    const [teams, setTeams] = useState<TeamInPoule[]>([]);
    const [draggedTeam, setDraggedTeam] = useState<TeamInPoule | null>(null);

    const fetchTeams = async () => {
        try {
            // Fetch teams
            const teamsResponse = await fetch('/api/wk-2026/getTeams');
            const teamsData = await teamsResponse.json();

            // Fetch saved poules
            const poulesResponse = await fetch('/api/wk-2026/getPoules');
            const poulesData = await poulesResponse.json();

            // Create a map of team assignments from saved poules
            const teamAssignments: { [teamId: string]: { poule: string; position: number } } = {};

            if (poulesData.poules) {
                poulesData.poules.forEach((poule: any) => {
                    if (poule.teams) {
                        Object.entries(poule.teams).forEach(([teamId, teamData]: [string, any]) => {
                            teamAssignments[teamId] = {
                                poule: poule.pouleId,
                                position: teamData.position
                            };
                        });
                    }
                });
            }

            // Merge team data with saved assignments
            const teamsWithAssignments = teamsData.teams.map((team: any) => {
                const assignment = teamAssignments[team.id];
                return {
                    ...team,
                    poule: assignment?.poule || null,
                    position: assignment?.position ?? null
                };
            });

            setTeams(teamsWithAssignments);
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const handleDragStart = (team: TeamInPoule) => {
        setDraggedTeam(team);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDropToPosition = (pouleId: string, position: number) => {
        if (!draggedTeam) return;

        // Check if this position is already occupied by a different team
        const teamAtPosition = teams.find(t => t.poule === pouleId && t.position === position);

        if (teamAtPosition && teamAtPosition.id !== draggedTeam.id) {
            alert(`Position ${position + 1} in Poule ${pouleId.toUpperCase()} is already occupied`);
            setDraggedTeam(null);
            return;
        }

        setTeams(teams.map(team =>
            team.id === draggedTeam.id
                ? { ...team, poule: pouleId, position }
                : team
        ));
        setDraggedTeam(null);
    };

    const handleDropToUnassigned = () => {
        if (!draggedTeam) return;

        setTeams(teams.map(team =>
            team.id === draggedTeam.id
                ? { ...team, poule: null, position: null }
                : team
        ));
        setDraggedTeam(null);
    };

    const getTeamAtPosition = (pouleId: string, position: number): TeamInPoule | null => {
        return teams.find(t => t.poule === pouleId && t.position === position) || null;
    };

    const getTeamsInPoule = (pouleId: string) => {
        return teams.filter(team => team.poule === pouleId);
    };

    const getUnassignedTeams = () => {
        return teams.filter(team => team.poule === null);
    };

    const getAssignedTeams = () => {
        return teams.filter(team => team.poule !== null);
    };

    console.log("Assigned teams:", getAssignedTeams());

    const clearAllAssignments = () => {
        setTeams(teams.map(team => ({ ...team, poule: null, position: null })));
    };

    const savePoules = () => {
        const assignedTeams = getAssignedTeams();
        fetch('/api/wk-2026/updatePot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ teams: assignedTeams }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
        })
        .catch(error => {
            console.error('Error:', error);
        });
        // TODO: Implement actual save logic using assignedTeams
    };

    const randomlyAssignAllPots = () => {
        // First, clear all existing assignments
        const clearedTeams = teams.map(team => ({ ...team, poule: null, position: null }));

        const pot1Teams = clearedTeams.filter(team => team.pot === 1);
        const pot2Teams = clearedTeams.filter(team => team.pot === 2);
        const pot3Teams = clearedTeams.filter(team => team.pot === 3);
        const pot4Teams = clearedTeams.filter(team => team.pot === 4);

        // Validate that pots 1-3 have exactly 12 teams, and pot 4 has at least 12
        if (pot1Teams.length !== 12 || pot2Teams.length !== 12 || pot3Teams.length !== 12) {
            alert(`Invalid team distribution:\nPot 1: ${pot1Teams.length}/12\nPot 2: ${pot2Teams.length}/12\nPot 3: ${pot3Teams.length}/12\nPot 4: ${pot4Teams.length}/12+`);
            return;
        }

        if (pot4Teams.length < 12) {
            alert(`Not enough teams in Pot 4: ${pot4Teams.length}/12`);
            return;
        }

        // Shuffle each pot randomly
        const shuffledPot1 = [...pot1Teams].sort(() => Math.random() - 0.5);
        const shuffledPot2 = [...pot2Teams].sort(() => Math.random() - 0.5);
        const shuffledPot3 = [...pot3Teams].sort(() => Math.random() - 0.5);
        const shuffledPot4 = [...pot4Teams].sort(() => Math.random() - 0.5).slice(0, 12); // Only take 12 teams from pot 4

        // Assign each team to a poule at their respective position
        const updatedTeams = clearedTeams.map(team => {
            // Check pot 1 (position 0)
            const pot1Index = shuffledPot1.findIndex(t => t.id === team.id);
            if (pot1Index !== -1) {
                return { ...team, poule: POULES[pot1Index], position: 0 };
            }

            // Check pot 2 (position 1)
            const pot2Index = shuffledPot2.findIndex(t => t.id === team.id);
            if (pot2Index !== -1) {
                return { ...team, poule: POULES[pot2Index], position: 1 };
            }

            // Check pot 3 (position 2)
            const pot3Index = shuffledPot3.findIndex(t => t.id === team.id);
            if (pot3Index !== -1) {
                return { ...team, poule: POULES[pot3Index], position: 2 };
            }

            // Check pot 4 (position 3)
            const pot4Index = shuffledPot4.findIndex(t => t.id === team.id);
            if (pot4Index !== -1) {
                return { ...team, poule: POULES[pot4Index], position: 3 };
            }

            return team;
        });

        setTeams(updatedTeams);
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">WK 2026 Games</h1>

            <div className="mb-4 flex gap-4">
                <button
                    onClick={randomlyAssignAllPots}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                >
                    Randomly Assign All Pots to Poules
                </button>
                <button
                    onClick={clearAllAssignments}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
                >
                    Clear All Assignments
                </button>
                <button
                onClick={savePoules}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold"
                >
                    Save Poules
                </button>
            </div>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Poules (4 positions per poule)</h2>
                <div className="grid grid-cols-6 gap-4">
                    {POULES.map((poule) => {
                        const teamsInPoule = getTeamsInPoule(poule);
                        const isFull = teamsInPoule.length >= 4;

                        return (
                            <div
                                key={poule}
                                className={`p-4 border-2 rounded-lg transition-colors ${isFull ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'
                                    }`}
                            >
                                <h3 className="font-bold text-lg mb-3">
                                    Poule {poule.toUpperCase()} ({teamsInPoule.length}/4)
                                </h3>
                                <div className="space-y-2">
                                    {[0, 1, 2, 3].map((position) => {
                                        const teamAtPosition = getTeamAtPosition(poule, position);

                                        if (teamAtPosition) {
                                            const country = countriesList.find((c: any) => c.name === teamAtPosition.name);
                                            return (
                                                <div
                                                    key={position}
                                                    draggable
                                                    onDragStart={() => handleDragStart(teamAtPosition)}
                                                    className="flex flex-row items-center p-2 bg-white border border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow"
                                                >
                                                    <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-gray-200 rounded-full text-xs font-bold mr-2">
                                                        {position + 1}
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        <Flag countryCode={country?.code || teamAtPosition.id} width={24} />
                                                    </div>
                                                    <span className="ml-2 text-sm truncate">{teamAtPosition.name}</span>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div
                                                    key={position}
                                                    onDragOver={handleDragOver}
                                                    onDrop={() => handleDropToPosition(poule, position)}
                                                    className="flex flex-row items-center p-2 bg-white border-2 border-dashed border-gray-300 rounded-lg min-h-[44px] hover:border-blue-400 hover:bg-blue-50 transition-colors"
                                                >
                                                    <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-gray-200 rounded-full text-xs font-bold mr-2">
                                                        {position + 1}
                                                    </div>
                                                    <span className="text-sm text-gray-400"></span>
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div
                className="mb-8 p-6 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50"
                onDragOver={handleDragOver}
                onDrop={handleDropToUnassigned}
            >
                <h2 className="text-xl font-semibold mb-4">Unassigned Teams ({getUnassignedTeams().length})</h2>
                <div className="grid grid-cols-4 gap-4">
                    {getUnassignedTeams().sort((a, b) => a.pot - b.pot).map((team: TeamInPoule) => {
                        const country = countriesList.find((c: any) => c.name === team.name);
                        return (
                            <div
                                key={team.id}
                                draggable
                                onDragStart={() => handleDragStart(team)}
                                className="relative flex flex-row items-center p-4 bg-white border-2 border-blue-300 rounded-lg cursor-move hover:shadow-lg transition-shadow"
                            >
                                <Flag countryCode={country?.code || team.id} width={40} />
                                <span className={`ml-2 font-bold absolute right-1 top-1 rounded-full w-6 h-6 flex items-center justify-center bg-blue-500 text-white text-xs ${team.pot === 1 && 'bg-red-500'} ${team.pot === 2 && 'bg-yellow-500'} ${team.pot === 3 && 'bg-green-500'} ${team.pot === 4 && 'bg-purple-500'} `}>{team.pot}</span>
                                <h2 className="ml-2 font-medium truncate">{team.name}</h2>
                            </div>
                        );
                    })}
                </div>
                {getUnassignedTeams().length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        Drag teams here to remove them from poules
                    </div>
                )}
            </div>
        </div>
    );
};

export default WK2026Page;