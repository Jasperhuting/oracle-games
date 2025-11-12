'use client'
import { useEffect, useState } from "react";
import { TeamRow } from "./TeamRow";
import { Team } from "@/lib/scraper/types";
import { Selector } from "./Selector";

export const TeamSelector = ({
    setSelectedTeams,
    selectedTeams,
    multiSelect = false,
    multiSelectShowSelected = true,
    showSelected = true,
    placeholder
}: {
    setSelectedTeams: (teams: Team[]) => void,
    selectedTeams: Team[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    showSelected?: boolean,
    placeholder?: string
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
            placeholder={placeholder || (multiSelect ? "Filter on teams..." : "Filter on team...")}
            getItemLabel={(team) => team.name?.replace(/\s*\d{4}$/, '') || ''}
            searchFilter={(team, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(team?.name?.toLowerCase().includes(lowerSearch) ||
                         team?.country?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(t1, t2) => t1.name === t2.name}
            showSelected={showSelected}
            renderItem={(team, index, isSelected) => (
                <TeamRow 
                    selectedTeam={isSelected} 
                    team={team} 
                    selectTeam={() => {}} 
                />
            )}
            renderSelectedItem={(team, index, onRemove) => (
                showSelected ? (
                    <TeamRow 
                        team={team} 
                        selectTeam={onRemove} 
                    />
                ) : null
            )}
        />
    );
};