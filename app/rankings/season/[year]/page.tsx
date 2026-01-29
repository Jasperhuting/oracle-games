'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@/components/AuthGuard';
import { usePlayerTeams } from '@/contexts/PlayerTeamsContext';
import RacePointsBreakdown from '@/components/RacePointsBreakdown';
import React from 'react';
import { Star } from 'tabler-icons-react';
import { Tooltip } from 'react-tooltip';
import { ScoreUpdateBanner } from '@/components/ScoreUpdateBanner';

interface StageDetails {
  stage: string;
  finishPosition: number | null;
  stageResult: number;
  gcPoints: number;
  pointsClass: number;
  mountainsClass: number;
  youthClass: number;
  total: number;
}

interface RaceSummary {
  raceSlug: string;
  raceName: string;
  totalPoints: number;
  stagesCount: number;
  bestFinishPosition: number | null;
  stages: StageDetails[];
}

interface SeasonPointsRider {
  id: string;
  rank: number;
  riderNameId: string;
  riderName: string;
  totalPoints: number;
  racesCount: number;
  races: RaceSummary[];
  updatedAt: string | null;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  nextOffset: number | null;
}

export default function SeasonLeaderboardPage() {

  const params = useParams();
  const year = useMemo(() => {
    const raw = (params as any)?.year;
    const parsed = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : 2026;
  }, [params]);

  const [expandedRiders, setExpandedRiders] = useState<Set<string>>(new Set());
  const [selectedTooltipGame, setSelectedTooltipGame] = useState<string>('');

  const { user } = useAuth();
  const { riders: allPlayerTeams, uniqueRiders: rankingsRiders, loading: rankingsLoading, total: totalRiders } = usePlayerTeams(user?.uid);

  const [gamesById, setGamesById] = useState<Record<string, { name?: string; division?: string }>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let isCancelled = false;

    async function loadGames() {
      try {
        const response = await fetch('/api/games/list?limit=200');
        if (!response.ok) return;
        const data = await response.json();

        if (isCancelled) return;
        if (!data || !Array.isArray(data.games)) return;

        const nextMap: Record<string, { name?: string; division?: string }> = {};
        data.games.forEach((g: any) => {
          if (!g?.id) return;
          nextMap[g.id] = { name: g.name, division: g.division };
        });
        setGamesById(nextMap);
      } catch {
        // ignore
      }
    }

    async function loadUserNames() {
      if (allPlayerTeams.length === 0) return;
      
      try {
        // Get unique user IDs
        const uniqueUserIds = [...new Set(allPlayerTeams.map(pt => pt.userId))];
        
        // Fetch user names for all unique users
        const userNamePromises = uniqueUserIds.map(async (userId) => {
          try {
            const response = await fetch(`/api/getUser?userId=${userId}`);
            if (response.status === 404) {
              // User not found (likely deleted), use userId as fallback
              return { userId, userName: userId };
            }
            if (!response.ok) return null;
            const data = await response.json();
            return { userId, userName: data.playername || data.displayName || userId };
          } catch {
            return { userId, userName: userId };
          }
        });

        const results = await Promise.all(userNamePromises);
        if (!isCancelled) {
          const userNameMap: Record<string, string> = {};
          results.forEach(result => {
            if (result) {
              userNameMap[result.userId] = result.userName;
            }
          });
          setUserNames(userNameMap);
        }
      } catch {
        // ignore
      }
    }

    loadGames();
    loadUserNames();

    return () => {
      isCancelled = true;
    };
  }, [allPlayerTeams]);

  const allPlayerTeamsByRiderNameId = useMemo(() => {
    const map = new Map<string, Array<{userId: string, gameId: string, userName?: string}>>();
    
    allPlayerTeams.forEach((pt) => {
      if (!pt.riderNameId) return;

      const existing = map.get(pt.riderNameId) ?? [];
      existing.push({
        userId: pt.userId,
        gameId: pt.gameId,
        userName: userNames[pt.userId] || pt.userId // Use fetched user name, fallback to userId
      });
      map.set(pt.riderNameId, existing);
    });

    return map;
  }, [allPlayerTeams, userNames]);

  const myGameIdsByRiderNameId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!user?.uid) return map;

    allPlayerTeams.forEach((pt) => {
      if (pt.userId !== user.uid) return;
      if (!pt.riderNameId) return;

      const existing = map.get(pt.riderNameId) ?? new Set<string>();
      existing.add(pt.gameId);
      map.set(pt.riderNameId, existing);
    });

    return map;
  }, [allPlayerTeams, user?.uid]);

  const toggleRider = (riderId: string) => {
    const newExpanded = new Set(expandedRiders);
    if (newExpanded.has(riderId)) {
      newExpanded.delete(riderId);
    } else {
      newExpanded.add(riderId);
    }
    setExpandedRiders(newExpanded);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <ScoreUpdateBanner year={year} />
          <Tooltip
            id="owned-games-tooltip"
            delayShow={0}
            className="!opacity-100"
            render={({ content }) => (
              <div className="text-sm whitespace-pre-line">
                {String(content || '')}
              </div>
            )}
          />
          <Tooltip
            id="owners-tooltip"
            delayShow={0}
            className="!opacity-100 !z-50 !max-w-md !bg-white !text-gray-900 !border !border-gray-200 !shadow-lg"
            clickable={true}
            delayHide={1000}
            render={({ content }) => {
              const owners = content?.split('|||') || [];
              
              // Group owners by game
              const ownersByGame = new Map<string, Array<{userName: string, isCurrentUser: boolean}>>();
              
              owners.forEach((ownerData) => {
                const [userName, gameId] = ownerData.split('::');
                const game = gamesById[gameId];
                const gameName = game 
                  ? (game.division ? `${game.name} - ${game.division}` : game.name || gameId)
                  : gameId;
                const isCurrentUser = userName === user?.uid;
                
                if (!ownersByGame.has(gameName)) {
                  ownersByGame.set(gameName, []);
                }
                ownersByGame.get(gameName)!.push({ userName, isCurrentUser });
              });
              
              const gameNames = Array.from(ownersByGame.keys());
              const activeGame = selectedTooltipGame && ownersByGame.has(selectedTooltipGame) 
                ? selectedTooltipGame 
                : gameNames[0] || '';
              
              const activePlayers = ownersByGame.get(activeGame) || [];
              
              return (
                <div className="min-w-72 max-w-lg">
                  {/* Tabs */}
                  <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap">
                    {gameNames.map((gameName) => (
                      <button
                        key={gameName}
                        onClick={() => setSelectedTooltipGame(gameName)}
                        className={`flex-shrink-0 px-2 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                          activeGame === gameName
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {gameName}
                      </button>
                    ))}
                  </div>
                  
                  {/* Content */}
                  <div className="p-3 max-h-60 overflow-y-auto">
                    {activePlayers.length > 0 ? (
                      <div className="space-y-1">
                        {activePlayers.map((player, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              player.isCurrentUser 
                                ? 'bg-yellow-50 border-yellow-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center">
                              {player.isCurrentUser && (
                                <span className="text-yellow-500 mr-2 text-lg">★</span>
                              )}
                              <span className={`text-sm font-medium ${
                                player.isCurrentUser ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {player.userName}
                              </span>
                            </div>
                            {player.isCurrentUser && (
                              <span className="text-xs text-yellow-600 font-medium bg-yellow-100 px-2 py-1 rounded-full">
                                Jij
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm text-center py-4">
                        Geen spelers in dit spel
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Seizoen Punten {year}
                </h1>
                <p className="text-gray-600">
                  Overzicht van alle renners en hun gescoorde punten dit seizoen
                </p>
              </div>
              <Link
                href="/games"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Terug naar Games
              </Link>
            </div>

            {/* Stats Summary */}
            <div className="flex w-full gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200 flex-1">
                <div className="text-sm text-gray-600">Totaal Renners</div>
                <div className="text-2xl font-bold text-gray-900">{totalRiders}</div>
              </div>
            </div>
          </div>

          {/* Loading */}
          {rankingsLoading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="text-gray-600">Laden...</div>
            </div>
          ) : rankingsRiders.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Geen seizoenspunten gevonden voor {year}</p>
              <p className="text-sm text-gray-500 mt-2">
                Punten worden toegevoegd wanneer etappe-uitslagen worden verwerkt.
              </p>
            </div>
          ) : (
            <>

              {/* Leaderboard Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Renner
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Spelers
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Punten
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rankingsRiders.map((rider, index) => {
                      const isExpanded = expandedRiders.has(rider.id || 'no-id');
                      const myGameIds = Array.from(myGameIdsByRiderNameId.get(rider.riderNameId) ?? []);
                      const isMine = myGameIds.length > 0;
                      const allOwners = allPlayerTeamsByRiderNameId.get(rider.riderNameId) || [];
                      const totalPlayers = allOwners.length;

                      // Get unique games where this rider is owned
                      const uniqueGames = new Set(allOwners.map(owner => owner.gameId));
                      
                      // Create tooltip content showing all players and their games
                      // Format: "userName::gameId|||userName::gameId" - matching auction teams format
                      const ownersTooltip = totalPlayers > 0 
                        ? allOwners
                            .map(owner => `${owner.userName}::${owner.gameId}`)
                            .join('|||')
                        : '';

                      const ownedInGamesLabel = isMine
                        ? myGameIds
                            .map((gameId) => {
                              const game = gamesById[gameId];
                              if (!game) return gameId;
                              if (game.division) return `${game.name} - ${game.division}`;
                              return game.name || gameId;
                            })
                            .join('\n')
                        : undefined;

                      const hasPointsBreakdown = rider.pointsBreakdown && rider.pointsBreakdown.length > 0;
                      const hasRacePoints = rider.racePoints && Object.keys(rider.racePoints).length > 0;
                      const hasPointsData = hasPointsBreakdown || hasRacePoints;

                      return (
                        <React.Fragment key={`${rider.riderNameId}_${rider.id || 'no-id'}`}>
                          <tr                            
                            className={`p-6 ${hasPointsData ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                            onClick={() => hasPointsData && toggleRider(rider.id || 'no-id')}
                          >
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center justify-center w-8 h-6 rounded-full text-sm font-bold ${(index + 1) === 1 ? 'bg-yellow-100 text-yellow-800' :
                                  (index + 1) === 2 ? 'bg-gray-200 text-gray-800' :
                                    (index + 1) === 3 ? 'bg-orange-100 text-orange-800' :
                                      'bg-gray-100 text-gray-600'
                                }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-4 gap-2 flex flex-row items-center content-center">
                              {isMine && (
                                <span
                                  data-tooltip-id="owned-games-tooltip"
                                  data-tooltip-content={ownedInGamesLabel}
                                >
                                  <Star className={'text-yellow-500'} />
                                </span>
                              )}
                              <div
                                className="font-medium text-gray-900"
                                data-tooltip-id={isMine ? 'owned-games-tooltip' : undefined}
                                data-tooltip-content={isMine ? ownedInGamesLabel : undefined}
                              >
                                {rider.riderName}
                              </div>
                              {hasPointsData && (
                                <div className="text-gray-400">
                                  <svg
                                    className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {totalPlayers > 0 ? (
                                  <span
                                    data-tooltip-id="owners-tooltip"
                                    data-tooltip-content={ownersTooltip}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium cursor-help"
                                  >
                                    <span>{totalPlayers}</span>
                                    <span className="text-xs text-blue-600">speler{totalPlayers !== 1 ? 's' : ''}</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="font-medium text-gray-900">{rider.pointsScored}</div>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={100} >
                              {isExpanded && hasPointsData && (
                                <div className="border-t border-gray-200 bg-gray-50 p-4">
                                  <RacePointsBreakdown
                                    pointsBreakdown={rider.pointsBreakdown}
                                    racePoints={rider.racePoints}
                                    riderName={rider.riderName}
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
