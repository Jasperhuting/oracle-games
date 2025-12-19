'use client'

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { useForm, SubmitHandler } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { GameType } from "@/lib/types/games";
import { useTranslation } from "react-i18next";

interface AuctionPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  finalizeDate?: string;
  status: string;
  top200Only?: boolean;
}

interface CountingRaceInput {
  raceId: string;
  raceSlug: string;
  raceName: string;
  restDays?: number[];
  mountainPointsMultiplier?: number;
  sprintPointsMultiplier?: number;
}

interface Race {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  classification: string;
  country: string;
  year: number;
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

// TODO: Remove any

export const EditGameModal = ({ gameId, onClose, onSuccess }: EditGameModalProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameType, setGameType] = useState<GameType | ''>('');
  const [gameYear, setGameYear] = useState<number>(2025);
  const [auctionPeriods, setAuctionPeriods] = useState<AuctionPeriodInput[]>([]);
  const [countingRaces, setCountingRaces] = useState<CountingRaceInput[]>([]);
  const [countingClassifications, setCountingClassifications] = useState<string[]>([]);
  const [availableRaces, setAvailableRaces] = useState<Race[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(false);

  const { t } = useTranslation();

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

        // Set game type and year
        setGameType(game.gameType);
        setGameYear(game.year || 2025);

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
          setAuctionPeriods(game.config.auctionPeriods.map((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            // Convert UTC dates to local time for datetime-local input
            const formatDateForInput = (dateString: string) => {
              const date = new Date(dateString);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              return `${year}-${month}-${day}T${hours}:${minutes}`;
            };

            return {
              name: p.name,
              startDate: p.startDate ? formatDateForInput(p.startDate) : '',
              endDate: p.endDate ? formatDateForInput(p.endDate) : '',
              finalizeDate: p.finalizeDate ? formatDateForInput(p.finalizeDate) : '',
              status: p.status,
              top200Only: p.top200Only || false,
            };
          }));
        }

        // Load counting races if auctioneer game
        if (game.gameType === 'auctioneer' && game.config?.countingRaces) {
          setCountingRaces(game.config.countingRaces);
        }

