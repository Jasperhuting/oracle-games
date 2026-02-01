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
    teamRiderCounts?: Map<string, number>
}) => {
    // Create teams from teamRiderCounts instead of API
    const teams = useMemo(() => {
        if (!showRiderCounts || teamRiderCounts.size === 0) {
            return [];
        }
        
        const teamList: Team[] = Array.from(teamRiderCounts.entries()).map(([teamId, count]) => ({
            id: teamId,
            name: teamId.replace(/-2026$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            slug: teamId,
            country: '',
            teamImage: undefined
        }));
        
        console.log('Debug - teams created from teamRiderCounts:', teamList.slice(0, 3));
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
                console.log(`Debug - getItemLabel called: showRiderCounts=${showRiderCounts}, teamRiderCounts.size=${teamRiderCounts.size}`);
                if (showRiderCounts && teamRiderCounts) {
                    const teamId = team.slug || team.name?.toLowerCase().replace(/\s+/g, '-');
                    let count = teamRiderCounts.get(teamId) || 0;
                    
                    console.log(`Debug - getItemLabel: team="${baseLabel}", teamId="${teamId}", count=${count}`);
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
                const count = teamRiderCounts?.get(team.slug || team.id) || 0;
                console.log(`Debug - renderItem: team="${team.name}", teamId="${team.id}", count=${count}, showRiderCount=${showRiderCounts}`);
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