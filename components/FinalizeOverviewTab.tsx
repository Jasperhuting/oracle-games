'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatCurrencyWhole } from '@/lib/utils/formatCurrency';
import { GameConfig } from '@/lib/types';

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
  bidCount?: number;
}

interface Game {
  id: string;
  name: string;
  division?: string;
  divisionLevel?: number;
  gameType: string;
  status: string;
  year?: number;
  config: GameConfig;
}

interface RiderData {
  team?: string;
  price?: number;
}

interface TeamData {
  name?: string;
}

interface PeriodRiders {
  periodName: string;
  riders: PlayerTeam[];
  totalSpent: number;
}

interface UserPurchases {
  playername: string;
  userId: string;
  userEmail?: string;
  periods: PeriodRiders[];
  totalSpent: number;
  totalRiders: number;
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
  const [activeGameTab, setActiveGameTab] = useState<string>('');
  const [activeDivisionTabs, setActiveDivisionTabs] = useState<Map<string, string>>(new Map());

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

        // Laad ook alle bids voor dit spel om de bidAt datum en bid count te krijgen
        const bidsRef = collection(db, 'bids');
        const wonBidsQuery = query(
          bidsRef,
          where('gameId', '==', game.id),
          where('status', '==', 'won')
        );
        const wonBidsSnapshot = await getDocs(wonBidsQuery);

        // Maak een map van userId+riderNameId naar bidAt datum
        const bidDatesMap = new Map<string, any>();
        wonBidsSnapshot.docs.forEach(doc => {
          const bidData = doc.data();
          const key = `${bidData.userId}_${bidData.riderNameId}`;
          bidDatesMap.set(key, bidData.bidAt);
        });

        // Laad ALLE bids (inclusief lost) om bid count te tellen
        const allBidsQuery = query(
          bidsRef,
          where('gameId', '==', game.id)
        );
        const allBidsSnapshot = await getDocs(allBidsQuery);

        console.log(`[${game.name}] Total bids found:`, allBidsSnapshot.docs.length);

        // Tel aantal biedingen per renner
        const bidCountMap = new Map<string, number>();
        allBidsSnapshot.docs.forEach(doc => {
          const bidData = doc.data();
          const riderKey = bidData.riderNameId;
          bidCountMap.set(riderKey, (bidCountMap.get(riderKey) || 0) + 1);
        });

        console.log(`[${game.name}] Bid counts per rider:`, Array.from(bidCountMap.entries()).slice(0, 5));

        // Voeg bidAt en bidCount toe aan purchases
        purchases.forEach(purchase => {
          const key = `${purchase.userId}_${purchase.riderNameId}`;
          const bidAt = bidDatesMap.get(key);
          if (bidAt) {
            (purchase as any).bidAt = bidAt;
          }

          // Voeg bid count toe
          const bidCount = bidCountMap.get(purchase.riderNameId) || 0;
          purchase.bidCount = bidCount;

          // Debug log voor de eerste paar purchases
          if (purchases.indexOf(purchase) < 3) {
            console.log(`[${game.name}] Purchase ${purchase.riderName}:`, {
              riderNameId: purchase.riderNameId,
              bidCount: bidCount,
              foundInMap: bidCountMap.has(purchase.riderNameId)
            });
          }
        });

        console.log(`Game ${game.name}: ${purchases.length} purchases`);

        // Check for duplicate IDs
        const purchaseIds = purchases.map(p => p.id);
        const duplicateIds = purchaseIds.filter((id, index) => purchaseIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          console.warn(`Found duplicate purchase IDs in ${game.name}:`, duplicateIds);
        }

