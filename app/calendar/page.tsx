'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarResponse, CalendarRace } from '@/lib/types';
import {
  MONTHS_NL,
  getClassificationLabel,
  filterTestGames,
  filterUnwantedClassifications,
  groupRacesByMonth,
} from '@/lib/utils/calendar';
import { RaceCard, CalendarGrid, RaceDetailPopup } from '@/components/calendar';

export default function CalendarPage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [showPast, setShowPast] = useState(false);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRace, setSelectedRace] = useState<CalendarRace | null>(null);

  // Available years for dropdown
  const years = [currentYear, currentYear + 1];

  const classificationOptions = useMemo(() => {
    if (!data?.races) return [];
    const filtered = filterUnwantedClassifications(data.races);
    const unique = Array.from(
      new Set(
        filtered
          .map((race) => (race.classification || '').trim())
          .filter(Boolean)
      )
    ).sort();
    return unique;
  }, [data?.races]);

  const raceOverlapsMonth = (race: CalendarRace, month: number) => {
    const raceStart = new Date(race.startDate);
    const raceEnd = new Date(race.endDate);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    return raceStart <= monthEnd && raceEnd >= monthStart;
  };

  // Filter races by removing unwanted classifications + filters
  const filteredRaces = useMemo(() => {
    if (!data?.races) return [];
    const today = new Date();
    const base = filterUnwantedClassifications(data.races);
    return base.filter((race) => {
      if (!showPast) {
        const raceEnd = new Date(race.endDate);
        // Treat endDate as end of local day so ongoing races aren't hidden too early.
        raceEnd.setHours(23, 59, 59, 999);
        if (raceEnd < today) return false;
      }
      if (classificationFilter !== 'all') {
        const classification = (race.classification || '').trim();
        if (classification !== classificationFilter) return false;
      }
      if (monthFilter !== 'all' && !raceOverlapsMonth(race, monthFilter)) {
        return false;
      }
      return true;
    });
  }, [data?.races, showPast, classificationFilter, monthFilter, year]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/calendar/races?year=${year}`);
        if (!response.ok) {
          throw new Error('Failed to fetch calendar data');
        }
        const result = await response.json();
        // Filter test games from seasonal games
        setData({
          ...result,
          seasonalGames: filterTestGames(result.seasonalGames || []),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  useEffect(() => {
    if (viewMode === 'calendar' && monthFilter !== 'all') {
      setCurrentMonth(monthFilter);
    }
  }, [viewMode, monthFilter]);

  const racesByMonth = groupRacesByMonth(filteredRaces);

  // Get races that are active during the current month (not just starting in it)
  const racesForCurrentMonth = filteredRaces.filter(race => {
    const raceStart = new Date(race.startDate);
    const raceEnd = new Date(race.endDate);
    const monthStart = new Date(year, currentMonth, 1);
    const monthEnd = new Date(year, currentMonth + 1, 0);

    // Race overlaps with this month if it starts before month ends AND ends after month starts
    return raceStart <= monthEnd && raceEnd >= monthStart;
  }) || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('calendar.title')}
        </h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Lijst
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'calendar' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Kalender
            </button>
          </div>

          {/* Year selector */}
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {years.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Maand</label>
            <select
              value={monthFilter}
              onChange={(e) => {
                const value = e.target.value;
                setMonthFilter(value === 'all' ? 'all' : parseInt(value, 10));
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Alle</option>
              {MONTHS_NL.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Raceniveau</label>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Alle</option>
              {classificationOptions.map((classification) => (
                <option key={classification} value={classification}>
                  {getClassificationLabel(classification)}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Toon afgelopen
          </label>

          <span className="text-sm text-gray-400">
            ({filteredRaces.length} {filteredRaces.length === 1 ? 'race' : 'races'})
          </span>
        </div>
      </div>

      {/* Seasonal games info */}
      {data && data.seasonalGames.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <span className="font-medium">{t('calendar.seasonalInfo')}:</span>{' '}
            {data.seasonalGames.map(g => g.name).join(', ')}{' '}
            {t('calendar.seasonalSuffix')}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-500">
            {t('global.loading')}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Calendar content */}
      {!loading && !error && data && (
        <>
          {viewMode === 'list' ? (
            // List view
            <div className="space-y-8">
              {data.races.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {t('calendar.noRaces')}
                </div>
              ) : (
                Array.from(racesByMonth.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([month, races]) => (
                    <div key={month}>
                      <h2 className="text-lg font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        {MONTHS_NL[month]}
                      </h2>
                      <div className="space-y-3">
                        {races.map((race:CalendarRace) => (
                          <RaceCard
                            key={race.id}
                            race={race}
                          />
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          ) : (
            // Calendar view
            <div>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (currentMonth === 0) {
                      setCurrentMonth(11);
                      setYear(y => y - 1);
                    } else {
                      setCurrentMonth(m => m - 1);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full text-lg"
                >
                  ←
                </button>
                <h2 className="text-lg font-semibold text-gray-700">
                  {MONTHS_NL[currentMonth]} {year}
                </h2>
                <button
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentMonth(0);
                      setYear(y => y + 1);
                    } else {
                      setCurrentMonth(m => m + 1);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full text-lg"
                >
                  →
                </button>
              </div>

              <CalendarGrid
                races={racesForCurrentMonth}
                year={year}
                month={currentMonth}
                onRaceClick={setSelectedRace}
              />

              {/* Legend */}
              <div className="mt-4 text-xs text-gray-500">
                <p>Klik op een wedstrijd voor meer details</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Race detail popup */}
      {selectedRace && (
        <RaceDetailPopup
          race={selectedRace}
          onClose={() => setSelectedRace(null)}
        />
      )}
    </div>
  );
}
