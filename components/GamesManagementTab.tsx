'use client'

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { GameDetailsModal } from "./GameDetailsModal";
import { EditGameModal } from "./EditGameModal";
import { DivisionAssignmentModal } from "./DivisionAssignmentModal";
import { ManageDivisionsModal } from "./ManageDivisionsModal";
import { GameStatusManager } from "./GameStatusManager";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "./ConfirmDialog";
import { useTranslation } from "react-i18next";
import { ClientGame } from "@/lib/types/games";
import { getPlatformConfigFromHost } from "@/lib/platform";

const CYCLING_GAME_TYPES = [
  'auctioneer',
  'slipstream',
  'last-man-standing',
  'poisoned-cup',
  'nations-cup',
  'rising-stars',
  'country-roads',
  'worldtour-manager',
  'fan-flandrien',
  'full-grid',
  'marginal-gains',
] as const;

const F1_GAME_TYPES = ['f1-prediction'] as const;
const FOOTBALL_GAME_TYPES = ['football-prediction', 'wk-2026-prediction', 'football'] as const;

export const GamesManagementTab = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [games, setGames] = useState<ClientGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [manageDivisionsModalOpen, setManageDivisionsModalOpen] = useState(false);
  const [selectedDivisionGames, setSelectedDivisionGames] = useState<ClientGame[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteGameId, setDeleteGameId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [finalizingGameId, setFinalizingGameId] = useState<string | null>(null);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false);
  const [pendingFinalizeGame, setPendingFinalizeGame] = useState<{id: string; name: string} | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);

  const { t } = useTranslation();
  const currentPlatform = typeof window !== 'undefined'
    ? getPlatformConfigFromHost(window.location.host).key
    : 'cycling';

  const loadGames = (async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/games/list?limit=100';
      if (filterYear) url += `&year=${filterYear}`;
      if (filterStatus) url += `&status=${filterStatus}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Could not load games');
      }

      const data = await response.json();
      setGames(data.games || []);
    } catch (error: unknown) {
      console.error('Error loading games:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong loading games');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadGames();
  }, [filterYear, filterStatus]);

  const handleView = (gameId: string) => {
    setSelectedGameId(gameId);
    setViewModalOpen(true);
  };

  const handleEdit = (gameId: string) => {
    setSelectedGameId(gameId);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (gameId: string) => {
    setDeleteGameId(gameId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteGameId || !user) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/games/${deleteGameId}?adminUserId=${user.uid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete game');
      }

      // Reload games list
      await loadGames();
      setDeleteConfirmOpen(false);
      setDeleteGameId(null);
    } catch (error: unknown) {
      console.error('Error deleting game:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete game');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedGameId(null);
    loadGames();
  };

  const handleViewEdit = () => {
    setViewModalOpen(false);
    setEditModalOpen(true);
  };

  const handleViewDelete = () => {
    if (selectedGameId) {
      setViewModalOpen(false);
      handleDeleteClick(selectedGameId);
    }
  };

  const handleManageLineup = (gameId: string) => {
    router.push(`/games/${gameId}/lineup`);
  };

  const handleManageDivisions = (gameId: string) => {
    setSelectedGameId(gameId);
    setDivisionModalOpen(true);
  };

  const handleManageDivisionGames = (divisionGames: ClientGame[]) => {
    setSelectedDivisionGames(divisionGames);
    setManageDivisionsModalOpen(true);
  };

  const handleDivisionSuccess = () => {
    setDivisionModalOpen(false);
    setSelectedGameId(null);
    loadGames();
  };

  const confirmFinalizeAuction = (gameId: string, gameName: string) => {
    setPendingFinalizeGame({ id: gameId, name: gameName });
    setFinalizeConfirmOpen(true);
  };

  const handleFinalizeAuction = async () => {
    if (!pendingFinalizeGame) return;

    setFinalizingGameId(pendingFinalizeGame.id);
    try {
      // First, fetch the game data to get auction periods
      const gameResponse = await fetch(`/api/games/${pendingFinalizeGame.id}`);
      if (!gameResponse.ok) {
        throw new Error('Failed to fetch game data');
      }
      const gameData = await gameResponse.json();

      // Find the period that should be finalized (active/closed and past finalizeDate)
      let periodToFinalize = null;
      const now = new Date();

      if (gameData.config?.auctionPeriods && gameData.config.auctionPeriods.length > 0) {
        for (const period of gameData.config.auctionPeriods) {
          const finalizeDate = period.finalizeDate ? new Date(period.finalizeDate) : null;

          // Find a period that is active or closed, not yet finalized, and past its finalize date
          if (
            (period.status === 'active' || period.status === 'closed') &&
            period.status !== 'finalized' &&
            finalizeDate &&
            now >= finalizeDate
          ) {
            periodToFinalize = period.name;
            break;
          }
        }
      }

      const response = await fetch(`/api/games/${pendingFinalizeGame.id}/bids/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionPeriodName: periodToFinalize,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to finalize auction');
      }

      const data = await response.json();

      setInfoDialog({
        title: 'Auction finalized',
        description: `Winners assigned: ${data.results.winnersAssigned}\nLosers refunded: ${data.results.losersRefunded}\nTotal riders: ${data.results.totalRiders}`,
      });

      // Reload games list to show updated state
      await loadGames();
    } catch (error) {
      console.error('Error finalizing auction:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to finalize auction';
      setInfoDialog({
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setFinalizingGameId(null);
    }
  };

  const handleManageDivisionsSuccess = () => {
    setManageDivisionsModalOpen(false);
    setSelectedDivisionGames([]);
    loadGames();
  };

  const toggleGroupExpanded = (baseName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(baseName)) {
        newSet.delete(baseName);
      } else {
        newSet.add(baseName);
      }
      return newSet;
    });
  };

  // Group games by base name (removing " - Division X" suffix)
  const groupedGames = games.reduce((acc, game) => {
    // Extract base name by removing " - Division X" pattern
    const baseName = game.name.replace(/ - Division \d+$/, '');

    if (!acc[baseName]) {
      acc[baseName] = [];
    }
    acc[baseName].push(game);
    return acc;
  }, {} as Record<string, ClientGame[]>);

  // Convert grouped games to array and sort
  const gameGroups = Object.entries(groupedGames).map(([baseName, divisionGames]) => {
    // Sort divisions by divisionLevel if available
    divisionGames.sort((a, b) => {
      const levelA = a.name.match(/Division (\d+)$/)?.[1];
      const levelB = b.name.match(/Division (\d+)$/)?.[1];
      if (levelA && levelB) {
        return parseInt(levelA) - parseInt(levelB);
      }
      return 0;
    });

    return {
      baseName,
      games: divisionGames,
      hasDivisions: divisionGames.length > 1,
    };
  }).sort((a, b) => a.baseName.localeCompare(b.baseName));

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

  const getSportCategory = (gameType: string): 'f1' | 'cycling' | 'football' | 'other' => {
    if (F1_GAME_TYPES.includes(gameType as typeof F1_GAME_TYPES[number])) return 'f1';
    if (CYCLING_GAME_TYPES.includes(gameType as typeof CYCLING_GAME_TYPES[number])) return 'cycling';
    if (FOOTBALL_GAME_TYPES.includes(gameType as typeof FOOTBALL_GAME_TYPES[number])) return 'football';
    return 'other';
  };

  const getSportLabel = (sport: 'f1' | 'cycling' | 'football' | 'other') => {
    switch (sport) {
      case 'f1':
        return 'F1';
      case 'cycling':
        return 'Cycling';
      case 'football':
        return 'Football';
      default:
        return 'Other';
    }
  };

  const visibleSports = currentPlatform === 'cycling'
    ? (['cycling', 'football', 'other'] as const)
    : (['cycling', 'football', 'other', 'f1'] as const);

  const sportSections = visibleSports
    .map((sport) => {
      const sportGroups = gameGroups.filter((group) => getSportCategory(group.games[0]?.gameType || '') === sport);
      const typeGroups = Object.entries(
        sportGroups.reduce((acc, group) => {
          const gameType = group.games[0]?.gameType || 'unknown';
          if (!acc[gameType]) {
            acc[gameType] = [];
          }
          acc[gameType].push(group);
          return acc;
        }, {} as Record<string, typeof gameGroups>)
      )
        .map(([gameType, groupedGames]) => ({
          gameType,
          label: getGameTypeLabel(gameType),
          groups: groupedGames.sort((a, b) => a.baseName.localeCompare(b.baseName)),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        sport,
        label: getSportLabel(sport),
        typeGroups,
        totalGroups: sportGroups.length,
      };
    })
    .filter((section) => section.totalGroups > 0);

  const renderGameRows = (groups: typeof gameGroups) => (
    <>
      {groups.map((group) => {
        const game = group.games[0];
        const totalPlayers = group.games.reduce((sum, g) => sum + (Number(g.playerCount) || 0), 0);
        const totalMaxPlayers = group.games.reduce((sum, g) => sum + (Number(g.maxPlayers) || 0), 0);
        const isExpanded = expandedGroups.has(group.baseName);

        return (
          <React.Fragment key={group.baseName}>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => group.hasDivisions && toggleGroupExpanded(group.baseName)}>
                  {group.hasDivisions && (
                    <button
                      onClick={() => toggleGroupExpanded(group.baseName)}
                      className="text-gray-500 hover:text-gray-700 focus:outline-none cursor-pointer"
                    >
                      {isExpanded ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {group.baseName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-600">{game.year}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <GameStatusManager
                  gameId={game.id!}
                  currentStatus={game.status as any} // eslint-disable-line @typescript-eslint/no-explicit-any
                  onStatusChange={loadGames}
                  compact
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-600">
                  {totalPlayers}
                  {totalMaxPlayers > 0 && ` / ${totalMaxPlayers}`}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm text-gray-600">
                  {group.hasDivisions ? (
                    <button
                      onClick={() => toggleGroupExpanded(group.baseName)}
                      className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      {group.games.length} divisions
                    </button>
                  ) : (
                    game.division || '1 division'
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm flex flex-row gap-2">
                <Button
                  onClick={() => game.id && handleView(game.id)}
                  variant="primary"
                  ghost
                  className="cursor-pointer"
                >
                  View
                </Button>
                <Button
                  onClick={() => game.id && handleEdit(game.id)}
                  variant="secondary"
                  ghost
                  className="cursor-pointer"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => game.id && handleManageLineup(game.id)}
                  variant="success"
                  ghost
                  className="cursor-pointer"
                >
                  Lineup
                </Button>
                {game.gameType === 'auctioneer' && game.status === 'bidding' && (
                  <Button
                    onClick={() => game.id && confirmFinalizeAuction(game.id, game.name)}
                    disabled={finalizingGameId === game.id}
                    variant="warning"
                    ghost
                    className="cursor-pointer"
                  >
                    {finalizingGameId === game.id ? '...' : 'Finalize'}
                  </Button>
                )}
                <Button
                  onClick={() => game.id && handleManageDivisions(game.id)}
                  variant="primary"
                  ghost
                  className="cursor-pointer"
                >
                  Assign Players
                </Button>
                {group.hasDivisions && (
                  <Button
                    onClick={() => handleManageDivisionGames(group.games)}
                    variant="secondary"
                    ghost
                    className="cursor-pointer"
                  >
                    Manage Divisions
                  </Button>
                )}
                {!group.hasDivisions && (
                  <Button
                    onClick={() => game.id && handleDeleteClick(game.id)}
                    variant="danger"
                    ghost
                    className="cursor-pointer"
                  >
                    Delete
                  </Button>
                )}
              </td>
            </tr>

            {group.hasDivisions && isExpanded && group.games.map((divisionGame) => (
              <tr key={divisionGame.id} className="bg-gray-50 border-l-4 border-blue-300">
                <td className="px-4 py-2 whitespace-nowrap pl-12">
                  <div className="text-sm text-gray-700">
                    {divisionGame.name}
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="text-sm text-gray-500">-</div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <GameStatusManager
                    gameId={divisionGame.id!}
                    currentStatus={divisionGame.status as any} // eslint-disable-line @typescript-eslint/no-explicit-any
                    onStatusChange={loadGames}
                    compact
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    {divisionGame.playerCount}
                    {divisionGame.maxPlayers && ` / ${divisionGame.maxPlayers}`}
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {divisionGame.division || '-'}
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm flex flex-row gap-2">
                  <Button
                    onClick={() => divisionGame.id && handleView(divisionGame.id)}
                    variant="primary"
                    ghost
                  >
                    View
                  </Button>
                  <Button
                    onClick={() => divisionGame.id && handleEdit(divisionGame.id)}
                    variant="secondary"
                    ghost
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => divisionGame.id && handleManageLineup(divisionGame.id)}
                    variant="success"
                    ghost
                  >
                    Lineup
                  </Button>
                  {divisionGame.gameType === 'auctioneer' && divisionGame.status === 'bidding' && (
                    <Button
                      onClick={() => divisionGame.id && confirmFinalizeAuction(divisionGame.id, divisionGame.name)}
                      disabled={finalizingGameId === divisionGame.id}
                      variant="warning"
                      ghost
                    >
                      {finalizingGameId === divisionGame.id ? '...' : 'Finalize'}
                    </Button>
                  )}
                  {divisionGame.id && (
                    <Button
                      onClick={() => handleDeleteClick(divisionGame.id!)}
                      variant="danger"
                      ghost
                    >
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">{t('global.filters')}</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
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
              <option value="2023">2023</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('games.status')}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            > 
              <option value="">{t('global.allStatuses')}</option>
              <option value="draft">{t('games.statuses.draft')}</option>
              <option value="registration">{t('games.statuses.registration')}</option>
              <option value="bidding">{t('games.statuses.bidding')}</option>
              <option value="active">{t('games.statuses.active')}</option>
              <option value="finished">{t('games.statuses.finished')}</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              text={t('global.refresh')}
              onClick={loadGames}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t('games.overview')}</h2>
          <span className="text-sm text-gray-600">
            {gameGroups.length} {gameGroups.length === 1 ? 'game' : 'games'}
          </span>
        </div>

        {loading && (
          <div className="text-center py-8 text-gray-600">
            Loading games...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && gameGroups.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            No games found
          </div>
        )}

        {!loading && !error && gameGroups.length > 0 && (
          <div className="space-y-8">
            {sportSections.map((section) => (
              <div key={section.sport} className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{section.label}</h3>
                  <span className="text-sm text-gray-500">
                    {section.totalGroups} {section.totalGroups === 1 ? 'game' : 'games'}
                  </span>
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

                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Year
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Players
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Divisions
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {renderGameRows(typeGroup.groups)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📊 Game Statuses:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Draft:</strong> Game created but not yet active</li>
          <li>• <strong>Registration:</strong> Players can register</li>
          <li>• <strong>Bidding:</strong> Auction is active (Auctioneer only)</li>
          <li>• <strong>Active:</strong> Game is in progress</li>
          <li>• <strong>Finished:</strong> Game has ended</li>
        </ul>
      </div>

      {/* View Modal */}
      {viewModalOpen && selectedGameId && (
        <GameDetailsModal
          gameId={selectedGameId}
          onClose={() => {
            setViewModalOpen(false);
            setSelectedGameId(null);
          }}
          onEdit={handleViewEdit}
          onDelete={handleViewDelete}
        />
      )}

      {/* Edit Modal */}
      {editModalOpen && selectedGameId && (
        <EditGameModal
          gameId={selectedGameId}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedGameId(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Division Assignment Modal */}
      {divisionModalOpen && selectedGameId && (
        <DivisionAssignmentModal
          gameId={selectedGameId}
          onClose={() => {
            setDivisionModalOpen(false);
            setSelectedGameId(null);
          }}
          onSuccess={handleDivisionSuccess}
        />
      )}

      {/* Manage Divisions Modal */}
      {manageDivisionsModalOpen && selectedDivisionGames.length > 0 && (
        <ManageDivisionsModal
          games={selectedDivisionGames}
          onClose={() => {
            setManageDivisionsModalOpen(false);
            setSelectedDivisionGames([]);
          }}
          onSuccess={handleManageDivisionsSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && deleteGameId && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this game? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                text="Cancel"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteGameId(null);
                }}
                disabled={deleting}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
              />
              <Button
                text={deleting ? "Deleting..." : "Delete"}
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Finalize Auction Confirmation Dialog */}
      <ConfirmDialog
        open={finalizeConfirmOpen}
        onClose={() => setFinalizeConfirmOpen(false)}
        onConfirm={handleFinalizeAuction}
        title="Finalize Auction"
        description={
          pendingFinalizeGame ? (
            <>
              <p>Are you sure you want to finalize the auction for <strong>&quot;{pendingFinalizeGame.name}&quot;</strong>?</p>
              <p className="mt-2">This will:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Assign riders to winning bidders</li>
                <li>Return budget to losing bidders</li>
              </ul>
              <p className="mt-2 font-semibold text-red-600">This action cannot be undone!</p>
            </>
          ) : ''
        }
        confirmText="Finalize Auction"
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
}
