'use client'

import { useState } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "./ConfirmDialog";

interface Game {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers?: number;
  status: string;
  divisionLevel?: number;
}

interface ManageDivisionsModalProps {
  games: Game[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ManageDivisionsModal = ({ games, onClose, onSuccess }: ManageDivisionsModalProps) => {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{id: string; name: string} | null>(null);

  const confirmDeleteDivision = (gameId: string, gameName: string) => {
    setPendingDelete({ id: gameId, name: gameName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteDivision = async () => {
    if (!user || !pendingDelete) return;

    setDeleting(pendingDelete.id);
    setError(null);

    try {
      const response = await fetch(`/api/games/${pendingDelete.id}?adminUserId=${user.uid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete division');
      }

      // If only 2 divisions remain and we deleted one, close modal and refresh
      if (games.length === 2) {
        onSuccess();
        onClose();
      } else {
        // Refresh the parent to update the list
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error deleting division:', error);
      setError(error.message || 'Failed to delete division');
    } finally {
      setDeleting(null);
    }
  };

  const handleRecalculatePlayerCounts = async () => {
    if (!user) return;

    setRecalculating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const results = [];

      // Recalculate for each division game
      for (const game of games) {
        const response = await fetch(`/api/games/${game.id}/recalculatePlayerCount?adminUserId=${user.uid}`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Failed to recalculate for ${game.name}`);
        }

        const data = await response.json();
        results.push(data);
      }

      setSuccessMessage(`Successfully recalculated player counts for ${games.length} division(s)`);

      // Refresh the parent to show updated counts
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error: any) {
      console.error('Error recalculating player counts:', error);
      setError(error.message || 'Failed to recalculate player counts');
    } finally {
      setRecalculating(false);
    }
  };

  // Sort games by division level
  const sortedGames = [...games].sort((a, b) => {
    const levelA = a.name.match(/Division (\d+)$/)?.[1];
    const levelB = b.name.match(/Division (\d+)$/)?.[1];
    if (levelA && levelB) {
      return parseInt(levelA) - parseInt(levelB);
    }
    return 0;
  });

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

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold">Manage Divisions</h2>
          <p className="text-gray-600 mt-1">
            {games.length} division{games.length !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
              <span className="text-green-700 text-sm">{successMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            {sortedGames.map((game) => (
              <div
                key={game.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{game.name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(game.status)}`}>
                        {getStatusLabel(game.status)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {game.playerCount} {game.playerCount === 1 ? 'player' : 'players'}
                        {game.maxPlayers && ` / ${game.maxPlayers} max`}
                      </span>
                    </div>
                  </div>
                  <Button
                    text={deleting === game.id ? "Deleting..." : "Delete"}
                    onClick={() => confirmDeleteDivision(game.id, game.name)}
                    disabled={deleting === game.id}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">Player Count Issues?</p>
                <p className="text-sm text-blue-800">
                  If player counts don't match the actual participants, click this button to recalculate them based on actual data.
                </p>
              </div>
              <Button
                text={recalculating ? "Recalculating..." : "Fix Counts"}
                onClick={handleRecalculatePlayerCounts}
                disabled={recalculating || deleting !== null}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
              />
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Deleting a division will permanently remove all data associated with it,
              including player registrations and bids. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <Button
            text="Close"
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700"
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteDivision}
        title="Delete Division"
        description={
          pendingDelete ? (
            <>
              <p>Are you sure you want to delete <strong>"{pendingDelete.name}"</strong>?</p>
              <p className="mt-2 font-semibold text-red-600">This will permanently delete this division and all its data. This action cannot be undone.</p>
            </>
          ) : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
