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

interface TeamsOverviewTeam {
  userId?: string;
  ranking?: number;
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

function getGameTypeLabel(gameType: string): string {
  const labels: Record<string, string> = {
    'auctioneer': 'Auction Master',
    'slipstream': 'Slipstream',
    'last-man-standing': 'Last Man Standing',
    'poisoned-cup': 'Poisoned Cup',
    'nations-cup': 'Nations Cup',
    'rising-stars': 'Rising Stars',
    'country-roads': 'Country Roads',
    'worldtour-manager': 'WorldTour Manager',
    'fan-flandrien': 'Fan Flandrien',
    'full-grid': 'Full Grid',
    'marginal-gains': 'Marginal Gains',
    'f1-prediction': 'F1 Prediction',
  };

  return labels[gameType] || gameType;
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
          const fullGridRankingCache = new Map<string, number>();
          for (const g of summaryData.games ?? []) {
            const gameSummary: GameSummary = { ...g, isParticipant: true };

            if (gameSummary.gameType === 'full-grid' && gameSummary.ranking === 0) {
              if (!fullGridRankingCache.has(gameSummary.gameId)) {
                try {
                  const standingsResponse = await fetch(`/api/games/${gameSummary.gameId}/teams-overview`);
                  if (standingsResponse.ok) {
                    const standingsData = await standingsResponse.json();
                    const teams = Array.isArray(standingsData?.teams) ? standingsData.teams as TeamsOverviewTeam[] : [];
                    const ownTeam = teams.find((team) => team.userId === userId);
                    fullGridRankingCache.set(gameSummary.gameId, Number(ownTeam?.ranking) || 0);
                  } else {
                    fullGridRankingCache.set(gameSummary.gameId, 0);
                  }
                } catch {
                  fullGridRankingCache.set(gameSummary.gameId, 0);
                }
              }

              const resolvedRanking = fullGridRankingCache.get(gameSummary.gameId) || 0;
              if (resolvedRanking > 0) {
                gameSummary.ranking = resolvedRanking;
              }
            }

            summaryMap.set(g.gameId, gameSummary);
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

  const groupByGameType = (list: GameSummary[]) =>
    Object.entries(
      list.reduce((acc, game) => {
        if (!acc[game.gameType]) {
          acc[game.gameType] = [];
        }
        acc[game.gameType].push(game);
        return acc;
      }, {} as Record<string, GameSummary[]>)
    )
      .map(([gameType, groupedGames]) => ({
        gameType,
        label: getGameTypeLabel(gameType),
        games: groupedGames.sort((a, b) => a.gameName.localeCompare(b.gameName)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

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

  const renderTable = (list: GameSummary[], borderColor: string) => (
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

  const renderSportSection = (
    list: GameSummary[],
    accentBorderClass: string,
    accentBgClass: string,
    titleClassName: string,
    icon: string,
    title: string,
    borderColor: string,
  ) => (
    <div className={`border-l-4 ${accentBorderClass} pl-4 ${accentBgClass} py-3 pr-3 rounded-r-lg`}>
      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${titleClassName}`}>
        <span className="text-lg">{icon}</span> {title}
      </h3>

      <div className="space-y-4">
        {groupByGameType(list).map((typeGroup) => (
          <div key={typeGroup.gameType} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {typeGroup.label}
              </h4>
              <span className="text-xs text-gray-500">
                {typeGroup.games.length} {typeGroup.games.length === 1 ? 'spel' : 'spellen'}
              </span>
            </div>
            {renderTable(typeGroup.games, borderColor)}
          </div>
        ))}
      </div>
    </div>
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
            renderSportSection(
              cyclingGames,
              'border-emerald-500',
              'bg-emerald-50/50',
              'text-emerald-700',
              '🚴',
              t('preferences.sports.cycling'),
              'border-emerald-200/50',
            )
          )}

          {f1Games.length > 0 && (
            renderSportSection(
              f1Games,
              'border-red-500',
              'bg-red-50/50',
              'text-red-700',
              '🏎️',
              t('preferences.sports.f1'),
              'border-red-200/50',
            )
          )}

          {otherGames.length > 0 && (
            renderSportSection(
              otherGames,
              'border-gray-400',
              'bg-gray-50/50',
              'text-gray-700',
              '🎮',
              t('preferences.sports.other'),
              'border-gray-200/50',
            )
          )}
        </div>
      )}
    </div>
  );
}
