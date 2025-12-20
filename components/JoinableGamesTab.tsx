'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { GameRulesModal } from "./GameRulesModal";
import { GameType } from "@/lib/types/games";
import process from "process";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "react-i18next";


interface Game {
  id: string;
  name: string;
  gameType: string;
  year: number;
  status: string;
  playerCount: number;
  maxPlayers?: number;
  division?: string;
  divisionCount?: number;
  divisionLevel?: number;
  description?: string;
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  createdAt: string;
  raceRef?: string;
}

interface GameGroup {
  baseName: string;
  games: Game[];
  isMultiDivision: boolean;
  totalPlayers: number;
  maxPlayers?: number;
}

interface Participant {
  id: string;
  gameId: string;
  userId: string;
  status: string;
  joinedAt: string;
  assignedDivision?: string;
  divisionAssigned?: boolean;
}

// TODO: Remove any

export const JoinableGamesTab = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [myGames, setMyGames] = useState<Set<string>>(new Set());
  const [myParticipants, setMyParticipants] = useState<Map<string, Participant>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [selectedGameForRules, setSelectedGameForRules] = useState<{ type: GameType; name: string } | null>(null);
  const [availableRules, setAvailableRules] = useState<Set<GameType>>(new Set());
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [pendingLeaveGameId, setPendingLeaveGameId] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);
  const [showTestGames, setShowTestGames] = useState(false);

  const { t } = useTranslation();

  const loadGames = (async () => {
    setLoading(true);
    setError(null);

    try {
      // Load available games
      let url = '/api/games/list?limit=100';
      if (filterYear) url += `&year=${filterYear}`;
      if (filterStatus) url += `&status=${filterStatus}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Could not load games');
      }

      const data = await response.json();
      setGames(data.games || []);

      // Load user's participations and admin status if logged in
      if (user) {
        // Check if user is admin
        const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setIsAdmin(userData.userType === 'admin');
        }

        const participantsResponse = await fetch(`/api/gameParticipants?userId=${user.uid}`);
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          const participants: Participant[] = participantsData.participants || [];

          // For pending multi-division participants, extract the actual gameId
          const gameIds = new Set(
            participants.map((p: Participant) => {
              // Remove "-pending" suffix if present
              return p.gameId.replace(/-pending$/, '');
            })
          );

          const participantMap = new Map(
            participants.map((p: Participant) => {
              const actualGameId = p.gameId.replace(/-pending$/, '');
              return [actualGameId, p];
            })
          );

          gameIds && setMyGames(gameIds);
          participantMap && setMyParticipants(participantMap);
        }
      }
    } catch (error: unknown) {
      console.error('Error loading games:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong loading games');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadGames();
  }, [user, filterYear, filterStatus]);

  // Fetch available game rules
  useEffect(() => {
    const fetchAvailableRules = async () => {
      try {
        const response = await fetch('/api/gameRules');
        if (response.ok) {
          const data = await response.json();
          const rulesArray = data.rules || [];
          const rulesSet = new Set<GameType>(
            rulesArray.filter((r: any) => r.rules).map((r: any) => r.gameType as GameType) // eslint-disable-line @typescript-eslint/no-explicit-any
          );
          setAvailableRules(rulesSet);
        }
      } catch (error) {
        console.error('Error fetching available rules:', error);
      }
    };
    fetchAvailableRules();
  }, []);

  const handleShowRules = (gameType: string, gameName: string) => {
    setSelectedGameForRules({ type: gameType as GameType, name: gameName });
    setRulesModalOpen(true);
  };

  const handleJoinGame = async (gameId: string) => {
    if (!user) {
      setInfoDialog({
        title: 'Login required',
        description: 'Please log in to join a game.',
      });
      return;
    }

    setJoining(gameId);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join game');
      }

      // Reload games to update the state
      await loadGames();
      setInfoDialog({
        title: 'Game joined',
        description: 'You have successfully joined the game.',
      });
    } catch (error: unknown) {
      console.error('Error joining game:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join game';
      setError(errorMessage);
      setInfoDialog({
        title: 'Join failed',
        description: errorMessage + '.',
      });
    } finally {
      setJoining(null);
    }
  };

  const confirmLeaveGame = (gameId: string) => {
    setPendingLeaveGameId(gameId);
    setLeaveConfirmOpen(true);
  };

  const handleLeaveGame = async () => {
    if (!user || !pendingLeaveGameId) return;

    setLeaving(pendingLeaveGameId);
    setError(null);

    try {
      const response = await fetch(`/api/games/${pendingLeaveGameId}/join?userId=${user.uid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to leave game');
      }

      // Reload games to update the state
      await loadGames();
      setInfoDialog({
        title: 'Game left',
        description: 'You have successfully left the game.',
      });
    } catch (error: unknown) {
      console.error('Error leaving game:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave game';
      setError(errorMessage);
      setInfoDialog({
        title: 'Leave failed',
        description: errorMessage + '.',
      });
    } finally {
      setLeaving(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'registration': return 'bg-blue-200 text-blue-800';
      case 'bidding': return 'bg-yellow-200 text-yellow-800';
      case 'active': return 'bg-green-200 text-green-800';
      case 'finished': return 'bg-primary text-primary';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusLabel = (status: string, gameType?: string) => {
    // WorldTour Manager uses "selecteren" instead of "bidding"
    if (status === 'bidding' && gameType === 'worldtour-manager') {
      return 'selecteren';
    }

    switch (status) {
      case 'draft': return 'draft';
      case 'registration': return 'registration';
      case 'bidding': return 'bidding';
      case 'active': return 'active';
      case 'finished': return 'finished';
      default: return status;
    }
  };

  const getGameTypeLabel = (gameType: string) => {
    switch (gameType) {
      case 'classic': return 'Classic';
      case 'auction': return 'Auction';
      case 'draft': return 'Draft';
      default: return gameType;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const isRegistrationOpen = (game: Game) => {
    const now = new Date();
    const openDate = game.registrationOpenDate ? new Date(game.registrationOpenDate) : null;
    const closeDate = game.registrationCloseDate ? new Date(game.registrationCloseDate) : null;

    if (openDate && openDate > now) return false;
    if (closeDate && closeDate < now) return false;
    return game.status === 'registration' || game.status === 'draft' || game.status === 'active';
  };

  const canJoin = (game: Game) => {
    if (myGames.has(game.id)) return false;
    if (!isRegistrationOpen(game)) return false;
    if (game.maxPlayers && game.playerCount >= game.maxPlayers) return false;
    return true;
  };

  const canLeave = (game: Game) => {
    if (!myGames.has(game.id)) return false;
    // Can only leave if game hasn't started
    return game.status === 'registration' || game.status === 'draft';
  };

  // Group games by base name (removing division suffix)
  const groupGames = (games: Game[]): GameGroup[] => {
    const groups = new Map<string, GameGroup>();

    games.forEach(game => {
      // Remove " - Division X" from the name to get the base name
      const baseName = game.name.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
      const isMultiDivision = (game.divisionCount || 1) > 1;

      if (!groups.has(baseName)) {
        groups.set(baseName, {
          baseName,
          games: [],
          isMultiDivision,
          totalPlayers: 0,
          maxPlayers: undefined,
        });
      }

      const group = groups.get(baseName)!;
      group.games.push(game);
      group.totalPlayers += game.playerCount;

      // For multi-division games, sum up maxPlayers across divisions
      if (isMultiDivision && game.maxPlayers) {
        group.maxPlayers = (group.maxPlayers || 0) + game.maxPlayers;
      } else if (!isMultiDivision) {
        group.maxPlayers = game.maxPlayers;
      }
    });

    // Sort games within each group by division level
    groups.forEach(group => {
      group.games.sort((a, b) => (a.divisionLevel || 999) - (b.divisionLevel || 999));
    });

    return Array.from(groups.values());
  };

  const gameGroups = groupGames(games);

  // Separate test games from regular games
  const isTestGame = (group: GameGroup) => {
    return group.baseName.toLowerCase().includes('test');
  };

  const regularGameGroups = gameGroups.filter(group => !isTestGame(group));
  const testGameGroups = gameGroups.filter(group => isTestGame(group));

  if (loading && games.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">{t('games.loadingGames')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-2xl font-bold mb-4">{t('games.joinGame')}</h2>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('global.allYears')}</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('games.status')}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('global.allStatuses')}</option>
              <option value="registration">{t('games.statuses.registration')}</option>
              <option value="bidding">{t('games.statuses.bidding')}</option>
              <option value="active">{t('games.statuses.active')}</option>
              <option value="finished">{t('games.statuses.finished')}</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Games List */}
      {games.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No games found with the selected filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Regular Games */}
          {regularGameGroups.map((group) => {
            // For multi-division games, use the first game as the representative
            const game = group.games[0];

            // Check if user has joined ANY division in this group
            const joinedGame = group.games.find(g => myGames.has(g.id));
            const isJoined = !!joinedGame;
            const participant = joinedGame ? myParticipants.get(joinedGame.id) : undefined;
            const isWaitingForDivision = isJoined && participant && !participant.divisionAssigned;

            // For multi-division: user can join if they haven't joined any division yet
            // For single-division: use existing canJoin logic
            const joinable = group.isMultiDivision
              ? !isJoined && isRegistrationOpen(game) && (!group.maxPlayers || group.totalPlayers < group.maxPlayers)
              : canJoin(game);

            const leaveable = joinedGame ? canLeave(joinedGame) : false;
            const isFull = group.maxPlayers && group.totalPlayers >= group.maxPlayers;

            return (
              <div
                key={group.isMultiDivision ? group.baseName : game.id}
                className={`bg-white border rounded-lg p-4 ${
                  isJoined ? 'border-primary bg-primary' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{group.baseName}</h3>
                      {isJoined && !isWaitingForDivision && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white">
                          Joined
                        </span>
                      )}
                      {isWaitingForDivision && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                          Waiting for Division Assignment
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(game.status)}`}>
                        {t(`games.statuses.${getStatusLabel(game.status, game.gameType)}`)}
                      </span>
                    </div>

                    {game.description && (
                      <p className="text-sm text-gray-600 mb-2">{game.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {availableRules.has(game.gameType as GameType) && (
                          <Button
                            variant="text"
                            size="text"
                            onClick={() => handleShowRules(game.gameType, group.baseName)}
                          >
                            {t('games.rules')}
                          </Button>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">{t('global.year')}:</span> {game.year}
                      </div>
                      <div>
                        <span className="font-medium">{t('global.players')}:</span> {group.totalPlayers}
                        {isFull && <span className="text-red-600 ml-1">(Full)</span>}
                      </div>
                      {group.isMultiDivision && (
                        <div>
                          <span className="font-medium">{t('global.divisions')}:</span> {group.games.length}
                          {participant?.assignedDivision && (
                            <span className="text-primary ml-1">
                              (You: {participant.assignedDivision})
                            </span>
                          )}
                        </div>
                      )}
                      {!group.isMultiDivision && game.division && (
                        <div>
                          <span className="font-medium">Division:</span> {game.division}
                        </div>
                      )}
                    </div>

                    {isWaitingForDivision && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        Your registration is pending. The admin will assign you to a division soon.
                      </div>
                    )}

                    {(game.registrationOpenDate || game.registrationCloseDate) && (
                      <div className="mt-2 text-xs text-gray-500">
                        {game.registrationOpenDate && (
                          <span>Opens: {formatDate(game.registrationOpenDate)}</span>
                        )}
                        {game.registrationOpenDate && game.registrationCloseDate && <span> • </span>}
                        {game.registrationCloseDate && (
                          <span>Closes: {formatDate(game.registrationCloseDate)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    {/* Admin View Button - show for admins who haven't joined, or for games in bidding/active status */}
                    {isAdmin && !isJoined && (
                      <>
                        {group.isMultiDivision ? (
                          // Show a button for each division
                          group.games.map((divisionGame) => (
                            <Button
                              key={divisionGame.id}
                              text={`${t('games.viewGameAdmin')} - ${divisionGame.division || `Division ${divisionGame.divisionLevel}`}`}
                              onClick={() => {
                                if (divisionGame.gameType === 'auction' || divisionGame.gameType === 'auctioneer' || divisionGame.gameType === 'worldtour-manager') {
                                  router.push(`/games/${divisionGame.id}/auction`);
                                } else {
                                  router.push(`/games/${divisionGame.id}/team`);
                                }
                              }}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                            />
                          ))
                        ) : (
                          // Single division - show one button
                          <Button
                            text={t('games.viewGameAdmin')}
                            onClick={() => {
                              if (game.gameType === 'auction' || game.gameType === 'auctioneer' || game.gameType === 'worldtour-manager') {
                                router.push(`/games/${game.id}/auction`);
                              } else {
                                router.push(`/games/${game.id}/team`);
                              }
                            }}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                          />
                        )}
                      </>
                    )}

                    {/* Admin View Button for joined games - show alongside regular buttons */}
                    {isAdmin && isJoined && !isWaitingForDivision && joinedGame && (
                      <Button
                        text={t('games.viewAllAdmin')}
                        onClick={() => {
                          // Navigate to first division if multi-division, otherwise stay on current game
                          const targetGame = group.isMultiDivision ? group.games[0] : joinedGame;
                          if (targetGame.gameType === 'auction' || targetGame.gameType === 'auctioneer' || targetGame.gameType === 'worldtour-manager') {
                            router.push(`/games/${targetGame.id}/auction`);
                          } else {
                            router.push(`/games/${targetGame.id}/team`);
                          }
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                      />
                    )}

                    {/* Regular user buttons */}
                    {joinable && (
                      <Button
                        text={joining === game.id ? t('games.joining') : t('games.joinGame')}
                        onClick={() => handleJoinGame(game.id)}
                        disabled={joining === game.id}
                        className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
                      />
                    )}
                    {isJoined && !isWaitingForDivision && joinedGame && (game.gameType === 'auction' || game.gameType === 'auctioneer' || game.gameType === 'worldtour-manager') && (
                      <Button
                        text={t('games.auction')}
                        onClick={() => router.push(`/games/${joinedGame.id}/auction`)}
                        className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
                      />
                    )}
                    {isJoined && !isWaitingForDivision && joinedGame && game.gameType !== 'auction' && game.gameType !== 'auctioneer' && game.gameType !== 'worldtour-manager' && (
                      <Button
                        text={t('games.selectTeam')}
                        onClick={() => router.push(`/games/${joinedGame.id}/team`)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-600/80 whitespace-nowrap"
                      />
                    )}
                    {leaveable && joinedGame && (
                      <Button
                        text={leaving === joinedGame.id ? t('games.leaving') : t('games.leaveGame')}
                        onClick={() => confirmLeaveGame(joinedGame.id)}
                        disabled={leaving === joinedGame.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 whitespace-nowrap"
                      />
                    )}
                    {!joinable && !leaveable && !isJoined && isFull && !isAdmin && (
                      <span className="text-sm text-red-600">{t('games.gameIsFull')}</span>
                    )}
                    {!joinable && !isJoined && !isFull && !isRegistrationOpen(game) && !isAdmin && (
                      <span className="text-sm text-gray-500">{t('games.registrationClosed')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Test Games Section */}
          {testGameGroups.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <button
                onClick={() => setShowTestGames(!showTestGames)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">{t('games.testGames')}</span>
                  <span className="text-sm text-gray-500">({testGameGroups.length})</span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${showTestGames ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTestGames && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                  {testGameGroups.map((group) => {
                    // For multi-division games, use the first game as the representative
                    const game = group.games[0];

                    // Check if user has joined ANY division in this group
                    const joinedGame = group.games.find(g => myGames.has(g.id));
                    const isJoined = !!joinedGame;
                    const participant = joinedGame ? myParticipants.get(joinedGame.id) : undefined;
                    const isWaitingForDivision = isJoined && participant && !participant.divisionAssigned;

                    // For multi-division: user can join if they haven't joined any division yet
                    // For single-division: use existing canJoin logic
                    const joinable = group.isMultiDivision
                      ? !isJoined && isRegistrationOpen(game) && (!group.maxPlayers || group.totalPlayers < group.maxPlayers)
                      : canJoin(game);

                    const leaveable = joinedGame ? canLeave(joinedGame) : false;
                    const isFull = group.maxPlayers && group.totalPlayers >= group.maxPlayers;

                    return (
                      <div
                        key={group.isMultiDivision ? group.baseName : game.id}
                        className={`bg-white border rounded-lg p-4 ${
                          isJoined ? 'border-primary bg-primary' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">{group.baseName}</h3>
                              {isJoined && !isWaitingForDivision && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white">
                                  {t('games.joined')}
                                </span>
                              )}
                              {isWaitingForDivision && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                                  Waiting for Division Assignment
                                </span>
                              )}
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(game.status)}`}>
                                {t(`games.statuses.${getStatusLabel(game.status, game.gameType)}`)}
                              </span>
                            </div>

                            {game.description && (
                              <p className="text-sm text-gray-600 mb-2">{game.description}</p>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                {availableRules.has(game.gameType as GameType) && (
                                  <Button
                                    variant="text"
                                    size="text"
                                    onClick={() => handleShowRules(game.gameType, group.baseName)}
                                  >
                                    {t('games.rules')}
                                  </Button>
                                )}
                              </div>
                              <div>
                                <span className="font-medium">{t('global.year')}:</span> {game.year}
                              </div>
                              <div>
                                <span className="font-medium">{t('global.players')}:</span> {group.totalPlayers}
                                {isFull && <span className="text-red-600 ml-1">(Full)</span>}
                              </div>
                              {group.isMultiDivision && (
                                <div>
                                  <span className="font-medium">{t('global.divisions')}:</span> {group.games.length}
                                  {participant?.assignedDivision && (
                                    <span className="text-primary ml-1">
                                      ({t('global.you')}: {participant.assignedDivision})
                                    </span>
                                  )}
                                </div>
                              )}
                              {!group.isMultiDivision && game.division && (
                                <div>
                                  <span className="font-medium">{t('global.division')}:</span> {game.division}
                                </div>
                              )}
                            </div>

                            {isWaitingForDivision && (
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                Your registration is pending. The admin will assign you to a division soon.
                              </div>
                            )}

                            {(game.registrationOpenDate || game.registrationCloseDate) && (
                              <div className="mt-2 text-xs text-gray-500">
                                {game.registrationOpenDate && (
                                  <span>Opens: {formatDate(game.registrationOpenDate)}</span>
                                )}
                                {game.registrationOpenDate && game.registrationCloseDate && <span> • </span>}
                                {game.registrationCloseDate && (
                                  <span>Closes: {formatDate(game.registrationCloseDate)}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="ml-4 flex flex-col gap-2">
                            {/* Admin View Button - show for admins who haven't joined, or for games in bidding/active status */}
                            {isAdmin && !isJoined && (
                              <Button
                                text={t('games.viewGameAdmin')}
                                onClick={() => {
                                  // Navigate to first division if multi-division, otherwise to the game
                                  const targetGame = group.isMultiDivision ? group.games[0] : game;
                                  if (targetGame.gameType === 'auction' || targetGame.gameType === 'auctioneer' || targetGame.gameType === 'worldtour-manager') {
                                    router.push(`/games/${targetGame.id}/auction`);
                                  } else {
                                    router.push(`/games/${targetGame.id}/team`);
                                  }
                                }}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                              />
                            )}

                            {/* Admin View Button for joined games - show alongside regular buttons */}
                            {isAdmin && isJoined && !isWaitingForDivision && joinedGame && (
                              <Button
                                text="View All (Admin)"
                                onClick={() => {
                                  // Navigate to first division if multi-division, otherwise stay on current game
                                  const targetGame = group.isMultiDivision ? group.games[0] : joinedGame;
                                  if (targetGame.gameType === 'auction' || targetGame.gameType === 'auctioneer' || targetGame.gameType === 'worldtour-manager') {
                                    router.push(`/games/${targetGame.id}/auction`);
                                  } else {
                                    router.push(`/games/${targetGame.id}/team`);
                                  }
                                }}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                              />
                            )}

                            {/* Regular user buttons */}
                            {joinable && (
                              <Button
                                text={joining === game.id ? "Joining..." : "Join Game"}
                                onClick={() => handleJoinGame(game.id)}
                                disabled={joining === game.id}
                                className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
                              />
                            )}
                            {isJoined && !isWaitingForDivision && joinedGame && (game.gameType === 'auction' || game.gameType === 'auctioneer' || game.gameType === 'worldtour-manager') && (
                              <Button
                                text="Auction"
                                onClick={() => router.push(`/games/${joinedGame.id}/auction`)}
                                className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
                              />
                            )}
                            {isJoined && !isWaitingForDivision && joinedGame && game.gameType !== 'auction' && game.gameType !== 'auctioneer' && game.gameType !== 'worldtour-manager' && (
                              <Button
                                text="Select Team"
                                onClick={() => router.push(`/games/${joinedGame.id}/team`)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-600/80 whitespace-nowrap"
                              />
                            )}
                            {leaveable && joinedGame && (
                              <Button
                                text={leaving === joinedGame.id ? "Leaving..." : "Leave Game"}
                                onClick={() => confirmLeaveGame(joinedGame.id)}
                                disabled={leaving === joinedGame.id}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 whitespace-nowrap"
                              />
                            )}
                            {!joinable && !leaveable && !isJoined && isFull && !isAdmin && (
                              <span className="text-sm text-red-600">Game is full</span>
                            )}
                            {!joinable && !isJoined && !isFull && !isRegistrationOpen(game) && !isAdmin && (
                              <span className="text-sm text-gray-500">Registration closed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Game Rules Modal */}
      {selectedGameForRules && (
        <GameRulesModal
          isOpen={rulesModalOpen}
          onClose={() => {
            setRulesModalOpen(false);
            setSelectedGameForRules(null);
          }}
          gameType={selectedGameForRules.type}
          gameName={selectedGameForRules.name}
        />
      )}

      {/* Leave Game Confirmation Dialog */}
      <ConfirmDialog
        open={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeaveGame}
        title="Leave Game"
        description="Are you sure you want to leave this game?"
        confirmText="Leave Game"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Info Dialog for messages previously shown with alert() */}
      {infoDialog && (
        <ConfirmDialog
          open={true}
          onClose={() => setInfoDialog(null)}
          onConfirm={() => setInfoDialog(null)}
          title={infoDialog.title}
          description={infoDialog.description}
          confirmText="OK"
          cancelText="Close"
        />
      )}
    </div>
  );
};
