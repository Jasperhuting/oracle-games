'use client';

import { useState } from 'react';
import type { CalendarRace } from '@/lib/types';
import { DAYS_NL, formatDateRange } from '@/lib/utils/calendar';

export function CalendarGrid({
  races,
  year,
  month,
  onRaceClick,
}: {
  races: CalendarRace[];
  year: number;
  month: number;
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
