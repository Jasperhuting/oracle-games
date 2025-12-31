'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameType, ClientGameRule } from '@/lib/types/games';
import { Button } from '@/components/Button';

export default function GameRulesPage({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const [gameId, setGameId] = useState<string>('');
  const [rules, setRules] = useState<string>('');
  const [gameName, setGameName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => {
      setGameId(p.gameId);
    });
  }, [params]);

  useEffect(() => {
    const fetchGameAndRules = async () => {
      if (!gameId) return;

      setLoading(true);
      try {
        // Fetch game details to get the game type
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (!gameResponse.ok) {
          throw new Error('Failed to load game details');
        }
        const gameData = await gameResponse.json();
        const gameType: GameType = gameData.game.gameType;
        setGameName(gameData.game.name);

        // Fetch all game rules
        const rulesResponse = await fetch('/api/gameRules');
        if (!rulesResponse.ok) {
          throw new Error('Failed to load game rules');
        }
        const rulesData: { rules: ClientGameRule[] } = await rulesResponse.json();

        // Find the rules for this game type
        const gameRule = rulesData.rules.find((r) => r.gameType === gameType);
        setRules(gameRule?.rules || '');
      } catch (err) {
        console.error('Error fetching game rules:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game rules');
      } finally {
        setLoading(false);
      }
    };

    fetchGameAndRules();
  }, [gameId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-center text-gray-600">Loading rules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button
            type="button"
            text="Back to Games"
            onClick={() => router.push('/games')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{gameName} - Rules</h1>
            </div>
            <Button
              type="button"
              text="Back"
              onClick={() => router.back()}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {rules ? (
            <div
              className="prose prose-sm sm:prose-base lg:prose-lg max-w-none
                prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1
                prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800
                prose-strong:font-bold prose-em:italic
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: rules }}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              No rules have been added for this game type yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
