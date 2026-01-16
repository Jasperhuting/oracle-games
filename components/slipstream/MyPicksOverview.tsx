'use client';

import { useState } from 'react';
import { CircleCheck, Clock, AlertTriangle, X } from 'tabler-icons-react';

interface Pick {
  id: string;
  raceSlug: string;
  raceName: string;
  raceDate: string;
  riderId: string | null;
  riderName: string | null;
  locked: boolean;
  timeLostSeconds?: number;
  timeLostFormatted?: string;
  greenJerseyPoints?: number;
  riderFinishPosition?: number;
  isPenalty?: boolean;
  penaltyReason?: string;
}

interface MyPicksOverviewProps {
  picks: Pick[];
  totalRaces: number;
  usedRiders: string[];
  onPickClick?: (raceSlug: string) => void;
}

export function MyPicksOverview({
  picks,
  totalRaces,
  usedRiders,
  onPickClick
}: MyPicksOverviewProps) {
  const [showAll, setShowAll] = useState(false);

  const completedPicks = picks.filter(p => p.locked);
  const pendingPicks = picks.filter(p => !p.locked && p.riderId);
  const missedPicks = picks.filter(p => p.isPenalty && p.penaltyReason === 'missed_pick');

  const displayPicks = showAll ? picks : picks.slice(0, 5);

  const getStatusIcon = (pick: Pick) => {
    if (pick.isPenalty) {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (pick.locked && pick.timeLostFormatted) {
      return <CircleCheck className="w-4 h-4 text-green-500" />;
    }
    if (pick.riderId) {
      return <Clock className="w-4 h-4 text-blue-500" />;
    }
    return <X className="w-4 h-4 text-gray-400" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">My Picks</h3>
          <div className="flex gap-3 text-xs">
            <span className="text-green-600">{completedPicks.length} completed</span>
            <span className="text-blue-600">{pendingPicks.length} pending</span>
            {missedPicks.length > 0 && (
              <span className="text-red-600">{missedPicks.length} missed</span>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {picks.length}/{totalRaces} races • {usedRiders.length} riders used
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {displayPicks.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No picks yet
          </div>
        ) : (
          displayPicks.map(pick => (
            <div
              key={pick.id || pick.raceSlug}
              onClick={() => onPickClick?.(pick.raceSlug)}
              className={`p-3 flex items-center justify-between hover:bg-gray-50 ${
                onPickClick ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(pick)}
                <div>
                  <div className="font-medium text-sm text-gray-900">
                    {pick.raceName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(pick.raceDate)}
                    {pick.riderName && (
                      <span className="ml-2">
                        → <span className="text-gray-700">{pick.riderName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {pick.locked && (
                <div className="text-right">
                  {pick.isPenalty ? (
                    <div className="text-xs text-red-600">
                      Penalty: {pick.timeLostFormatted}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-yellow-600">
                        ⏱ {pick.timeLostFormatted || '0:00'}
                      </span>
                      {pick.greenJerseyPoints !== undefined && pick.greenJerseyPoints > 0 && (
                        <span className="text-xs text-green-600">
                          🟢 {pick.greenJerseyPoints} pts
                        </span>
                      )}
                      {pick.riderFinishPosition && (
                        <span className="text-xs text-gray-400">
                          P{pick.riderFinishPosition}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!pick.locked && pick.riderId && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                  Pending
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {picks.length > 5 && (
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-sm text-blue-600 hover:text-blue-700"
          >
            {showAll ? 'Show less' : `Show all ${picks.length} picks`}
          </button>
        </div>
      )}

      {usedRiders.length > 0 && (
        <details className="p-3 border-t border-gray-200">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Used riders ({usedRiders.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {usedRiders.map(rider => (
              <span
                key={rider}
                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
              >
                {rider.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
