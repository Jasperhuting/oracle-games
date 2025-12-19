'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface PlayerTeam {
  id: string;
  gameId: string;
  userId: string;
  playername: string;
  riderNameId: string;
  riderName: string;
  riderTeam?: string | { name?: string } | any;
  pricePaid: number;
  acquiredAt: any;
  acquisitionType: string;
  originalPrice?: number;
}

interface Game {
  id: string;
  name: string;
  division?: string;
  divisionLevel?: number;
  gameType: string;
  status: string;
  year?: number;
}

interface RiderData {
  team?: string;
  price?: number;
}

interface TeamData {
  name?: string;
}

interface UserPurchases {
  playername: string;
  userId: string;
  userEmail?: string;
  riders: PlayerTeam[];
  totalSpent: number;
}

interface UserData {
  displayName?: string;
  email?: string;
  playername?: string;
}

interface DivisionData {
  game: Game;
  userPurchases: UserPurchases[];
  totalRiders: number;
  totalValue: number;
}

interface GameGroupData {
  baseName: string;
  divisions: DivisionData[];
}

export function FinalizeOverviewTab() {
  const [loading, setLoading] = useState(true);
  const [gameGroups, setGameGroups] = useState<GameGroupData[]>([]);
  const [riderCache, setRiderCache] = useState<Map<string, RiderData>>(new Map());
  const [usersCache, setUsersCache] = useState<Map<string, UserData>>(new Map());
  const [teamsCache, setTeamsCache] = useState<Map<string, TeamData>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Laad alle users eerst
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersMap = new Map<string, UserData>();
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        usersMap.set(doc.id, {
          displayName: data.displayName,
          email: data.email,
          playername: data.playername
        });
      });
      setUsersCache(usersMap);
      console.log('Loaded users:', usersMap.size);

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

      console.log('Loaded games:', games.length);

      // Groepeer games per base name (zonder divisie)
      const gameGroupsMap = new Map<string, DivisionData[]>();

      for (const game of games) {
        // Bepaal de base name (zonder divisie nummer)
        let baseName = game.name;
        if (game.division && game.divisionLevel) {
          // Verwijder divisie informatie uit de naam
          baseName = game.name.replace(new RegExp(`\\s*-?\\s*Divisie\\s*${game.divisionLevel}`, 'i'), '').trim();
        }

        // Laad alle playerTeams voor dit spel - ZONDER orderBy om alle data te krijgen
        const playerTeamsRef = collection(db, 'playerTeams');
        const playerTeamsQuery = query(
          playerTeamsRef,
          where('gameId', '==', game.id)
        );
        const playerTeamsSnapshot = await getDocs(playerTeamsQuery);

        const purchases: PlayerTeam[] = playerTeamsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PlayerTeam));

        console.log(`Game ${game.name}: ${purchases.length} purchases`);

        // Verzamel alle unieke team IDs die opgehaald moeten worden
        const year = game.year || new Date().getFullYear();
        const ridersNeedingTeam = new Set<string>();
        const teamIdsToFetch = new Set<string>();

        // Verzamel team IDs uit DocumentReferences en alle renners die price data nodig hebben
        for (const purchase of purchases) {
          let teamObj: any = purchase.riderTeam;

          // Voeg alle renners toe aan ridersNeedingTeam om price data op te halen
          ridersNeedingTeam.add(purchase.riderNameId);

          // Als riderTeam een JSON string is, parse het eerst
          if (typeof purchase.riderTeam === 'string' && purchase.riderTeam.startsWith('{')) {
            try {
              teamObj = JSON.parse(purchase.riderTeam);
              console.log('Parsed team object for', purchase.riderName, ':', teamObj);
            } catch (e) {
              // Als parsing faalt, behandel het als een normale string
              teamObj = purchase.riderTeam;
            }
          }

          if (teamObj && typeof teamObj === 'object') {
            // Check for serialized Firestore DocumentReference
            if (teamObj.type === 'firestore/documentReference/1.0' && teamObj.referencePath) {
              const teamId = teamObj.referencePath.split('/').pop() || '';
              console.log('Found team ID:', teamId, 'for rider:', purchase.riderName);
              if (teamId && !teamsCache.has(teamId)) {
                teamIdsToFetch.add(teamId);
              }
            }
            // Check for regular DocumentReference
            else if (teamObj.referencePath || teamObj.path) {
              const path = teamObj.referencePath || teamObj.path || '';
              const teamId = path.split('/').pop() || '';
              if (teamId && !teamsCache.has(teamId)) {
                teamIdsToFetch.add(teamId);
              }
            }
            // Check for object with name property
            else if (teamObj.name) {
              purchase.riderTeam = teamObj.name;
            }
            else {
              purchase.riderTeam = '-';
            }
          }
          // Als riderTeam leeg is, een string zonder waarde, of '-', markeer voor team ophalen
          else if (!purchase.riderTeam || purchase.riderTeam === '' || purchase.riderTeam === '-' || (typeof purchase.riderTeam === 'string' && purchase.riderTeam.trim() === '')) {
            // Al toegevoegd aan ridersNeedingTeam hierboven
          }
        }

        // Haal team data op uit de teams collectie
        if (teamIdsToFetch.size > 0) {
          console.log('Fetching teams:', Array.from(teamIdsToFetch));
          const newTeamsData = new Map<string, TeamData>();

          for (const teamId of teamIdsToFetch) {
            try {
              const teamDocRef = doc(db, 'teams', teamId);
              const teamDocSnap = await getDoc(teamDocRef);

              if (teamDocSnap.exists()) {
                const teamData = teamDocSnap.data();
                console.log(`Team ${teamId} found:`, teamData);
                newTeamsData.set(teamId, { name: teamData?.name || teamId });
              } else {
                console.log(`Team ${teamId} not found, using fallback`);
                // Fallback: maak teamnaam van ID
                const teamName = teamId
                  .replace(/-\d{4}$/, '')
                  .split('-')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                newTeamsData.set(teamId, { name: teamName });
              }
            } catch (error) {
              console.error(`Error fetching team ${teamId}:`, error);
              // Fallback: maak teamnaam van ID
              const teamName = teamId
                .replace(/-\d{4}$/, '')
                .split('-')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              newTeamsData.set(teamId, { name: teamName });
            }
          }

          // Update teams cache
          setTeamsCache(prev => {
            const newCache = new Map(prev);
            newTeamsData.forEach((team, id) => {
              newCache.set(id, team);
            });
            return newCache;
          });

          // Update purchases met team data
          for (const purchase of purchases) {
            let teamObj: any = purchase.riderTeam;

            // Als riderTeam een JSON string is, parse het eerst
            if (typeof purchase.riderTeam === 'string' && purchase.riderTeam.startsWith('{')) {
              try {
                teamObj = JSON.parse(purchase.riderTeam);
              } catch (e) {
                teamObj = purchase.riderTeam;
              }
            }

            if (teamObj && typeof teamObj === 'object') {
              let teamId = '';

              if (teamObj.type === 'firestore/documentReference/1.0' && teamObj.referencePath) {
                teamId = teamObj.referencePath.split('/').pop() || '';
              } else if (teamObj.referencePath || teamObj.path) {
                const path = teamObj.referencePath || teamObj.path || '';
                teamId = path.split('/').pop() || '';
              }

              if (teamId) {
                const teamData = newTeamsData.get(teamId) || teamsCache.get(teamId);
                purchase.riderTeam = teamData?.name || '-';
              }
            }
          }
        }

        // Haal team data op voor alle unieke renners in één keer
        if (ridersNeedingTeam.size > 0) {
          const rankingsCollection = `rankings_${year}`;
          const ridersCollectionRef = collection(db, rankingsCollection);
          const ridersSnapshot = await getDocs(ridersCollectionRef);

          const ridersDataMap = new Map<string, { team: string; price: number }>();
          ridersSnapshot.docs.forEach(doc => {
            if (ridersNeedingTeam.has(doc.id)) {
              const data = doc.data();
              // Zorg dat team altijd een string is
              let teamName = '-';
              if (data?.team) {
                if (typeof data.team === 'string') {
                  teamName = data.team;
                } else if (typeof data.team === 'object' && data.team.name) {
                  teamName = data.team.name;
                } else if (typeof data.team === 'object') {
                  teamName = JSON.stringify(data.team);
                }
              }
              const price = data?.price || 0;
              ridersDataMap.set(doc.id, { team: teamName, price });
            }
          });

          // Update cache
          setRiderCache(prev => {
            const newCache = new Map(prev);
            ridersDataMap.forEach((riderData, riderId) => {
              newCache.set(`${riderId}_${year}`, riderData);
            });
            return newCache;
          });

          // Update purchases met team en price data
          purchases.forEach(purchase => {
            if (!purchase.riderTeam || purchase.riderTeam === '-') {
              const riderData = ridersDataMap.get(purchase.riderNameId);
              if (riderData) {
                purchase.riderTeam = riderData.team;
                purchase.originalPrice = riderData.price;
              }
            } else if (!purchase.originalPrice) {
              // Als team al is gezet maar originalPrice niet, haal price op
              const riderData = ridersDataMap.get(purchase.riderNameId);
              if (riderData) {
                purchase.originalPrice = riderData.price;
              }
            }
          });
        }

        // Groepeer purchases per user
        const userPurchasesMap = new Map<string, UserPurchases>();

        purchases.forEach(purchase => {
          const key = purchase.userId;

          if (!userPurchasesMap.has(key)) {
            // Haal user data op uit cache
            const userData = usersMap.get(purchase.userId);
            const displayName = userData?.playername || userData?.displayName || userData?.email || purchase.userId;

            userPurchasesMap.set(key, {
              playername: displayName,
              userId: purchase.userId,
              userEmail: userData?.email,
              riders: [],
              totalSpent: 0
            });
          }
          const userPurchase = userPurchasesMap.get(key)!;
          userPurchase.riders.push(purchase);
          userPurchase.totalSpent += purchase.pricePaid;
        });

        // Converteer naar array en sorteer riders binnen elke user op prijs
        const userPurchases: UserPurchases[] = Array.from(userPurchasesMap.values()).map(up => {
          up.riders.sort((a, b) => b.pricePaid - a.pricePaid);
          return up;
        });

        // Sorteer users op totaal uitgegeven bedrag (hoogste eerst)
        userPurchases.sort((a, b) => b.totalSpent - a.totalSpent);

        const totalRiders = purchases.length;
        const totalValue = purchases.reduce((sum, p) => sum + p.pricePaid, 0);

        const divisionData: DivisionData = {
          game,
          userPurchases,
          totalRiders,
          totalValue
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
      console.log('Final game groups:', groupedData);
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
    if (!timestamp) return '-';
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString('nl-NL');
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString('nl-NL');
      }
      if (timestamp instanceof Date) {
        return timestamp.toLocaleString('nl-NL');
      }
      return new Date(timestamp).toLocaleString('nl-NL');
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return '-';
    }
  };

  const formatTeamName = (riderTeam: any): string => {
    if (!riderTeam) return '-';

    let teamObj = riderTeam;

    // Als riderTeam een JSON string is, parse het eerst
    if (typeof riderTeam === 'string') {
      if (riderTeam.startsWith('{')) {
        try {
          teamObj = JSON.parse(riderTeam);
        } catch (e) {
          // Als parsing faalt, return de string zelf
          return riderTeam;
        }
      } else {
        // Als het een gewone string is (geen JSON), return het
        return riderTeam;
      }
    }

    // Als het een object is
    if (typeof teamObj === 'object') {
      // Check for serialized Firestore DocumentReference
      if (teamObj.type === 'firestore/documentReference/1.0' && teamObj.referencePath) {
        const teamId = teamObj.referencePath.split('/').pop() || '';
        const teamName = teamId
          .replace(/-\d{4}$/, '')
          .split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return teamName || '-';
      }

      // Check for regular DocumentReference
      if (teamObj.referencePath || teamObj.path) {
        const path = teamObj.referencePath || teamObj.path || '';
        const teamId = path.split('/').pop() || '';
        const teamName = teamId
          .replace(/-\d{4}$/, '')
          .split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return teamName || '-';
      }

      // Check for object with name property
      if (teamObj.name) {
        return teamObj.name;
      }
    }

    return '-';
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Laden...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Finalize Overzicht</h2>
        <p className="text-gray-600 mb-4">
          Overzicht van alle gekochte renners gegroepeerd per speler
        </p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Ververs data
        </button>
      </div>

      {gameGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-500">Geen games gevonden</p>
        </div>
      ) : (
        <div className="space-y-8">
          {gameGroups.map((gameGroup) => (
            <div key={String(gameGroup.baseName)} className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-bold mb-6">{String(gameGroup.baseName)}</h3>

              {gameGroup.divisions.map((divisionData) => {
                
                console.log(divisionData);

                return (
                <div key={String(divisionData.game.id)} className="mb-8 last:mb-0">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-300">
                    <h4 className="text-lg font-semibold">
                      {divisionData.game.division ? (
                        <>Divisie {Number(divisionData.game.divisionLevel || 0)}</>
                      ) : (
                        <>Enkele divisie</>
                      )}
                    </h4>
                    <div className="text-sm text-gray-500">
                      Status: <span className="capitalize">{String(divisionData.game.status || '')}</span>
                      {' • '}
                      {Number(divisionData.totalRiders || 0)} renners
                      {' • '}
                      Totaal: {formatCurrency(Number(divisionData.totalValue) || 0)}
                    </div>
                  </div>

                  {divisionData.userPurchases.length === 0 ? (
                    <p className="text-gray-500 italic">Nog geen renners gekocht</p>
                  ) : (
                    <div className="space-y-6">
                      {divisionData.userPurchases.map((userPurchase) => (
                        <div key={String(userPurchase.userId)} className="border-2 border-blue-300 rounded-lg overflow-hidden shadow-sm">
                          <div className="bg-gradient-to-r from-blue-100 to-blue-50 px-5 py-4 border-b-2 border-blue-300">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">Speler</div>
                                <h5 className="font-bold text-xl text-blue-900">{String(userPurchase.playername || 'Onbekend')}</h5>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-blue-600 mb-1">{Number(userPurchase.riders?.length || 0)} renners</div>
                                <div className="font-bold text-lg text-green-700">{formatCurrency(Number(userPurchase.totalSpent) || 0)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left py-2 px-4 text-sm font-semibold">Renner</th>
                                  <th className="text-left py-2 px-4 text-sm font-semibold">Team</th>
                                  <th className="text-right py-2 px-4 text-sm font-semibold">Origineel</th>
                                  <th className="text-right py-2 px-4 text-sm font-semibold">Betaald</th>
                                  <th className="text-right py-2 px-4 text-sm font-semibold">Verschil</th>
                                  <th className="text-left py-2 px-4 text-sm font-semibold">Type</th>
                                  <th className="text-left py-2 px-4 text-sm font-semibold">Datum</th>
                                </tr>
                              </thead>
                              <tbody>
                                {userPurchase.riders.map((purchase) => {
                                  const originalPrice = purchase.originalPrice || 0;
                                  const pricePaid = Number(purchase.pricePaid) || 0;
                                  const difference = pricePaid - originalPrice;
                                  const differencePercentage = originalPrice > 0 ? ((difference / originalPrice) * 100) : 0;

                                  return (
                                  <tr
                                    key={String(purchase.id)}
                                    className="border-b border-gray-100 hover:bg-blue-50"
                                  >
                                    <td className="py-2 px-4 font-medium">{String(purchase.riderName || '')}</td>
                                    <td className="py-2 px-4 text-gray-600 text-sm">
                                      {formatTeamName(purchase.riderTeam)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-gray-600 text-sm">
                                      {originalPrice > 0 ? formatCurrency(originalPrice) : '-'}
                                    </td>
                                    <td className="py-2 px-4 text-right font-semibold text-green-700">
                                      {formatCurrency(pricePaid)}
                                    </td>
                                    <td className="py-2 px-4 text-right text-sm">
                                      {originalPrice > 0 ? (
                                        <span className={difference >= 0 ? 'text-red-600' : 'text-green-600'}>
                                          {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                                          <span className="text-xs ml-1">({differencePercentage >= 0 ? '+' : ''}{differencePercentage.toFixed(0)}%)</span>
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-2 px-4 text-sm text-gray-600 capitalize">
                                      {String(purchase.acquisitionType || '')}
                                    </td>
                                    <td className="py-2 px-4 text-sm text-gray-500">
                                      {formatDate(purchase.acquiredAt)}
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )})}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