        // Check for duplicate rider + user combinations
        const riderUserCombos = purchases.map(p => `${p.userId}_${p.riderNameId}`);
        const duplicateRiderUsers = riderUserCombos.filter((combo, index) => riderUserCombos.indexOf(combo) !== index);
        if (duplicateRiderUsers.length > 0) {
          console.warn(`Found duplicate rider+user combinations in ${game.name}:`, duplicateRiderUsers);
          // Log details of duplicates
          duplicateRiderUsers.forEach(combo => {
            const [userId, riderNameId] = combo.split('_');
            const duplicatePurchases = purchases.filter(p => p.userId === userId && p.riderNameId === riderNameId);
            console.warn(`  Details for ${combo}:`, duplicatePurchases.map(p => ({
              id: p.id,
              riderName: p.riderName,
              playername: p.playername,
              pricePaid: p.pricePaid,
              acquisitionType: p.acquisitionType
            })));
          });
        }

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
              const price = data?.points || 0;
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

        // Haal auction periods op uit game config
        const auctionPeriods = (game.config as any).auctionPeriods || [];

        console.log(`[${game.name}] Total auction periods:`, auctionPeriods.length);
        console.log(`[${game.name}] Total purchases:`, purchases.length);
        if (purchases.length > 0) {
          console.log(`[${game.name}] Sample acquiredAt dates:`, purchases.slice(0, 3).map(p => ({
            rider: p.riderName,
            acquiredAt: p.acquiredAt?.toDate?.() || new Date(p.acquiredAt)
          })));
        }

        // Groepeer eerst alle purchases per user
        const userPurchasesMap = new Map<string, UserPurchases>();

        purchases.forEach(purchase => {
          const key = purchase.userId;

          if (!userPurchasesMap.has(key)) {
            const userData = usersMap.get(purchase.userId);
            const displayName = userData?.playername || userData?.displayName || userData?.email || purchase.userId;

            userPurchasesMap.set(key, {
              playername: displayName,
              userId: purchase.userId,
              userEmail: userData?.email,
              periods: [],
              totalSpent: 0,
              totalRiders: 0
            });
          }
        });

        // Als er auction periods zijn, groepeer renners per period binnen elke user
        if (auctionPeriods.length > 0) {
          // Voor elke user
          userPurchasesMap.forEach((userPurchase, userId) => {
            // Voor elke auction period
            auctionPeriods.forEach((period: any) => {
              const periodStartDate = period.startDate?.toDate?.() || new Date(period.startDate);
              const periodEndDate = period.endDate?.toDate?.() || new Date(period.endDate);

              // Filter purchases van deze user die in deze period vallen
              const periodPurchases = purchases.filter(purchase => {
                if (purchase.userId !== userId) return false;

                // Gebruik bidAt als beschikbaar, anders acquiredAt als fallback
                const bidAt = (purchase as any).bidAt;
                const dateToCheck = bidAt
                  ? (bidAt?.toDate?.() || new Date(bidAt))
                  : (purchase.acquiredAt?.toDate?.() || new Date(purchase.acquiredAt));

                // Check of de purchase binnen deze period valt
                return dateToCheck >= periodStartDate && dateToCheck <= periodEndDate;
              });

              if (periodPurchases.length > 0) {
                // Sorteer renners op prijs
                periodPurchases.sort((a, b) => b.pricePaid - a.pricePaid);

                const totalSpent = periodPurchases.reduce((sum, p) => sum + p.pricePaid, 0);

                userPurchase.periods.push({
                  periodName: period.name,
                  riders: periodPurchases,
                  totalSpent
                });

                userPurchase.totalSpent += totalSpent;
                userPurchase.totalRiders += periodPurchases.length;
              }
            });
          });
        } else {
          // Geen auction periods - alle renners in één groep
          userPurchasesMap.forEach((userPurchase, userId) => {
            const userPurchases = purchases.filter(p => p.userId === userId);

            if (userPurchases.length > 0) {
              userPurchases.sort((a, b) => b.pricePaid - a.pricePaid);
              const totalSpent = userPurchases.reduce((sum, p) => sum + p.pricePaid, 0);

              userPurchase.periods.push({
                periodName: 'Alle renners',
                riders: userPurchases,
                totalSpent
              });

              userPurchase.totalSpent = totalSpent;
              userPurchase.totalRiders = userPurchases.length;
            }
          });
        }

