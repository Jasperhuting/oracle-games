'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@/components/AuthGuard';
import { GamesBreadcrumb } from '@/components/GamesBreadcrumb';
import { GameRulesModal } from '@/components/GameRulesModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GameCard } from '@/components/joinable-games';
import { useAuth } from '@/hooks/useAuth';
import type { JoinableGame, JoinableGameGroup, JoinableGameParticipant } from '@/lib/types';
import { AuctioneerConfig, GameType, MarginalGainsConfig, WorldTourManagerConfig } from '@/lib/types/games';

export default function GameDetailPage() {
  const params = useParams();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const gameId = useMemo(() => {
    const id = params?.gameId;
    return Array.isArray(id) ? id[0] : id;
  }, [params]);

  const [gameGroup, setGameGroup] = useState<JoinableGameGroup | null>(null);
  const [selectedGame, setSelectedGame] = useState<JoinableGame | null>(null);
  const [myGames, setMyGames] = useState<Set<string>>(new Set());
  const [myParticipants, setMyParticipants] = useState<Map<string, JoinableGameParticipant>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [selectedGameForRules, setSelectedGameForRules] = useState<{ type: GameType; name: string } | null>(null);
  const [availableRules, setAvailableRules] = useState<Set<GameType>>(new Set());
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [pendingLeaveGameId, setPendingLeaveGameId] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);

  const getGameStartDate = (config: AuctioneerConfig | MarginalGainsConfig | WorldTourManagerConfig | undefined): string | undefined => {
    if (!config) return undefined;

    if ('auctionPeriods' in config && config.auctionPeriods && config.auctionPeriods.length > 0) {
      const sortedPeriods = [...config.auctionPeriods].sort((a, b) => {
        const dateA = typeof a.startDate === 'string' ? a.startDate : a.startDate?.toDate?.()?.toISOString();
        const dateB = typeof b.startDate === 'string' ? b.startDate : b.startDate?.toDate?.()?.toISOString();
        return (dateA || '').localeCompare(dateB || '');
      });
      const firstPeriod = sortedPeriods[0];
      if (firstPeriod.startDate) {
        return typeof firstPeriod.startDate === 'string'
          ? firstPeriod.startDate
          : firstPeriod.startDate?.toDate?.()?.toISOString();
      }
    }

    return undefined;
  };

  const getCountingRaces = (config: AuctioneerConfig | undefined): { raceId: string; raceName: string }[] => {
    if (!config || !('countingRaces' in config) || !config.countingRaces) return [];
    return config.countingRaces;
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

  const isSelectionBasedGame = (gameType: string) => {
    return gameType === 'auction' || gameType === 'auctioneer' || gameType === 'worldtour-manager' || gameType === 'marginal-gains' || gameType === 'full-grid';
  };

  const getStatusLabel = (game: JoinableGame) => {
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
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('nl-NL', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      console.error('[GameDetailPage] formatDate error:', error);
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('nl-NL', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
    } catch (error) {
      console.error('[GameDetailPage] formatDate error:', error);
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
    if (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains') {
      return game.status === 'registration' || game.status === 'draft' || game.status === 'bidding';
    }
    return game.status === 'registration' || game.status === 'draft';
  };

  const groupGames = async (games: JoinableGame[]): Promise<JoinableGameGroup[]> => {
    const groups = new Map<string, JoinableGameGroup>();

    games.forEach(game => {
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

      if (isMultiDivision && game.maxPlayers) {
        group.maxPlayers = (group.maxPlayers || 0) + game.maxPlayers;
      } else if (!isMultiDivision) {
        group.maxPlayers = game.maxPlayers;
      }
    });

    const f1Game = games.find(g => g.gameType === 'f1-prediction');
    if (f1Game) {
      try {
        const f1Response = await fetch('/api/f1/participants?season=2026');
        if (f1Response.ok) {
          const f1Data = await f1Response.json();
          if (f1Data.success && f1Data.participants) {
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

    groups.forEach(group => {
      group.games.sort((a, b) => (a.divisionLevel || 999) - (b.divisionLevel || 999));
    });

    return Array.from(groups.values());
  };

  const loadGameData = async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/games/list?limit=200');
      if (!response.ok) {
        throw new Error('Could not load games');
      }

      const data = await response.json();
      const games: JoinableGame[] = data.games || [];
      const groupedGames = await groupGames(games);
      const group = groupedGames.find(g => g.games.some(game => game.id === gameId));

      if (!group) {
        setError(t('games.notFound', 'Game niet gevonden.'));
        setGameGroup(null);
        setSelectedGame(null);
        return;
      }

      setGameGroup(group);
      setSelectedGame(group.games.find(game => game.id === gameId) || group.games[0]);

      if (user) {
        const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setIsAdmin(userData.userType === 'admin');
        }

        const participantsResponse = await fetch(`/api/gameParticipants?userId=${user.uid}`);
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          const participants: JoinableGameParticipant[] = participantsData.participants || [];

          const f1ParticipantsResponse = await fetch('/api/f1/participants?season=2026');
          let f1Participants: JoinableGameParticipant[] = [];
          if (f1ParticipantsResponse.ok) {
            const f1Data = await f1ParticipantsResponse.json();
            if (f1Data.success && f1Data.participants) {
              f1Participants = f1Data.participants
                .filter((p: any) => p.userId === user.uid)
                .map((p: any) => ({
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

          const allParticipants = [...participants, ...f1Participants];

          const gameIds = new Set(
            allParticipants.map((p: JoinableGameParticipant) => p.gameId.replace(/-pending$/, ''))
          );
          const participantMap = new Map(
            allParticipants.map((p: JoinableGameParticipant) => {
              const actualGameId = p.gameId.replace(/-pending$/, '');
              return [actualGameId, p];
            })
          );

          setMyGames(gameIds);
          setMyParticipants(participantMap);
        }
      }
    } catch (error: unknown) {
      console.error('Error loading game:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong loading the game');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    loadGameData();
  }, [authLoading, user, gameId]);

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

  const handleJoinGame = async (targetGameId: string) => {
    if (!user) {
      setInfoDialog({
        title: 'Login required',
        description: 'Please log in to join a game.',
      });
      return;
    }

    setJoining(targetGameId);
    setError(null);

    try {
      const response = await fetch(`/api/games/${targetGameId}/join`, {
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

      await loadGameData();
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

  const handleLeaveGame = async () => {
    if (!pendingLeaveGameId) return;
    setLeaveConfirmOpen(false);
    setLeaving(pendingLeaveGameId);
    setError(null);

    try {
      const response = await fetch(`/api/games/${pendingLeaveGameId}/join`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to leave game');
      }

      await loadGameData();
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
      setPendingLeaveGameId(null);
    }
  };

  const onLeave = (targetGameId: string) => {
    setPendingLeaveGameId(targetGameId);
    setLeaveConfirmOpen(true);
  };

  return (
    <AuthGuard>
      <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-blue-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-52 w-52 rounded-full bg-teal-200/30 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-8">
          <div className="mx-auto container">
            <GamesBreadcrumb />

            <div className="mt-4 mb-6 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80">Oracle Games</p>
              <h1 className="text-3xl sm:text-4xl font-semibold font-serif text-gray-900">
                {selectedGame ? selectedGame.name : t('games.gameDetails', 'Game details')}
              </h1>
              <p className="text-sm text-gray-600 max-w-2xl">
                {t('games.joinSingle', 'Bekijk de spelregels, deadlines en doe meteen mee als dit nog kan.')}
              </p>
            </div>

            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="text-gray-600">{t('games.loadingGames')}</div>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
                <p className="font-semibold">{error}</p>
                <p className="mt-2 text-sm text-red-600">
                  {t('games.backToOverview', 'Ga terug naar het overzicht om andere games te bekijken.')}
                </p>
                <Link href="/games" className="mt-4 inline-flex text-sm text-red-700 underline">
                  {t('games.backToGames', 'Terug naar games')}
                </Link>
              </div>
            )}

            {!loading && !error && gameGroup && (
              <div className="space-y-6">
                <GameCard
                  group={gameGroup}
                  myGames={myGames}
                  myParticipants={myParticipants}
                  isAdmin={isAdmin}
                  availableRules={availableRules}
                  joining={joining}
                  leaving={leaving}
                  onJoin={handleJoinGame}
                  onLeave={onLeave}
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

                {selectedGame && (
                  <div className="rounded-2xl border border-emerald-100 bg-white/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-600/80">
                          {t('games.details', 'Game info')}
                        </p>
                        <h2 className="text-2xl font-semibold text-gray-900">
                          {t('games.detailsHeading', 'Alles wat je moet weten')}
                        </h2>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-700">
                      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">{t('global.year')}</span>
                        <span className="font-semibold text-gray-900">{selectedGame.year}</span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">{t('games.status', 'Status')}</span>
                        <span className="font-semibold text-gray-900">{getStatusLabel(selectedGame)}</span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">{t('global.players')}</span>
                        <span className="font-semibold text-gray-900">{gameGroup.totalPlayers}</span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">{t('games.opens', 'Opens')}</span>
                        <span className="font-semibold text-gray-900">{formatDate(selectedGame.registrationOpenDate)}</span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                        <span className="block text-[10px] uppercase tracking-wide text-gray-400">{t('games.closes', 'Closes')}</span>
                        <span className="font-semibold text-gray-900">{formatDate(selectedGame.registrationCloseDate)}</span>
                      </div>
                      {selectedGame.teamSelectionDeadline && (
                        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                          <span className="block text-[10px] uppercase tracking-wide text-gray-400">Deadline</span>
                          <span className="font-semibold text-gray-900">{formatDateTime(selectedGame.teamSelectionDeadline)}</span>
                        </div>
                      )}
                      {['auctioneer', 'worldtour-manager', 'marginal-gains'].includes(selectedGame.gameType) && (
                        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                          <span className="block text-[10px] uppercase tracking-wide text-gray-400">{t('games.starts', 'Start')}</span>
                          <span className="font-semibold text-gray-900">
                            {formatDate(getGameStartDate(selectedGame.config as AuctioneerConfig | MarginalGainsConfig | WorldTourManagerConfig | undefined))}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedGame.description && (
                      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                        {selectedGame.description}
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-gray-700">
                      <span className="font-semibold">{t('games.races', 'Wedstrijden')}:</span>{' '}
                      {selectedGame.raceType === 'season'
                        ? t('games.fullSeason', 'Heel seizoen')
                        : selectedGame.gameType === 'auctioneer'
                          ? (getCountingRaces(selectedGame.config as AuctioneerConfig).map(r => r.raceName).join(', ') || '-')
                          : '-'}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  <Link href="/games" className="underline">
                    {t('games.backToGames', 'Terug naar games')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

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
    </AuthGuard>
  );
}
