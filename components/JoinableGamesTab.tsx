'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GameRulesModal } from "./GameRulesModal";
import { GameType } from "@/lib/types/games";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "react-i18next";
import { GameCard } from "./joinable-games";
import Link from "next/link";
import { getPlatformConfigFromHost } from "@/lib/platform";
import { 
  JoinableGame, 
  JoinableGameGroup, 
  JoinableGameParticipant 
} from "@/lib/types";

interface F1ParticipantApiRow {
  userId: string;
  gameId: string;
  displayName: string;
  joinedAt: string;
  status: string;
}

export const JoinableGamesTab = () => {
  const { user, impersonationStatus, loading: authLoading } = useAuth();
  const [games, setGames] = useState<JoinableGame[]>([]);
  const [gameGroups, setGameGroups] = useState<JoinableGameGroup[]>([]);
  const [myGames, setMyGames] = useState<Set<string>>(new Set());
  const [myParticipants, setMyParticipants] = useState<Map<string, JoinableGameParticipant>>(new Map());
  const [loading, setLoading] = useState(true);
  const [participationsLoaded, setParticipationsLoaded] = useState(false);
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
  const currentPlatform = typeof window !== 'undefined'
    ? getPlatformConfigFromHost(window.location.host).key
    : 'cycling';

  const loadGames = async () => {
    setLoading(true);
    setParticipationsLoaded(false);
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

      // Group games and calculate participant counts
      const groupedGames = await groupGames(data.games || []);
      setGameGroups(groupedGames);

      // Load user's participations and admin status if logged in
      if (user) {
        // Check if user is admin
        const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setIsAdmin(userData.userType === 'admin');
        }

        // Load regular game participants
        const participantsResponse = await fetch(`/api/gameParticipants?userId=${user.uid}`);
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          const participants: JoinableGameParticipant[] = participantsData.participants || [];

          // Also load F1 participants for the F1 game
          const f1ParticipantsResponse = await fetch('/api/f1/participants?season=2026');
          let f1Participants: JoinableGameParticipant[] = [];
          if (f1ParticipantsResponse.ok) {
            const f1Data = await f1ParticipantsResponse.json();
            if (f1Data.success && f1Data.participants) {
              // Convert F1 participants to JoinableGameParticipant format
              f1Participants = f1Data.participants
                .filter((p: F1ParticipantApiRow) => p.userId === user.uid) // Only get current user's F1 participation
                .map((p: F1ParticipantApiRow) => ({
                  id: p.userId,
                  gameId: p.gameId,
                  userId: p.userId,
                  playerName: p.displayName,
                  joinedAt: p.joinedAt,
                  status: p.status,
                  budget: 0,
                  spentBudget: 0,
                  rosterSize: 0,
                  rosterComplete: false,
                  totalPoints: 0,
                  divisionAssigned: true,
                  assignedDivision: 'Main',
                  team: [],
                  leagueIds: [],
                }));
            }
          }

          // Combine regular participants with F1 participants
          const allParticipants = [...participants, ...f1Participants];

          // For pending multi-division participants, extract the actual gameId
          const gameIds = new Set(
            allParticipants.map((p: JoinableGameParticipant) => {
              // Remove "-pending" suffix if present
              return p.gameId.replace(/-pending$/, '');
            })
          );

          const participantMap = new Map(
            allParticipants.map((p: JoinableGameParticipant) => {
              const actualGameId = p.gameId.replace(/-pending$/, '');
              return [actualGameId, p];
            })
          );

          gameIds && setMyGames(gameIds);
          participantMap && setMyParticipants(participantMap);
        }
        setParticipationsLoaded(true);
      } else {
        // No user logged in, participations are "loaded" (empty)
        setParticipationsLoaded(true);
      }
    } catch (error: unknown) {
      console.error('Error loading games:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong loading games');
      // Even on error, mark participations as loaded to prevent infinite loading
      setParticipationsLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Don't load games until auth is ready
    if (authLoading) return;
    loadGames();
  }, [user, filterYear, filterStatus, authLoading]);

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
      case 'finished': return 'bg-primary text-white';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  // Helper to check if a game type uses selection-based bidding
  const isSelectionBasedGame = (gameType: string) => {
    return gameType === 'auction' || gameType === 'auctioneer' || gameType === 'worldtour-manager' || gameType === 'marginal-gains' || gameType === 'full-grid';
  };

  const getStatusLabel = (game: JoinableGame) => {
    // WorldTour Manager and Marginal Gains use "selecteren" instead of "bidding"
    if (game.status === 'bidding' && (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains' || game.gameType === 'full-grid')) {
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
    const teamDeadline = game.teamSelectionDeadline ? new Date(game.teamSelectionDeadline) : null;

    if (openDate && openDate > now) return false;
    if (closeDate && closeDate < now) return false;
    if (teamDeadline && teamDeadline < now) return false;

    // For worldtour-manager, marginal-gains, and full-grid, allow joining during bidding/selection status as well
    if (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains' || game.gameType === 'full-grid') {
      return game.status === 'registration' || game.status === 'draft' || game.status === 'bidding' || game.status === 'active';
    }

    // Auction Master (auctioneer) can only be joined during registration/draft
    if (game.gameType === 'auctioneer') {
      return game.status === 'registration' || game.status === 'draft';
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
    // For worldtour-manager, marginal-gains, and full-grid, also allow leaving during 'bidding' status
    if (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains' || game.gameType === 'full-grid') {
      return game.status === 'registration' || game.status === 'draft' || game.status === 'bidding';
    }
    return game.status === 'registration' || game.status === 'draft';
  };

  // Group games by base name (removing division suffix)
  const groupGames = async (games: JoinableGame[]): Promise<JoinableGameGroup[]> => {
    const groups = new Map<string, JoinableGameGroup>();

    // First, create groups and calculate regular participant counts
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

    // For F1 games, update the participant count from F1 database
    const f1Game = games.find(g => g.gameType === 'f1-prediction');
    if (f1Game) {
      try {
        const f1Response = await fetch('/api/f1/participants?season=2026');
        if (f1Response.ok) {
          const f1Data = await f1Response.json();
          if (f1Data.success && f1Data.participants) {
            // Find the F1 game group by checking game type instead of name
            groups.forEach(group => {
              if (group.games.some(g => g.gameType === 'f1-prediction')) {
                group.totalPlayers = f1Data.participants.length;
              }
            });
          }
        }
      } catch (error) {
        console.error('Error fetching F1 participants for game count:', error);
      }
    }

    // Sort games within each group by division level
    groups.forEach(group => {
      group.games.sort((a, b) => (a.divisionLevel || 999) - (b.divisionLevel || 999));
    });

    return Array.from(groups.values());
  };

  // Separate test games from regular games
  const isTestGame = (group: JoinableGameGroup) => {
    return group.baseName.toLowerCase().includes('test');
  };

  // Categorize games by sport type
  const CYCLING_GAME_TYPES = [
    'auctioneer', 'slipstream', 'last-man-standing', 'poisoned-cup',
    'nations-cup', 'rising-stars', 'country-roads', 'worldtour-manager',
    'fan-flandrien', 'full-grid', 'marginal-gains'
  ];
  const F1_GAME_TYPES = ['f1-prediction'];
  const SOCCER_GAME_TYPES: string[] = []; // Toekomstige uitbreiding

  const getGameTypeLabel = (gameType: string) => {
    const labels: Record<string, string> = {
      'auctioneer': 'Auction Master',
      'slipstream': 'Slipstream',
      'last-man-standing': 'Last Man Standing',
      'poisoned-cup': 'Poisoned Cup',
      'nations-cup': 'Nations Cup',
      'rising-stars': 'Rising Stars',
      'country-roads': 'Country Roads',
      'worldtour-manager': 'WorldTour Manager',
      'marginal-gains': 'Marginal Gains',
      'fan-flandrien': 'Fan Flandrien',
      'full-grid': 'Full Grid',
      'f1-prediction': 'F1 Prediction',
    };

    return labels[gameType] || gameType;
  };

  const getCategoryForGroup = (group: JoinableGameGroup): 'cycling' | 'f1' | 'soccer' | 'other' => {
    const gameType = group.games[0]?.gameType;
    if (CYCLING_GAME_TYPES.includes(gameType)) return 'cycling';
    if (F1_GAME_TYPES.includes(gameType)) return 'f1';
    if (SOCCER_GAME_TYPES.includes(gameType)) return 'soccer';
    return 'other';
  };

  const regularGameGroups = gameGroups.filter(group => !isTestGame(group));
  const testGameGroups = gameGroups.filter(group => isTestGame(group));

  // Group regular games by sport category
  const cyclingGames = regularGameGroups.filter(g => getCategoryForGroup(g) === 'cycling');
  const f1Games = regularGameGroups.filter(g => getCategoryForGroup(g) === 'f1');
  const soccerGames = regularGameGroups.filter(g => getCategoryForGroup(g) === 'soccer');
  const otherGames = regularGameGroups.filter(g => getCategoryForGroup(g) === 'other');
  const visibleSports = currentPlatform === 'cycling'
    ? (['cycling', 'soccer', 'other'] as const)
    : (['cycling', 'soccer', 'other', 'f1'] as const);

  const sportGroupsMap = {
    cycling: cyclingGames,
    soccer: soccerGames,
    other: otherGames,
    f1: f1Games,
  } satisfies Record<'cycling' | 'soccer' | 'other' | 'f1', JoinableGameGroup[]>;

  const getSportMeta = (sport: 'cycling' | 'soccer' | 'other' | 'f1') => {
    switch (sport) {
      case 'cycling':
        return {
          label: 'Wielrennen',
          icon: '🚴',
          iconClassName: 'bg-emerald-100 text-emerald-700',
          lineClassName: 'bg-emerald-100',
        };
      case 'soccer':
        return {
          label: 'Voetbal',
          icon: '⚽',
          iconClassName: 'bg-orange-100 text-orange-700',
          lineClassName: 'bg-orange-100',
        };
      case 'f1':
        return {
          label: 'Formule 1',
          icon: '🏎️',
          iconClassName: 'bg-blue-100 text-blue-700',
          lineClassName: 'bg-blue-100',
        };
      default:
        return {
          label: 'Overige',
          icon: '✦',
          iconClassName: 'bg-gray-100 text-gray-600',
          lineClassName: 'bg-gray-100',
        };
    }
  };

  const sportSections = visibleSports
    .map((sport) => {
      const groups = sportGroupsMap[sport];
      const typeGroups = Object.entries(
        groups.reduce((acc, group) => {
          const gameType = group.games[0]?.gameType || 'unknown';
          if (!acc[gameType]) {
            acc[gameType] = [];
          }
          acc[gameType].push(group);
          return acc;
        }, {} as Record<string, JoinableGameGroup[]>)
      )
        .map(([gameType, groupedGames]) => ({
          gameType,
          label: getGameTypeLabel(gameType),
          groups: groupedGames.sort((a, b) => a.baseName.localeCompare(b.baseName)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        sport,
        ...getSportMeta(sport),
        typeGroups,
      };
    })
    .filter((section) => section.typeGroups.length > 0);

  // Show loading state until auth is ready, games are loaded, and participations are loaded
  if (authLoading || loading || (user && !participationsLoaded)) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">{t('games.loadingGames')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-6">
          {/* Games List */}
          {games.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">No games found with the selected filters</p>
            </div>
          ) : (
            <div className="space-y-6">
          {sportSections.map((section) => (
            <div key={section.sport} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${section.iconClassName}`}>
                  {section.icon}
                </span>
                <h3 className="text-lg font-semibold text-gray-800">{section.label}</h3>
                <div className={`h-px flex-1 ${section.lineClassName}`} />
              </div>

              {section.typeGroups.map((typeGroup) => (
                <div key={`${section.sport}-${typeGroup.gameType}`} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                      {typeGroup.label}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {typeGroup.groups.length} {typeGroup.groups.length === 1 ? 'reeks' : 'reeksen'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {typeGroup.groups.map((group) => (
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
                </div>
              ))}
            </div>
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
        </div>

        <aside className="space-y-4">
          <div className="bg-white/80 backdrop-blur border border-emerald-100 rounded-2xl p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600/80">Lobby</p>
              <h2 className="text-2xl font-semibold text-gray-900">{t('games.joinGame')}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">{t('global.allYears')}</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('games.status')}
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
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

          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-900 mb-2">Kalender</p>
            <div className="flex flex-col gap-2">
              <Link href="/account" className="text-primary hover:text-primary/80">
                Bekijk de kalender op je profielpagina
              </Link>
              <a
                href="https://www.procyclingstats.com/races.php"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
              >
                Volledige PCS kalender (UWT, .Pro, 1. & 2.)
              </a>
            </div>
          </div>
        </aside>
      </div>

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
