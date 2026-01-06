'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GameRulesModal } from "./GameRulesModal";
import { GameType } from "@/lib/types/games";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "react-i18next";
import { GameCard } from "./joinable-games";
import { 
  JoinableGame, 
  JoinableGameGroup, 
  JoinableGameParticipant 
} from "@/lib/types";

export const JoinableGamesTab = () => {
  const { user, impersonationStatus } = useAuth();
  const [games, setGames] = useState<JoinableGame[]>([]);
  const [myGames, setMyGames] = useState<Set<string>>(new Set());
  const [myParticipants, setMyParticipants] = useState<Map<string, JoinableGameParticipant>>(new Map());
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
          const participants: JoinableGameParticipant[] = participantsData.participants || [];

          // For pending multi-division participants, extract the actual gameId
          const gameIds = new Set(
            participants.map((p: JoinableGameParticipant) => {
              // Remove "-pending" suffix if present
              return p.gameId.replace(/-pending$/, '');
            })
          );

          const participantMap = new Map(
            participants.map((p: JoinableGameParticipant) => {
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
            rulesArray
              .filter((r: { rules?: string; gameType: string }) => r.rules)
              .map((r: { rules?: string; gameType: string }) => r.gameType as GameType)
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

  // Helper to check if a game type uses selection-based bidding
  const isSelectionBasedGame = (gameType: string) => {
    return gameType === 'auction' || gameType === 'auctioneer' || gameType === 'worldtour-manager' || gameType === 'marginal-gains';
  };

  const getStatusLabel = (game: JoinableGame) => {
    // WorldTour Manager and Marginal Gains use "selecteren" instead of "bidding"
    if (game.status === 'bidding' && (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains')) {
      return 'selecteren';
    }

    switch (game.status) {
      case 'draft': return 'draft';
      case 'registration': return 'registration';
      case 'bidding': return game.bidding ? 'bidding' : 'selecteren';
      case 'active': return 'active';
      case 'finished': return 'finished';
      default: return game.status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    console.log('[JoinableGamesTab] formatDate input:', dateString, typeof dateString);
    try {
      const date = new Date(dateString);
      console.log('[JoinableGamesTab] parsed date:', date, date.toString());
      return date.toLocaleDateString('nl-NL', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      console.error('[JoinableGamesTab] formatDate error:', error);
      return dateString;
    }
  };

   const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    console.log('[JoinableGamesTab] formatDate input:', dateString, typeof dateString);
    try {
      const date = new Date(dateString);
      console.log('[JoinableGamesTab] parsed date:', date, date.toString());
      return date.toLocaleString('nl-NL', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
    } catch (error) {
      console.error('[JoinableGamesTab] formatDate error:', error);
      return dateString;
    }
  };

  const isRegistrationOpen = (game: JoinableGame) => {
    const now = new Date();
    const openDate = game.registrationOpenDate ? new Date(game.registrationOpenDate) : null;
    const closeDate = game.registrationCloseDate ? new Date(game.registrationCloseDate) : null;

    if (openDate && openDate > now) return false;
    if (closeDate && closeDate < now) return false;

    // For worldtour-manager and marginal-gains, allow joining during bidding status as well
    if (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains') {
      return game.status === 'registration' || game.status === 'draft' || game.status === 'bidding' || game.status === 'active';
    }

    return game.status === 'registration' || game.status === 'draft' || game.status === 'active';
  };

  const canJoin = (game: JoinableGame) => {
    if (myGames.has(game.id)) return false;
    if (!isRegistrationOpen(game)) return false;
    if (game.maxPlayers && game.playerCount >= game.maxPlayers) return false;
    return true;
  };

  const canLeave = (game: JoinableGame) => {
    if (!myGames.has(game.id)) return false;
    // Can only leave if game hasn't started
    // For worldtour-manager and marginal-gains, also allow leaving during 'bidding' status
    if (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains') {
      return game.status === 'registration' || game.status === 'draft' || game.status === 'bidding';
    }
    return game.status === 'registration' || game.status === 'draft';
  };

  // Group games by base name (removing division suffix)
  const groupGames = (games: JoinableGame[]): JoinableGameGroup[] => {
    const groups = new Map<string, JoinableGameGroup>();

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
  const isTestGame = (group: JoinableGameGroup) => {
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
          {regularGameGroups.map((group) => (
            <GameCard
              key={group.isMultiDivision ? group.baseName : group.games[0].id}
              group={group}
              myGames={myGames}
              myParticipants={myParticipants}
              isAdmin={isAdmin}
              availableRules={availableRules}
              joining={joining}
              leaving={leaving}
              onJoin={handleJoinGame}
              onLeave={confirmLeaveGame}
              onShowRules={handleShowRules}
              isRegistrationOpen={isRegistrationOpen}
              canJoin={canJoin}
              canLeave={canLeave}
              isSelectionBasedGame={isSelectionBasedGame}
              getStatusLabel={getStatusLabel}
              getStatusBadgeColor={getStatusBadgeColor}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
            />
          ))}

          {/* Test Games Section */}
          {(isAdmin || impersonationStatus?.isImpersonating) && testGameGroups.length > 0 && (
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
                  {testGameGroups.map((group) => (
                    <GameCard
                      key={group.isMultiDivision ? group.baseName : group.games[0].id}
                      group={group}
                      myGames={myGames}
                      myParticipants={myParticipants}
                      isAdmin={isAdmin}
                      availableRules={availableRules}
                      joining={joining}
                      leaving={leaving}
                      onJoin={handleJoinGame}
                      onLeave={confirmLeaveGame}
                      onShowRules={handleShowRules}
                      isRegistrationOpen={isRegistrationOpen}
                      canJoin={canJoin}
                      canLeave={canLeave}
                      isSelectionBasedGame={isSelectionBasedGame}
                      getStatusLabel={getStatusLabel}
                      getStatusBadgeColor={getStatusBadgeColor}
                      formatDate={formatDate}
                      formatDateTime={formatDateTime}
                    />
                  ))}
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
