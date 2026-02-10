'use client';

import { useState, useMemo, useEffect } from 'react';
import { PlayerRow } from '@/components/PlayerRow';
import { Selector } from '@/components/Selector';
import { TeamSelector } from '@/components/TeamSelector';
import { normalizeString } from '@/lib/utils/stringUtils';
import { Rider } from '@/lib/scraper/types';
import { Team } from '@/lib/scraper/types';

interface SlipstreamRiderSelectorProps {
  riders: Rider[];
  usedRiderIds: string[];
  selectedRider: Rider | null;
  onSelect: (rider: Rider | null) => void;
  disabled?: boolean;
}

export function SlipstreamRiderSelector({
  riders,
  usedRiderIds,
  selectedRider,
  onSelect,
  disabled = false
}: SlipstreamRiderSelectorProps) {
  const [selectedItems, setSelectedItems] = useState<Rider[]>(
    selectedRider ? [selectedRider] : []
  );
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);

  const normalizeTeamSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+$/g, '')
      .replace(/-202\d$/g, '');
  };

  const getRiderTeamSlug = (rider: Rider) => {
    if (rider.teamId && typeof rider.teamId === 'string') {
      return normalizeTeamSlug(rider.teamId);
    }
    if (rider.team && typeof rider.team === 'object') {
      const teamObj = rider.team as any;
      if (teamObj.slug) return normalizeTeamSlug(teamObj.slug);
      if (teamObj.id) return normalizeTeamSlug(teamObj.id);
      if (teamObj.name) return normalizeTeamSlug(teamObj.name);
      if (teamObj.teamName) return normalizeTeamSlug(teamObj.teamName);
    }
    if (rider.team && typeof rider.team === 'string') {
      return normalizeTeamSlug(rider.team);
    }
    if ((rider as any).teamName && typeof (rider as any).teamName === 'string') {
      return normalizeTeamSlug((rider as any).teamName);
    }
    if ((rider as any).teamNameID && typeof (rider as any).teamNameID === 'string') {
      return normalizeTeamSlug((rider as any).teamNameID);
    }
    return '';
  };

  const getRiderTeamDisplay = (rider: Rider) => {
    if (rider.team && typeof rider.team === 'object' && (rider.team as any).name) {
      return (rider.team as any).name as string;
    }
    if ((rider as any).teamName && typeof (rider as any).teamName === 'string') {
      return (rider as any).teamName as string;
    }
    if (rider.team && typeof rider.team === 'string') {
      return rider.team;
    }
    return '';
  };

  // Sync internal state with prop when selectedRider changes
  useEffect(() => {
    if (selectedRider) {
      setSelectedItems([selectedRider]);
    } else {
      setSelectedItems([]);
    }
  }, [selectedRider]);

  const availableRiders = useMemo(() => {
    const filtered = riders.filter(rider => {
      const riderId = rider.id || (rider as { nameID?: string }).nameID || '';
      const isUsed = usedRiderIds.includes(riderId);
      
      if (isUsed) return false;
      
      if (selectedTeams.length > 0) {
        const riderTeamId = getRiderTeamSlug(rider);
        const matches = selectedTeams.some(team => {
          const teamSlug = normalizeTeamSlug(team.slug || team.id || team.name || '');
          return teamSlug === riderTeamId;
        });
        
        return matches;
      }
      
      return true;
    });
    
    return filtered;
  }, [riders, usedRiderIds, selectedTeams]);

  // Calculate rider counts per team for TeamSelector
  const teamRiderCounts = useMemo(() => {
    const counts = new Map<string, { count: number; teamImage?: string }>();
    
    riders.forEach(rider => {
      const riderId = rider.id || (rider as { nameID?: string }).nameID || '';
      const isUsed = usedRiderIds.includes(riderId);
      
      if (!isUsed) {
        const teamId = getRiderTeamSlug(rider);
        const teamImage = (rider.team && typeof rider.team === 'object')
          ? ((rider.team as any).teamImage || (rider.team as any).jerseyImageTeam || '')
          : '';
        
        if (teamId) {
          const existing = counts.get(teamId);
          if (existing) {
            existing.count++;
          } else {
            counts.set(teamId, {
              count: 1,
              teamImage: teamImage
            });
          }
        }
      }
    });
    
    return counts;
  }, [riders, usedRiderIds]);

  const handleSelect = (items: Rider[]) => {
    setSelectedItems(items);
    onSelect(items[0] || null);
  };

  const handleTeamFilterChange = (teams: Team[]) => {
    setSelectedTeams(teams);
    // Clear rider selection when team filter changes
    setSelectedItems([]);
    onSelect(null);
  };

  if (disabled) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-gray-500">
        <p className="text-sm">Pick selection is disabled</p>
        {selectedRider && (
          <div className="mt-2">
            <span className="font-medium">Current pick:</span> {selectedRider.name}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {availableRiders.length} riders available ({usedRiderIds.length} already used)
        </span>
      </div>

      {/* Team Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Filter by Team</label>
        <TeamSelector
          selectedTeams={selectedTeams}
          setSelectedTeams={handleTeamFilterChange}
          multiSelect={false}
          showSelected={false}
          placeholder="Filter on teams..."
          showRiderCounts={true}
          teamRiderCounts={teamRiderCounts}
        />
      </div>
      
      <Selector<Rider>
        items={availableRiders}
        selectedItems={selectedItems}
        setSelectedItems={handleSelect}
        multiSelect={false}
        placeholder="Search for a rider..."
        getItemLabel={(rider) => rider.name || ''}
        searchFilter={(rider, searchTerm) => {
          const normalizedSearch = normalizeString(searchTerm);
          const lowerSearch = searchTerm.toLowerCase();

          return !!(
            normalizeString(rider?.name || '').includes(normalizedSearch) ||
            normalizeString(getRiderTeamDisplay(rider) || '').includes(normalizedSearch) ||
            rider?.country?.toLowerCase().includes(lowerSearch)
          );
        }}
        isEqual={(r1, r2) => {
          const id1 = r1.id || (r1 as { nameID?: string }).nameID || r1.name;
          const id2 = r2.id || (r2 as { nameID?: string }).nameID || r2.name;
          return id1 === id2;
        }}
        renderItem={(rider, index, isSelected) => (
          <PlayerRow
            showPoints={true}
            showRank={true}
            selectedPlayer={isSelected}
            player={rider}
            selectPlayer={() => {}}
            index={false}
            fullWidth={true}
          />
        )}
        renderSelectedItem={(rider, _index, onRemove) => (
          <PlayerRow
            showRank={true}
            showPoints={true}
            showButton={false}
            player={rider}
            selectPlayer={onRemove}
            index={false}
            fullWidth={true}
          />
        )}
      />

      {usedRiderIds.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Show used riders ({usedRiderIds.length})
          </summary>
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-32 overflow-y-auto">
            {usedRiderIds.map((id, i) => {
              const rider = riders.find(r => (r.id || (r as { nameID?: string }).nameID) === id);
              return (
                <span key={id} className="inline-block mr-2 mb-1">
                  {rider?.name || id}{i < usedRiderIds.length - 1 ? ',' : ''}
                </span>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
