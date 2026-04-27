'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface GameSummary {
  gameId: string;
  gameName: string;
  gameType: string;
  sportType: 'cycling' | 'f1' | 'other';
  ranking: number;
  totalParticipants: number;
  totalPoints: number;
  status: string;
  lastScoreUpdate?: string | null;
  isParticipant: boolean;
}

interface ListGame {
  id: string;
  name: string;
  gameType: string;
  status: string;
  division?: string;
  isTest?: boolean;
}

interface ActiveGamesCardProps {
  userId: string;
  excludeSportTypes?: string[];
}

const cyclingTypes = new Set([
  'auctioneer', 'slipstream', 'last-man-standing', 'poisoned-cup',
  'nations-cup', 'rising-stars', 'country-roads', 'worldtour-manager',
  'fan-flandrien', 'full-grid', 'marginal-gains',
]);

function getSportType(gameType: string): 'cycling' | 'f1' | 'other' {
  if (cyclingTypes.has(gameType)) return 'cycling';
  if (gameType === 'f1-prediction') return 'f1';
  return 'other';
}

export function ActiveGamesCard({ userId, excludeSportTypes = [] }: ActiveGamesCardProps) {
  const { t } = useTranslation();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGames() {
      try {
        const [summaryRes, listRes] = await Promise.all([
          fetch('/api/account/games-summary'),
          fetch('/api/games/list?limit=100'),
        ]);

        const summaryMap = new Map<string, GameSummary>();
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          for (const g of summaryData.games ?? []) {
            summaryMap.set(g.gameId, { ...g, isParticipant: true });
          }
        }

        const merged: GameSummary[] = [];

        if (listRes.ok) {
          const listData = await listRes.json();
          for (const g of listData.games ?? [] as ListGame[]) {
            if (g.isTest || g.name?.toLowerCase().includes('test')) continue;
            if (!['registration', 'bidding', 'active'].includes(g.status)) continue;

            if (summaryMap.has(g.id)) {
              merged.push(summaryMap.get(g.id)!);
              summaryMap.delete(g.id);
            } else {
              const gameName = g.division ? `${g.name} - ${g.division}` : g.name;
              merged.push({
                gameId: g.id,
                gameName,
                gameType: g.gameType,
                sportType: getSportType(g.gameType),
                ranking: 0,
                totalParticipants: 0,
                totalPoints: 0,
                status: g.status,
                lastScoreUpdate: null,
                isParticipant: false,
              });
            }
          }
        }

        // Any participant games not in the list (e.g. finished but still in summary)
        for (const g of summaryMap.values()) {
          merged.push(g);
        }

        merged.sort((a, b) => {
          const sportOrder = { cycling: 0, f1: 1, other: 2 };
          if (sportOrder[a.sportType] !== sportOrder[b.sportType]) {
            return sportOrder[a.sportType] - sportOrder[b.sportType];
          }
          return a.gameName.localeCompare(b.gameName);
        });

        setGames(merged);
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchGames();
  }, [userId]);

  const cyclingGames = games.filter(g => g.sportType === 'cycling' && !excludeSportTypes.includes(g.sportType));
  const f1Games = games.filter(g => g.sportType === 'f1' && !excludeSportTypes.includes(g.sportType));
  const otherGames = games.filter(g => g.sportType === 'other' && !excludeSportTypes.includes(g.sportType));

  const formatRanking = (game: GameSummary): string => {
    if (!game.isParticipant) return '-';
    if (game.ranking === 0) return '-';
    if (game.totalParticipants === 0) return `#${game.ranking}`;
    const percentage = Math.round((game.ranking / game.totalParticipants) * 100);
    return t('activeGames.rankingOf', { ranking: game.ranking, total: game.totalParticipants, percentage });
  };

  const getGameLink = (game: GameSummary): string => {
    if (game.sportType === 'f1') return `/f1`;
    if (game.gameType === 'slipstream') return `/games/${game.gameId}/slipstream`;
    return `/games/${game.gameId}/dashboard`;
  };

  const formatLastUpdate = (lastUpdate?: string | null): string => {
    if (!lastUpdate) return t('activeGames.noUpdates');
    const date = new Date(lastUpdate);
    if (Number.isNaN(date.getTime())) return t('global.unknown');
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    if (diffMinutes < 1) return t('activeGames.justNow');
    if (diffMinutes < 60) return t('activeGames.minutesAgo', { minutes: diffMinutes });
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return t('activeGames.hoursAgo', { hours: diffHours });
    const diffDays = Math.round(diffHours / 24);
    return t('activeGames.daysAgo', { days: diffDays });
  };

  const renderTable = (list: GameSummary[], borderColor: string, bgColor: string) => (
    <table className="w-full text-sm">
      <tbody>
        {list.map((game) => (
          <tr key={game.gameId} className={`border-t ${borderColor}`}>
            <td className="py-1.5">
              <Link href={getGameLink(game)} className="text-primary underline hover:text-primary/80">
                {game.gameName}
              </Link>
              {game.isParticipant && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {t('activeGames.lastUpdate')}: {formatLastUpdate(game.lastScoreUpdate)}
                </div>
              )}
              {!game.isParticipant && (
                <div className="text-xs text-gray-400 mt-0.5 italic">
                  Niet deelgenomen
                </div>
              )}
            </td>
            <td className="py-1.5 text-right pr-4 text-gray-600">
              {formatRanking(game)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
        {t('activeGames.title')}
      </h2>

      {loading ? (
        <div className="space-y-4">
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-1 border-t border-gray-100">
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : games.length === 0 ? (
        <p className="text-sm text-gray-400">{t('activeGames.noGames')}</p>
      ) : (
        <div className="space-y-6">
          {cyclingGames.length > 0 && (
            <div className="border-l-4 border-emerald-500 pl-4 bg-emerald-50/50 py-3 pr-3 rounded-r-lg">
              <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🚴</span> {t('preferences.sports.cycling')}
              </h3>
              {renderTable(cyclingGames, 'border-emerald-200/50', 'bg-emerald-50')}
            </div>
          )}

          {f1Games.length > 0 && (
            <div className="border-l-4 border-red-500 pl-4 bg-red-50/50 py-3 pr-3 rounded-r-lg">
              <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🏎️</span> {t('preferences.sports.f1')}
              </h3>
              {renderTable(f1Games, 'border-red-200/50', 'bg-red-50')}
            </div>
          )}

          {otherGames.length > 0 && (
            <div className="border-l-4 border-gray-400 pl-4 bg-gray-50/50 py-3 pr-3 rounded-r-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">🎮</span> {t('preferences.sports.other')}
              </h3>
              {renderTable(otherGames, 'border-gray-200/50', 'bg-gray-50')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
