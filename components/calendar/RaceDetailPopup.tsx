import type { CalendarRace } from '@/lib/types';
import { filterTestGames, formatDateRange } from '@/lib/utils/calendar';
import { GameBadge } from './GameBadge';
import { Flag } from '@/components/Flag';

export function RaceDetailPopup({
  race,
  onClose,
}: {
  race: CalendarRace;
  onClose: () => void;
}) {
  // Games are already attached to the race by the API (including seasonal games for non-women races)
  const filteredGames = filterTestGames(race.games);

  // Remove duplicates based on game name
  const uniqueGamesMap = new Map<string, typeof race.games[0]>();
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
