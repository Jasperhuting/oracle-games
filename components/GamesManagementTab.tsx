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
  createdAt: string;
}

export const GamesManagementTab = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [divisionModalOpen, setDivisionModalOpen] = useState(false);
  const [manageDivisionsModalOpen, setManageDivisionsModalOpen] = useState(false);
  const [selectedDivisionGames, setSelectedDivisionGames] = useState<Game[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteGameId, setDeleteGameId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [finalizingGameId, setFinalizingGameId] = useState<string | null>(null);

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
    } catch (error: any) {
      console.error('Error loading games:', error);
      setError(error.message || 'Something went wrong loading games');
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
    } catch (error: any) {
      console.error('Error deleting game:', error);
      setError(error.message || 'Failed to delete game');
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

  const handleManageDivisionGames = (divisionGames: Game[]) => {
    setSelectedDivisionGames(divisionGames);
    setManageDivisionsModalOpen(true);
  };

  const handleDivisionSuccess = () => {
    setDivisionModalOpen(false);
    setSelectedGameId(null);
    loadGames();
  };

  const handleFinalizeAuction = async (gameId: string, gameName: string) => {
    if (!confirm(`Are you sure you want to finalize the auction for "${gameName}"?\n\nThis will:\n- Assign riders to winning bidders\n- Return budget to losing bidders\n- This action cannot be undone!`)) {
      return;
    }

    setFinalizingGameId(gameId);
    try {
      const response = await fetch(`/api/games/${gameId}/bids/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to finalize auction');
      }

      const data = await response.json();

      alert(`Auction finalized successfully!\n\nWinners assigned: ${data.results.winnersAssigned}\nLosers refunded: ${data.results.losersRefunded}\nTotal riders: ${data.results.totalRiders}`);

      // Reload games list to show updated state
      await loadGames();
    } catch (error) {
      console.error('Error finalizing auction:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to finalize auction';
      alert(errorMsg);
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
  }, {} as Record<string, Game[]>);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'registration': return 'Registration';
      case 'bidding': return 'Bidding';
      case 'active': return 'Active';
      case 'finished': return 'Finished';
      default: return status;
    }
  };

  const getGameTypeLabel = (gameType: string) => {
    const labels: Record<string, string> = {
      'auctioneer': 'Auctioneer',
      'carry-me-home': 'Carry Me Home',
      'last-man-standing': 'Last Man Standing',
      'poisoned-cup': 'Poisoned Cup',
      'nations-cup': 'Nations Cup',
      'rising-stars': 'Rising Stars',
      'country-roads': 'Country Roads',
      'worldtour-manager': 'WorldTour Manager',
      'fan-flandrien': 'Fan Flandrien',
      'giorgio-armada': 'Giorgio Armada',
    };
    return labels[gameType] || gameType;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Filters</h2>
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
              <option value="">All years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="registration">Registration</option>
              <option value="bidding">Bidding</option>
              <option value="active">Active</option>
              <option value="finished">Finished</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              text="Refresh"
              onClick={loadGames}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Games Overview</h2>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
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
                {gameGroups.map((group) => {
                  // Use first game for common properties
                  const game = group.games[0];
                  // Calculate total players across all divisions
                  const totalPlayers = group.games.reduce((sum, g) => sum + (Number(g.playerCount) || 0), 0);
                  const totalMaxPlayers = group.games.reduce((sum, g) => sum + (Number(g.maxPlayers) || 0), 0);
                  const isExpanded = expandedGroups.has(group.baseName);

                  return (
                    <React.Fragment key={group.baseName}>
                      {/* Main game row */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => group.hasDivisions && toggleGroupExpanded(group.baseName)}>
                            {group.hasDivisions && (
                              <button
                                onClick={() => toggleGroupExpanded(group.baseName)}
                                className="text-gray-500 hover:text-gray-700 focus:outline-none"
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
                          <div className="text-sm text-gray-600">
                            {getGameTypeLabel(game.gameType)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{game.year}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <GameStatusManager
                            gameId={game.id}
                            currentStatus={game.status as any}
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
                                className="text-blue-600 hover:text-blue-800 font-medium"
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
                            onClick={() => handleView(game.id)}
                            variant="primary"
                            ghost
                          >
                            View
                          </Button>
                          <Button
                            onClick={() => handleEdit(game.id)}
                            variant="secondary"
                            ghost
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleManageLineup(game.id)}
                            variant="success"
                            ghost
                          >
                            Lineup
                          </Button>
                          {game.gameType === 'auctioneer' && game.status === 'bidding' && (
                            <Button
                              onClick={() => handleFinalizeAuction(game.id, game.name)}
                              disabled={finalizingGameId === game.id}
                              variant="warning"
                              ghost
                            >
                              {finalizingGameId === game.id ? '...' : 'Finalize'}
                            </Button>
                          )}
                          {group.hasDivisions && (
                            <Button
                              onClick={() => handleManageDivisions(game.id)}
                              variant="primary"
                              ghost
                            >
                              Assign Players
                            </Button>
                          )}
                          {!group.hasDivisions && (
                            <Button
                              onClick={() => handleDeleteClick(game.id)}
                              variant="danger"
                              ghost
                            >
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded division rows */}
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
                            <div className="text-sm text-gray-500">-</div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <GameStatusManager
                              gameId={divisionGame.id}
                              currentStatus={divisionGame.status as any}
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
                              onClick={() => handleView(divisionGame.id)}
                              variant="primary"
                              ghost
                            >
                              View
                            </Button>
                            <Button
                              onClick={() => handleEdit(divisionGame.id)}
                              variant="secondary"
                              ghost
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleManageLineup(divisionGame.id)}
                              variant="success"
                              ghost
                            >
                              Lineup
                            </Button>
                            {divisionGame.gameType === 'auctioneer' && divisionGame.status === 'bidding' && (
                              <Button
                                onClick={() => handleFinalizeAuction(divisionGame.id, divisionGame.name)}
                                disabled={finalizingGameId === divisionGame.id}
                                variant="warning"
                                ghost
                              >
                                {finalizingGameId === divisionGame.id ? '...' : 'Finalize'}
                              </Button>
                            )}
                            <Button
                              onClick={() => handleDeleteClick(divisionGame.id)}
                              variant="danger"
                              ghost
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
    </div>
  );
}
