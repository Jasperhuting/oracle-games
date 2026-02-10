'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BidBackupTool } from '@/components/admin/BidBackupTool';
import Link from 'next/link';
import { ArrowRight } from 'tabler-icons-react';
import { Game } from '@/lib/types';

export default function BidBackupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [loadingGames, setLoadingGames] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!loading && !user) {
        router.push('/login');
        return;
      }

      if (user) {
        try {
          const response = await fetch(`/api/getUser?userId=${user.uid}`);
          if (response.ok) {
            const userData = await response.json();
            if (userData.userType === 'admin') {
              setIsAdmin(true);
            } else {
              router.push('/home');
            }
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          router.push('/home');
        } finally {
          setChecking(false);
        }
      }
    };

    checkAdminStatus();
  }, [user, loading, router]);

  useEffect(() => {
    const loadGames = async () => {
      if (!isAdmin) return;

      setLoadingGames(true);
      try {
        // Load only games with auction periods
        const response = await fetch('/api/games/list?limit=100');
        if (response.ok) {
          const data = await response.json();

          const gamesWithAuctions = data.games.filter((game: Game) => {
            // Only include games that have auctionPeriods in their config
            if ('auctionPeriods' in game.config) {
              return game.config.auctionPeriods && game.config.auctionPeriods.length > 0;
            }
            return false;
          });
          setGames(gamesWithAuctions);
        }
      } catch (error) {
        console.error('Error loading games:', error);
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
  }, [isAdmin]);

  if (loading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const selectedGame = games.find(g => g.id === selectedGameId);

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
          <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Back to Home
          </Link>
          <ArrowRight className="mx-2" size={16} />
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Admin
          </Link>
          <ArrowRight className="mx-2" size={16} />
          <span className="text-sm text-gray-900">Bid Backup Tool</span>
        </div>

        <h1 className="text-3xl font-bold mb-6">Bid Backup Tool</h1>

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
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}{
                  'auctionPeriods' in game.config &&
                  ` (${game.config.auctionPeriods?.length || 0} biedronde(s))`
                }
              </option>
            ))}
          </select>
        </div>

        {selectedGame && user && 'auctionPeriods' in selectedGame.config && (
          <BidBackupTool
            gameId={selectedGame.id || ''}
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
    </div>
  );
}
