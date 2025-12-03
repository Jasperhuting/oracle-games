'use client'

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { useForm, SubmitHandler } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { GameType } from "@/lib/types/games";

interface AuctionPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface GameFormData {
  name: string;
  status: string;
  division?: string;
  divisionLevel?: number;
  maxPlayers?: number;

  // Auctioneer config
  budget?: number;
  maxRiders?: number;
}

interface EditGameModalProps {
  gameId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditGameModal = ({ gameId, onClose, onSuccess }: EditGameModalProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameType, setGameType] = useState<GameType | ''>('');
  const [auctionPeriods, setAuctionPeriods] = useState<AuctionPeriodInput[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GameFormData>();

  useEffect(() => {
    const loadGame = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) {
          throw new Error('Failed to load game');
        }
        const data = await response.json();
        const game = data.game;

        // Set game type
        setGameType(game.gameType);

        // Populate form
        reset({
          name: game.name,
          status: game.status,
          division: game.division,
          divisionLevel: game.divisionLevel,
          maxPlayers: game.maxPlayers,
          budget: game.config?.budget,
          maxRiders: game.config?.maxRiders,
        });

        // Load auction periods if auctioneer game
        if (game.gameType === 'auctioneer' && game.config?.auctionPeriods) {
          setAuctionPeriods(game.config.auctionPeriods.map((p: any) => ({
            name: p.name,
            startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 16) : '',
            endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 16) : '',
            status: p.status,
          })));
        }
      } catch (error: any) {
        console.error('Error loading game:', error);
        setError(error.message || 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId, reset]);

  const addAuctionPeriod = () => {
    setAuctionPeriods([...auctionPeriods, { name: '', startDate: '', endDate: '', status: 'pending' }]);
  };

  const removeAuctionPeriod = (index: number) => {
    setAuctionPeriods(auctionPeriods.filter((_, i) => i !== index));
  };

  const updateAuctionPeriod = (index: number, field: keyof AuctionPeriodInput, value: string) => {
    const updated = [...auctionPeriods];
    updated[index][field] = value;
    setAuctionPeriods(updated);
  };

  const onSubmit: SubmitHandler<GameFormData> = async (data) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updates: any = {
        adminUserId: user.uid,
        name: data.name,
        status: data.status,
        division: data.division,
        divisionLevel: data.divisionLevel,
        maxPlayers: data.maxPlayers,
      };

      // Handle auctioneer config
      if (gameType === 'auctioneer') {
        if (auctionPeriods.length === 0) {
          setError('Please add at least one auction period');
          setIsSubmitting(false);
          return;
        }

        const invalidPeriod = auctionPeriods.find(p => !p.name || !p.startDate || !p.endDate);
        if (invalidPeriod) {
          setError('All auction periods must have a name, start date, and end date');
          setIsSubmitting(false);
          return;
        }

        updates.config = {
          budget: Number(data.budget) || 100,
          maxRiders: Number(data.maxRiders) || 8,
          auctionPeriods: auctionPeriods.map(period => ({
            name: period.name,
            startDate: new Date(period.startDate).toISOString(),
            endDate: new Date(period.endDate).toISOString(),
            status: period.status,
          })),
          auctionStatus: auctionPeriods.some(p => p.status === 'active') ? 'active' :
                        auctionPeriods.every(p => p.status === 'closed') ? 'closed' : 'pending',
        };
      }

      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not update game');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error updating game:', error);
      setError(error.message || 'Something went wrong updating the game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'registration', label: 'Registration' },
    { value: 'bidding', label: 'Bidding' },
    { value: 'active', label: 'Active' },
    { value: 'finished', label: 'Finished' },
  ];

  const AUCTION_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'finalized', label: 'Finalized' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Edit Game</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          )}

          {!loading && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Game Name */}
              <div>
                <TextInput
                  label="Game Name"
                  placeholder="E.g. Auctioneer - Tour de France 2025 - Division 1"
                  {...register('name', {
                    required: 'Game name is required',
                    minLength: {
                      value: 5,
                      message: 'Name must be at least 5 characters'
                    }
                  })}
                />
                {errors.name && (
                  <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Game Status *
                </label>
                <select
                  {...register('status', {
                    required: 'Status is required'
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.status && (
                  <span className="text-red-500 text-xs mt-1 block">{errors.status.message}</span>
                )}
              </div>

              {/* Division */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    label="Division (optional)"
                    placeholder="E.g. Division 1, Premier"
                    {...register('division')}
                  />
                </div>
                <div>
                  <TextInput
                    type="number"
                    label="Division Level (optional)"
                    placeholder="1 = highest"
                    {...register('divisionLevel', {
                      min: {
                        value: 1,
                        message: 'Level must be at least 1'
                      }
                    })}
                  />
                </div>
              </div>

              {/* Max Players */}
              <div>
                <TextInput
                  type="number"
                  label="Maximum Number of Players (optional)"
                  placeholder="E.g. 50"
                  {...register('maxPlayers', {
                    min: {
                      value: 2,
                      message: 'At least 2 players required'
                    }
                  })}
                />
              </div>

              {/* Auctioneer Specific Fields */}
              {gameType === 'auctioneer' && (
                <div className="border-t pt-4 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">Auctioneer Configuration</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <TextInput
                        type="number"
                        label="Budget per Player"
                        placeholder="E.g. 100"
                        {...register('budget', {
                          min: {
                            value: 1,
                            message: 'Budget must be at least 1'
                          }
                        })}
                      />
                    </div>
                    <div>
                      <TextInput
                        type="number"
                        label="Max Riders per Team"
                        placeholder="E.g. 8"
                        {...register('maxRiders', {
                          min: {
                            value: 1,
                            message: 'At least 1 rider required'
                          }
                        })}
                      />
                    </div>
                  </div>

                  {/* Auction Periods */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Auction Periods *
                      </label>
                      <Button
                        type="button"
                        text="+ Add Period"
                        onClick={addAuctionPeriod}
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700"
                      />
                    </div>

                    {auctionPeriods.length === 0 && (
                      <p className="text-sm text-gray-500 mb-2">
                        No auction periods added. Click "+ Add Period" to add one.
                      </p>
                    )}

                    <div className="space-y-3">
                      {auctionPeriods.map((period, index) => (
                        <div key={index} className="border border-gray-300 rounded-md p-3 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-700">Period {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeAuctionPeriod(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <input
                                type="text"
                                placeholder="Period name (e.g., Pre-race, Stage 1-5)"
                                value={period.name}
                                onChange={(e) => updateAuctionPeriod(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Start Date & Time</label>
                                <input
                                  type="datetime-local"
                                  value={period.startDate}
                                  onChange={(e) => updateAuctionPeriod(index, 'startDate', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">End Date & Time</label>
                                <input
                                  type="datetime-local"
                                  value={period.endDate}
                                  onChange={(e) => updateAuctionPeriod(index, 'endDate', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Status</label>
                                <select
                                  value={period.status}
                                  onChange={(e) => updateAuctionPeriod(index, 'status', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  {AUCTION_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3">
                <Button
                  text="Cancel"
                  onClick={onClose}
                  type="button"
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
                />
                <Button
                  text={isSubmitting ? "Saving..." : "Save Changes"}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary hover:bg-primary"
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
