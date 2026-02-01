'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarRace, CalendarGame } from '@/lib/types/calendar';

interface CalendarCardProps {
  userId: string;
}

interface RaceWithGames {
  race: CalendarRace;
  relevantGames: string[];
}

export function CalendarCard({ userId }: CalendarCardProps) {
  const [races, setRaces] = useState<RaceWithGames[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalendarData() {
      try {
        const currentYear = new Date().getFullYear();

        // Fetch user's active games
        const participantsResponse = await fetch(`/api/gameParticipants?userId=${userId}`);
        const participantsData = participantsResponse.ok
          ? await participantsResponse.json()
          : { participants: [] };
        const participants = participantsData.participants || [];

        const userGameIds = new Set(
          participants.map((p: any) => p.gameId.replace(/-pending$/, ''))
        );

        // Fetch calendar
        const calendarResponse = await fetch(`/api/calendar/races?year=${currentYear}`);
        if (!calendarResponse.ok) {
          setLoading(false);
          return;
        }

        const calendarData = await calendarResponse.json();
        const allRaces: CalendarRace[] = calendarData.races || [];
        const seasonalGames: CalendarGame[] = calendarData.seasonalGames || [];

        // Helper to check if game should be excluded
        const shouldExcludeGame = (game: CalendarGame): boolean => {
          // Exclude test games
          if (game.name?.toLowerCase().includes('test')) return true;
          // Exclude F1 games (they use a different database for races)
          if (game.gameType === 'f1-prediction') return true;
          return false;
        };

        // Get user's seasonal game names (excluding test and F1 games)
        const userSeasonalGameNames = seasonalGames
          .filter((g) => userGameIds.has(g.id) && !shouldExcludeGame(g))
          .map((g) => g.name);

        // Filter races that are upcoming and relevant to user's games
        const now = new Date();
        const upcomingRaces = allRaces
          .filter((race) => {
            const startDate = new Date(race.startDate);
            return startDate >= now;
          })
          .map((race) => {
            // Get games relevant to this race that user is in (excluding test and F1 games)
            const raceGameNames = race.games
              .filter((g) => userGameIds.has(g.id) && !shouldExcludeGame(g))
              .map((g) => g.name);

            // Combine race-specific games with seasonal games
            const allRelevantGames = [...new Set([...raceGameNames, ...userSeasonalGameNames])];

            return {
              race,
              relevantGames: allRelevantGames,
            };
          })
          .filter((item) => item.relevantGames.length > 0) // Only races with relevant games
          .slice(0, 8); // Limit to 8 upcoming races

        setRaces(upcomingRaces);
      } catch (error) {
        console.error('Error fetching calendar:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchCalendarData();
    }
  }, [userId]);

  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startDay = start.getDate().toString().padStart(2, '0');
    const startMonth = (start.getMonth() + 1).toString().padStart(2, '0');
    const endDay = end.getDate().toString().padStart(2, '0');
    const endMonth = (end.getMonth() + 1).toString().padStart(2, '0');

    if (startDate === endDate) {
      return `${startDay}/${startMonth}`;
    }

    if (start.getMonth() === end.getMonth()) {
      return `${startDay}/${startMonth} - ${endDay}/${endMonth}`;
    }

    return `${startDay}/${startMonth} - ${endDay}/${endMonth}`;
  };

  const formatGames = (games: string[]): string => {
    if (games.length === 0) return '-';
    if (games.length <= 3) return games.join(', ');
    return `${games.slice(0, 2).join(', ')} & ${games.length - 2} meer`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">Kalender</h2>
        <Link
          href="/calendar"
          className="text-sm text-primary hover:underline"
        >
          Volledige kalender
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden...</p>
      ) : races.length === 0 ? (
        <p className="text-sm text-gray-400">Geen relevante races gepland</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="pb-2 font-medium">Datum</th>
                <th className="pb-2 font-medium">Wedstrijd:</th>
                <th className="pb-2 font-medium">Spellen:</th>
              </tr>
            </thead>
            <tbody>
              {races.map((item) => (
                <tr key={item.race.id} className="border-t border-gray-100">
                  <td className="py-1.5 whitespace-nowrap text-gray-600">
                    {formatDateRange(item.race.startDate, item.race.endDate)}
                  </td>
                  <td className="py-1.5 text-gray-900">
                    {item.race.name}
                  </td>
                  <td className="py-1.5 text-gray-600 italic truncate max-w-[150px]" title={formatGames(item.relevantGames)}>
                    {item.relevantGames.length} Spellen
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
