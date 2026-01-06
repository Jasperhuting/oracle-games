'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { FinalizePlayerTeam, FinalizeGame as Game, DivisionData, GameGroupData } from '@/lib/types/pages';
import { useTranslation } from 'react-i18next';

export default function FinalizeOverviewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gameGroups, setGameGroups] = useState<GameGroupData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const { t } = useTranslation();

  useEffect(() => {
    if (user === null) {
      router.push('/login');
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Laad alle auctioneer games die actief of bidding zijn
      const gamesRef = collection(db, 'games');
      const gamesQuery = query(
        gamesRef,
        where('gameType', '==', 'auctioneer'),
        where('status', 'in', ['bidding', 'active', 'finished'])
      );
      const gamesSnapshot = await getDocs(gamesQuery);

      const games: Game[] = gamesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Game));

      // Groepeer games per base name (zonder divisie)
      const gameGroupsMap = new Map<string, DivisionData[]>();

      for (const game of games) {
        // Bepaal de base name (zonder divisie nummer)
        let baseName = game.name;
        if (game.division && game.divisionLevel) {
          // Verwijder divisie informatie uit de naam
          baseName = game.name.replace(new RegExp(`\\s*-?\\s*Divisie\\s*${game.divisionLevel}`, 'i'), '').trim();
        }

        // Laad alle playerTeams voor dit spel
        const playerTeamsRef = collection(db, 'playerTeams');
        const playerTeamsQuery = query(
          playerTeamsRef,
          where('gameId', '==', game.id),
          orderBy('pricePaid', 'desc')
        );
        const playerTeamsSnapshot = await getDocs(playerTeamsQuery);

        const purchases: FinalizePlayerTeam[] = playerTeamsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FinalizePlayerTeam));

        const divisionData: DivisionData = {
          game,
          purchases
        };

        if (!gameGroupsMap.has(baseName)) {
          gameGroupsMap.set(baseName, []);
        }
        gameGroupsMap.get(baseName)!.push(divisionData);
      }

      // Converteer naar array en sorteer
      const groupedData: GameGroupData[] = Array.from(gameGroupsMap.entries()).map(([baseName, divisions]) => {
        // Sorteer divisies op niveau
        divisions.sort((a, b) => {
          const levelA = a.game.divisionLevel || 0;
          const levelB = b.game.divisionLevel || 0;
          return levelA - levelB;
        });

        return {
          baseName,
          divisions
        };
      });

      // Sorteer game groups op naam
      groupedData.sort((a, b) => a.baseName.localeCompare(b.baseName));

      setGameGroups(groupedData);
    } catch (error) {
      console.error('Error loading finalize overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('nl-NL')}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('nl-NL');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Finalize Overzicht</h1>
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Finalize Overzicht</h1>
          <p className="text-gray-400">
            Overzicht van alle gekochte renners per spel en divisie
          </p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Ververs data
          </button>
        </div>

        {gameGroups.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6">
            <p className="text-gray-400">Geen games gevonden</p>
          </div>
        ) : (
          <div className="space-y-8">
            {gameGroups.map((gameGroup) => (
              <div key={gameGroup.baseName} className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">{gameGroup.baseName}</h2>

                {gameGroup.divisions.map((divisionData) => (
                  <div key={divisionData.game.id} className="mb-8 last:mb-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold">
                        {divisionData.game.division ? (
                          <>Divisie {divisionData.game.divisionLevel}</>
                        ) : (
                          <>Enkele divisie</>
                        )}
                      </h3>
                      <div className="text-sm text-gray-400">
                        Status: <span className="capitalize">{divisionData.game.status}</span>
                        {' • '}
                        {divisionData.purchases.length} renners
                      </div>
                    </div>

                    {divisionData.purchases.length === 0 ? (
                      <p className="text-gray-500 italic">Nog geen renners gekocht</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-2 px-3">Renner</th>
                              <th className="text-left py-2 px-3">Team</th>
                              <th className="text-left py-2 px-3">Gekocht door</th>
                              <th className="text-right py-2 px-3">{t('global.price')}</th>
                              <th className="text-left py-2 px-3">Type</th>
                              <th className="text-left py-2 px-3">Datum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {divisionData.purchases.map((purchase) => (
                              <tr
                                key={purchase.id}
                                className="border-b border-gray-700 hover:bg-gray-750"
                              >
                                <td className="py-2 px-3 font-medium">{purchase.riderName}</td>
                                <td className="py-2 px-3 text-gray-400">{purchase.riderTeam || '-'}</td>
                                <td className="py-2 px-3">{purchase.playername}</td>
                                <td className="py-2 px-3 text-right font-semibold">
                                  {formatCurrency(purchase.pricePaid)}
                                </td>
                                <td className="py-2 px-3 text-sm text-gray-400 capitalize">
                                  {purchase.acquisitionType}
                                </td>
                                <td className="py-2 px-3 text-sm text-gray-400">
                                  {formatDate(purchase.acquiredAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-600 font-bold">
                              <td colSpan={3} className="py-3 px-3">Totaal</td>
                              <td className="py-3 px-3 text-right">
                                {formatCurrency(
                                  divisionData.purchases.reduce((sum, p) => sum + p.pricePaid, 0)
                                )}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
