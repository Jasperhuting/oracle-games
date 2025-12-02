'use client'

import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { TeamSelector } from "./TeamSelector";
import { Team } from "@/lib/scraper/types";
import { Flag } from "./Flag";
import process from "process";
import { normalizeString } from "@/lib/utils/stringUtils";

const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

interface Rider {
  id: string;
  name: string;
  country: string;
  team?: string;
  teamId?: string;
  jerseyImage?: string;
  retired: boolean;
  rank?: number;
  points?: number;
}

export const RidersManagementTab = () => {
  const { user } = useAuth();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithoutTeam, setShowOnlyWithoutTeam] = useState(false);
  const BATCH_SIZE = 1000;
  const hasFetchedRef = useRef(false);

  // Inline editing state
  const [editingRiderTeam, setEditingRiderTeam] = useState<string | null>(null);

  // Close editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-editing]')) {
        setEditingRiderTeam(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadRiders = async (isLoadingMore = false) => {
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/getRankings?year=${YEAR}&limit=3000`);
      if (!response.ok) {
        throw new Error('Failed to load riders');
      }
      const data = await response.json();

      // Transform riders data
      const ridersData = (data.riders || []).map((r: any) => ({
        id: r.nameID || r.id,
        name: r.name,
        country: r.country,
        team: r.team?.name,
        teamId: r.team?.nameID || r.team?.slug,
        jerseyImage: r.jerseyImage,
        retired: r.retired || false,
        rank: r.rank,
        points: r.points,
      }));

      if (isLoadingMore) {
        setRiders(prev => [...prev, ...ridersData]);
      } else {
        setRiders(ridersData);
      }
    } catch (error: any) {
      console.error('Error loading riders:', error);
      setError(error.message || 'Failed to load riders');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreRiders = () => {
    loadRiders(true);
  };

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadRiders(false);
    }
  }, []);

  // Update rider team
  const handleUpdateRiderTeam = async (riderId: string, teamId: string, teamName: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/riders/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: user.uid,
          riderId,
          teamId,
          teamName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update rider team');
      }

      // Update local state
      setRiders(riders.map(r =>
        r.id === riderId ? { ...r, team: teamName, teamId } : r
      ));

      setEditingRiderTeam(null);
    } catch (error: any) {
      console.error('Error updating rider team:', error);
      alert(error.message || 'Failed to update rider team');
    }
  };

  // Toggle rider retired status
  const handleToggleRetired = async (riderId: string, currentRetired: boolean) => {
    if (!user) return;

    try {
      const response = await fetch('/api/riders/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: user.uid,
          riderId,
          retired: !currentRetired,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update rider status');
      }

      // Update local state
      setRiders(riders.map(r =>
        r.id === riderId ? { ...r, retired: !currentRetired } : r
      ));
    } catch (error: any) {
      console.error('Error updating rider status:', error);
      alert(error.message || 'Failed to update rider status');
    }
  };


  const filteredRiders = riders.filter(rider => {
    // Search filter with normalization
    const normalizedSearch = normalizeString(searchTerm);
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = normalizeString(rider.name).includes(normalizedSearch) ||
      normalizeString(rider.team || '').includes(normalizedSearch) ||
      rider.country?.toLowerCase().includes(lowerSearch);

    // Team filter
    const matchesTeamFilter = !showOnlyWithoutTeam || !rider.team || rider.team === '';

    return matchesSearch && matchesTeamFilter;
  });

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">Loading riders...</div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search riders by name, team, or country..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Filter Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="show-without-team"
            checked={showOnlyWithoutTeam}
            onChange={(e) => setShowOnlyWithoutTeam(e.target.checked)}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
          />
          <label htmlFor="show-without-team" className="ml-2 text-sm text-gray-700 cursor-pointer">
            Show only riders without a team
          </label>
        </div>
      </div>

      {/* Riders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Country</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Team</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Points</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Retired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No riders found
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider) => {
                  const isEditingTeam = editingRiderTeam === rider.id;

                  return (
                    <tr key={rider.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{rider.rank || '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{rider.name}</td>

                      {/* Country - Read Only */}
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {<Flag countryCode={rider.country || '-'} />}
                      </td>

                      {/* Team - Inline Editable */}
                      <td
                        className="px-4 py-3 text-sm text-gray-600 cursor-pointer relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRiderTeam(rider.id);
                        }}
                      >
                        {isEditingTeam ? (
                          <div data-editing className="relative z-50">
                            <TeamSelector
                              selectedTeams={
                                rider.teamId
                                  ? [{
                                      id: rider.teamId,
                                      name: rider.team || '',
                                      slug: rider.teamId,
                                    } as Team]
                                  : []
                              }
                              setSelectedTeams={(teams: Team[]) => {
                                if (teams.length > 0) {
                                  const team = teams[0];
                                  const teamId = team.id || team.slug || '';
                                  const teamName = team.name || '';
                                  if (teamId) {
                                    handleUpdateRiderTeam(rider.id, teamId, teamName);
                                  }
                                }
                              }}
                              multiSelect={false}
                              multiSelectShowSelected={false}
                            />
                          </div>
                        ) : (
                          <span className="hover:bg-gray-100 px-2 py-1 rounded">
                            {rider.team || '-'}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-600">{rider.points || '-'}</td>

                      {/* Retired - Checkbox */}
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={rider.retired}
                          onChange={() => handleToggleRetired(rider.id, rider.retired)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Showing count and Load More */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {filteredRiders.length} of {riders.length} riders loaded
        </div>
      </div>
    </div>
  );
};
