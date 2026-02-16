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
  const { user, loading: authLoading } = useAuth();
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
  const [draftSelections, setDraftSelections] = useState<Record<string, Rider | null>>({});

  const [loading, setLoading] = useState(false);
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
  const hasDraftSelection = !!selectedRaceSlug && Object.prototype.hasOwnProperty.call(draftSelections, selectedRaceSlug);

  const fetchData = useCallback(async () => {
    if (!gameId) return;
    if (!user) {
      setLoading(false);
      return;
    }

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
        
        // Always fetch rankings to get full rider data (country/team),
        // then filter by eligibleRiders when provided.
        const eligibleIds: string[] = gameData.game?.eligibleRiders || [];
        const year = gameData.game?.year || new Date().getFullYear();
        const rankingsRes = await fetch(`/api/getRankings?year=${year}&limit=2000`);
        if (rankingsRes.ok) {
          const rankingsData = await rankingsRes.json();
          const rankingRiders = rankingsData.riders || [];
          const normalizedRiders = rankingRiders.map((r: Rider) => ({
            ...r,
            id: r.id || r.name?.toLowerCase().replace(/\s+/g, '-') || ''
          }));

          if (eligibleIds.length === 0) {
            setEligibleRiders(normalizedRiders);
          } else {
            const byId = new Map<string, Rider>();
            normalizedRiders.forEach((r: Rider) => {
              if (r.id) byId.set(r.id, r);
              const nameId = (r as { nameID?: string }).nameID;
              if (nameId) byId.set(nameId, r);
            });
            const filtered: Rider[] = [];

            // Preserve order of eligibleIds
            eligibleIds.forEach((id: string) => {
              const rider = byId.get(id);
              if (rider) filtered.push(rider);
            });

            setEligibleRiders(filtered);
          }
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
    if (authLoading) return;
    fetchData();
  }, [fetchData, authLoading]);

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

    if (selectedRaceSlug && Object.prototype.hasOwnProperty.call(draftSelections, selectedRaceSlug)) {
      setSelectedRider(draftSelections[selectedRaceSlug] || null);
      return;
    }

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
  }, [selectedRaceSlug, calendar, eligibleRiders, draftSelections]);

  const handleSelectRider = (rider: Rider | null) => {
    if (!selectedRaceSlug) {
      setSelectedRider(rider);
      return;
    }
    setSelectedRider(rider);
    setDraftSelections(prev => ({
      ...prev,
      [selectedRaceSlug]: rider
    }));
  };

  const handleSubmitPick = async () => {
    if (!selectedRider || !selectedRaceSlug || !user || !canMakePick) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    const hadPick = !!selectedRace?.userPick;

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
        const details = data.details ? ` (${data.details})` : '';
        throw new Error((data.error || 'Failed to submit pick') + details);
      }

      setSuccessMessage(data.message || 'Pick submitted successfully!');
      
      if (data.usedRiders) {
        setParticipantData(prev => prev ? { 
          ...prev, 
          usedRiders: data.usedRiders,
          picksCount: hadPick ? prev.picksCount : prev.picksCount + 1
        } : null);
      }

      if (selectedRaceSlug) {
        setDraftSelections(prev => {
          const next = { ...prev };
          delete next[selectedRaceSlug];
          return next;
        });
      }

      if (selectedRaceSlug) {
        setCalendar(prev => prev.map(race => (
          race.raceSlug === selectedRaceSlug
            ? { ...race, userPick: data.pick || null }
            : race
        )));
      }

    } catch (err) {
      console.error('Error submitting pick:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearPick = async () => {
    if (!selectedRaceSlug || !user || !canMakePick) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    const hadPick = !!selectedRace?.userPick;

    try {
      const response = await fetch(`/api/games/${gameId}/slipstream/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          raceSlug: selectedRaceSlug,
          clearPick: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const details = data.details ? ` (${data.details})` : '';
        throw new Error((data.error || 'Failed to clear pick') + details);
      }

      setSuccessMessage(data.message || 'Pick cleared successfully!');

      if (data.usedRiders) {
        setParticipantData(prev => prev ? { 
          ...prev, 
          usedRiders: data.usedRiders,
          picksCount: hadPick ? Math.max(0, prev.picksCount - 1) : prev.picksCount
        } : null);
      }

      if (selectedRaceSlug) {
        setDraftSelections(prev => {
          const next = { ...prev };
          delete next[selectedRaceSlug];
          return next;
        });
      }

      if (selectedRaceSlug) {
        setCalendar(prev => prev.map(race => (
          race.raceSlug === selectedRaceSlug
            ? { ...race, userPick: null }
            : race
        )));
      }
    } catch (err) {
      console.error('Error clearing pick:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear pick');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSelection = () => {
    if (!selectedRaceSlug) return;
    setDraftSelections(prev => {
      if (!Object.prototype.hasOwnProperty.call(prev, selectedRaceSlug)) {
        return prev;
      }
      const next = { ...prev };
      delete next[selectedRaceSlug];
      return next;
    });
  };

  if (authLoading || loading) {
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
      <style jsx>{`
        .pick-actions {
          container-type: inline-size;
        }
        @container (min-width: 360px) {
          .pick-actions-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @container (min-width: 520px) {
          .pick-actions-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>

        {/* Your Stats - horizontal bar above layout */}
        {participantData && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold mb-3">Your Stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold mb-4">Select Race</h2>
              <SlipstreamRacePicker
                races={calendar}
                selectedRaceSlug={selectedRaceSlug}
                onSelectRace={setSelectedRaceSlug}
                showFinished={true}
                filter={raceFilter}
                onFilterChange={handleFilterChange}
              />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold mb-4">Select Rider</h2>
              {selectedRaceSlug ? (
                <SlipstreamRiderSelector
                  riders={eligibleRiders}
                  usedRiderIds={participantData?.usedRiders || []}
                  selectedRider={selectedRider}
                  onSelect={handleSelectRider}
                  disabled={!canMakePick}
                />
              ) : (
                <div className="p-4 bg-gray-100 rounded-lg text-gray-500 text-sm">
                  Select a race first
                </div>
              )}
              
              {selectedRace && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-col gap-3">
                    <div className="text-sm text-gray-600">
                      {selectedRace.userPick ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700">
                          Huidige pick: <strong className="text-green-800">{selectedRace.userPick.riderName}</strong>
                          {selectedRace.userPick.locked && <span className="text-xs text-green-600">(locked)</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700">
                          Geen pick voor deze race
                        </span>
                      )}
                    </div>
                    
                    {canMakePick && (
                      <div className="pick-actions">
                        <div className="pick-actions-grid grid grid-cols-1 gap-2">
                        {hasDraftSelection && (
                          <button
                            onClick={handleCancelSelection}
                            disabled={submitting}
                            className={`w-full px-3 py-2 rounded-lg font-medium transition-colors ${
                              !submitting
                                ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            Annuleren
                          </button>
                        )}
                        {selectedRace.userPick && (
                          <button
                            onClick={handleClearPick}
                            disabled={submitting}
                            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                              !submitting
                                ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {submitting ? 'Bezig...' : 'Pick verwijderen'}
                          </button>
                        )}
                        <button
                          onClick={handleSubmitPick}
                          disabled={!selectedRider || submitting}
                          className={`w-full px-6 py-2 rounded-lg font-medium transition-colors ${
                            selectedRider && !submitting
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {submitting ? 'Bezig...' : selectedRace.userPick ? 'Pick bijwerken' : 'Pick indienen'}
                        </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
