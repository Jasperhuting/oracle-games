'use client'

import { ActionPanel } from "@/components/ActionPanel";
import { Button } from "@/components/Button";
import { MyTeamSelection } from "@/components/MyTeamSelection";
import { Pagination } from "@/components/Pagination";
import { PlayerCard } from "@/components/PlayerCard";
import { Toggle } from "@/components/Toggle";
import { iso2ToFlag } from "@/lib/firebase/utils";
import { Country, Team, Rider } from "@/lib/scraper";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { List } from 'react-window';
import { PlayerRow } from "@/components/PlayerRow";

export default function CreateRankingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [rankedRiders, setRankedRiders] = useState<any[]>([]);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [year, setYear] = useState(2025);
  const [teamsArray, setTeamsArray] = useState<any[]>([]);

  const [selectedPlayers, setSelectedPlayers] = useState<Rider[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<Country[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);

  const [showPlayerCard, setShowPlayerCard] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtered lists based on selected countries and players
  const [filteredRiders, setFilteredRiders] = useState<any[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<any[]>([]);

  const [myTeamSelection, setMyTeamSelection] = useState<any[]>([]);

  const [startingList, setStartingList] = useState<any[]>([]);

  const setStartingListRace = async ({year, race}: {year: number, race: string}) => {
    const response = await fetch(`/api/setStartingListRace?year=${year}&race=${race}`);
    const data = await response.json();
  }

  const getStartingListRace = async ({year, race}: {year: number, race: string}) => {
    const response = await fetch(`/api/getRidersFromRace?year=${year}&race=${race}`);
    const data = await response.json();
    setStartingList(data.riders);
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

  const getEnrichedRiders = async () => {

    teamsArray.forEach(async (team: any) => {
      const response = await fetch(`/api/setEnrichedTeamsAndRiders?year=2025&team=${team.id}`);
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

  const saveToCache = (year: number, riders: any[], teams: any[], totalCount: number) => {
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
      fetchData({ year, append: true });
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

        const ridersResponse = await fetch(`/api/getRankings?year=${year}&limit=${batchSize}&offset=${currentOffset}`);
        const ridersData = await ridersResponse.json();

        allLoadedRiders = [...allLoadedRiders, ...(ridersData.riders || [])];
        setRankedRiders(allLoadedRiders);
        currentOffset = allLoadedRiders.length;

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Now save everything to cache
      saveToCache(year, allLoadedRiders, teamsList, totalCount);

    } catch (error) {
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Only load data if not already loaded
    if (rankedRiders.length === 0 && !loadingMore) {
      fetchData({ year });
    }
  }, [year]);

  // Filter riders and teams when selectedCountries, selectedPlayers, or selectedTeams changes
  useEffect(() => {
    if (selectedPlayers.length > 0) {
      // If players are selected, show only those players
      const filtered = rankedRiders.filter(rider =>
        selectedPlayers.some(p => p.name === rider.name && p.rank === rider.rank)
      );
      setFilteredRiders(filtered);
      // Don't filter teams when players are selected
      setFilteredTeams(teamsList);
    } else if (selectedTeams.length > 0) {
      // Filter riders by selected teams
      const teamNames = selectedTeams.map(t => t.name?.toLowerCase());
      const filtered = rankedRiders.filter(rider => {
        // Handle both string and object team types
        const riderTeamName = typeof rider.team === 'string'
          ? rider.team?.toLowerCase()
          : rider.team?.name?.toLowerCase();
        return riderTeamName && teamNames.includes(riderTeamName);
      });
      setFilteredRiders(filtered);
      // Show only selected teams
      setFilteredTeams(selectedTeams);
    } else if (selectedCountries.length > 0) {
      // Filter riders by selected country codes
      const countryCodes = selectedCountries.map(c => c.code?.toLowerCase());
      const filtered = rankedRiders.filter(rider =>
        countryCodes.includes(rider.country?.toLowerCase())
      );
      setFilteredRiders(filtered);

      // Filter teams by selected country codes
      const filteredTeamsList = teamsList.filter(team =>
        countryCodes.includes(team.country?.toLowerCase())
      );
      setFilteredTeams(filteredTeamsList);
    } else {
      // No filters selected, show all
      setFilteredRiders(rankedRiders);
      setFilteredTeams(teamsList);
    }
  }, [selectedCountries, selectedPlayers, selectedTeams, rankedRiders, teamsList]);

  const setTeams = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/createTeamRanking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ year, offset: 0 }),
      });

      const data = await response.json();

      // Refresh data after creation
      await fetchData({ year });
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const setAllRankings = async () => {
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
          body: JSON.stringify({ year, offset: currentOffset }),
        });

        const data = await response.json();
      } catch (error) {
        console.error(`Error creating rankings for offset ${currentOffset}:`, error);
      }
    }

    // Refresh data after all rankings are created
    await fetchData({ year });
    setProgress({ current: 0, total: 0, isRunning: false });
    router.refresh();
  };

  return (
    <div className="bg-gray-300">
      <div className="container mx-auto">
        <h1>Create Ranking</h1>
        

        <div className="flex items-center justify-start gap-5 my-5">
          <Button onClick={getEnrichedRiders} text="Get Enriched Riders" />
          <Button text={isLoading ? 'Loading...' : 'Set Teams'} onClick={() => setTeams()} disabled={isLoading || progress.isRunning} className="mr-[10px]" />
          <Button text={progress.isRunning ? 'Running...' : 'Set All Rankings'} onClick={setAllRankings} disabled={isLoading || progress.isRunning} className="mr-[10px]" />          
          <Button text={progress.isRunning ? 'Running...' : 'Set Starting List'} onClick={() => setStartingListRace({year: 2024, race: 'tour-de-france'})} disabled={isLoading || progress.isRunning} className="mr-[10px]" />
          <Button text={progress.isRunning ? 'Running...' : 'Get Starting List'} onClick={() => getStartingListRace({year, race: 'vuelta-a-espana'})} disabled={isLoading || progress.isRunning} className="mr-[10px]" />
          <Button
            onClick={() => {
              clearCache(year);
              setRankedRiders([]);
              setTeamsList([]);
              setTotalCount(null);
              fetchData({ year, forceRefresh: true });
            }}
            disabled={isLoading || progress.isRunning || loadingMore}
            className={`mr-[10px] ${usingCache ? 'bg-red-500' : 'bg-gray-500'}`}
            text={usingCache ? 'Refresh from Database' : 'No Cache'}
          />
        </div>

        {usingCache && (
          <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>
            ✅ Data geladen vanuit lokale cache (geen database kosten)
          </div>
        )}

        {!usingCache && rankedRiders.length > 0 && totalCount && rankedRiders.length < totalCount && (
          <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '14px' }}>
            ⚠️ Alleen {rankedRiders.length} van {totalCount} riders geladen.
            Klik op <strong>"Load All & Cache"</strong> om alle data te laden en op te slaan voor later (eenmalige database kosten).
          </div>
        )}

        {progress.isRunning && (
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
            <div style={{ marginBottom: '5px' }}>
              Progress: {progress.current} / {progress.total}
            </div>
            <div style={{ width: '100%', backgroundColor: '#ddd', borderRadius: '5px', height: '20px' }}>
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  backgroundColor: '#4caf50',
                  height: '100%',
                  borderRadius: '5px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}


        <ActionPanel showPlayerCard={showPlayerCard} setShowPlayerCard={setShowPlayerCard} selectedPlayers={selectedPlayers} setSelectedPlayers={setSelectedPlayers} selectedCountries={selectedCountries} setSelectedCountries={setSelectedCountries} selectedTeams={selectedTeams} setSelectedTeams={setSelectedTeams} />

        <Pagination
          currentPage={currentPage}
          totalItems={startingList?.length || 0}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        <div className={`w-full ${showPlayerCard ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4' : 'flex flex-col items-start bg-white rounded-md divide-y divide-[#CAC4D0] justify-start flex-wrap my-4 pb-4'}`}>
          {startingList?.length > 0 ?
            startingList
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .map((player, index) => {
              return (
                <div key={player.id || index} className="flex w-full">
                  {showPlayerCard ?
                    <PlayerCard player={player} selected={myTeamSelection.includes(player)} onClick={(player) => myTeamSelection.includes(player) ? setMyTeamSelection(myTeamSelection.filter((p) => p.id !== player.id)) : setMyTeamSelection([...myTeamSelection, player])} />
                    :
                    <PlayerRow index={index} showButton showRank fullWidth selectedPlayer={myTeamSelection.includes(player)} player={player} selectPlayer={(player) => myTeamSelection.includes(player) ? setMyTeamSelection(myTeamSelection.filter((p) => p.id !== player.id)) : setMyTeamSelection([...myTeamSelection, player])} />}
                </div>
              );
            })
            :
            <p>No riders found</p>
          }
        </div>


        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 1fr 80px 60px',
                  padding: '8px',
                  borderBottom: '2px solid #ccc',
                  fontWeight: 'bold',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>Rank</div>
                  <div>Name</div>
                  <div>Team</div>
                  <div>Points</div>
                  <div>Country</div>
                </div>
                <List
                  defaultHeight={600}
                  rowCount={filteredRiders.length}
                  rowHeight={40}
                  rowProps={{}}
                  rowComponent={({ index, style }) => {
                    const rider = filteredRiders[index];
                    return (
                      <div
                        style={{
                          ...style,
                          display: 'grid',
                          gridTemplateColumns: '60px 1fr 320px 80px 60px',
                          padding: '8px',
                          borderBottom: '1px solid #eee',
                          alignItems: 'center'
                        }}
                      >
                        <div>{rider.rank}</div>
                        <div className="whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">{rider.name}</div>
                        <div className="whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis">{rider?.team?.name.replace(/\s*\d{4}$/, '')}</div>
                        <div>{rider.points}</div>
                        <div>{iso2ToFlag(rider.country)}</div>
                      </div>
                    );
                  }}
                />
                {totalCount && rankedRiders.length < totalCount && (
                  <div style={{ marginTop: '10px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                      onClick={loadMoreRiders}
                      disabled={loadingMore}
                      style={{ padding: '10px 20px' }}
                    >
                      {loadingMore ? 'Loading...' : `Load More (${totalCount - rankedRiders.length} remaining)`}
                    </button>
                    <button
                      onClick={loadAllData}
                      disabled={loadingMore}
                      style={{ padding: '10px 20px', backgroundColor: '#4caf50', color: 'white' }}
                    >
                      Load All & Cache
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-md p-4">
            <h2>Teams ({filteredTeams.length}
              {selectedCountries.length > 0 && ` (filtered by ${selectedCountries.length} countr${selectedCountries.length > 1 ? 'ies' : 'y'} from ${teamsList.length})`})
            </h2>
            {filteredTeams.length === 0 ? (
              <p>No teams found{selectedCountries.length > 0 ? ' for selected countries' : '. Click "Set Teams" to load them'}.</p>
            ) : (
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 100px 80px 70px ',
                  padding: '8px',
                  borderBottom: '2px solid #ccc',
                  fontWeight: 'bold',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div>Rank</div>
                  <div>Name</div>
                  <div>Points</div>
                  <div>Country</div>
                  <div>Image</div>
                </div>
                <List
                  defaultHeight={600}
                  rowCount={filteredTeams.length}
                  rowHeight={40}
                  rowProps={{}}
                  rowComponent={({ index, style }) => {
                    const team = filteredTeams[index];
                    return (
                      <div
                        style={{
                          ...style,
                          display: 'grid',
                          gridTemplateColumns: '60px 1fr 100px 80px 70px ',
                          padding: '8px',
                          borderBottom: '1px solid #eee',
                          alignItems: 'center'
                        }}
                      >
                        <div>{team.pcsRank}</div>
                        <div>{team.name}</div>
                        <div>{team.points}</div>
                        <div>{iso2ToFlag(team.country)}</div>


                        <div>{team?.teamImage ? <img src={`https://www.procyclingstats.com/${team?.teamImage}`} alt={team?.name} style={{ width: '30px', height: '30px' }} /> : ""}</div>
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <MyTeamSelection myTeamSelection={myTeamSelection} setMyTeamSelection={setMyTeamSelection} />
    </div>

  );
}