        // Verwijder users zonder renners en converteer naar array
        const userPurchases: UserPurchases[] = Array.from(userPurchasesMap.values())
          .filter(up => up.totalRiders > 0)
          .sort((a, b) => b.totalSpent - a.totalSpent);

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

      // Stel de eerste game in als active tab
      if (groupedData.length > 0 && !activeGameTab) {
        setActiveGameTab(groupedData[0].baseName);
        // Stel de eerste divisie in als active voor elke game
        const initialDivisionTabs = new Map<string, string>();
        groupedData.forEach(gameGroup => {
          if (gameGroup.divisions.length > 0) {
            initialDivisionTabs.set(gameGroup.baseName, gameGroup.divisions[0].game.id);
          }
        });
        setActiveDivisionTabs(initialDivisionTabs);
      }

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
        <div>
          {/* Game Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
              {gameGroups.map((gameGroup) => (
                <button
                  key={String(gameGroup.baseName)}
                  onClick={() => setActiveGameTab(gameGroup.baseName)}
                  className={`
                    whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors
                    ${activeGameTab === gameGroup.baseName
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {String(gameGroup.baseName)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="space-y-8">
            {gameGroups.map((gameGroup) => {
              if (activeGameTab !== gameGroup.baseName) return null;

              const activeDivisionId = activeDivisionTabs.get(gameGroup.baseName) || gameGroup.divisions[0]?.game.id;

              console.log('gameGroup', gameGroup);
              return (
              <div key={String(gameGroup.baseName)}>
                {/* Divisie Tabs - alleen tonen als er meerdere divisies zijn */}
                {gameGroup.divisions.length > 1 && (
                  <div className="border-b border-gray-300 mb-6">
                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Division Tabs">
                      {gameGroup.divisions.map((divisionData) => (
                        <button
                          key={String(divisionData.game.id)}
                          onClick={() => {
                            const newTabs = new Map(activeDivisionTabs);
                            newTabs.set(gameGroup.baseName, divisionData.game.id);
                            setActiveDivisionTabs(newTabs);
                          }}
                          className={`
                            whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm transition-colors
                            ${activeDivisionId === divisionData.game.id
                              ? 'border-purple-500 text-purple-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                          `}
                        >
                          {divisionData.game.division ? (
                            <>Divisie {Number(divisionData.game.divisionLevel || 0)}</>
                          ) : (
                            <>{String(gameGroup.baseName)}</>
                          )}
                        </button>
                      ))}
                    </nav>
                  </div>
                )}

