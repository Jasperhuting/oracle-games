'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface AvailableGame {
  id: string;
  name: string;
  gameType: string;
  status: string;
  registrationCloseDate?: string;
  division?: string;
}

interface AvailableGamesCardProps {
  userId: string;
}

export function AvailableGamesCard({ userId }: AvailableGamesCardProps) {
  const { t } = useTranslation();
  const [games, setGames] = useState<AvailableGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAvailableGames() {
      try {
        // Fetch all games (no status filter to get all joinable games)
        const gamesResponse = await fetch('/api/games/list?limit=100');
        if (!gamesResponse.ok) {
          setLoading(false);
          return;
        }

        const gamesData = await gamesResponse.json();
        const allGames = gamesData.games || [];

        // Fetch user's participations
        const participantsResponse = await fetch(`/api/gameParticipants?userId=${userId}`);
        const participantsData = participantsResponse.ok
          ? await participantsResponse.json()
          : { participants: [] };
        const participants = participantsData.participants || [];

        // Get game IDs user has joined
        const joinedGameIds = new Set(
          participants
            .filter((p: any) => p.gameId)
            .map((p: any) => p.gameId.replace(/-pending$/, ''))
        );

        // Filter to joinable games that user hasn't joined (excluding test games)
        const available = allGames
          .filter((game: any) =>
            !joinedGameIds.has(game.id) &&
            ['draft', 'registration', 'bidding', 'active'].includes(game.status) &&
            !game.isTest &&
            !game.name?.toLowerCase().includes('test')
          )
          .map((game: any) => ({
            id: game.id,
            name: game.division ? `${game.name} - ${game.division}` : game.name,
            gameType: game.gameType,
            status: game.status,
            registrationCloseDate: game.registrationCloseDate,
            division: game.division,
          }))
          .slice(0, 10); // Limit to 10 games

        setGames(available);
      } catch (error) {
        console.error('Error fetching available games:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchAvailableGames();
    }
  }, [userId]);

  const formatDeadline = (dateString?: string): { date: string; relative: string } => {
    if (!dateString) return { date: '', relative: '' };
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

    const dateStr = date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    let relative: string;
    if (diffMs < 0) relative = t('availableGames.deadlineExpired');
    else if (diffHours < 1) relative = t('availableGames.deadlineLessThanHour');
    else if (diffHours < 24) relative = t('availableGames.deadlineHours', { hours: diffHours });
    else if (diffDays === 1) relative = t('availableGames.deadlineTomorrow');
    else relative = t('availableGames.deadlineDays', { days: diffDays });

    return { date: dateStr, relative };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">{t('availableGames.title')}</h2>
        <Link
          href="/games"
          className="text-sm text-primary hover:underline"
        >
          {t('availableGames.viewAll')}
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">{t('global.loading')}</p>
      ) : games.length === 0 ? (
        <p className="text-sm text-gray-400">{t('availableGames.noGames')}</p>
      ) : (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-1 font-medium">{t('availableGames.columnGame')}</th>
                <th className="pb-1 font-medium text-right">{t('availableGames.columnDeadline')}</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => {
                const deadline = formatDeadline(game.registrationCloseDate);
                return (
                  <tr key={game.id} className="border-t border-gray-100">
                    <td className="py-1.5">
                      <Link
                        href={`/games/${game.id}`}
                        className="text-gray-900 hover:text-primary hover:underline"
                      >
                        {game.name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right">
                      {deadline.date ? (
                        <>
                          <div className="text-gray-900 font-medium">{deadline.relative}</div>
                          <div className="text-xs text-gray-400">{deadline.date}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
