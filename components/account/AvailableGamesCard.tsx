'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

interface AvailableGame {
  id: string;
  name: string;
  gameType: string;
  status: string;
  registrationDeadline?: string;
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
          participants.map((p: any) => p.gameId.replace(/-pending$/, ''))
        );

        // Filter to joinable games (registration or bidding) that user hasn't joined (excluding test games)
        const available = allGames
          .filter((game: any) =>
            !joinedGameIds.has(game.id) &&
            ['registration', 'bidding'].includes(game.status) &&
            !game.isTest &&
            !game.name?.toLowerCase().includes('test')
          )
          .map((game: any) => ({
            id: game.id,
            name: game.division ? `${game.name} - ${game.division}` : game.name,
            gameType: game.gameType,
            status: game.status,
            registrationDeadline: game.registrationDeadline,
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

  const formatDeadline = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Verlopen';
    if (diffDays === 0) return 'Vandaag';
    if (diffDays === 1) return 'Morgen';
    if (diffDays < 7) return `${diffDays} dagen`;

    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">Beschikbare spellen</h2>
        <Link
          href="/games"
          className="text-sm text-primary hover:underline"
        >
          Bekijk alles
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden...</p>
      ) : games.length === 0 ? (
        <p className="text-sm text-gray-400">Geen beschikbare spellen</p>
      ) : (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-1 font-medium">Spel</th>
                <th className="pb-1 font-medium text-right">Deadline:</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id} className="border-t border-gray-100">
                  <td className="py-1.5">
                    <Link
                      href={`/games/${game.id}`}
                      className="text-gray-900 hover:text-primary hover:underline"
                    >
                      {game.name}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right text-gray-600">
                    {formatDeadline(game.registrationDeadline)}
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