                {gameGroup.divisions.map((divisionData) => {
                  // Toon alleen de actieve divisie
                  if (activeDivisionId !== divisionData.game.id) return null;

                  console.log('divisionData', divisionData);

                  // Bereken divisie-brede statistieken
                  const allDivisionRiders = divisionData.userPurchases.flatMap(up => up.periods.flatMap(p => p.riders));
                  const divisionRidersWithPrice = allDivisionRiders.filter(r => r.originalPrice && r.originalPrice > 0);

                  const divisionBestBuy = divisionRidersWithPrice.reduce((best, rider) => {
                    const diff = rider.pricePaid - (rider.originalPrice || 0);
                    const bestDiff = best.pricePaid - (best.originalPrice || 0);
                    return diff < bestDiff ? rider : best;
                  }, divisionRidersWithPrice[0]);

                  const divisionWorstBuy = divisionRidersWithPrice.reduce((worst, rider) => {
                    const diff = rider.pricePaid - (rider.originalPrice || 0);
                    const worstDiff = worst.pricePaid - (worst.originalPrice || 0);
                    return diff > worstDiff ? rider : worst;
                  }, divisionRidersWithPrice[0]);

                  const divisionMostPopular = allDivisionRiders.reduce((popular, rider) => {
                    const riderBids = rider.bidCount || 0;
                    const popularBids = popular.bidCount || 0;
                    return riderBids > popularBids ? rider : popular;
                  }, allDivisionRiders[0]);

                  const divisionMostExpensive = allDivisionRiders.reduce((expensive, rider) => {
                    return rider.pricePaid > expensive.pricePaid ? rider : expensive;
                  }, allDivisionRiders[0]);

                  const divisionCheapest = allDivisionRiders.reduce((cheap, rider) => {
                    return rider.pricePaid < cheap.pricePaid ? rider : cheap;
                  }, allDivisionRiders[0]);

                  // Player with most budget remaining
                  const playerWithMostBudget = divisionData.userPurchases.reduce((player, curr) => {
                    const playerBudgetLeft = (divisionData.game.config as any).budget - player.totalSpent;
                    const currBudgetLeft = (divisionData.game.config as any).budget - curr.totalSpent;
                    return currBudgetLeft > playerBudgetLeft ? curr : player;
                  }, divisionData.userPurchases[0]);

                  // Player with most riders
                  const playerWithMostRiders = divisionData.userPurchases.reduce((player, curr) => {
                    return curr.totalRiders > player.totalRiders ? curr : player;
                  }, divisionData.userPurchases[0]);

                  // Player with fewest riders
                  const playerWithFewestRiders = divisionData.userPurchases.reduce((player, curr) => {
                    return curr.totalRiders < player.totalRiders ? curr : player;
                  }, divisionData.userPurchases[0]);

                  return (
                  <div key={String(divisionData.game.id)} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <div className="mb-6 pb-4 border-b-2 border-gray-300">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold">
                          {divisionData.game.division ? (
                            <>Divisie {Number(divisionData.game.divisionLevel || 0)}</>
                          ) : (
                            <>{String(gameGroup.baseName)}</>
                          )}
                        </h3>
                        <div className="text-sm text-gray-500">
                          Status: <span className="capitalize">{String(divisionData.game.status || '')}</span>
                          {' • '}
                          {Number(divisionData.totalRiders || 0)} renners
                          {' • '}
                          Totaal: {formatCurrency(Number(divisionData.totalValue) || 0)}
                        </div>
                      </div>

                      {/* Divisie statistieken */}
                      {allDivisionRiders.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-lg">
                          <div className="text-xs font-semibold text-indigo-700 mb-2 uppercase tracking-wide">Divisie Statistieken</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {divisionBestBuy && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">🏆 Beste koop</span>
                                <span className="text-sm font-semibold text-green-700">{divisionBestBuy.riderName}</span>
                                <span className="text-xs text-gray-600">
                                  {formatCurrency(divisionBestBuy.pricePaid)}
                                  {divisionBestBuy.originalPrice && (
                                    <span className="text-green-600 ml-1">
                                      ({divisionBestBuy.pricePaid - divisionBestBuy.originalPrice >= 0 ? '+' : ''}{formatCurrency(divisionBestBuy.pricePaid - divisionBestBuy.originalPrice)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}

                            {divisionWorstBuy && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">💸 Slechtste koop</span>
                                <span className="text-sm font-semibold text-red-700">{divisionWorstBuy.riderName}</span>
                                <span className="text-xs text-gray-600">
                                  {formatCurrency(divisionWorstBuy.pricePaid)}
                                  {divisionWorstBuy.originalPrice && (
                                    <span className="text-red-600 ml-1">
                                      (+{formatCurrency(divisionWorstBuy.pricePaid - divisionWorstBuy.originalPrice)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}

                            {divisionMostPopular && (divisionMostPopular.bidCount || 0) > 1 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">🔥 Meest gewild</span>
                                <span className="text-sm font-semibold text-orange-700">{divisionMostPopular.riderName}</span>
                                <span className="text-xs text-gray-600">{divisionMostPopular.bidCount} biedingen</span>
                              </div>
                            )}

                            {divisionMostExpensive && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">💰 Duurste</span>
                                <span className="text-sm font-semibold text-purple-700">{divisionMostExpensive.riderName}</span>
                                <span className="text-xs text-gray-600">{formatCurrency(divisionMostExpensive.pricePaid)}</span>
                              </div>
                            )}

                            {divisionCheapest && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">💵 Goedkoopste</span>
                                <span className="text-sm font-semibold text-blue-700">{divisionCheapest.riderName}</span>
                                <span className="text-xs text-gray-600">{formatCurrency(divisionCheapest.pricePaid)}</span>
                              </div>
                            )}

                            {playerWithMostBudget && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">💰 Meeste budget over</span>
                                <span className="text-sm font-semibold text-emerald-700">{playerWithMostBudget.playername}</span>
                                <span className="text-xs text-gray-600">{formatCurrency((divisionData.game.config as any).budget - playerWithMostBudget.totalSpent)}</span>
                              </div>
                            )}

                            {playerWithMostRiders && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">👥 Meeste renners</span>
                                <span className="text-sm font-semibold text-cyan-700">{playerWithMostRiders.playername}</span>
                                <span className="text-xs text-gray-600">{playerWithMostRiders.totalRiders} renners</span>
                              </div>
                            )}

                            {playerWithFewestRiders && divisionData.userPurchases.length > 1 && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 mb-1">👤 Minste renners</span>
                                <span className="text-sm font-semibold text-amber-700">{playerWithFewestRiders.playername}</span>
                                <span className="text-xs text-gray-600">{playerWithFewestRiders.totalRiders} renners</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  {divisionData.userPurchases.length === 0 ? (
                    <p className="text-gray-500 italic">Nog geen renners gekocht</p>
                  ) : (
                    <div className="space-y-6">
                      {divisionData.userPurchases.map((userPurchase) => {
                        // Bereken statistieken
                        const allRiders = userPurchase.periods.flatMap(p => p.riders);
                        const ridersWithOriginalPrice = allRiders.filter(r => r.originalPrice && r.originalPrice > 0);

                        // Beste koop (dichtst bij kostprijs, liefst onder)
                        const bestBuy = ridersWithOriginalPrice.reduce((best, rider) => {
                          const diff = rider.pricePaid - (rider.originalPrice || 0);
                          const bestDiff = best.pricePaid - (best.originalPrice || 0);
                          return diff < bestDiff ? rider : best;
                        }, ridersWithOriginalPrice[0]);

                        // Slechtste koop (verst boven kostprijs)
                        const worstBuy = ridersWithOriginalPrice.reduce((worst, rider) => {
                          const diff = rider.pricePaid - (rider.originalPrice || 0);
                          const worstDiff = worst.pricePaid - (worst.originalPrice || 0);
                          return diff > worstDiff ? rider : worst;
                        }, ridersWithOriginalPrice[0]);

                        // Meest gewilde renner (hoogste aantal biedingen, alleen als > 1)
                        const mostPopular = allRiders.reduce((popular, rider) => {
                          const riderBids = rider.bidCount || 0;
                          const popularBids = popular.bidCount || 0;
                          return riderBids > popularBids ? rider : popular;
                        }, allRiders[0]);

                        // Duurste renner
                        const mostExpensive = allRiders.reduce((expensive, rider) => {
                          return rider.pricePaid > expensive.pricePaid ? rider : expensive;
                        }, allRiders[0]);

                        // Goedkoopste renner
                        const cheapest = allRiders.reduce((cheap, rider) => {
                          return rider.pricePaid < cheap.pricePaid ? rider : cheap;
                        }, allRiders[0]);

                        return (
                        <div key={String(userPurchase.userId)} className="rounded-lg overflow-hidden shadow-sm">
                          <div className="bg-gradient-to-r from-blue-100 to-blue-50 px-5 py-4 ">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">Speler</div>
                                <h5 className="font-bold text-xl text-blue-900">{String(userPurchase.playername || 'Onbekend')}</h5>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-blue-600 mb-1">{Number(userPurchase.totalRiders || 0)} renners</div>
                                <div className="font-bold text-lg flex flex-row gap-2">
                                  <span className="flex flex-col justify-start">
                                    <span className="text-xs text-gray-500 text-left">budget</span>
                                    <span className="text-green-700">{formatCurrencyWhole((divisionData.game.config as any).budget)}</span>
                                  </span>
                                  <span className="flex flex-col justify-start">
                                    <span className="text-xs text-gray-500 text-left">betaald</span>
                                    <span className="text-red-700">{formatCurrencyWhole(Number(userPurchase.totalSpent) || 0)}</span>
                                  </span>
                                  <span className="flex flex-col justify-start">
                                    <span className="text-xs text-gray-500 text-left">over</span>
                                    <span className="text-blue-700">{formatCurrencyWhole(Number((divisionData.game.config as any).budget) - Number(userPurchase.totalSpent) || 0)}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Statistieken */}
                          <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-3 border-t border-blue-200">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              {/* Beste koop */}
                              {bestBuy && (
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500 mb-1">🏆 Beste koop</span>
                                  <span className="text-sm font-semibold text-green-700">{bestBuy.riderName}</span>
                                  <span className="text-xs text-gray-600">
                                    {formatCurrency(bestBuy.pricePaid)}
                                    {bestBuy.originalPrice && (
                                      <span className="text-green-600 ml-1">
                                        ({bestBuy.pricePaid - bestBuy.originalPrice >= 0 ? '+' : ''}{formatCurrency(bestBuy.pricePaid - bestBuy.originalPrice)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Slechtste koop */}
                              {worstBuy && (
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500 mb-1">💸 Slechtste koop</span>
                                  <span className="text-sm font-semibold text-red-700">{worstBuy.riderName}</span>
                                  <span className="text-xs text-gray-600">
                                    {formatCurrency(worstBuy.pricePaid)}
                                    {worstBuy.originalPrice && (
                                      <span className="text-red-600 ml-1">
                                        (+{formatCurrency(worstBuy.pricePaid - worstBuy.originalPrice)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Meest gewilde */}
                              {mostPopular && (mostPopular.bidCount || 0) > 1 && (
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500 mb-1">🔥 Meest gewild</span>
                                  <span className="text-sm font-semibold text-orange-700">{mostPopular.riderName}</span>
                                  <span className="text-xs text-gray-600">{mostPopular.bidCount} biedingen</span>
                                </div>
                              )}

                              {/* Duurste renner */}
                              {mostExpensive && (
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500 mb-1">💰 Duurste</span>
                                  <span className="text-sm font-semibold text-purple-700">{mostExpensive.riderName}</span>
                                  <span className="text-xs text-gray-600">{formatCurrency(mostExpensive.pricePaid)}</span>
                                </div>
                              )}

                              {/* Goedkoopste renner */}
                              {cheapest && (
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-500 mb-1">💵 Goedkoopste</span>
                                  <span className="text-sm font-semibold text-blue-700">{cheapest.riderName}</span>
                                  <span className="text-xs text-gray-600">{formatCurrency(cheapest.pricePaid)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Per period */}
                          {userPurchase.periods.map((periodData) => (
                            <div key={String(periodData.periodName)} className="border-t-2 border-blue-200">
                              <div className="bg-gradient-to-r from-purple-50 to-white px-5 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-purple-900">{String(periodData.periodName)}</span>
                                  <span className="text-sm text-purple-700">
                                    {periodData.riders.length} renners • {formatCurrency(periodData.totalSpent)}
                                  </span>
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
                                      <th className="text-center py-2 px-4 text-sm font-semibold">Biedingen</th>
                                      <th className="text-left py-2 px-4 text-sm font-semibold">Datum</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {periodData.riders.map((purchase) => {
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
                                          <td className="py-2 px-4 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                              {purchase.bidCount || 0}
                                            </span>
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
                      );
                      })}
                    </div>
                  )}
                  </div>
                )})}
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  );
}
