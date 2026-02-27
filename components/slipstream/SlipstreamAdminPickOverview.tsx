'use client';

import { useMemo, useState } from 'react';

interface CalendarRace {
  raceSlug: string;
  raceName: string;
}

interface MatrixPick {
  userId: string;
  raceSlug: string;
  riderName: string;
  pickedAt?: string | null;
  timeLostFormatted?: string | null;
  greenJerseyPoints?: number | null;
  riderFinishPosition?: number | null;
}

interface MatrixParticipant {
  userId: string;
  playername: string;
}

interface SlipstreamAdminPickOverviewProps {
  races: CalendarRace[];
  picks: MatrixPick[];
  participants: MatrixParticipant[];
  loading: boolean;
  error: string | null;
}

export function SlipstreamAdminPickOverview({
  races,
  picks,
  participants,
  loading,
  error
}: SlipstreamAdminPickOverviewProps) {
  const raceOptions = useMemo(() => [...races], [races]);
  const [activeSortRaceSlug, setActiveSortRaceSlug] = useState<string>('');

  const picksByUserAndRace = useMemo(() => {
    const map = new Map<string, Map<string, MatrixPick>>();
    const sortedPicks = [...picks].sort(
      (a, b) => new Date(b.pickedAt || 0).getTime() - new Date(a.pickedAt || 0).getTime()
    );

    sortedPicks.forEach((pick) => {
      if (!map.has(pick.userId)) {
        map.set(pick.userId, new Map<string, MatrixPick>());
      }

      const userPicks = map.get(pick.userId);
      if (!userPicks) return;

      if (!userPicks.has(pick.raceSlug)) {
        userPicks.set(pick.raceSlug, pick);
      }
    });

    return map;
  }, [picks]);

  const participantRows = useMemo(() => {
    const rows = [...participants].map((participant) => ({
      userId: participant.userId,
      playername: participant.playername,
    }));

    if (activeSortRaceSlug) {
      rows.sort((a, b) => {
        const aPick = picksByUserAndRace.get(a.userId)?.get(activeSortRaceSlug)?.riderName || '';
        const bPick = picksByUserAndRace.get(b.userId)?.get(activeSortRaceSlug)?.riderName || '';
        const aFirstName = aPick.trim().split(/\s+/)[0] || '';
        const bFirstName = bPick.trim().split(/\s+/)[0] || '';

        if (!!aPick !== !!bPick) return aPick ? -1 : 1;

        const riderFirstNameCompare = aFirstName.localeCompare(bFirstName);
        if (riderFirstNameCompare !== 0) return riderFirstNameCompare;

        const riderFullNameCompare = aPick.localeCompare(bPick);
        if (riderFullNameCompare !== 0) return riderFullNameCompare;

        return a.playername.localeCompare(b.playername);
      });
      return rows;
    }

    rows.sort((a, b) => {
      const nameCompare = a.playername.localeCompare(b.playername);
      if (nameCompare !== 0) return nameCompare;
      return a.userId.localeCompare(b.userId);
    });

    return rows;
  }, [participants, activeSortRaceSlug, picksByUserAndRace]);

  const handleRaceHeaderSort = (raceSlug: string) => {
    setActiveSortRaceSlug((current) => (current === raceSlug ? '' : raceSlug));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Picksmatrix</h3>
        {!loading && (
          <p className="mt-2 text-sm text-gray-500">
            {participantRows.length} deelnemers • {raceOptions.length} zichtbare races
            {activeSortRaceSlug && (
              <span className="ml-2 text-gray-600">
                • Gesorteerd op: {raceOptions.find((race) => race.raceSlug === activeSortRaceSlug)?.raceName}
              </span>
            )}
          </p>
        )}
        {!loading && raceOptions.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            Klik op een racekolom om te sorteren op gekozen renner (voornaam). Klik opnieuw om te resetten.
          </p>
        )}
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="p-4 text-sm text-gray-500">Overzicht laden...</div>
      )}

      {!loading && !error && participantRows.length === 0 && (
        <div className="p-4 text-sm text-gray-500">Geen deelnemers gevonden voor dit spel.</div>
      )}

      {!loading && !error && participantRows.length > 0 && raceOptions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium sticky left-0 bg-gray-50 z-10">
                  Deelnemer
                </th>
                {raceOptions.map((race) => {
                  const picksCount = participantRows.filter((participant) => {
                    return !!picksByUserAndRace.get(participant.userId)?.get(race.raceSlug)?.riderName;
                  }).length;
                  const isActiveSort = activeSortRaceSlug === race.raceSlug;

                  return (
                    <th key={race.raceSlug} className="text-left px-4 py-3 font-medium min-w-[220px]">
                      <button
                        type="button"
                        onClick={() => handleRaceHeaderSort(race.raceSlug)}
                        className={`text-left w-full rounded px-1 py-0.5 transition-colors ${
                          isActiveSort ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-900'
                        }`}
                        title="Sorteer op deze race"
                      >
                        <div className="font-medium">
                          {race.raceName} {isActiveSort ? '↑' : ''}
                        </div>
                        <div className={`text-xs ${isActiveSort ? 'text-blue-600' : 'text-gray-500'}`}>
                          {picksCount}/{participantRows.length}
                        </div>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {participantRows.map((participant) => {
                const userPicks = picksByUserAndRace.get(participant.userId) || new Map<string, MatrixPick>();

                return (
                  <tr key={participant.userId} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900 sticky left-0 bg-white z-10">
                      {participant.playername}
                    </td>
                    {raceOptions.map((race) => {
                      const pick = userPicks.get(race.raceSlug);
                      return (
                        <td key={`${participant.userId}-${race.raceSlug}`} className="px-4 py-3 align-top">
                          {pick?.riderName ? (
                            <div className="space-y-1">
                              <div className="text-gray-900 font-medium">{pick.riderName}</div>
                              <div className="text-xs text-yellow-700">⏱ {pick.timeLostFormatted || '-'}</div>
                              <div className="text-xs text-green-700">🟢 {pick.greenJerseyPoints ?? 0} pts</div>
                              {pick.riderFinishPosition ? (
                                <div className="text-xs text-gray-500">P{pick.riderFinishPosition}</div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && raceOptions.length === 0 && (
        <div className="p-4 text-sm text-gray-500">Nog geen races met verstreken pickdeadline.</div>
      )}
    </div>
  );
}
