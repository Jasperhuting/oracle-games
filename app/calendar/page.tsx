'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarResponse, CalendarRace, CalendarGame } from '@/lib/types';
import { Flag } from '@/components/Flag';

const MONTHS_NL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

// UCI Race Classification descriptions
const CLASSIFICATION_LABELS: Record<string, string> = {
  // World Tour
  '2.UWT': 'UCI WorldTour (Grote Rondes & Monumenten)',
  '1.UWT': 'UCI WorldTour (Eendaagse)',
  // Pro Series
  '2.Pro': 'UCI ProSeries (Meerdaagse)',
  '1.Pro': 'UCI ProSeries (Eendaagse)',
  // Class 1 & 2
  '2.1': 'Klasse 1 (Meerdaagse)',
  '1.1': 'Klasse 1 (Eendaagse)',
  '2.2': 'Klasse 2 (Meerdaagse)',
  '1.2': 'Klasse 2 (Eendaagse)',
  // National Championships
  'NC': 'Nationaal Kampioenschap',
  'CC': 'Continentaal Kampioenschap',
  'WC': 'Wereldkampioenschap',
  // Women
  '2.WWT': 'Women\'s WorldTour (Meerdaagse)',
  '1.WWT': 'Women\'s WorldTour (Eendaagse)',
  // Other
  'GT': 'Grand Tour',
  'ME': 'Mannen Elite',
  'MU': 'Mannen U23',
  'WE': 'Vrouwen Elite',
};

// Get display label for classification
function getClassificationLabel(code: string): string {
  return CLASSIFICATION_LABELS[code] || code;
}

// Filter out test games
function filterTestGames(games: CalendarGame[]): CalendarGame[] {
  return games.filter(g => !g.name.toLowerCase().includes('test'));
}

// Filter out unwanted race classifications
function filterUnwantedClassifications(races: CalendarRace[]): CalendarRace[] {
  const unwantedClassifications = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'];
  
  // Check if classification is in race name instead
  const filtered = races.filter(race => {
    const classification = (race.classification || '').trim();
    const hasUnwantedInName = unwantedClassifications.some(cls => 
      race.name.includes(cls) || race.name.includes(`${cls} -`)
    );
    const hasUnwantedInClassification = unwantedClassifications.some(cls => 
      classification.includes(cls)
    );
    const nameLower = race.name.toLowerCase();
    const slugLower = (race.slug || '').toLowerCase();
    const hasWomenInName = nameLower.includes('women') || nameLower.includes('vrouw') || nameLower.includes('dames');
    const hasWomenInSlug = slugLower.includes('women') || slugLower.includes('vrouw') || slugLower.includes('dames');
    const hasWWTInClassification = classification.includes('WWT');
    const isWomenClassification = classification.includes('.W') || classification.endsWith('W');
    
    if (hasUnwantedInName || hasUnwantedInClassification || hasWomenInName || hasWomenInSlug || hasWWTInClassification || isWomenClassification) {
      console.log('Filtering out race:', race.name, 'classification:', classification, 'hasWWT:', hasWWTInClassification);
    }
    
    return !hasUnwantedInName && !hasUnwantedInClassification && !hasWomenInName && !hasWomenInSlug && !hasWWTInClassification && !isWomenClassification;
  });
  
  console.log('Original races:', races.length);
  console.log('Filtered races:', filtered.length);
  return filtered;
}

// Group races by month
function groupRacesByMonth(races: CalendarRace[]): Map<number, CalendarRace[]> {
  const grouped = new Map<number, CalendarRace[]>();

  races.forEach(race => {
    const month = new Date(race.startDate).getMonth();
    if (!grouped.has(month)) {
      grouped.set(month, []);
    }
    grouped.get(month)!.push(race);
  });

  return grouped;
}

// Format date range
function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString('nl-NL', { month: 'short' });
  const endMonth = end.toLocaleDateString('nl-NL', { month: 'short' });

  // Same day (single-day race)
  if (startDate === endDate) {
    return `${startDay} ${startMonth}`;
  }

  // Same month
  if (start.getMonth() === end.getMonth()) {
    return `${startDay}-${endDay} ${startMonth}`;
  }

  // Different months
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

// Game badge component
function GameBadge({ game }: { game: CalendarGame }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
      {game.name}
    </span>
  );
}

