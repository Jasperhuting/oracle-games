'use client';

import { useState } from 'react';
import { Clock, CircleCheck, Lock, AlertCircle, Check } from 'tabler-icons-react';

interface Race {
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

export type RaceFilter = 'all' | 'upcoming' | 'finished' | 'needs_pick';

interface SlipstreamRacePickerProps {
  races: Race[];
  selectedRaceSlug: string | null;
  onSelectRace: (raceSlug: string) => void;
  showFinished?: boolean;
  filter?: RaceFilter;
  onFilterChange?: (filter: RaceFilter) => void;
}

export function SlipstreamRacePicker({
  races,
  selectedRaceSlug,
  onSelectRace,
  showFinished = false,
  filter: externalFilter,
  onFilterChange
}: SlipstreamRacePickerProps) {
  const [internalFilter, setInternalFilter] = useState<RaceFilter>('needs_pick');

  // Use external filter if provided, otherwise use internal state
  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const filteredRaces = races
    .filter(race => {
      if (filter === 'upcoming') return race.status === 'upcoming' && !race.deadlinePassed;
      if (filter === 'finished') return race.status === 'finished';
      if (filter === 'needs_pick') return race.status === 'upcoming' && !race.deadlinePassed && !race.userPick;
      return showFinished || race.status !== 'finished';
    })
    .sort((a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime());

  const needsPickCount = races.filter(r => r.status === 'upcoming' && !r.deadlinePassed && !r.userPick).length;
  const pickedCount = races.filter(r => r.userPick).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('needs_pick')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${
            filter === 'needs_pick'
              ? 'bg-orange-500 text-white'
              : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Needs Pick ({needsPickCount})
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            filter === 'upcoming'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('finished')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            filter === 'finished'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Finished
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
      </div>

      <div className="text-xs text-gray-500 flex gap-3">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          {pickedCount} picked
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          {needsPickCount} need pick
        </span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredRaces.length === 0 ? (
          <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
            {filter === 'needs_pick' ? 'All races have picks! 🎉' : 'No races found'}
          </div>
        ) : (
          filteredRaces.map(race => {
            const isSelected = race.raceSlug === selectedRaceSlug;
            const canPick = race.status === 'upcoming' && !race.deadlinePassed;
            const hasPick = !!race.userPick;
            
            return (
              <button
                key={race.raceSlug}
                onClick={() => onSelectRace(race.raceSlug)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : hasPick
                    ? 'border-green-200 bg-green-50/50 hover:border-green-300'
                    : canPick
                    ? 'border-orange-200 bg-orange-50/30 hover:border-orange-300'
                    : 'border-gray-200 bg-gray-50 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      hasPick 
                        ? 'bg-green-500 text-white' 
                        : canPick 
                        ? 'bg-orange-100 border-2 border-orange-300' 
                        : 'bg-gray-200'
                    }`}>
                      {hasPick && <Check className="w-3 h-3" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{race.raceName}</div>
                      <div className="text-sm text-gray-500">{formatDate(race.raceDate)}</div>
                      {hasPick ? (
                        <div className="mt-1 text-sm text-green-700 font-medium">
                          ✓ {race.userPick?.riderName}
                        </div>
                      ) : canPick ? (
                        <div className="mt-1 text-sm text-orange-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          No pick yet
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {race.status === 'finished' ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">Finished</span>
                    ) : race.deadlinePassed || race.status === 'locked' ? (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Locked</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">{race.timeUntilDeadlineFormatted}</span>
                    )}
                    {race.userPick?.locked && race.userPick?.timeLostFormatted && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-yellow-600">⏱ {race.userPick.timeLostFormatted}</span>
                        {(race.userPick.greenJerseyPoints ?? 0) > 0 && (
                          <span className="text-green-600">+{race.userPick.greenJerseyPoints}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
