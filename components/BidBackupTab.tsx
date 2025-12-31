'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { BidBackupTool } from '@/components/admin/BidBackupTool';
import { BidBackupGame } from '@/lib/types/bid';

export function BidBackupTab() {
  const { user } = useAuth();
  const [games, setGames] = useState<BidBackupGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    const loadGames = async () => {
      setLoadingGames(true);
      try {
        // Load only games with auction periods
        const response = await fetch('/api/games/list?limit=100');
        if (response.ok) {
          const data = await response.json();
          const gamesWithAuctions = data.games.filter(
            (game: BidBackupGame) =>
              game.config?.auctionPeriods &&
              game.config.auctionPeriods.length > 0
          );
          setGames(gamesWithAuctions);
        }
      } catch (error) {
        console.error('Error loading games:', error);
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
  }, []);

  const selectedGame = games.find(g => g.id === selectedGameId);

  return (
    <div className="max-w-4xl">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Belangrijk</h3>
        <p className="text-sm text-yellow-700">
          Deze tool verstuurt aan alle spelers een bericht met hun biedingen uit een specifieke biedronde.
          Gebruik dit <strong>voordat</strong> je biedingen verwijdert, zodat spelers weten op welke renners ze hadden geboden.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label htmlFor="game-selector" className="block text-sm font-medium text-gray-700 mb-2">
          Selecteer game:
        </label>
        <select
          id="game-selector"
          value={selectedGameId}
          onChange={(e) => setSelectedGameId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loadingGames}
        >
          <option value="">-- Selecteer een game --</option>
          {games.map((game) => {
            const parts = [
              game.name,
              game.division ? `${game.division}` : null,
              game.year ? `(${game.year})` : null,
              `${game.config.auctionPeriods?.length || 0} biedronde(s)`
            ].filter(Boolean);

            const displayName = parts.join(' - ');

            return (
              <option key={game.id} value={game.id}>
                {displayName}
              </option>
            );
          })}
        </select>
      </div>

      {selectedGame && user && (
        <BidBackupTool
          gameId={selectedGame.id}
          adminUserId={user.uid}
          auctionPeriods={selectedGame.config.auctionPeriods || []}
        />
      )}

      {!selectedGameId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">Selecteer een game om te beginnen</p>
        </div>
      )}
    </div>
  );
}
