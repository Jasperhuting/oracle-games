import type { CalendarRace } from '@/lib/types';
import { Flag } from '@/components/Flag';
import { filterTestGames, formatDateRange } from '@/lib/utils/calendar';
import { GameBadge } from './GameBadge';

export function RaceCard({
  race,
}: {
  race: CalendarRace;
}) {
  // Games are already attached to the race by the API (including seasonal games for non-women races)
  const filteredGames = filterTestGames(race.games);

  // Remove duplicates based on game ID
  const uniqueGamesMap = new Map<string, typeof race.games[0]>();
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
