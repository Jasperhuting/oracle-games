'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminOrImpersonatedGate } from '@/components/AdminOrImpersonatedGate';
import type { ForumCategory, ForumGame } from '@/lib/types/forum';

export default function ForumPage() {
  const [games, setGames] = useState<ForumGame[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const VISIBLE_CATEGORY_SLUGS = ['algemeen', 'vragen-hulp', 'test'];
  const CATEGORY_ICONS: Record<string, string> = {
    algemeen: '🗨️',
    'vragen-hulp': '❓',
    test: '🧪',
  };

  function getGameIcon(name: string): string {
    if (name.toLowerCase().includes('f1')) return '🏎️';
    return '🚴';
  }

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [gamesRes, categoriesRes] = await Promise.all([
      fetch('/api/forum/games'),
      fetch('/api/forum/categories'),
    ]);

    if (!gamesRes.ok) {
      setError('Kon spellen niet laden.');
      setLoading(false);
      return;
    }

    const gamesData = await gamesRes.json();
    setGames(gamesData.games || []);

    if (categoriesRes.ok) {
      const catData = await categoriesRes.json();
      setCategories((catData.categories || []).filter((c: ForumCategory) => VISIBLE_CATEGORY_SLUGS.includes(c.slug)));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AdminOrImpersonatedGate>
      <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-5xl">
          <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
            <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900 underline">
              ← Terug naar account
            </Link>
          </div>

          <div className="bg-gradient-to-br from-amber-50 via-white to-sky-50 border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">💬</div>
                  <h1 className="text-2xl font-bold text-gray-900">Forum</h1>
                </div>
                <p className="text-sm text-gray-600">
                  Bespreek alles rondom de spellen, stel vragen of klets gezellig mee.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Preview
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {loading && <div className="text-sm text-gray-500">Spellen laden...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}

            {!loading && !error && categories.length === 0 && games.length === 0 && (
              <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400">
                Geen forums gevonden.
              </div>
            )}

            {!loading && !error && (categories.length > 0 || games.length > 0) && (
              <div className="grid grid-cols-1 gap-4">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/forum/${cat.slug}`}
                    className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-base font-bold">
                        {CATEGORY_ICONS[cat.slug] || '💬'}
                      </div>
                      <div>
                        <h2 className="font-semibold text-gray-900">{cat.name}</h2>
                        <p className="text-xs text-gray-500">Open forum →</p>
                      </div>
                    </div>
                  </Link>
                ))}

                {games.map((game) => (
                  <Link
                    key={game.id}
                    href={`/forum/game/${game.id}`}
                    className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-primary hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base font-bold">
                          {getGameIcon(game.name)}
                        </div>
                        <h2 className="font-semibold text-gray-900">{game.name}</h2>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                        {game.topicCount} topics
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Laatste activiteit:{' '}
                      {game.lastActivityAt
                        ? new Date(game.lastActivityAt).toLocaleString('nl-NL')
                        : 'nog geen activiteit'}
                    </p>
                    <div className="mt-4 text-xs text-primary underline">Open spel-forum →</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminOrImpersonatedGate>
  );
}
