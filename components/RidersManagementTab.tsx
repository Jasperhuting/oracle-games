'use client'

import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { TeamSelector } from "./TeamSelector";
import { Team } from "@/lib/scraper/types";
import { Flag } from "./Flag";
import { normalizeString } from "@/lib/utils/stringUtils";
import { ConfirmDialog } from "./ConfirmDialog";
import { Rider } from "@/lib/types/rider";
import { useRankings } from "@/contexts/RankingsContext";
import { useTranslation } from "react-i18next";

export const RidersManagementTab = () => {
  const { user } = useAuth();
  const { riders: rankingsRiders, refetch: refetchRankings } = useRankings();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithoutTeam, setShowOnlyWithoutTeam] = useState(false);
  const BATCH_SIZE = 1000;
  const hasFetchedRef = useRef(false);

  const { t } = useTranslation(); 

  // Inline editing state
  const [editingRiderTeam, setEditingRiderTeam] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);

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
      // Load from context
      if (rankingsRiders.length === 0) {
        await refetchRankings();
      }

      // Use riders from context (already in the correct format)
      setRiders(rankingsRiders);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error loading riders:', error);
        setError(error.message || 'Failed to load riders');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };


  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadRiders(false);
    }
  }, []);

  // Update rider team
  const handleUpdateRiderTeam = async (riderId: string, teamId: string | null, teamName: string | null) => {
    if (!user) return;

    try {
      const response = await fetch('/api/riders/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: user.uid,
          riderId,
          teamId, // Only send team reference ID, not the name
          year: 2026,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update rider team');
      }

      // Update local state with properly formatted team object
      setRiders(riders.map(r =>
        r.id === riderId 
          ? { 
              ...r, 
              team: teamName && teamId ? { name: teamName, id: teamId } : undefined,
              teamId: teamId || undefined 
            } 
          : r
      ));

      setEditingRiderTeam(null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error updating rider team:', error);
        setInfoDialog({
          title: 'Error',
          description: error.message || 'Failed to update rider team.',
        });
      }
    }
  };

  // Remove team from rider
  const handleRemoveTeam = async (riderId: string) => {
    if (!user) return;
    await handleUpdateRiderTeam(riderId, null, null); // Pass null for both teamId and teamName
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
          year: 2026,
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
    } catch (error: unknown) { 
      if (error instanceof Error) {
        console.error('Error updating rider status:', error);
        setInfoDialog({
          title: 'Error',
          description: error.message || 'Failed to update rider status.',
        });
      }
    }
  };


  const filteredRiders = riders.filter(rider => {
    // Search filter with normalization
    const normalizedSearch = normalizeString(searchTerm);
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch = normalizeString(rider.name).includes(normalizedSearch) ||
      normalizeString(rider.team?.name || '').includes(normalizedSearch) ||
      rider.country?.toLowerCase().includes(lowerSearch);

    // Team filter
    const matchesTeamFilter = !showOnlyWithoutTeam || !rider.team || rider.team?.name === '';

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
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('global.rank')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('global.name')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('global.country')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('global.team')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t('global.points')}</th>
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
                      <td className="px-4 py-3 text-sm text-gray-600">
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
                          <div className="flex items-center gap-2">
                            <span 
                              className="hover:bg-gray-100 px-2 py-1 rounded cursor-pointer flex-1 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingRiderTeam(rider.id);
                              }}
                            >
                              {rider.team?.name || '-'}
                            </span>
                            {rider.team?.name && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTeam(rider.id);
                                }}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium cursor-pointer"
                                title="Remove team"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-600">{rider.points || '-'}</td>

                      {/* Retired - Checkbox */}
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={rider.retired || false}
                          onChange={() => handleToggleRetired(rider.id, rider.retired || false)}
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

      {/* Info Dialog for messages previously shown with alert() */}
      {infoDialog && (
        <ConfirmDialog
          open={true}
          onClose={() => setInfoDialog(null)}
          onConfirm={() => setInfoDialog(null)}
          title={infoDialog.title}
          description={infoDialog.description}
          confirmText="OK"
          cancelText="Close"
        />
      )}
    </div>
  );
};
