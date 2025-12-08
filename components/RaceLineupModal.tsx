'use client'

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { PlayerSelector } from "./PlayerSelector";
import { TeamSelector } from "./TeamSelector";
import { Team, Rider } from "@/lib/scraper/types";
import { Flag } from "./Flag";

interface RaceLineupModalProps {
  gameId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RaceLineupModal = ({ gameId, onClose, onSuccess }: RaceLineupModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedRiders, setSelectedRiders] = useState<Rider[]>([]);
  const [viewMode, setViewMode] = useState<'teams' | 'riders'>('riders');

  useEffect(() => {
    const loadLineup = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}/lineup`);
        if (!response.ok) {
          throw new Error('Failed to load race lineup');
        }
        const data = await response.json();

        console.log('data.teams', data.teams);

        // Convert API teams to Team type
        // TODO: Remove any
        const teams: Team[] = (data.teams || []).map((t: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          country: t.country,
          class: t.class,
          image: t.jerseyImage,
          pcsRank: t.pcsRank,
          rank: t.uciRank,
          points: t.points,
          slug: t.id,
        }));

        // Convert API riders to Rider type
        // TODO: Remove any
        const riders: Rider[] = (data.riders || []).map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: r.id,
          name: r.name,
          firstName: r.firstName,
          lastName: r.lastName,
          country: r.country,
          startNumber: r.startNumber,
          rank: r.rank || 0,
          points: r.points || 0,
          team: {
            name: r.team,
            rank: 0,
            nameID: r.teamId || '',
            slug: r.teamId || '',
            class: '',
            country: r.country || '',
            points: 0,
          },
          nameID: r.id,
          dropout: false,
        }));

        setAllTeams(teams);
        setAllRiders(riders);

        // Set selected teams based on currentTeamIds
        const currentTeamIdSet = new Set(data.currentTeamIds || []);
        const preSelectedTeams = teams.filter(t => currentTeamIdSet.has(t.id));
        setSelectedTeams(preSelectedTeams);

        // Set selected riders based on currentRiderIds
        const currentRiderIdSet = new Set(data.currentRiderIds || []);
        const preSelectedRiders = riders.filter(r => currentRiderIdSet.has(r.id));
        setSelectedRiders(preSelectedRiders);
      } catch (error: unknown) {
        console.error('Error loading lineup:', error);
        setError(error instanceof Error ? error.message : 'Failed to load race lineup');
      } finally {
        setLoading(false);
      }
    };

    loadLineup();
  }, [gameId]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const teamIds = selectedTeams.map(t => String(t.id || t.slug || '')).filter(id => id);
      const riderIds = selectedRiders.map(r => String(r.id || r.nameID || '')).filter(id => id);

      const response = await fetch(`/api/games/${gameId}/lineup`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          teamIds: teamIds,
          riderIds: riderIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update lineup');
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('Error saving lineup:', error);
      setError(error instanceof Error ? error.message : 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRiders = (newRiders: Rider[]) => {
    // When multiSelect is true, Selector passes the entire updated array
    // Check if a new rider was added (array got longer)
    if (newRiders.length > selectedRiders.length) {
      // Find the newly added rider
      const addedRider = newRiders.find(newR =>
        !selectedRiders.some(existingR =>
          existingR.name === newR.name && existingR.rank === newR.rank
        )
      );

      if (addedRider) {
        // Put the new rider at the top
        const othersRiders = newRiders.filter(r =>
          !(r.name === addedRider.name && r.rank === addedRider.rank)
        );
        setSelectedRiders([addedRider, ...othersRiders]);
        return;
      }
    }

    // If removed or no change, just set it directly
    setSelectedRiders(newRiders);
  };

  const handleRemoveRider = (riderId: string) => {
    setSelectedRiders(selectedRiders.filter(r => r.id !== riderId));
  };

  const handleToggleTeams = (newTeams: Team[]) => {
    // When multiSelect is true, Selector passes the entire updated array
    // Check if a new team was added (array got longer)
    if (newTeams.length > selectedTeams.length) {
      // Find the newly added team
      const addedTeam = newTeams.find(newT =>
        !selectedTeams.some(existingT => existingT.name === newT.name)
      );

      if (addedTeam) {
        // Put the new team at the top
        const otherTeams = newTeams.filter(t => t.name !== addedTeam.name);
        setSelectedTeams([addedTeam, ...otherTeams]);
        return;
      }
    }

    // If removed or no change, just set it directly
    setSelectedTeams(newTeams);
  };

  const handleRemoveTeam = (teamId: string) => {
    setSelectedTeams(selectedTeams.filter(t => t.id !== teamId));
  };

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Manage Race Lineup</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {!loading && (
            <>
              {/* View Toggle */}
              <div className="flex space-x-2 mb-6">
                <button
                  onClick={() => setViewMode('riders')}
                  className={`px-4 py-2 rounded-md font-medium ${
                    viewMode === 'riders'
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Riders ({selectedRiders.length})
                </button>
                <button
                  onClick={() => setViewMode('teams')}
                  className={`px-4 py-2 rounded-md font-medium ${
                    viewMode === 'teams'
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Teams ({selectedTeams.length})
                </button>
              </div>

              {/* Riders View */}
              {viewMode === 'riders' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-3">Add/Remove Riders</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Search and click riders to add or remove from the race lineup. Selected riders are highlighted.
                    </p>
                    <PlayerSelector
                      selectedPlayers={selectedRiders}
                      setSelectedPlayers={handleToggleRiders}
                      multiSelect={true}
                      multiSelectShowSelected={false}
                      items={allRiders}
                    />
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">
                      Current Lineup ({selectedRiders.length} riders)
                    </h3>

                    {selectedRiders.length === 0 ? (
                      <p className="text-gray-500 text-sm py-8 text-center">
                        No riders selected. Add riders using the selector above.
                      </p>
                    ) : (
                      <div className="border border-gray-200 rounded-md overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-4 p-3 bg-gray-100 font-semibold text-sm border-b border-gray-200">
                          <div className="col-span-1">Rank</div>
                          <div className="col-span-4">Name</div>
                          <div className="col-span-3">Team</div>
                          <div className="col-span-2">Points</div>
                          <div className="col-span-1">Country</div>
                          <div className="col-span-1"></div>
                        </div>

                        {/* Riders List */}
                        <div className="max-h-[400px] overflow-y-auto">
                          {selectedRiders.map((rider, index) => (
                            <div
                              key={rider.id || index}
                              className="grid grid-cols-12 gap-4 p-3 border-b border-gray-100 hover:bg-gray-50 items-center"
                            >
                              <div className="col-span-1 text-sm">{rider.rank || '-'}</div>
                              <div className="col-span-4 text-sm font-medium truncate" title={rider.name}>
                                {rider.name}
                              </div>
                              <div className="col-span-3 text-sm text-gray-600 truncate" title={rider.team?.name}>
                                {rider.team?.name || '-'}
                              </div>
                              <div className="col-span-2 text-sm">{rider.points || 0}</div>
                              <div className="col-span-1">
                                {rider.country && <Flag countryCode={rider.country} />}
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => handleRemoveRider(rider.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Teams View */}
              {viewMode === 'teams' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-3">Add/Remove Teams</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Search and click teams to add or remove from the race lineup. Selected teams are highlighted.
                    </p>
                    <TeamSelector
                      selectedTeams={selectedTeams}
                      setSelectedTeams={handleToggleTeams}
                      multiSelect={true}
                      multiSelectShowSelected={false}
                      showSelected={false}
                    />
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">
                      Current Teams ({selectedTeams.length} teams)
                    </h3>

                    {selectedTeams.length === 0 ? (
                      <p className="text-gray-500 text-sm py-8 text-center">
                        No teams selected. Add teams using the selector above.
                      </p>
                    ) : (
                      <div className="border border-gray-200 rounded-md overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-13 gap-4 p-3 bg-gray-100 font-semibold text-sm border-b border-gray-200">
                          <div className="col-span-1">Rank</div>
                          <div className="col-span-5">Name</div>
                          <div className="col-span-2">Class</div>
                          <div className="col-span-2">Points</div>
                          <div className="col-span-1">Jersey</div>
                          <div className="col-span-1"></div>
                        </div>

                        {/* Teams List */}
                        <div className="max-h-[400px] overflow-y-auto">
                          {selectedTeams.map((team, index) => (
                            <div
                              key={team.id || index}
                              className="grid grid-cols-13 gap-4 p-3 border-b border-gray-100 hover:bg-gray-50 items-center"
                            >
                              <div className="col-span-1 text-sm">{team.pcsRank || '-'}</div>
                              <div className="col-span-5 text-sm font-medium truncate" title={team.name}>
                                {team.name?.replace(/\s*\d{4}$/, '')}
                              </div>
                              <div className="col-span-2 text-sm text-gray-600">{team.class || '-'}</div>
                              <div className="col-span-2 text-sm">{team.points || 0}</div>
                              <div className="col-span-1">
                                {team.image && <img src={`https://www.procyclingstats.com/${team.image}`} alt={team.name} className="w-6 h-6" />}
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  onClick={() => handleRemoveTeam(team.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {viewMode === 'teams'
              ? `${selectedTeams.length} teams in lineup`
              : `${selectedRiders.length} riders in lineup`}
          </div>
          <div className="space-x-3">
            <Button
              text="Cancel"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
            />
            <Button
              text={saving ? "Saving..." : "Save Lineup"}
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-primary hover:bg-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
