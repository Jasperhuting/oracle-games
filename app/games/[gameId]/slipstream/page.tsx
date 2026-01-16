'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { SlipstreamRacePicker, RaceFilter } from '@/components/slipstream/SlipstreamRacePicker';
import { SlipstreamRiderSelector } from '@/components/slipstream/SlipstreamRiderSelector';
import { SlipstreamStandings } from '@/components/slipstream/SlipstreamStandings';
import { SlipstreamRaceManager } from '@/components/slipstream/SlipstreamRaceManager';
import { Rider } from '@/lib/scraper/types';

const VALID_FILTERS: RaceFilter[] = ['needs_pick', 'upcoming', 'finished', 'all'];

interface CalendarRace {
  raceId: string;
  raceSlug: string;
  raceName: string;
  raceDate: string;
  pickDeadline: string;
  status: 'upcoming' | 'locked' | 'finished';
  order: number;
  deadlinePassed: boolean;
  timeUntilDeadline: number;
  timeUntilDeadlineFormatted: string;
  userPick?: {
    riderId: string;
    riderName: string;
    locked: boolean;
    timeLostSeconds?: number;
    timeLostFormatted?: string;
    greenJerseyPoints?: number;
    riderFinishPosition?: number;
  } | null;
}

interface StandingEntry {
  userId: string;
  playername: string;
  ranking: number;
  value: number;
  valueFormatted: string;
  gapToLeader: number;
  gapToLeaderFormatted: string;
  picksCount: number;
  missedPicksCount: number;
}

interface ParticipantData {
  usedRiders: string[];
  totalTimeLostSeconds: number;
  totalGreenJerseyPoints: number;
  picksCount: number;
  missedPicksCount: number;
}

