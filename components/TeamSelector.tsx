'use client'
import { useMemo } from "react";
import { TeamRow } from "./TeamRow";
import { Team } from "@/lib/scraper/types";
import { Selector } from "./Selector";

export const TeamSelector = ({
    setSelectedTeams,
    selectedTeams,
    multiSelect = false,
    multiSelectShowSelected = true,
    showSelected = true,
    placeholder,
    showRiderCounts = false,
    teamRiderCounts = new Map()
}: {
    setSelectedTeams: (teams: Team[]) => void,
    selectedTeams: Team[],
    multiSelect?: boolean,
    multiSelectShowSelected?: boolean,
    showSelected?: boolean,
    placeholder?: string,
    showRiderCounts?: boolean,
    teamRiderCounts?: Map<string, { count: number; teamImage?: string }>
}) => {
    // Create teams from teamRiderCounts instead of API
    const teams = useMemo(() => {
        if (!showRiderCounts || teamRiderCounts.size === 0) {
            return [];
        }
        
        const teamList: Team[] = Array.from(teamRiderCounts.entries()).map(([teamId, data]) => {
            return {
                id: teamId,
                name: teamId.replace(/-2026$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                slug: teamId,
                country: '',
                teamImage: data.teamImage
            };
        });
        
        return teamList;
    }, [teamRiderCounts, showRiderCounts]);
    
    return (
        <Selector<Team>
            items={teams}
            selectedItems={selectedTeams}
            setSelectedItems={setSelectedTeams}
            multiSelect={multiSelect}
            multiSelectShowSelected={false}
            showSelected={showSelected}
            placeholder={placeholder || (multiSelect ? "Filter on teams..." : "Filter on team...")}
            getItemLabel={(team) => {
                const baseLabel = team.name?.replace(/\s*\d{4}$/, '') || '';
                if (showRiderCounts && teamRiderCounts) {
                    const teamId = team.slug || team.name?.toLowerCase().replace(/\s+/g, '-');
                    const count = teamRiderCounts.get(teamId)?.count || 0;
                    
                    return `${baseLabel} (${count})`;
                }
                return baseLabel;
            }}
            searchFilter={(team, searchTerm) => {
                const lowerSearch = searchTerm.toLowerCase();
                return !!(team?.name?.toLowerCase().includes(lowerSearch));
            }}
            isEqual={(t1, t2) => t1.id === t2.id}
            renderItem={(team, index, isSelected) => {
                const count = teamRiderCounts?.get(team.slug || team.id)?.count || 0;
                return (
                    <TeamRow 
                        selectedTeam={isSelected} 
                        team={team} 
                        selectTeam={() => {}} 
                        showRiderCount={showRiderCounts}
                        riderCount={count}
                    />
                );
            }}
            renderSelectedItem={() => null}
        />
    );
};