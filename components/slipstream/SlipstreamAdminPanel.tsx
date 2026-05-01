'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Refresh, Lock, CircleCheck, Clock, AlertTriangle, UserOff, UserCheck } from 'tabler-icons-react';

const MISSED_RACES_THRESHOLD = 4;

interface Race {
  raceId: string;
  raceSlug: string;
  raceName: string;
  raceDate: string;
  pickDeadline: string;
  status: 'upcoming' | 'locked' | 'finished';
  order: number;
}

interface InactivePlayer {
  participantId: string;
  userId: string;
  playername: string;
  missedPicksCount: number;
  status: string;
}

interface SlipstreamAdminPanelProps {
  gameId: string;
  races: Race[];
  onRaceStatusChange?: () => void;
}

export function SlipstreamAdminPanel({
  gameId,
  races,
  onRaceStatusChange
}: SlipstreamAdminPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [inactivePlayers, setInactivePlayers] = useState<InactivePlayer[]>([]);
  const [withdrawnPlayers, setWithdrawnPlayers] = useState<InactivePlayer[]>([]);
  const [finishedRacesCount, setFinishedRacesCount] = useState(0);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState<string | null>(null);

  const fetchInactivePlayers = useCallback(async () => {
    setInactiveLoading(true);
    try {
      const res = await fetch(
        `/api/games/${gameId}/slipstream/admin/inactive-players?threshold=${MISSED_RACES_THRESHOLD}`
      );
      const data = await res.json();
      if (res.ok) {
        setInactivePlayers(data.inactivePlayers || []);
        setWithdrawnPlayers(data.withdrawnPlayers || []);
        setFinishedRacesCount(data.finishedRacesCount || 0);
      }
    } catch {
      // silent
    } finally {
      setInactiveLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchInactivePlayers();
  }, [fetchInactivePlayers]);

  const handleWithdraw = async (player: InactivePlayer, restore: boolean) => {
    setWithdrawLoading(player.participantId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/games/${gameId}/slipstream/admin/withdraw-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: player.participantId, restore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuccess(
        restore
          ? `${player.playername} hersteld naar actief`
          : `${player.playername} teruggetrokken uit het spel`
      );
      await fetchInactivePlayers();
      onRaceStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij bijwerken speler');
    } finally {
      setWithdrawLoading(null);
    }
  };

  const updateRaceStatus = async (raceSlug: string, status: 'upcoming' | 'locked' | 'finished') => {
    setLoading(raceSlug);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/games/${gameId}/slipstream/admin/race-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceSlug, status })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update race status');
      }

      setSuccess(`${raceSlug} status updated to ${status}`);
      onRaceStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update race status');
    } finally {
      setLoading(null);
    }
  };

  const calculateResults = async (race: Race) => {
    const { raceSlug, raceId } = race;
    setLoading(`calc-${raceSlug}`);
    setError(null);
    setSuccess(null);

    try {
      const resultsResponse = await fetch(`/api/races/${raceId}/results`);
      if (!resultsResponse.ok) {
        throw new Error('Race results not available. Save race result first.');
      }
      const resultsData = await resultsResponse.json();

      const response = await fetch(`/api/games/${gameId}/slipstream/calculate-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raceSlug,
          stageResults: resultsData.stageResults || resultsData.results || []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate results');
      }

      setSuccess(`Results calculated for ${raceSlug}: ${data.summary?.participantsProcessed || 0} participants processed`);
      onRaceStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate results');
    } finally {
      setLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'finished':
        return <CircleCheck className="w-4 h-4 text-green-500" />;
      case 'locked':
        return <Lock className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Inactive players alert */}
      {(inactivePlayers.length > 0 || withdrawnPlayers.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Inactieve spelers
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {finishedRacesCount} races afgerond. Spelers met {MISSED_RACES_THRESHOLD}+ gemiste races.
            </p>
          </div>

          {inactivePlayers.length > 0 && (
            <div className="p-4 space-y-2">
              <p className="text-sm font-medium text-amber-700">
                {inactivePlayers.length} speler{inactivePlayers.length !== 1 ? 's' : ''} te veel races gemist:
              </p>
              {inactivePlayers.map(player => (
                <div
                  key={player.participantId}
                  className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <UserOff className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-medium text-gray-900">{player.playername}</span>
                      <span className="ml-2 text-sm text-amber-700">
                        {player.missedPicksCount} gemiste races
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleWithdraw(player, false)}
                    disabled={withdrawLoading === player.participantId}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 shrink-0"
                  >
                    {withdrawLoading === player.participantId ? 'Bezig...' : 'Uitsluiten'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {withdrawnPlayers.length > 0 && (
            <div className={`p-4 space-y-2 ${inactivePlayers.length > 0 ? 'border-t border-gray-100' : ''}`}>
              <p className="text-sm font-medium text-gray-500">
                {withdrawnPlayers.length} uitgesloten speler{withdrawnPlayers.length !== 1 ? 's' : ''} (herstelbaar):
              </p>
              {withdrawnPlayers.map(player => (
                <div
                  key={player.participantId}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <UserOff className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <span className="font-medium text-gray-600">{player.playername}</span>
                      <span className="ml-2 text-xs text-gray-400">uitgesloten</span>
                      {player.missedPicksCount > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({player.missedPicksCount} gemiste races)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleWithdraw(player, true)}
                    disabled={withdrawLoading === player.participantId}
                    className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1 shrink-0"
                  >
                    <UserCheck className="w-3 h-3" />
                    {withdrawLoading === player.participantId ? 'Bezig...' : 'Herstellen'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {inactiveLoading && (
            <div className="p-4 text-sm text-gray-500">Laden...</div>
          )}
        </div>
      )}

      {/* Race management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Slipstream Admin
          </h2>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            {success}
          </div>
        )}

        <div className="p-4">
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {races.map(race => (
              <div
                key={race.raceSlug}
                className="p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(race.status)}
                    <div>
                      <div className="font-medium">{race.raceName}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(race.raceDate)} • Deadline: {formatDate(race.pickDeadline)}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    race.status === 'finished' ? 'bg-green-100 text-green-700' :
                    race.status === 'locked' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {race.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {race.status === 'upcoming' && (
                    <button
                      onClick={() => updateRaceStatus(race.raceSlug, 'locked')}
                      disabled={loading === race.raceSlug}
                      className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                    >
                      {loading === race.raceSlug ? 'Locking...' : 'Lock Picks'}
                    </button>
                  )}

                  {race.status === 'locked' && (
                    <>
                      <button
                        onClick={() => updateRaceStatus(race.raceSlug, 'upcoming')}
                        disabled={loading === race.raceSlug}
                        className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        Unlock
                      </button>
                      <button
                        onClick={() => calculateResults(race)}
                        disabled={loading === `calc-${race.raceSlug}`}
                        className="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Refresh className={`w-3 h-3 ${loading === `calc-${race.raceSlug}` ? 'animate-spin' : ''}`} />
                        Calculate Results
                      </button>
                    </>
                  )}

                  {race.status === 'finished' && (
                    <>
                      <button
                        onClick={() => updateRaceStatus(race.raceSlug, 'locked')}
                        disabled={loading === race.raceSlug}
                        className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                      >
                        Revert to Locked
                      </button>
                      <button
                        onClick={() => calculateResults(race)}
                        disabled={loading === `calc-${race.raceSlug}`}
                        className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Refresh className={`w-3 h-3 ${loading === `calc-${race.raceSlug}` ? 'animate-spin' : ''}`} />
                        Recalculate
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <p><strong>Workflow:</strong> Upcoming → Lock Picks (at deadline) → Calculate Results (after race)</p>
        </div>
      </div>
    </div>
  );
}
