'use client';

import { useState } from 'react';
import { Settings, Refresh, Lock, CircleCheck, Clock } from 'tabler-icons-react';

interface Race {
  raceId: string;
  raceSlug: string;
  raceName: string;
  raceDate: string;
  pickDeadline: string;
  status: 'upcoming' | 'locked' | 'finished';
  order: number;
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

  const calculateResults = async (raceSlug: string) => {
    setLoading(`calc-${raceSlug}`);
    setError(null);
    setSuccess(null);

    try {
      const resultsResponse = await fetch(`/api/races/${raceSlug}/results`);
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
                      onClick={() => calculateResults(race.raceSlug)}
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
                      onClick={() => calculateResults(race.raceSlug)}
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
  );
}
