'use client'

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/utils";

interface Game {
  id: string;
  name: string;
  gameType: string;
  year: number;
  status: string;
  playerCount: number;
  maxPlayers?: number;
  division?: string;
  divisionLevel?: number;
  createdAt: string;
  updatedAt: string;
  config?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  raceRef?: string;
  eligibleTeams?: string[];
  eligibleRiders?: string[];
}

interface GameDetailsModalProps {
  gameId: string;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const GameDetailsModal = ({ gameId, onClose, onEdit, onDelete }: GameDetailsModalProps) => {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { t } = useTranslation();

  useEffect(() => {
    const loadGame = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) {
          throw new Error('Failed to load game');
        }
        const data = await response.json();
        setGame(data.game);
      } catch (error: unknown) {
        console.error('Error loading game:', error);
        setError(error instanceof Error ? error.message : 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

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

  const getStatusLabel = (status: string, t: any) => {
    switch (status) {
      case 'draft': return t('games.statuses.draft');
      case 'registration': return t('games.statuses.registration');
      case 'bidding': return t('games.statuses.bidding');
      case 'active': return t('games.statuses.active');
      case 'finished': return t('games.statuses.finished');
      default: return status;
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


  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Game Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {game && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Game Name</label>
                    <p className="text-gray-900">{game.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Game Type</label>
                    <p className="text-gray-900">{getGameTypeLabel(game.gameType)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Year</label>
                    <p className="text-gray-900">{game.year}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(game.status)}`}>
                      {getStatusLabel(game.status, t)}
                    </span>
                  </div>
                  {game.division && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Division</label>
                      <p className="text-gray-900">
                        {game.division} {game.divisionLevel ? `(Level ${game.divisionLevel})` : ''}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Players</label>
                    <p className="text-gray-900">
                      {game.playerCount}{game.maxPlayers ? ` / ${game.maxPlayers}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Dates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-gray-900">{formatDate(game.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="text-gray-900">{formatDate(game.updatedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Race Lineup */}
              {(game?.eligibleTeams && (game?.eligibleTeams?.length > 0)) || (game?.eligibleRiders && (game?.eligibleRiders?.length > 0)) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Race Lineup</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {game?.eligibleTeams && (game?.eligibleTeams?.length > 0) && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Eligible Teams</label>
                        <p className="text-gray-900">{game.eligibleTeams?.length} teams</p>
                      </div>
                    )}
                    {game?.eligibleRiders?.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Eligible Riders</label>
                        <p className="text-gray-900">{game.eligibleRiders?.length} riders</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Game Configuration */}
              {game.config && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Configuration</h3>
                  <div className="bg-gray-50 rounded-md p-4">
                    {game.gameType === 'auctioneer' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-500">Budget per Player</label>
                            <p className="text-gray-900">{game.config.budget}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Max Riders per Team</label>
                            <p className="text-gray-900">{game.config.maxRiders}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-500">Auction Status</label>
                            <p className="text-gray-900 capitalize">{game.config.auctionStatus}</p>
                          </div>
                        </div>

                        {game.config.auctionPeriods && game.config.auctionPeriods.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-500 block mb-2">
                              Auction Periods ({game.config.auctionPeriods.length})
                            </label>
                            <div className="space-y-2">
                              {game.config.auctionPeriods.map((period: any, index: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <div key={index} className="bg-white border border-gray-200 rounded-md p-3">
                                  <div className="font-medium text-gray-900 mb-1">{period.name}</div>
                                  <div className="text-sm text-gray-600">
                                    <div>Start: {formatDate(period.startDate)}</div>
                                    <div>End: {formatDate(period.endDate)}</div>
                                    <div className="mt-1">
                                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                                        period.status === 'active' ? 'bg-green-100 text-green-800' :
                                        period.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {period.status}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {game.gameType !== 'auctioneer' && (
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(game.config, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          {onDelete && (
            <Button
              text="Delete"
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700"
            />
          )}
          {onEdit && (
            <Button
              text="Edit"
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700"
            />
          )}
          <Button
            text="Close"
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
          />
        </div>
      </div>
    </div>
  );
};
