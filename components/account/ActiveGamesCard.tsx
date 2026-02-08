'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface ActiveGame {
  gameId: string;
  gameName: string;
  gameType: string;
  sportType: 'cycling' | 'f1' | 'other';
  ranking: number;
  totalParticipants: number;
  totalPoints: number;
  status: string;
}

interface ActiveGamesCardProps {
  userId: string;
}

export function ActiveGamesCard({ userId }: ActiveGamesCardProps) {
  const { t } = useTranslation();
  const [games, setGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getTodayKey = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const readDailyCache = (cacheKey: string): ActiveGame[] | null => {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.date !== getTodayKey()) return null;
        if (!Array.isArray(parsed?.games)) return null;
        return parsed.games as ActiveGame[];
      } catch {
        return null;
      }
    };

    const writeDailyCache = (cacheKey: string, data: ActiveGame[]) => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ date: getTodayKey(), games: data })
        );
      } catch {
        // Ignore cache write failures (e.g., storage full or disabled)
      }
    };

    async function fetchActiveGames() {
      try {
        const cacheKey = `active-games-summary:${userId}`;
        const cached = readDailyCache(cacheKey);
        if (cached) {
          setGames(cached);
          setLoading(false);
          return;
        }

        // Fetch user's participations
        const participantsResponse = await fetch(`/api/gameParticipants?userId=${userId}`);
        if (!participantsResponse.ok) {
          setLoading(false);
          return;
        }

        const participantsData = await participantsResponse.json();
        const participants = participantsData.participants || [];

        // Get unique game IDs (remove -pending suffix)
        const gameIds = [...new Set(
          participants
            .map((p: any) => p.gameId.replace(/-pending$/, ''))
            .filter((id: string) => id)
        )] as string[];

        const activeGames: ActiveGame[] = [];

        for (const gameId of gameIds) {
          try {
            // Fetch game info
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (!gameResponse.ok) continue;

            const gameData = await gameResponse.json();
            const game = gameData.game;

            // Only show active, bidding, or registration games
            if (!['registration', 'bidding', 'active'].includes(game?.status)) {
              continue;
            }

            // Skip test games
            if (game.isTest || game.name?.toLowerCase().includes('test')) {
              continue;
            }

            // Find participant data for this user
            const participant = participants.find((p: any) =>
              p.gameId.replace(/-pending$/, '') === gameId
            );

            // Determine sport type
            const sportType = getSportType(game.gameType);

            // Get standings to find user's ranking and points
            const standingsResponse = await fetch(`/api/games/${gameId}/teams-overview`);
            let totalParticipants = 0;
            let userRanking = 0;
            let userPoints = 0;

            if (standingsResponse.ok) {
              const standingsData = await standingsResponse.json();
              const teams = standingsData.teams || [];
              totalParticipants = teams.length;

              // Find user's entry in the standings
              const userTeam = teams.find((team: any) => team.userId === userId);
              if (userTeam) {
                userRanking = userTeam.ranking || 0;
                userPoints = userTeam.totalPoints || 0;
              }
            }

            activeGames.push({
              gameId,
              gameName: game.division ? `${game.name} - ${game.division}` : game.name,
              gameType: game.gameType,
              sportType,
              ranking: userRanking,
              totalParticipants,
              totalPoints: userPoints,
              status: game.status,
            });
          } catch {
            // Skip games that fail
          }
        }

        // Sort by sport type, then by name
        activeGames.sort((a, b) => {
          const sportOrder = { cycling: 0, f1: 1, other: 2 };
          if (sportOrder[a.sportType] !== sportOrder[b.sportType]) {
            return sportOrder[a.sportType] - sportOrder[b.sportType];
          }
          return a.gameName.localeCompare(b.gameName);
        });

        writeDailyCache(`active-games-summary:${userId}`, activeGames);
        setGames(activeGames);
      } catch (error) {
        console.error('Error fetching active games:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchActiveGames();
    }
  }, [userId]);

  const cyclingGames = games.filter(g => g.sportType === 'cycling');
  const f1Games = games.filter(g => g.sportType === 'f1');
  const otherGames = games.filter(g => g.sportType === 'other');

  const formatRanking = (ranking: number, total: number): string => {
    if (ranking === 0 || total === 0) return '-';
    const percentage = Math.round(((total - ranking + 1) / total) * 100);
    return `#${ranking} van ${total} (top ${percentage}%)`;
  };

  const getGameLink = (game: ActiveGame): string => {
    if (game.sportType === 'f1') {
      return `/f1`;
    }
    return `/games/${game.gameId}/dashboard`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
        Actieve spellen
      </h2>

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton loader */}
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-1 border-t border-gray-100">
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                  <div className="flex gap-4">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : games.length === 0 ? (
        <p className="text-sm text-gray-400">Geen actieve spellen</p>
      ) : (
        <div className="space-y-6">
          {/* Wielrennen */}
          {cyclingGames.length > 0 && (
            <div className="border-l-4 border-emerald-500 pl-4 bg-emerald-50/50 py-3 pr-3 rounded-r-lg">
              <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🚴</span> Wielrennen
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 font-medium"></th>
                    <th className="pb-1 font-medium text-right pr-4"></th>
                    <th className="pb-1 font-medium text-right">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  {cyclingGames.map((game) => (
                    <tr key={game.gameId} className="border-t border-emerald-200/50">
                      <td className="py-1.5">
                        <Link
                          href={getGameLink(game)}
                          className="text-primary underline hover:text-primary/80"
                        >
                          {game.gameName}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right pr-4 text-gray-600">
                        {formatRanking(game.ranking, game.totalParticipants)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-primary">
                        {game.totalPoints} punten
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Formule 1 */}
          {f1Games.length > 0 && (
            <div className="border-l-4 border-red-500 pl-4 bg-red-50/50 py-3 pr-3 rounded-r-lg">
              <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🏎️</span> Formule 1
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-1 font-medium"></th>
                    <th className="pb-1 font-medium text-right pr-4"></th>
                    <th className="pb-1 font-medium text-right">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  {f1Games.map((game) => (
                    <tr key={game.gameId} className="border-t border-red-200/50">
                      <td className="py-1.5">
                        <Link
                          href={getGameLink(game)}
                          className="text-primary underline hover:text-primary/80"
                        >
                          {game.gameName}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right pr-4 text-gray-600">
                        {formatRanking(game.ranking, game.totalParticipants)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-primary">
                        {game.totalPoints} punten
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Other */}
          {otherGames.length > 0 && (
            <div className="border-l-4 border-gray-400 pl-4 bg-gray-50/50 py-3 pr-3 rounded-r-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🎮</span> Overig
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {otherGames.map((game) => (
                    <tr key={game.gameId} className="border-t border-gray-200/50">
                      <td className="py-1.5">
                        <Link
                          href={getGameLink(game)}
                          className="text-primary underline hover:text-primary/80"
                        >
                          {game.gameName}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right pr-4 text-gray-600">
                        {formatRanking(game.ranking, game.totalParticipants)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-primary">
                        {game.totalPoints} punten
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getSportType(gameType: string): 'cycling' | 'f1' | 'other' {
  const cyclingTypes = [
    'auctioneer',
    'slipstream',
    'last-man-standing',
    'poisoned-cup',
    'nations-cup',
    'rising-stars',
    'country-roads',
    'worldtour-manager',
    'fan-flandrien',
    'full-grid',
    'marginal-gains',
  ];

  const f1Types = ['f1-prediction'];

  if (cyclingTypes.includes(gameType)) return 'cycling';
  if (f1Types.includes(gameType)) return 'f1';
  return 'other';
}
