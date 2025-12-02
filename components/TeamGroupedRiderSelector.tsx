'use client'

import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { Rider } from "@/lib/scraper/types";
import { PlayerRow } from "./PlayerRow";
import { normalizeString } from "@/lib/utils/stringUtils";

interface TeamGroup {
  teamName: string;
  teamId: string;
  teamImage?: string;
  riders: Rider[];
}

export const TeamGroupedRiderSelector = ({
  riders,
  selectedRiders,
  setSelectedRiders,
  placeholder = "Search riders or teams...",
}: {
  riders: Rider[];
  selectedRiders: Rider[];
  setSelectedRiders: (riders: Rider[]) => void;
  placeholder?: string;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Group riders by team
  const teamGroups = useMemo(() => {
    const groups = new Map<string, TeamGroup>();

    riders.forEach(rider => {
      const teamName = rider.team?.name || 'Unknown Team';
      const teamId = rider.team?.nameID || rider.team?.slug || teamName;
      const teamImage = rider.team?.teamImage;

      if (!groups.has(teamId)) {
        groups.set(teamId, {
          teamName,
          teamId,
          teamImage,
          riders: [],
        });
      }

      groups.get(teamId)!.riders.push(rider);
    });

    // Sort riders within each team by rank
    groups.forEach(group => {
      group.riders.sort((a, b) => (a.rank || 0) - (b.rank || 0));
    });

    // Convert to array and sort by team name
    return Array.from(groups.values()).sort((a, b) =>
      b.riders.length - a.riders.length
    );
  }, [riders]);

  // Filter teams based on search
  const filteredTeamGroups = useMemo(() => {
    if (!debouncedSearchTerm) return teamGroups;

    const normalizedSearch = normalizeString(debouncedSearchTerm);
    const lowerSearch = debouncedSearchTerm.toLowerCase();

    return teamGroups
      .map(group => ({
        ...group,
        riders: group.riders.filter(rider => {
          return (
            normalizeString(rider.name || '').includes(normalizedSearch) ||
            normalizeString(rider.team?.name || '').includes(normalizedSearch) ||
            rider.country?.toLowerCase().includes(lowerSearch)
          )
        }),
      }))
      .filter(group =>
        group.riders.length > 0 ||
        normalizeString(group.teamName).includes(normalizedSearch)
      );
  }, [teamGroups, debouncedSearchTerm]);

  // Get team selection state
  const getTeamState = (group: TeamGroup): 'none' | 'some' | 'all' => {
    const selectedCount = group.riders.filter(rider =>
      selectedRiders.some(sr => sr.id === rider.id || sr.nameID === rider.nameID)
    ).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === group.riders.length) return 'all';
    return 'some';
  };

  // Toggle team selection
  const toggleTeam = (group: TeamGroup) => {
    const teamState = getTeamState(group);

    if (teamState === 'all') {
      // Deselect all riders in this team
      setSelectedRiders(
        selectedRiders.filter(sr =>
          !group.riders.some(r => r.id === sr.id || r.nameID === sr.nameID)
        )
      );
    } else {
      // Select all riders in this team
      const newRiders = group.riders.filter(r =>
        !selectedRiders.some(sr => sr.id === r.id || sr.nameID === r.nameID)
      );
      setSelectedRiders([...selectedRiders, ...newRiders]);
    }
  };

  // Toggle individual rider
  const toggleRider = (rider: Rider) => {
    const isSelected = selectedRiders.some(
      sr => sr.id === rider.id || sr.nameID === rider.nameID
    );

    if (isSelected) {
      setSelectedRiders(
        selectedRiders.filter(sr => sr.id !== rider.id && sr.nameID !== rider.nameID)
      );
    } else {
      setSelectedRiders([...selectedRiders, rider]);
    }
  };

  // Toggle team expansion
  const toggleExpanded = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  // Expand teams with search results
  useEffect(() => {
    if (debouncedSearchTerm) {
      const teamsToExpand = new Set(filteredTeamGroups.map(g => g.teamId));
      setExpandedTeams(teamsToExpand);
    }
  }, [debouncedSearchTerm, filteredTeamGroups]);

  const clearAll = () => {
    setSelectedRiders([]);
  };

  const getDisplayValue = () => {
    if (isFocused) {
      return searchTerm;
    }
    if (selectedRiders.length > 0) {
      return selectedRiders.map(r => r.name).join(', ');
    }
    return searchTerm;
  };

  const getPlaceholder = () => {
    if (selectedRiders.length > 0 && !isFocused) {
      return `${placeholder} (${selectedRiders.length} selected)`;
    }
    return placeholder;
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="flex items-center gap-2">
        <input
          className={`h-[40px] max-w-[400px] w-full px-3 border rounded ${
            selectedRiders.length > 0 ? 'border-primary bg-blue-50' : 'border-gray-300'
          }`}
          type="text"
          placeholder={getPlaceholder()}
          value={getDisplayValue()}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow clicks on dropdown items
            setTimeout(() => setIsFocused(false), 200);
          }}
        />
        {selectedRiders.length > 0 && (
          <button
            onClick={clearAll}
            className="h-[40px] px-3 bg-red-600 cursor-pointer text-white rounded hover:bg-red-600 whitespace-nowrap"
            title="Clear selection"
          >
            ✕ Clear ({selectedRiders.length})
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isFocused && (
        <div
          className="absolute top-[40px] left-0 bg-white border border-solid border-gray-200 rounded-md w-[800px] max-w-[800px] max-h-[500px] overflow-y-scroll shadow-lg"
          style={{ zIndex: 9999 }}
        >
          {filteredTeamGroups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No riders found matching your search.
            </div>
          ) : (
            filteredTeamGroups.map((group, groupIndex) => {
              const teamState = getTeamState(group);
              const isExpanded = expandedTeams.has(group.teamId);

              return (
                <div
                  key={group.teamId}
                  className={`${groupIndex > 0 ? 'border-t border-gray-200' : ''}`}
                >
                  {/* Team Header */}
                  <div className="bg-gray-50 hover:bg-gray-100 transition-colors sticky top-0 z-10">
                    <div className="flex items-center px-4 py-3 gap-3">
                      {/* Team Checkbox */}
                      <input
                        type="checkbox"
                        checked={teamState === 'all'}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = teamState === 'some';
                          }
                        }}
                        onChange={() => toggleTeam(group)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      />

                      {/* Expand/Collapse Button */}
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          toggleExpanded(group.teamId);
                        }}
                        className="flex-1 flex items-center justify-between text-left font-medium text-gray-900 hover:text-primary transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>{group.teamImage ? <img src={`https://www.procyclingstats.com/${group?.teamImage}`} alt={group.teamName} className="w-8 h-8" /> : <img src="/jersey-transparent.png" className="w-8 h-8" />}</span>
                          <span>{group.teamName}</span>
                          <span className="text-sm text-gray-500">
                            ({group.riders.length} riders)
                          </span>
                        </span>
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Riders List */}
                  {isExpanded && (
                    <div className="bg-white">
                      {group.riders.map((rider, riderIndex) => {
                        const isSelected = selectedRiders.some(
                          sr => sr.id === rider.id || sr.nameID === rider.nameID
                        );

                        return (
                          <div
                            key={rider.id || rider.nameID || riderIndex}
                            className={`flex items-center px-4 py-2 gap-3 hover:bg-gray-50 cursor-pointer ${
                              riderIndex > 0 ? 'border-t border-gray-100' : ''
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              toggleRider(rider);
                            }}
                          >
                            {/* Rider Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer pointer-events-none"
                            />

                            {/* Rider Info */}
                            <div className="flex-1 pointer-events-none">
                              <PlayerRow
                                showPoints={true}
                                showRank={true}
                                selectedPlayer={isSelected}
                                player={rider}
                                selectPlayer={() => {}}
                                index={false}
                                fullWidth={true}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
