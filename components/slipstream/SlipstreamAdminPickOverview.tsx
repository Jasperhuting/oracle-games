'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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
  currentUserId?: string;
  standingsOrder?: string[];
}

type SortMode = 'alphabetical' | 'standings';

export function SlipstreamAdminPickOverview({
  races,
  picks,
  participants,
  loading,
  error,
  currentUserId,
  standingsOrder,
}: SlipstreamAdminPickOverviewProps) {
  const { t } = useTranslation();

  // Races reversed: newest (highest order) on the left
  const raceOptions = useMemo(() => [...races].reverse(), [races]);

  const [activeSortRaceSlug, setActiveSortRaceSlug] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [hoveredRider, setHoveredRider] = useState<string | null>(null);

  // Synchronized top scrollbar
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const isSyncingRef = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const update = () => {
      if (tableContainerRef.current) {
        setScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(table);
    return () => ro.disconnect();
  }, [raceOptions, participants]);

  const handleTopScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (tableContainerRef.current && topScrollRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    isSyncingRef.current = false;
  }, []);

  const handleTableScroll = useCallback(() => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
    isSyncingRef.current = false;
  }, []);

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
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;

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

    if (sortMode === 'standings' && standingsOrder && standingsOrder.length > 0) {
      const orderMap = new Map(standingsOrder.map((id, index) => [id, index]));
      rows.sort((a, b) => {
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;
        const aOrder = orderMap.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    } else {
      rows.sort((a, b) => {
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;
        const nameCompare = a.playername.localeCompare(b.playername);
        if (nameCompare !== 0) return nameCompare;
        return a.userId.localeCompare(b.userId);
      });
    }

    return rows;
  }, [participants, activeSortRaceSlug, picksByUserAndRace, sortMode, standingsOrder, currentUserId]);

  const riderUsageStats = useMemo(() => {
    const participantMap = new Map(participants.map((p) => [p.userId, p.playername]));
    const riderMap = new Map<string, string[]>();
    picks.forEach((pick) => {
      if (!pick.riderName) return;
      if (!riderMap.has(pick.riderName)) riderMap.set(pick.riderName, []);
      const name = participantMap.get(pick.userId) || pick.userId;
      riderMap.get(pick.riderName)!.push(name);
    });
    return Array.from(riderMap.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([riderName, pickedBy]) => ({ riderName, count: pickedBy.length, pickedBy }));
  }, [picks, participants]);

  const maxRiderCount = riderUsageStats[0]?.count ?? 1;

  const handleRaceHeaderSort = (raceSlug: string) => {
    setActiveSortRaceSlug((current) => (current === raceSlug ? '' : raceSlug));
  };

  return (
    <>
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">{t('slipstream.picksMatrix')}</h3>
            {!loading && (
              <p className="mt-1 text-sm text-gray-500">
                {participantRows.length} {t('slipstream.participants')} • {raceOptions.length} {t('slipstream.visibleRaces')}
                {activeSortRaceSlug && (
                  <span className="ml-2 text-gray-600">
                    • {t('slipstream.sortedBy')} {raceOptions.find((race) => race.raceSlug === activeSortRaceSlug)?.raceName}
                  </span>
                )}
              </p>
            )}
            {!loading && raceOptions.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">{t('slipstream.sortHint')}</p>
            )}
          </div>

          {!loading && !activeSortRaceSlug && (
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setSortMode('alphabetical')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortMode === 'alphabetical'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('slipstream.sortAlphabetical', 'A-Z')}
              </button>
              <button
                type="button"
                onClick={() => setSortMode('standings')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortMode === 'standings'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('slipstream.sortByStandings', 'Stand')}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="p-4 text-sm text-gray-500">{t('slipstream.loadingOverview')}</div>
      )}

      {!loading && !error && participantRows.length === 0 && (
        <div className="p-4 text-sm text-gray-500">{t('slipstream.noParticipantsFound')}</div>
      )}

      {!loading && !error && participantRows.length > 0 && raceOptions.length > 0 && (
        <>
          {/* Top scrollbar */}
          <div
            ref={topScrollRef}
            className="overflow-x-auto border-b border-gray-100"
            style={{ height: '14px' }}
            onScroll={handleTopScroll}
          >
            <div style={{ width: scrollWidth, height: '1px' }} />
          </div>

          {/* Table */}
          <div
            ref={tableContainerRef}
            className="overflow-x-auto"
            onScroll={handleTableScroll}
          >
            <table ref={tableRef} className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium sticky left-0 bg-gray-50 z-10">
                    {t('slipstream.participant')}
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
                          title={t('slipstream.sortByRace')}
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
                  const isCurrentUser = participant.userId === currentUserId;

                  return (
                    <tr
                      key={participant.userId}
                      className={`border-t border-gray-100 ${isCurrentUser ? 'bg-blue-50' : ''}`}
                    >
                      <td
                        className={`px-4 py-3 text-gray-900 sticky left-0 z-10 ${
                          isCurrentUser ? 'bg-blue-50 font-semibold' : 'bg-white'
                        }`}
                      >
                        {participant.playername}
                        {isCurrentUser && (
                          <span className="ml-1 text-xs text-blue-600">{t('slipstream.you')}</span>
                        )}
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
                                {pick.riderFinishPosition && pick.riderFinishPosition > 0 ? (
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
        </>
      )}

      {!loading && !error && raceOptions.length === 0 && (
        <div className="p-4 text-sm text-gray-500">{t('slipstream.noRacesWithDeadlinePassed')}</div>
      )}

    </div>

      {/* Rider usage stats - separate block */}
      {!loading && !error && riderUsageStats.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">{t('slipstream.riderUsage', 'Renner gebruik')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {riderUsageStats.map(({ riderName, count, pickedBy }) => (
              <div key={riderName} className="px-4 py-2.5 flex items-center gap-3">
                <div
                  className="relative shrink-0"
                  onMouseEnter={() => setHoveredRider(riderName)}
                  onMouseLeave={() => setHoveredRider(null)}
                >
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full cursor-default select-none w-9 inline-block text-center">
                    {count}×
                  </span>
                  {hoveredRider === riderName && (
                    <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg min-w-max">
                      <div className="px-3 pt-2.5 pb-1 text-xs font-semibold text-gray-500 border-b border-gray-100">
                        {count}× gekozen door
                      </div>
                      <ul className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                        {pickedBy.map((name) => (
                          <li key={name} className="text-sm text-gray-900">{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="w-24 shrink-0 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${(count / maxRiderCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-900 flex-1 min-w-0">{riderName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