// Race card component (list view)
function RaceCard({
  race,
}: {
  race: CalendarRace;
}) {
  // Games are already attached to the race by the API (including seasonal games for non-women races)
  const filteredGames = filterTestGames(race.games);
  
  // Remove duplicates based on game ID
  const uniqueGamesMap = new Map<string, CalendarGame>();
  filteredGames.forEach(game => {
if (!uniqueGamesMap.has(game.name)) {
      uniqueGamesMap.set(game.name, game);
    }
  });
  
  const allGames = Array.from(uniqueGamesMap.values());

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow ${new Date(race.startDate) < new Date() ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{race.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {formatDateRange(race.startDate, race.endDate)}
            {race.classification && (
              <span className="ml-2 text-gray-400">• {race.classification}</span>
            )}
          </p>
        </div>
        {race.country && (
          <span className="text-sm text-gray-400">{<Flag countryCode={race.country} />}</span>
        )}
      </div>

      {allGames.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allGames.map(game => (
            <GameBadge key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

// Calendar grid component with multi-day race support
function CalendarGrid({
  races,
  year,
  month,
  onRaceClick,
}: {
  races: CalendarRace[];
  year: number;
  month: number;
  seasonalGames: CalendarGame[];
  onRaceClick: (race: CalendarRace) => void;
}) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Get day of week for first day (0 = Sunday, we want Monday = 0)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  // Create array of days
  const days: (number | null)[] = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Add days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Calculate weeks for the calendar
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  // Pad last week if needed
  while (weeks.length > 0 && weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null);
  }

  // Color palette for races
  const raceColors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#a855f7', // purple
    '#f97316', // orange
    '#ec4899', // pink
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#ef4444', // red
  ];

  // Sort races by start date and duration (longer races first for better stacking)
  const sortedRaces = [...races].sort((a, b) => {
    const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (startDiff !== 0) return startDiff;
    // Longer races first
    const aDuration = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
    const bDuration = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
    return bDuration - aDuration;
  });

  // Assign consistent colors to races based on sorted order
  const raceColorMap = new Map<string, string>();
  sortedRaces.forEach((race, index) => {
    raceColorMap.set(race.id, raceColors[index % raceColors.length]);
  });

  // Get races that should appear in a specific week
  const getRacesForWeek = (week: (number | null)[], weekIndex: number): { race: CalendarRace; startCol: number; endCol: number; isStart: boolean; isEnd: boolean }[] => {
    const result: { race: CalendarRace; startCol: number; endCol: number; isStart: boolean; isEnd: boolean }[] = [];
    
    races.forEach(race => {
      const raceStart = new Date(race.startDate);
      const raceEnd = new Date(race.endDate);
      raceStart.setHours(0, 0, 0, 0);
      raceEnd.setHours(0, 0, 0, 0);
      
      let startCol = -1;
      let endCol = -1;
      let isStart = false;
      let isEnd = false;
      
      week.forEach((day, colIndex) => {
        if (day === null) return;
        
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);
        
        if (currentDate >= raceStart && currentDate <= raceEnd) {
          if (startCol === -1) startCol = colIndex;
          endCol = colIndex;
          
          if (currentDate.getTime() === raceStart.getTime()) isStart = true;
          if (currentDate.getTime() === raceEnd.getTime()) isEnd = true;
        }
      });
      
      if (startCol !== -1) {
        result.push({ race, startCol, endCol, isStart, isEnd });
      }
    });
    
    return result;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DAYS_NL.map(day => (
          <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - week by week */}
      {weeks.map((week, weekIndex) => {
        const weekRaces = getRacesForWeek(week, weekIndex);
        // Sort week races consistently
        weekRaces.sort((a, b) => {
          const aStart = new Date(a.race.startDate).getTime();
          const bStart = new Date(b.race.startDate).getTime();
          if (aStart !== bStart) return aStart - bStart;
          const aDuration = new Date(a.race.endDate).getTime() - aStart;
          const bDuration = new Date(b.race.endDate).getTime() - bStart;
          return bDuration - aDuration;
        });

        return (
          <div key={weekIndex} className="relative">
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {week.map((day, dayIndex) => {
                const isToday = day && new Date().getDate() === day &&
                                new Date().getMonth() === month &&
                                new Date().getFullYear() === year;

                return (
                  <div
                    key={dayIndex}
                    className={`min-h-[130px] border-b border-r border-gray-100 ${
                      day ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    {day && (
                      <div className={`text-xs p-1 ${isToday ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center ml-1 mt-1' : 'text-gray-400'}`}>
                        {day}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Race bars overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ top: '30px' }}>
              <div className="relative h-full">
                {weekRaces.slice(0, 4).map(({ race, startCol, endCol, isStart, isEnd }, raceIndex) => {
                  const color = raceColorMap.get(race.id) || raceColors[0];
                  const leftPercent = (startCol / 7) * 100;
                  const widthPercent = ((endCol - startCol + 1) / 7) * 100;

                  return (
                    <button
                      key={race.id}
                      onClick={() => onRaceClick(race)}
                      className="absolute pointer-events-auto text-left text-xs text-white truncate hover:brightness-110 transition-all cursor-pointer"
                      style={{
                        left: `calc(${leftPercent}% + ${isStart ? '3px' : '0px'})`,
                        width: `calc(${widthPercent}% - ${isStart ? '3px' : '0px'} - ${isEnd ? '3px' : '0px'})`,
                        top: `${raceIndex * 19}px`,
                        height: '17px',
                        lineHeight: '17px',
                        paddingLeft: isStart ? '6px' : '4px',
                        paddingRight: '4px',
                        backgroundColor: color,
                        borderRadius: `${isStart ? '3px' : '0'} ${isEnd ? '3px' : '0'} ${isEnd ? '3px' : '0'} ${isStart ? '3px' : '0'}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                      title={`${race.name} (${formatDateRange(race.startDate, race.endDate)})`}
                    >
                      {race.name}
                    </button>
                  );
                })}
                {weekRaces.length > 4 && (
                  <button
                    onClick={() => setExpandedWeek(expandedWeek === weekIndex ? null : weekIndex)}
                    className="absolute text-xs text-primary font-medium hover:underline cursor-pointer pointer-events-auto"
                    style={{ top: '76px', left: '4px' }}
                  >
                    +{weekRaces.length - 4} meer
                  </button>
                )}
                {/* Expanded week popup */}
                {expandedWeek === weekIndex && weekRaces.length > 4 && (
                  <div
                    className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3 pointer-events-auto"
                    style={{ top: '100px', maxHeight: '200px' }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Alle races deze week ({weekRaces.length})</span>
                      <button
                        onClick={() => setExpandedWeek(null)}
                        className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                    <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '150px' }}>
                      {weekRaces.map(({ race }) => {
                        const color = raceColorMap.get(race.id) || raceColors[0];
                        return (
                          <button
                            key={race.id}
                            onClick={() => {
                              onRaceClick(race);
                              setExpandedWeek(null);
                            }}
                            className="w-full text-left text-xs text-white px-2 py-1 rounded hover:brightness-110 truncate"
                            style={{ backgroundColor: color }}
                          >
                            {race.name} ({formatDateRange(race.startDate, race.endDate)})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Race detail popup
function RaceDetailPopup({
  race,
  onClose,
}: {
  race: CalendarRace;
  onClose: () => void;
}) {
  // Games are already attached to the race by the API (including seasonal games for non-women races)
  const filteredGames = filterTestGames(race.games);
  
  // Remove duplicates based on game name
  const uniqueGamesMap = new Map<string, CalendarGame>();
  filteredGames.forEach(game => {
    if (!uniqueGamesMap.has(game.name)) {
      uniqueGamesMap.set(game.name, game);
    }
  });
  
  const allGames = Array.from(uniqueGamesMap.values());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{race.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-gray-500">Datum:</span>{' '}
            <span className="text-gray-900">{formatDateRange(race.startDate, race.endDate)}</span>
          </div>

          {race.classification && (
            <div>
              <span className="text-gray-500">Classificatie:</span>{' '}
              <span className="text-gray-900">{race.classification}</span>
            </div>
          )}

          {race.country && (
            <div>
              <span className="text-gray-500">Land:</span>{' '}
              <span className="text-gray-900">{<Flag countryCode={race.country} />}</span>
            </div>
          )}

          {allGames.length > 0 && (
            <div>
              <span className="text-gray-500 block mb-2">Telt voor:</span>
              <div className="flex flex-wrap gap-1.5">
                {allGames.map(game => (
                  <GameBadge key={game.id} game={game} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRace, setSelectedRace] = useState<CalendarRace | null>(null);

  // Available years for dropdown
  const years = [currentYear, currentYear + 1];

  // Filter races by removing unwanted classifications
  const filteredRaces = useMemo(() => {
    if (!data?.races) return [];
    return filterUnwantedClassifications(data.races);
  }, [data?.races]);

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
                seasonalGames={data.seasonalGames}
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
