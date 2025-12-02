'use client'
export const dynamic = "force-dynamic";

import { ActionPanel } from "@/components/ActionPanel";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { TeamSelector } from "@/components/TeamSelector";
import { ClassSelector } from "@/components/ClassSelector";
import { Country, Team, Rider } from "@/lib/scraper";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { List } from 'react-window';
import { Flag } from "@/components/Flag";
import countriesList from '@/lib/country.json';
import toast from "react-hot-toast";
import process from "process";
import { useStreamGroup } from "@motiadev/stream-client-react";

const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

export default function CreateRankingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [rankedRiders, setRankedRiders] = useState<unknown[]>([]);
  const [teamsList, setTeamsList] = useState<unknown[]>([]);
  const [teamsArray, setTeamsArray] = useState<unknown[]>([]);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [loadingToastId, setLoadingToastId] = useState<string | undefined>(undefined);
  const [processedStages, setProcessedStages] = useState<Set<string>>(new Set());

  const [selectedPlayers, setSelectedPlayers] = useState<Rider[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<Country[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const [viewRank, setViewRank] = useState(true);
  const [viewClass, setViewClass] = useState(true);
  const [viewPoints, setViewPoints] = useState(true);
  const [viewCountry, setViewCountry] = useState(true);
  const [viewImage, setViewImage] = useState(true);


  // Inline editing state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingRiderTeam, setEditingRiderTeam] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  // Filtered lists based on selected countries and players
  const [filteredRiders, setFilteredRiders] = useState<unknown[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<unknown[]>([]);

  // Close editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any editing area
      if (!target.closest('[data-editing]')) {
        setEditingRiderTeam(null);
        setEditingTeamId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);



  const setStartingListRace = async ({ year, race }: { year: number, race: string }) => {
    const response = await fetch(`/api/setStartingListRace?year=${year}&race=${race}`);
    const data = await response.json();
  }

  const getStartingListRace = async ({ year, race }: { year: number, race: string }) => {
    const response = await fetch(`/api/getRidersFromRace?year=${year}&race=${race}`);
    const data = await response.json();
    // setStartingList(data.riders);
  }


  const getAllTeams = async () => {
    const response = await fetch(`/api/getTeams`);
    const data = await response.json();

    setTeamsArray(data.teams);
    return data;
  };

  useEffect(() => {
    getAllTeams();
  }, []);


  const streamGroup = useStreamGroup<{ id: string, stage: string, year: number, teamName: string, dataTeams?: any, dataRiders?: any }>({
    streamName: 'updates',
    groupId: traceId || 'default'
  })


  useEffect(() => {
    if (streamGroup && streamGroup.data && streamGroup.data.length > 0) {
      // Get all stages from the stream group data array
      const stages = streamGroup.data.filter((item: Record<string, unknown>) => item && item.stage).map((item: Record<string, unknown>) => item.stage);

      // Process stages in order: fetching-team, update-team, fetching-riders, update-riders
      const stageOrder = ['fetching-team', 'update-team', 'fetching-riders', 'update-riders'];

      // Find new stages to process
      const newStagesToProcess = stageOrder.filter(
        (expectedStage) => stages.includes(expectedStage) && !processedStages.has(expectedStage)
      );

      if (newStagesToProcess.length > 0) {
        // Process stages sequentially with delays
        let delay = 0;
        newStagesToProcess.forEach((expectedStage) => {
          setTimeout(() => {

            // Dismiss initial loading toast on first stage
            if (expectedStage === 'fetching-team' && loadingToastId) {
              toast.dismiss(loadingToastId);
            }

            // Show different toasts based on the stage
            if (expectedStage === 'fetching-team') {
              toast.loading('Fetching team data...', { id: 'progress-toast' });
            } else if (expectedStage === 'update-team') {
              toast.dismiss('progress-toast');
              toast.success('Team data updated! 🏆', { duration: 2000 });
            } else if (expectedStage === 'fetching-riders') {
              toast.loading('Fetching riders data...', { id: 'progress-toast' });
            } else if (expectedStage === 'update-riders') {
              toast.dismiss('progress-toast');
              toast.success('Riders data updated! 🚴', { duration: 3000 });
            }

            // Mark this stage as processed
            setProcessedStages(prev => new Set([...prev, expectedStage]));
          }, delay);

          // Add delay for next stage (500ms between stages)
          delay += 500;
        });
      }
    }
  }, [streamGroup, processedStages, loadingToastId])



  const getEnrichedRiders = async () => {

    teamsArray.forEach(async (team: any) => {

      let teamSlug = team.slug;

      if (teamSlug === 'q365-pro-cycing-team-2025') {
        teamSlug = 'q365-pro-cycling-team-2025'
      }

      const response = await fetch(`/api/setEnrichedRiders?year=${YEAR}&team=${teamSlug}`);
      const data = await response.json();
    })

  };

  const getEnrichedTeams = async () => {

    teamsArray.forEach(async (team: any) => {

      let teamSlug = team.slug;

      if (teamSlug === 'q365-pro-cycing-team-2025') {
        teamSlug = 'q365-pro-cycling-team-2025'
      }

      const response = await fetch(`/api/setEnrichedTeams?year=${YEAR}&team=${teamSlug}`);
      const data = await response.json();
    })

  };

  const [progress, setProgress] = useState({ current: 0, total: 0, isRunning: false });
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [usingCache, setUsingCache] = useState(false);

  // Cache helpers
  const getCacheKey = (type: 'riders' | 'teams', year: number) => `${type}_${year}`;
  const getCacheMetaKey = (year: number) => `cache_meta_${year}`;

  const loadFromCache = (year: number) => {
    try {
      const cacheMetaKey = getCacheMetaKey(year);
      const cacheMeta = localStorage.getItem(cacheMetaKey);

      if (cacheMeta) {
        const meta = JSON.parse(cacheMeta);
        const now = Date.now();
        const oneYear = 365 * 24 * 60 * 60 * 1000;
        const cacheAge = now - meta.timestamp;

        // Check if cache is still valid (less than 1 year old)
        if (now - meta.timestamp < oneYear) {
          const ridersCache = localStorage.getItem(getCacheKey('riders', year));
          const teamsCache = localStorage.getItem(getCacheKey('teams', year));

          if (ridersCache && teamsCache) {
            const riders = JSON.parse(ridersCache);
            const teams = JSON.parse(teamsCache);

            setRankedRiders(riders);
            setTeamsList(teams);
            setTotalCount(meta.totalCount || riders.length);
            setUsingCache(true);
            return true;
          } else {
          }
        } else {
        }
      } else {
      }
    } catch (error) {
    }
    return false;
  };

  const saveToCache = (year: number, riders: unknown[], teams: unknown[], totalCount: number) => {
    try {
      localStorage.setItem(getCacheKey('riders', year), JSON.stringify(riders));
      localStorage.setItem(getCacheKey('teams', year), JSON.stringify(teams));
      localStorage.setItem(getCacheMetaKey(year), JSON.stringify({
        timestamp: Date.now(),
        totalCount
      }));
      setUsingCache(true);
    } catch (error) {
      // If localStorage is full, clear old caches
      clearOldCaches(year);
      // Try again after clearing
      try {
        localStorage.setItem(getCacheKey('riders', year), JSON.stringify(riders));
        localStorage.setItem(getCacheKey('teams', year), JSON.stringify(teams));
        localStorage.setItem(getCacheMetaKey(year), JSON.stringify({
          timestamp: Date.now(),
          totalCount
        }));
        setUsingCache(true);
      } catch (retryError) {
      }
    }
  };

  const clearCache = (year: number) => {
    localStorage.removeItem(getCacheKey('riders', year));
    localStorage.removeItem(getCacheKey('teams', year));
    localStorage.removeItem(getCacheMetaKey(year));
    setUsingCache(false);
  };

  // Fetch available classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch('/api/getClasses');
        const data = await response.json();
        setAvailableClasses(data.classes || []);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  // Update team class
  const handleUpdateTeamClass = async (teamId: string, newClass: string) => {
    try {
      const response = await fetch('/api/updateTeamClass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, teamClass: newClass }),
      });

      if (!response.ok) {
        throw new Error('Failed to update team class');
      }

      // Update local state
      setTeamsList(teamsList.map(team =>
        team.id === teamId ? { ...team, class: newClass } : team
      ));
      setFilteredTeams(filteredTeams.map(team =>
        team.id === teamId ? { ...team, class: newClass } : team
      ));

      setEditingTeamId(null);
    } catch (error) {
      console.error('Error updating team class:', error);
      alert('Failed to update team class');
    }
  };

  // Update rider team
  const handleUpdateRiderTeam = async (riderId: string, teamSlug: string) => {
    try {
      const response = await fetch('/api/updateRiderTeam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId, teamSlug, YEAR }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rider team');
      }

      const result = await response.json();

      // Update local state
      setRankedRiders(rankedRiders.map(rider =>
        rider.id === riderId ? { ...rider, team: result.team } : rider
      ));
      setFilteredRiders(filteredRiders.map(rider =>
        rider.id === riderId ? { ...rider, team: result.team } : rider
      ));

      setEditingRiderTeam(null);
    } catch (error) {
      console.error('Error updating rider team:', error);
      alert('Failed to update rider team');
    }
  };

  const clearOldCaches = (currentYear: number) => {
    // Clear caches for years other than current
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('riders_') || key.startsWith('teams_') || key.startsWith('cache_meta_'))) {
        if (!key.includes(`_${currentYear}`)) {
          localStorage.removeItem(key);
        }
      }
    }
  };

  const fetchData = async ({ year, append = false, forceRefresh = false }: { year: number, append?: boolean, forceRefresh?: boolean }) => {
    try {
      // Try to load from cache first (only on initial load, not append)
      if (!append && !forceRefresh) {
        const cacheLoaded = loadFromCache(year);
        if (cacheLoaded) {
          return;
        }
      }

      setLoadingMore(true);
      setUsingCache(false); // We're fetching from database, not using cache

      const currentOffset = append ? rankedRiders.length : 0;
      const limit = 500; // Fetch 500 at a time to avoid quota issues

      // Fetch riders with pagination
      const ridersResponse = await fetch(`/api/getRankings?year=${year}&limit=${limit}&offset=${currentOffset}`);
      const ridersData = await ridersResponse.json();

      let allRiders = append ? [...rankedRiders, ...(ridersData.riders || [])] : ridersData.riders || [];

      if (append) {
        setRankedRiders(allRiders);
      } else {
        setRankedRiders(ridersData.riders || []);
        allRiders = ridersData.riders || [];
      }

      // Update total count if available
      if (ridersData.pagination?.totalCount) {
        setTotalCount(ridersData.pagination.totalCount);
      }

      // Fetch teams (only on initial load)
      let teams = teamsList;
      if (!append) {
        const teamsResponse = await fetch('/api/getTeams');
        const teamsData = await teamsResponse.json();
        teams = teamsData.teams || [];
        setTeamsList(teams);
      }

      // Save to cache when all data is loaded
      const totalNeeded = ridersData.pagination?.totalCount || 0;
      if (totalNeeded > 0 && allRiders.length >= totalNeeded) {
        saveToCache(year, allRiders, teams, totalNeeded);
      } else if (totalNeeded > 0) {
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreRiders = () => {
    if (!loadingMore && totalCount && rankedRiders.length < totalCount) {
      fetchData({ year: YEAR, append: true });
    }
  };

  const loadAllData = async () => {
    if (!totalCount) {
      console.error('Cannot load all data - total count not available');
      return;
    }

    setLoadingMore(true);

    try {
      const batchSize = 500;
      let allLoadedRiders = [...rankedRiders];
      let currentOffset = rankedRiders.length;

      // Load all batches
      while (currentOffset < totalCount) {

        const ridersResponse = await fetch(`/api/getRankings?year=${YEAR}&limit=${batchSize}&offset=${currentOffset}`);
        const ridersData = await ridersResponse.json();

        const newRiders = ridersData.riders || [];

        // Break if no new riders were returned
        if (newRiders.length === 0) {
          break;
        }

        allLoadedRiders = [...allLoadedRiders, ...newRiders];
        setRankedRiders(allLoadedRiders);
        currentOffset = allLoadedRiders.length;

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Now save everything to cache
      saveToCache(YEAR, allLoadedRiders, teamsList, totalCount);

    } catch (error) {
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Only load data if not already loaded
    if (rankedRiders.length === 0 && !loadingMore) {
      fetchData({ year: YEAR });
    }
  }, [YEAR, rankedRiders.length, loadingMore]);

  useEffect(() => {
    let filtered = rankedRiders;

    // Apply country filter
    if (selectedCountries.length > 0) {
      const countryCodes = selectedCountries.map(c => c.code?.toLowerCase());
      filtered = filtered.filter(rider =>
        countryCodes.includes(rider.country?.toLowerCase())
      );
    }

    // Apply team filter
    if (selectedTeams.length > 0) {
      const teamNames = selectedTeams.map(t => t.name?.toLowerCase());
      filtered = filtered.filter(rider => {
        const riderTeamName = typeof rider.team === 'string'
          ? rider.team?.toLowerCase()
          : rider.team?.name?.toLowerCase();
        return riderTeamName && teamNames.includes(riderTeamName);
      });
    }

    // Apply player filter
    if (selectedPlayers.length > 0) {
      filtered = filtered.filter(rider =>
        selectedPlayers.some(p => p.name === rider.name && p.rank === rider.rank)
      );
    }

    // Apply class filter
    if (selectedClasses.length > 0) {
      const classNames = selectedClasses.map(c => c?.toLowerCase());
      filtered = filtered.filter(rider =>
        classNames.includes(rider.team?.class?.toLowerCase())
      );
    }

    // Riders after all filters
    setFilteredRiders(filtered);

    // Filter teams list accordingly
    let filteredTeamsList = teamsList;

    if (selectedCountries.length > 0) {
      const countryCodes = selectedCountries.map(c => c.code?.toLowerCase());
      filteredTeamsList = filteredTeamsList.filter(team =>
        countryCodes.includes(team.country?.toLowerCase())
      );
    }

    if (selectedTeams.length > 0) {
      const teamNames = selectedTeams.map(t => t.name?.toLowerCase());
      filteredTeamsList = filteredTeamsList.filter(team =>
        teamNames.includes(team.name?.toLowerCase())
      );
    }

    if (selectedClasses.length > 0) {
      const classNames = selectedClasses.map(c => c?.toLowerCase());
      filteredTeamsList = filteredTeamsList.filter(team =>
        classNames.includes(team.class?.toLowerCase())
      );
    }

    setFilteredTeams(filteredTeamsList);
  }, [selectedCountries, selectedPlayers, selectedTeams, rankedRiders, teamsList, selectedClasses]);

  const setTeams = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/createTeamRanking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year: YEAR, offset: 0 }),
      });

      const data = await response.json();

      // Refresh data after creation
      await fetchData({ year: YEAR });
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const createRanking = async () => {
    const offsetOptions = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500];

    setProgress({ current: 0, total: offsetOptions.length, isRunning: true });

    for (let i = 0; i < offsetOptions.length; i++) {
      const currentOffset = offsetOptions[i];

      setProgress({ current: i + 1, total: offsetOptions.length, isRunning: true });

      try {
        const response = await fetch('/api/createRanking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ year: YEAR, offset: currentOffset }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response for offset ${currentOffset} (${response.status}):`, errorText);
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        console.log(`Successfully processed offset ${currentOffset}:`, data.result?.riders?.length || 0, 'riders');

        // Add delay between requests to avoid rate limiting (2 seconds)
        if (i < offsetOptions.length - 1) {
          console.log(`Waiting 2 seconds before next request to avoid rate limiting...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error creating rankings for offset ${currentOffset}:`, error);
        // Wait longer after an error (5 seconds) before retrying next offset
        if (i < offsetOptions.length - 1) {
          console.log(`Error occurred, waiting 5 seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // Refresh data after all rankings are created
    await fetchData({ year: YEAR });
    setProgress({ current: 0, total: 0, isRunning: false });
    router.refresh();
  };


  const updateTeam = async () => {
    setIsLoading(true);

    // Show loading toast immediately
    const toastId = toast.loading('Starting update...');
    setLoadingToastId(toastId);
    setProcessedStages(new Set()); // Reset for the new update

    try {
      const response = await fetch('/api/updateTeam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year: YEAR, teamName: 'q365-pro-cycling-team-2025' }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.dismiss(toastId);
        toast.error('Failed to update team');
      } else {
        if (data.traceId) {
          setTraceId(data.traceId);
        } else {
          console.warn('No traceId in response');
          toast.dismiss(toastId);
        }
      }
    } catch (error) {
      console.error(error)
      toast.dismiss(toastId);
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="bg-gray-300 min-h-[100vh] h-full">
      <div className="container mx-auto">
        <h1>Create Ranking</h1>


        <div className="flex items-center justify-start gap-5 my-5">

          <Button text="update team" onClick={updateTeam} />

          <Button text={progress.isRunning ? 'Running...' : 'Create Ranking'} onClick={createRanking} disabled={isLoading || progress.isRunning} />

          <Button onClick={() => getEnrichedTeams()} text="Get Enriched Teams" />
          <Button onClick={() => getEnrichedRiders()} text="Get Enriched Riders" />
          <Button text={isLoading ? 'Loading...' : 'Set Teams'} onClick={() => setTeams()} disabled={isLoading || progress.isRunning} />
          <Button text={progress.isRunning ? 'Running...' : 'Set Starting List'} onClick={() => setStartingListRace({ year: YEAR, race: 'tour-de-france' })} disabled={isLoading || progress.isRunning} />
          <Button text={progress.isRunning ? 'Running...' : 'Get Starting List'} onClick={() => getStartingListRace({ year: YEAR, race: 'tour-de-france' })} disabled={isLoading || progress.isRunning} />
          <Button
            onClick={() => {
              clearCache(YEAR);
              setRankedRiders([]);
              setTeamsList([]);
              setTotalCount(null);
              fetchData({ year: YEAR, forceRefresh: true });
            }}
            disabled={isLoading || progress.isRunning || loadingMore}
            className={`mr-[10px] ${usingCache ? 'bg-red-500' : 'bg-gray-500'}`}
            text={usingCache ? 'Refresh from Database' : 'No Cache'}
          />
        </div>

        {usingCache && (
          <div className="mb-2.5 p-2 bg-blue-100 rounded text-sm">
            ✅ Data loaded from local cache (no database costs)
          </div>
        )}

        {!usingCache && rankedRiders.length > 0 && totalCount && rankedRiders.length < totalCount && (
          <div className="mb-2.5 p-2 bg-yellow-100 rounded text-sm">
            ⚠️ Only {rankedRiders.length} of {totalCount} riders loaded.
            Click <strong>&quot;Load All & Cache&quot;</strong> to load and save all data for later (one-time database cost).
          </div>
        )}

        {progress.isRunning && (
          <div className="mb-5 p-2.5 bg-gray-100 rounded">
            <div className="mb-1">
              Progress: {progress.current} / {progress.total}
            </div>
            <div className="w-full bg-gray-300 rounded h-5">
              <div
                className="bg-green-500 h-full rounded transition-all duration-300 ease-in-out"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}


        <ActionPanel
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
          selectedCountries={selectedCountries}
          setSelectedCountries={setSelectedCountries}
          selectedTeams={selectedTeams}
          setSelectedTeams={setSelectedTeams}
          selectedClasses={selectedClasses}
          setSelectedClasses={setSelectedClasses}
          availablePlayers={rankedRiders}
        />


        <div className="grid grid-cols-2 gap-5 mt-5">
          <div className="bg-white rounded-md p-4">
            <h2>
              Ranked Riders ({filteredRiders.length}
              {selectedPlayers.length > 0 && ` (showing ${selectedPlayers.length} selected player${selectedPlayers.length > 1 ? 's' : ''})`}
              {selectedPlayers.length === 0 && selectedCountries.length > 0 && ` (filtered by ${selectedCountries.length} countr${selectedCountries.length > 1 ? 'ies' : 'y'} from ${rankedRiders.length})`}
              {selectedPlayers.length === 0 && selectedCountries.length === 0 && totalCount && totalCount > rankedRiders.length && ` of ${totalCount}`})
            </h2>
            {filteredRiders.length === 0 ? (
              <p>No riders found{selectedPlayers.length > 0 ? ' - selected players not in loaded data' : selectedCountries.length > 0 ? ' for selected countries' : '. Click "Set Ranking" to load them'}.</p>
            ) : (
              <div>
                <div className="grid p-2 border-b-2 border-gray-400 font-bold bg-gray-100" style={{ gridTemplateColumns: '60px 1fr 1fr 80px 60px' }}>
                  <div>Rank</div>
                  <div>Name</div>
                  <div>Team</div>
                  <div>Points</div>
                  <div>Country</div>
                </div>
                <div className="relative overflow-visible">
                  <List
                    defaultHeight={600}
                    rowCount={filteredRiders.length}
                    rowHeight={(index) => {
                      const rider = filteredRiders[index];
                      return editingRiderTeam === rider.id ? 60 : 40;
                    }}
                    rowProps={{}}
                    rowComponent={({ index, style }) => {
                      const rider = filteredRiders[index];
                      const isEditing = editingRiderTeam === rider.id;

                      return (
                        <div
                          className="grid p-2 border-b border-gray-200 items-center overflow-visible"
                          style={{
                            ...style,
                            gridTemplateColumns: '60px 1fr 320px 80px 60px',
                            zIndex: isEditing ? 999 : 1
                          }}
                        >
                          <div>{rider.rank}</div>
                          <div className="whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">{rider.name}</div>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRiderTeam(rider.id);
                            }}
                            className="cursor-pointer relative overflow-visible"
                          >
                            {isEditing ? (
                              <div data-editing>
                                <TeamSelector
                                  selectedTeams={rider?.team ? [rider.team] : []}
                                  setSelectedTeams={(teams: Team[]) => {
                                    if (teams.length > 0 && teams[0].slug) {
                                      handleUpdateRiderTeam(rider.id, teams[0].slug);
                                    }
                                    setEditingRiderTeam(null);
                                  }}
                                  multiSelect={false}
                                  multiSelectShowSelected={false}
                                  placeholder={rider?.team?.name?.replace(/\s*\d{4}$/, '') || 'Select team...'}
                                />
                              </div>
                            ) : (
                              <span className={`hover:bg-gray-100 px-2 py-1 rounded whitespace-nowrap overflow-hidden text-ellipsis`}>
                                {rider?.team?.name || <span className={`${rider?.team?.name ? '' : 'text-red-500'}`}>No Team</span>}
                              </span>
                            )}
                          </div>
                          <div>{rider.points}</div>
                          <div
                            onClick={() => {
                              const countryObj = countriesList.find(c => c.code?.toLowerCase() === rider.country?.toLowerCase());
                              if (countryObj) {
                                setSelectedCountries([countryObj]);
                              }
                            }}
                            className="cursor-pointer"
                            title={countriesList.find(c => c.code?.toLowerCase() === rider.country?.toLowerCase())?.name}
                          >
                            <Flag countryCode={rider.country} />
                          </div>
                        </div>
                      );
                    }}
                  />
                </div>
                {totalCount && rankedRiders.length < totalCount && (
                  <div className="mt-2.5 text-center flex gap-2.5 justify-center">
                    <button
                      onClick={loadMoreRiders}
                      disabled={loadingMore}
                      className="px-5 py-2.5"
                    >
                      {loadingMore ? 'Loading...' : `Load More (${totalCount - rankedRiders.length} remaining)`}
                    </button>
                    <button
                      onClick={loadAllData}
                      disabled={loadingMore}
                      className="px-5 py-2.5 bg-green-500 text-white"
                    >
                      Load All & Cache
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-md p-4">

            <div className="grid grid-cols-3 gap-2.5">
              <Toggle status={viewRank} onText="Show Rank" offText="Hide Rank" toggleOn={() => setViewRank(!viewRank)} toggleOff={() => setViewRank(!viewRank)} />
              <Toggle status={viewClass} onText="Show Class" offText="Hide Class" toggleOn={() => setViewClass(!viewClass)} toggleOff={() => setViewClass(!viewClass)} />
              <Toggle status={viewPoints} onText="Show Points" offText="Hide Points" toggleOn={() => setViewPoints(!viewPoints)} toggleOff={() => setViewPoints(!viewPoints)} />
              <Toggle status={viewCountry} onText="Show Country" offText="Hide Country" toggleOn={() => setViewCountry(!viewCountry)} toggleOff={() => setViewCountry(!viewCountry)} />
              <Toggle status={viewImage} onText="Show Image" offText="Hide Image" toggleOn={() => setViewImage(!viewImage)} toggleOff={() => setViewImage(!viewImage)} />
            </div>

            <h2>Teams ({filteredTeams.length}
              {selectedCountries.length > 0 && ` (filtered by ${selectedCountries.length} countr${selectedCountries.length > 1 ? 'ies' : 'y'} from ${teamsList.length})`})
            </h2>
            {filteredTeams.length === 0 ? (
              <p>No teams found{selectedCountries.length > 0 ? ' for selected countries' : '. Click "Set Teams" to load them'}.</p>
            ) : (
              <div>
                <div className="grid p-2 border-b-2 border-gray-400 font-bold bg-gray-100" style={{ gridTemplateColumns: `${viewRank ? '60px' : ''} ${viewClass ? '100px' : ''} 1fr ${viewPoints ? '100px' : ''} ${viewCountry ? '80px' : ''} ${viewImage ? '70px' : ''}` }}>
                  {viewRank && <div>Rank</div>}
                  {viewClass && <div>Class</div>}
                  <div>Name</div>
                  {viewPoints && <div>Points</div>}
                  {viewCountry && <div>Country</div>}
                  {viewImage && <div>Image</div>}
                </div>
                <div className="relative overflow-visible">
                  <List
                    defaultHeight={600}
                    rowCount={filteredTeams.length}
                    rowHeight={(index) => {
                      const team = filteredTeams[index];
                      return editingTeamId === team.id ? 60 : 40;
                    }}
                    rowProps={{}}
                    rowComponent={({ index, style }) => {
                      const team = filteredTeams[index];
                      const isEditing = editingTeamId === team.id;

                      return (
                        <div
                          className="grid p-2 border-b border-gray-200 items-center overflow-visible"
                          style={{
                            ...style,
                            gridTemplateColumns: `${viewRank ? '60px' : ''} ${viewClass ? '100px' : ''} 1fr ${viewPoints ? '100px' : ''} ${viewCountry ? '80px' : ''} ${viewImage ? '70px' : ''}`,
                            zIndex: isEditing ? 999 : 1
                          }}
                        >
                          {viewRank && <div>{team.pcsRank}</div>}
                          {viewClass && <div
                            onClick={() => setEditingTeamId(team.id)}
                            className="cursor-pointer relative overflow-visible"
                          >
                            {isEditing ? (
                              <div data-editing>
                                <ClassSelector
                                  selectedClasses={team.class ? [team.class] : []}
                                  setSelectedClasses={(classes: string[]) => {
                                    if (classes.length > 0) {
                                      handleUpdateTeamClass(team.id, classes[0]);
                                    }
                                    setEditingTeamId(null);
                                  }}
                                  multiSelect={false}
                                  multiSelectShowSelected={false}
                                  placeholder={team.class || 'Select class...'}
                                />
                              </div>
                            ) : (
                              <span className="hover:bg-gray-100 px-2 py-1 rounded">
                                {team.class || '—'}
                              </span>
                            )}
                          </div>}
                          <div title={team.name} className="whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis">{team.name}</div>
                          {viewPoints && <div>{team.points}</div>}
                          {viewCountry && <div>{team?.country && <div
                            onClick={() => {
                              const countryObj = countriesList.find(c => c.code?.toLowerCase() === team.country?.toLowerCase());
                              if (countryObj) {
                                setSelectedCountries([countryObj]);
                              }
                            }}
                            className="cursor-pointer"
                            title={countriesList.find(c => c.code?.toLowerCase() === team.country?.toLowerCase())?.name}
                          >
                            <Flag countryCode={team.country} />
                          </div>}</div>}
                          {viewImage && <div>{team?.teamImage ? <img src={`https://www.procyclingstats.com/${team?.teamImage}`} alt={team?.name} className="w-[30px] h-[30px]" /> : <img src="/jersey-transparent.png" className="w-[30px] h-[30px]" />}</div>}
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  );
}