        // Load counting classifications if auctioneer game
        if (game.gameType === 'auctioneer' && game.config?.countingClassifications) {
          setCountingClassifications(game.config.countingClassifications);
        }
      } catch (error: unknown) {
        console.error('Error loading game:', error);
        setError(error instanceof Error ? error.message : 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [gameId, reset]);

  // Load available races when year changes
  useEffect(() => {
    const loadRaces = async () => {
      if (!gameYear || gameType !== 'auctioneer') return;
      
      setLoadingRaces(true);
      try {
        const response = await fetch(`/api/scraper/races?year=${gameYear}`);
        if (response.ok) {
          const data = await response.json();
          setAvailableRaces(data.races || []);
        }
      } catch (error) {
        console.error('Error loading races:', error);
      } finally {
        setLoadingRaces(false);
      }
    };

    loadRaces();
  }, [gameYear, gameType]);

  const addAuctionPeriod = () => {
    setAuctionPeriods([...auctionPeriods, { name: '', startDate: '', endDate: '', finalizeDate: '', status: 'pending', top200Only: false }]);
  };

  const removeAuctionPeriod = (index: number) => {
    setAuctionPeriods(auctionPeriods.filter((_, i) => i !== index));
  };

  const updateAuctionPeriod = <K extends keyof AuctionPeriodInput>(
    index: number,
    field: K,
    value: AuctionPeriodInput[K]
  ) => {
    const updated = [...auctionPeriods];
    updated[index][field] = value;
    setAuctionPeriods(updated);
  };

  const addCountingRace = (raceId: string) => {
    const race = availableRaces.find(r => r.id === raceId);
    if (!race) return;

    // Check if race is already added
    if (countingRaces.some(r => r.raceId === raceId)) {
      setError('This race is already added');
      return;
    }

    // Set default multipliers based on race slug
    let mountainMultiplier = 4; // Default for Tour
    const sprintMultiplier = 2;
    
    if (race.slug.includes('giro')) {
      mountainMultiplier = 2; // Giro uses 2x
    }

    setCountingRaces([...countingRaces, {
      raceId: race.id,
      raceSlug: race.slug,
      raceName: race.name,
      restDays: [],
      mountainPointsMultiplier: mountainMultiplier,
      sprintPointsMultiplier: sprintMultiplier,
    }]);
  };

  const removeCountingRace = (index: number) => {
    setCountingRaces(countingRaces.filter((_, i) => i !== index));
  };

  const updateCountingRace = <K extends keyof CountingRaceInput>(
    index: number,
    field: K,
    value: CountingRaceInput[K]
  ) => {
    const updated = [...countingRaces];
    updated[index][field] = value;
    setCountingRaces(updated);
  };

  const onSubmit: SubmitHandler<GameFormData> = async (data) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updates: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
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
          auctionPeriods: auctionPeriods.map(period => {
            // datetime-local gives us "2025-12-14T00:00" format
            // We need to treat this as local time (browser timezone)
            // Don't append 'Z' - let the browser interpret it as local time
            const startDate = new Date(period.startDate + ':00');
            const endDate = new Date(period.endDate + ':00');
            const finalizeDate = period.finalizeDate ? new Date(period.finalizeDate + ':00') : undefined;

            return {
              name: period.name,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              finalizeDate: finalizeDate?.toISOString(),
              status: period.status,
              top200Only: period.top200Only || false,
            };
          }),
          auctionStatus: auctionPeriods.some(p => p.status === 'active') ? 'active' :
                        auctionPeriods.every(p => p.status === 'closed') ? 'closed' : 'pending',
          countingRaces: countingRaces.length > 0 ? countingRaces : undefined,
          countingClassifications: countingClassifications.length > 0 ? countingClassifications : undefined,
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
    } catch (error: unknown) {
      console.error('Error updating game:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong updating the game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: 'draft', label: t('games.statuses.draft') },
    { value: 'registration', label: t('games.statuses.registration') },
    { value: 'bidding', label: t('games.statuses.bidding') },
    { value: 'active', label: t('games.statuses.active') },
    { value: 'finished', label: t('games.statuses.finished') },
  ];

  const AUCTION_STATUS_OPTIONS = [
    { value: 'pending', label: t('games.auctionStatuses.pending') },
    { value: 'active', label: t('games.auctionStatuses.active') },
    { value: 'closed', label: t('games.auctionStatuses.closed') },
    { value: 'finalized', label: t('games.auctionStatuses.finalized') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{t('games.editGame')}</h2>
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
            <div className="text-center py-8 text-gray-600">{t('games.loading')}</div>
          )}

          {!loading && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Game Name */}
              <div>
                <TextInput
                  label={t('games.name')}
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
                        No auction periods added. Click &quot;+ Add Period&quot; to add one.
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

                            <div className="grid grid-cols-2 gap-2">
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
                                <label className="block text-xs text-gray-600 mb-1">
                                  Finalize Date & Time (optional)
                                </label>
                                <input
                                  type="datetime-local"
                                  value={period.finalizeDate || ''}
                                  onChange={(e) => updateAuctionPeriod(index, 'finalizeDate', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  {period.finalizeDate
                                    ? 'Status will be managed automatically'
                                    : 'Leave empty for manual finalization'}
                                </p>
                              </div>
                              {!period.finalizeDate && (
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
                                  <p className="text-xs text-gray-500 mt-1">
                                    Manual status control
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Top 200 Only Checkbox */}
                            <div className="mt-3">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={period.top200Only || false}
                                  onChange={(e) => updateAuctionPeriod(index, 'top200Only', e.target.checked)}
                                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary"
                                />
                                <span className="text-sm text-gray-700">
                                  Only top 200 riders (users can only bid on riders in top 200)
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Counting Races */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Counting Races (optional)
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Select which races count for points. All stages of selected races will count. Leave empty to count all races.
                    </p>

                    {loadingRaces && (
                      <p className="text-sm text-gray-500 mb-2">Loading races...</p>
                    )}

                    {!loadingRaces && availableRaces.length === 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                        <p className="text-sm text-yellow-800">
                          No races found for {gameYear}. Please scrape races first from the admin panel.
                        </p>
                      </div>
                    )}

                    {!loadingRaces && availableRaces.length > 0 && (
                      <div className="mb-3">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addCountingRace(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">+ Add Race</option>
                          {availableRaces
                            .filter(race => !countingRaces.some(cr => cr.raceId === race.id))
                            .map((race) => (
                              <option key={race.id} value={race.id}>
                                {race.name} ({race.classification}) - {new Date(race.startDate).toLocaleDateString()}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {countingRaces.length === 0 && (
                      <p className="text-sm text-gray-500 mb-2">
                        No races selected. All races will count for points.
                      </p>
                    )}

                    <div className="space-y-3">
                      {countingRaces.map((race, index) => (
                        <div key={index} className="border border-gray-300 rounded-md p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-sm font-medium text-gray-700">{race.raceName}</span>
                            <button
                              type="button"
                              onClick={() => removeCountingRace(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          {/* Rest Days */}
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-1">
                              Rustdagen (stage numbers, comma separated)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., 9, 16"
                              value={race.restDays?.join(', ') || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                const restDays = value
                                  .split(',')
                                  .map(s => parseInt(s.trim()))
                                  .filter(n => !isNaN(n));
                                updateCountingRace(index, 'restDays', restDays);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              GC punten worden toegekend op rustdagen (1x eerste, 2x tweede) en eindstand (3x)
                            </p>
                          </div>

                          {/* Multipliers */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Berg Multiplier
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="4"
                                value={race.mountainPointsMultiplier || ''}
                                onChange={(e) => updateCountingRace(index, 'mountainPointsMultiplier', parseInt(e.target.value) || 4)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Tour: 4x, Giro: 2x
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Sprint Multiplier
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="2"
                                value={race.sprintPointsMultiplier || ''}
                                onChange={(e) => updateCountingRace(index, 'sprintPointsMultiplier', parseInt(e.target.value) || 2)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Standaard: 2x
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Counting Classifications */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Race Classifications (optional)
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Select race classifications to automatically include all races with those classifications. Works together with specific race selection above.
                    </p>

                    <div className="mb-3">
                      <select
                        onChange={(e) => {
                          if (e.target.value && !countingClassifications.includes(e.target.value)) {
                            setCountingClassifications([...countingClassifications, e.target.value]);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">+ Add Classification</option>
                        <option value="wc">World Championship (wc)</option>
                        <option value="cc">Continental Championship (cc)</option>
                        <option value="nc">National Championship (nc)</option>
                        <option value="1.uwt">1.UWT</option>
                        <option value="2.uwt">2.UWT</option>
                        <option value="1.pro">1.Pro</option>
                        <option value="2.pro">2.Pro</option>
                        <option value="1.1">1.1</option>
                        <option value="1.2">1.2</option>
                        <option value="2.1">2.1</option>
                        <option value="2.2">2.2</option>
                      </select>
                    </div>

                    {countingClassifications.length === 0 && (
                      <p className="text-sm text-gray-500 mb-2">
                        No classifications selected.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {countingClassifications.map((classification, index) => (
                        <div key={index} className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                          <span className="font-medium">{classification}</span>
                          <button
                            type="button"
                            onClick={() => setCountingClassifications(countingClassifications.filter((_, i) => i !== index))}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
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