export default function SlipstreamPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const gameId = params?.gameId as string;

  // Get filter from URL, default to 'needs_pick'
  const filterParam = searchParams.get('filter') as RaceFilter | null;
  const raceFilter: RaceFilter = filterParam && VALID_FILTERS.includes(filterParam) ? filterParam : 'needs_pick';

  const [gameName, setGameName] = useState<string>('');
  const [calendar, setCalendar] = useState<CalendarRace[]>([]);
  const [standings, setStandings] = useState<{
    yellowJersey: StandingEntry[];
    greenJersey: StandingEntry[];
    racesCompleted: number;
    totalRaces: number;
  } | null>(null);
  const [eligibleRiders, setEligibleRiders] = useState<Rider[]>([]);
  const [participantData, setParticipantData] = useState<ParticipantData | null>(null);

  const [selectedRaceSlug, setSelectedRaceSlug] = useState<string | null>(null);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Update URL when filter changes
  const handleFilterChange = useCallback((newFilter: RaceFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', newFilter);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const selectedRace = calendar.find(r => r.raceSlug === selectedRaceSlug);
  const canMakePick = selectedRace && !selectedRace.deadlinePassed && selectedRace.status === 'upcoming';

  const fetchData = useCallback(async () => {
    if (!gameId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const [gameRes, calendarRes, standingsRes] = await Promise.all([
        fetch(`/api/games/${gameId}`),
        fetch(`/api/games/${gameId}/slipstream/calendar?userId=${user.uid}`),
        fetch(`/api/games/${gameId}/slipstream/standings`)
      ]);

      // Check admin status
      const userRes = await fetch(`/api/getUser?userId=${user.uid}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        setIsAdmin(userData.userType === 'admin');
      }

      if (gameRes.ok) {
        const gameData = await gameRes.json();
        setGameName(gameData.game?.name || '');
        
        // Try to get riders from game config first, otherwise fetch from rankings
        let riders = gameData.game?.eligibleRiders || [];
        
        if (riders.length === 0) {
          // Fetch riders from rankings
          const year = new Date().getFullYear();
          const rankingsRes = await fetch(`/api/getRankings?year=${year}`);
          if (rankingsRes.ok) {
            const rankingsData = await rankingsRes.json();
            const rankingRiders = rankingsData.riders || [];
            setEligibleRiders(rankingRiders.map((r: Rider) => ({
              ...r,
              id: r.id || r.name?.toLowerCase().replace(/\s+/g, '-') || ''
            })));
          }
        } else {
          const mappedRiders: Rider[] = riders.map((r: string, i: number) => ({
            id: r,
            name: r.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            rank: i + 1,
            points: 0,
            country: '',
          }));
          setEligibleRiders(mappedRiders);
        }
      }

      if (calendarRes.ok) {
        const calendarData = await calendarRes.json();
        setCalendar(calendarData.calendar || []);
      }

      if (standingsRes.ok) {
        const standingsData = await standingsRes.json();
        setStandings({
          yellowJersey: standingsData.yellowJersey || [],
          greenJersey: standingsData.greenJersey || [],
          racesCompleted: standingsData.racesCompleted || 0,
          totalRaces: standingsData.totalRaces || 0
        });
      }

      const participantRes = await fetch(`/api/gameParticipants?gameId=${gameId}&userId=${user.uid}`);
      if (participantRes.ok) {
        const participantData = await participantRes.json();
        const participant = participantData.participants?.[0];
        if (participant?.slipstreamData) {
          setParticipantData(participant.slipstreamData);
        }
      }

    } catch (err) {
      console.error('Error loading slipstream data:', err);
      setError('Failed to load game data');
    } finally {
      setLoading(false);
    }
  }, [gameId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-select first upcoming race when calendar loads
  useEffect(() => {
    if (calendar.length > 0 && !selectedRaceSlug) {
      const nextUpcoming = calendar.find(
        (r: CalendarRace) => r.status === 'upcoming' && !r.deadlinePassed
      );
      if (nextUpcoming) {
        setSelectedRaceSlug(nextUpcoming.raceSlug);
      }
    }
  }, [calendar, selectedRaceSlug]);

  useEffect(() => {
    // Find the race directly from calendar when selectedRaceSlug changes
    const race = calendar.find(r => r.raceSlug === selectedRaceSlug);
    
    if (race?.userPick) {
      const pickRiderId = race.userPick.riderId;
      const pickRiderName = race.userPick.riderName;
      
      // Try to find by id first, then by name slug
      let existingRider = eligibleRiders.find(r => r.id === pickRiderId);
      if (!existingRider && pickRiderName) {
        // Try matching by name (case insensitive)
        const lowerName = pickRiderName.toLowerCase();
        existingRider = eligibleRiders.find(
          r => r.name?.toLowerCase() === lowerName || 
               r.id?.toLowerCase() === lowerName.replace(/\s+/g, '-')
        );
      }
      setSelectedRider(existingRider || null);
    } else {
      setSelectedRider(null);
    }
  }, [selectedRaceSlug, calendar, eligibleRiders]);

  const handleSubmitPick = async () => {
    if (!selectedRider || !selectedRaceSlug || !user || !canMakePick) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/games/${gameId}/slipstream/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          raceSlug: selectedRaceSlug,
          riderId: selectedRider.id,
          riderName: selectedRider.name
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit pick');
      }

      setSuccessMessage(data.message || 'Pick submitted successfully!');
      
      if (data.usedRiders) {
        setParticipantData(prev => prev ? { ...prev, usedRiders: data.usedRiders } : null);
      }

      await fetchData();

    } catch (err) {
      console.error('Error submitting pick:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Slipstream
              </h1>
              {gameName && (
                <p className="text-gray-600">{gameName}</p>
              )}
            </div>
            <Link
              href="/games"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold mb-4">Make Your Pick</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Select Race</h3>
                  <SlipstreamRacePicker
                    races={calendar}
                    selectedRaceSlug={selectedRaceSlug}
                    onSelectRace={setSelectedRaceSlug}
                    showFinished={true}
                    filter={raceFilter}
                    onFilterChange={handleFilterChange}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Select Rider</h3>
                  {selectedRaceSlug ? (
                    <SlipstreamRiderSelector
                      riders={eligibleRiders}
                      usedRiderIds={participantData?.usedRiders || []}
                      selectedRider={selectedRider}
                      onSelect={setSelectedRider}
                      disabled={!canMakePick}
                    />
                  ) : (
                    <div className="p-4 bg-gray-100 rounded-lg text-gray-500 text-sm">
                      Select a race first
                    </div>
                  )}
                </div>
              </div>

              {selectedRace && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {selectedRace.userPick ? (
                        <span>
                          Current pick: <strong>{selectedRace.userPick.riderName}</strong>
                          {selectedRace.userPick.locked && ' (locked)'}
                        </span>
                      ) : (
                        <span className="text-orange-600">No pick yet for this race</span>
                      )}
                    </div>
                    
                    {canMakePick && (
                      <button
                        onClick={handleSubmitPick}
                        disabled={!selectedRider || submitting}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          selectedRider && !submitting
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {submitting ? 'Submitting...' : selectedRace.userPick ? 'Update Pick' : 'Submit Pick'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {participantData && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-semibold mb-3">Your Stats</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {participantData.totalTimeLostSeconds > 0 
                        ? `+${Math.floor(participantData.totalTimeLostSeconds / 60)}:${(participantData.totalTimeLostSeconds % 60).toString().padStart(2, '0')}`
                        : '0:00'}
                    </div>
                    <div className="text-xs text-gray-500">Time Lost</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {participantData.totalGreenJerseyPoints}
                    </div>
                    <div className="text-xs text-gray-500">Green Points</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {participantData.picksCount}
                    </div>
                    <div className="text-xs text-gray-500">Picks Made</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {participantData.usedRiders.length}
                    </div>
                    <div className="text-xs text-gray-500">Riders Used</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            {standings && (
              <SlipstreamStandings
                yellowJersey={standings.yellowJersey}
                greenJersey={standings.greenJersey}
                racesCompleted={standings.racesCompleted}
                totalRaces={standings.totalRaces}
                currentUserId={user?.uid}
              />
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6">
            <SlipstreamRaceManager
              gameId={gameId}
              races={calendar}
              onRacesChange={fetchData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
