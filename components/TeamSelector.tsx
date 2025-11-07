'use client'
import { useEffect, useState } from "react";
import { TeamRow } from "./TeamRow";
import { Team } from "@/lib/scraper/types";
import { Selector } from "./Selector";

export const TeamSelector = ({ 
    setSelectedTeams, 
    selectedTeams, 
    multiSelect = false, 
    multiSelectShowSelected = true 
}: { 
    setSelectedTeams: (teams: Team[]) => void, 
    selectedTeams: Team[], 
    multiSelect?: boolean, 
    multiSelectShowSelected?: boolean 
}) => {
    const [teams, setTeams] = useState<Team[]>([]);
    
    // Load teams from API on mount
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const response = await fetch('/api/getTeams');
                const data = await response.json();
                setTeams(data.teams || []);
            } catch (error) {
                console.error('Error fetching teams:', error);
            }
        };
        fetchTeams();
    }, []);

    return (
        <Selector<Team>
            items={teams}
            selectedItems={selectedTeams}
            setSelectedItems={setSelectedTeams}
            multiSelect={multiSelect}
            multiSelectShowSelected={multiSelectShowSelected}
            placeholder={multiSelect ? "Search teams..." : "Search team..."}
            searchFilter={(team, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(team?.name?.toLowerCase().includes(lowerSearch) || 
                         team?.country?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(t1, t2) => t1.name === t2.name}
            renderItem={(team, index, isSelected) => (
                <TeamRow 
                    selectedTeam={isSelected} 
                    team={team} 
                    selectTeam={() => {}} 
                />
            )}
            renderSelectedItem={(team, index, onRemove) => (
                <TeamRow 
                    team={team} 
                    selectTeam={onRemove} 
                />
            )}
        />
    );
};