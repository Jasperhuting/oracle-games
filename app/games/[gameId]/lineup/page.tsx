'use client'

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { TeamGroupedRiderSelector } from "@/components/TeamGroupedRiderSelector";
import { TeamSelector } from "@/components/TeamSelector";
import { ClassSelector } from "@/components/ClassSelector";
import { Team, Rider } from "@/lib/scraper/types";
import { Flag } from "@/components/Flag";
import { ArrowUp } from "tabler-icons-react";

export default function LineupPage({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gameId, setGameId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_allTeams, setAllTeams] = useState<Team[]>([]);
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedRiders, setSelectedRiders] = useState<Rider[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'teams' | 'riders'>('riders');
  const [gameName, setGameName] = useState<string>('');
  const [raceType, setRaceType] = useState<string>('');

 const [showBanner, setShowBanner] = useState(true);

useEffect(() => {
  const checkBannerCookie = () => {
    // Clear any localStorage value (legacy)
    if (typeof window !== 'undefined' && localStorage.getItem('hide-beta-banner') !== null) {
      localStorage.removeItem('hide-beta-banner');
    }

    const cookies = document.cookie.split('; ');
    const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));

    if (hideBannerCookie) {
      // Extract the value after 'hide-beta-banner='
      const value = hideBannerCookie.split('=')[1];
      setShowBanner(value !== 'true');
    } else {
      setShowBanner(true);
    }
  };

  // Check initially
  checkBannerCookie();

  // Poll for cookie changes (since cookies don't trigger events)
  const interval = setInterval(checkBannerCookie, 100);

  return () => clearInterval(interval);
}, []);

  useEffect(() => {
    params.then(p => setGameId(p.gameId));
  }, [params]);

  const loadLineup = (async () => {
    try {
      setLoading(true);

      // Load game details
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (!gameResponse.ok) throw new Error('Failed to load game');
      const gameData = await gameResponse.json();
      setGameName(gameData.game.name);
      setRaceType(gameData.game.raceType || '');

      // Load lineup
      const response = await fetch(`/api/games/${gameId}/lineup`);
      if (!response.ok) {
        throw new Error('Failed to load race lineup');
      }
      const data = await response.json();

      // Convert API teams to Team type
      const teams: Team[] = (data.teams || []).map((t: any) => ({
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
      const riders: Rider[] = (data.riders || []).map((r: any) => {
        // Find the team class from the teams array
        const teamData = teams.find(t => t.id === r.teamId || t.name === r.team);

        return {
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
            teamImage: teamData?.image || '',
            class: teamData?.class || r.teamClass || '',
            country: r.country || '',
            points: 0,
          },
          nameID: r.id,
          dropout: false,
        };
      });

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
    } catch (error: any) {
      console.error('Error loading lineup:', error);
      setError(error.message || 'Failed to load race lineup');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!gameId) return;

    loadLineup();
  }, [gameId, user, authLoading, router]);

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

      const result = await response.json();

      if (result.gamesUpdated && result.gamesUpdated > 1) {
        alert(`Lineup saved successfully for ${result.gamesUpdated} games sharing this race!\n\nRiders added: ${result.ridersAdded}\nRiders removed: ${result.ridersRemoved}`);
      } else {
        alert('Lineup saved successfully!');
      }
    } catch (error: any) {
      console.error('Error saving lineup:', error);
      setError(error.message || 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
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

  const handleSelectAllRiders = () => {
    // Select all riders from the filtered list (respecting team and class filters)
    setSelectedRiders(filteredRiders);
  };

  // Filter riders based on selected classes and teams
  const filteredRiders = useMemo(() => {
    let filtered = allRiders;

    // Filter by selected teams (if any teams are selected)
    if (selectedTeams.length > 0) {
      const selectedTeamIds = new Set(selectedTeams.map(t => t.id || t.slug));
      filtered = filtered.filter(rider => {
        const riderTeamId = rider.team?.slug || rider.team?.nameID || '';
        return selectedTeamIds.has(riderTeamId);
      });
    }

    // Filter by selected classes (if any classes are selected)
    if (selectedClasses.length > 0) {
      filtered = filtered.filter(rider => {
        return selectedClasses.includes(rider.team?.class || '');
      });
    }

    return filtered;
  }, [allRiders, selectedClasses, selectedTeams]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${showBanner ? 'mt-[36px]' : 'mt-0'} `}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Manage Race Lineup</h1>
              {gameName && <p className="text-sm text-gray-600 mt-1">{gameName}</p>}
            </div>
            <Button
              type="button"
              text="← Back to Games"
              onClick={() => router.push('/games')}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

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
          

            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Add/Remove Riders</h3>
                {raceType === 'season' && (
                  <Button
                    type="button"
                    text={
                      selectedTeams.length > 0 || selectedClasses.length > 0
                        ? `Select All Filtered Riders (${filteredRiders.length})`
                        : "Select All Riders"
                    }
                    onClick={handleSelectAllRiders}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-sm"
                  />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {selectedTeams.length > 0 ? (
                  <>Showing riders from {selectedTeams.length} selected team{selectedTeams.length > 1 ? 's' : ''}. Go to the Teams tab to change team selection.</>
                ) : (
                  <>No teams selected - showing all riders. Use the Teams tab to filter riders by team.</>
                )}
                {selectedClasses.length > 0 && ` Filtered by ${selectedClasses.length} class${selectedClasses.length > 1 ? 'es' : ''}.`}
                {raceType === 'season' && selectedTeams.length === 0 && selectedClasses.length === 0 && ' You can select all riders at once using the button above.'}
              </p>
              <div className="flex space-x-2">
              <ClassSelector
                selectedClasses={selectedClasses}
                setSelectedClasses={setSelectedClasses}
                multiSelect={true}
                multiSelectShowSelected={false}
              />
              <TeamGroupedRiderSelector
                riders={filteredRiders}
                selectedRiders={selectedRiders}
                setSelectedRiders={setSelectedRiders}
              />
              </div>
            </div>

            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
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
                  <div className="overflow-y-auto">
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
            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-3">Select Teams to Filter Riders</h3>
              <p className="text-sm text-gray-600 mb-3">
                Select teams to filter which riders are available in the Riders tab. Only riders from selected teams will be shown.
                If no teams are selected, all riders are available.
              </p>
              <TeamSelector
                selectedTeams={selectedTeams}
                setSelectedTeams={handleToggleTeams}
                multiSelect={true}
                multiSelectShowSelected={false}
                showSelected={false}
              />
            </div>

            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
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
                  <div className="overflow-y-auto">
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

        {/* Save Button */}
        <div className="mt-6 flex gap-2 justify-center sticky bottom-0 z-10 bg-white/90 rounded-lg border border-gray-200 backdrop-blur-sm p-4 w-full">
          <Button
            text={saving ? "Saving..." : "Save Lineup"}
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary hover:bg-primary"
          />
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            disabled={saving}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium"
          >
            <span className="flex items-center gap-1"><ArrowUp size={16} /> Scroll to top</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
