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
}

interface GameFormData {
  name: string;
  gameType: GameType;
  raceType: 'season' | 'grand-tour' | 'classics' | 'single-race';
  raceSlug?: string;
  year: number;
  divisionCount?: number;
  maxPlayers?: number;
  bidding: boolean;

  // Auctioneer config
  budget?: number;
  maxRiders?: number;
  maxMinimumBid?: number;
  allowSharedRiders?: boolean;
  maxOwnersPerRider?: number;

  // WorldTour Manager config
  wtmBudget?: number;
  wtmMinRiders?: number;
  wtmMaxRiders?: number;
  wtmMaxNeoProPoints?: number;
  wtmMaxNeoProAge?: number;

  // Marginal Gains config
  mgTeamSize?: number;
  mgCurrentYear?: number;

  // F1 Prediction config
  f1Season?: number;
  f1RegistrationDeadline?: string;

  // Full Grid config
  fgBudget?: number;
  fgMaxRiders?: number;
}

interface Race {
  id: string;
  name: string;
  year: number;
  slug: string;
}

export const CreateGameTab = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [selectedGameType, setSelectedGameType] = useState<GameType | ''>('');
  const [auctionPeriods, setAuctionPeriods] = useState<AuctionPeriodInput[]>([]);
  const [allowSharedRiders, setAllowSharedRiders] = useState(false);
  const { t } = useTranslation();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<GameFormData>({
    defaultValues: {
      raceType: 'grand-tour',
    }
  });

  // Watch game type, race type, and race to auto-generate game name
  const watchGameType = watch('gameType');
  const watchRaceType = watch('raceType');
  const watchRaceSlug = watch('raceSlug');

  useEffect(() => {
    setSelectedGameType(watchGameType as GameType);
  }, [watchGameType]);

  // Auto-generate game name when game type, race type, or race changes
  useEffect(() => {
    let generatedName = '';

    // Get the game type label if selected
    const gameTypeLabel = watchGameType
      ? GAME_TYPE_OPTIONS.find(opt => opt.value === watchGameType)?.label.split(' - ')[0] || watchGameType
      : '';

    // Get the race info if selected
    const selectedRace = watchRaceSlug ? races.find(r => r.slug === watchRaceSlug) : null;
    const racePart = selectedRace ? `${selectedRace.name} ${selectedRace.year}` : '';

    // For season games without a specific race, use the race type
    const seasonPart = watchRaceType === 'season' && !racePart ? 'Season' : '';

    // Generate name based on what's available
    if (gameTypeLabel && racePart) {
      generatedName = `${gameTypeLabel} - ${racePart}`;
    } else if (gameTypeLabel && seasonPart) {
      generatedName = `${gameTypeLabel} - ${seasonPart}`;
    } else if (gameTypeLabel) {
      generatedName = gameTypeLabel;
    } else if (racePart) {
      generatedName = racePart;
    }

    if (generatedName) {
      setValue('name', generatedName);
    }
  }, [watchGameType, watchRaceType, watchRaceSlug, races, setValue]);

  // Load available races
  useEffect(() => {
    const loadRaces = async () => {
      if (!user) {
        setLoadingRaces(false);
        return;
      }

      try {
        const response = await fetch(`/api/getRaces?userId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          setRaces(data.races || []);
        }
      } catch (error) {
        console.error('Error loading races:', error);
      } finally {
        setLoadingRaces(false);
      }
    };

    loadRaces();
  }, [user]);

  const addAuctionPeriod = () => {
    setAuctionPeriods([...auctionPeriods, { name: '', startDate: '', endDate: '', finalizeDate: '' }]);
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
    setSuccess(null);

    try {
      // Build config based on game type
      let config: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

      if (data.gameType === 'auctioneer') {
        // Validate auction periods
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

        config = {
          budget: Number(data.budget) || 100,
          maxRiders: Number(data.maxRiders) || 8,
          maxMinimumBid: data.maxMinimumBid ? Number(data.maxMinimumBid) : undefined,
          allowSharedRiders: data.allowSharedRiders || false,
          maxOwnersPerRider: data.allowSharedRiders && data.maxOwnersPerRider ? Number(data.maxOwnersPerRider) : undefined,
          auctionPeriods: auctionPeriods.map(period => {
            // datetime-local gives us "2025-12-14T00:00" format
            // We need to treat this as the actual UTC time, not local time
            // So we append 'Z' to indicate UTC timezone
            const startDate = new Date(period.startDate + ':00Z');
            const endDate = new Date(period.endDate + ':00Z');
            const finalizeDate = period.finalizeDate ? new Date(period.finalizeDate + ':00Z') : undefined;

            return {
              name: period.name,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              finalizeDate: finalizeDate?.toISOString(),
              status: 'pending',
            };
          }),
          auctionStatus: 'pending',
        };
      } else if (data.gameType === 'worldtour-manager') {
        // Validate auction periods for WorldTour Manager
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

        config = {
          budget: Number(data.wtmBudget) || 12000,
          minRiders: Number(data.wtmMinRiders) || 27,
          maxRiders: Number(data.wtmMaxRiders) || 32,
          maxNeoProPoints: data.wtmMaxNeoProPoints ? Number(data.wtmMaxNeoProPoints) : undefined,
          maxNeoProAge: data.wtmMaxNeoProAge ? Number(data.wtmMaxNeoProAge) : 21,
          auctionPeriods: auctionPeriods.map(period => {
            // datetime-local gives us "2025-12-14T00:00" format
            // We need to treat this as the actual UTC time, not local time
            // So we append 'Z' to indicate UTC timezone
            const startDate = new Date(period.startDate + ':00Z');
            const endDate = new Date(period.endDate + ':00Z');
            const finalizeDate = period.finalizeDate ? new Date(period.finalizeDate + ':00Z') : undefined;

            return {
              name: period.name,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              finalizeDate: finalizeDate?.toISOString(),
              status: 'pending',
            };
          }),
          auctionStatus: 'pending',
        };
      } else if (data.gameType === 'slipstream') {
        // Slipstream config - races are added later via admin interface
        config = {
          allowReuse: false,
          countingRaces: [],
          penaltyMinutes: 1,
          pickDeadlineMinutes: 60,
          greenJerseyPoints: {
            1: 10, 2: 9, 3: 8, 4: 7, 5: 6,
            6: 5, 7: 4, 8: 3, 9: 2, 10: 1
          }
        };
      } else if (data.gameType === 'marginal-gains') {
        config = {
          teamSize: Number(data.mgTeamSize) || 20,
          currentYear: Number(data.mgCurrentYear) || new Date().getFullYear(),
          auctionPeriods: auctionPeriods.length > 0 ? auctionPeriods.map(period => {
            const startDate = new Date(period.startDate + ':00Z');
            const endDate = new Date(period.endDate + ':00Z');
            const finalizeDate = period.finalizeDate ? new Date(period.finalizeDate + ':00Z') : undefined;

            return {
              name: period.name,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              finalizeDate: finalizeDate?.toISOString(),
              status: 'pending',
            };
          }) : undefined,
          auctionStatus: auctionPeriods.length > 0 ? 'pending' : undefined,
        };
      } else if (data.gameType === 'f1-prediction') {
        config = {
          season: Number(data.year) || 2026,
          registrationOpen: true,
          registrationDeadline: data.f1RegistrationDeadline
            ? new Date(data.f1RegistrationDeadline + ':00Z').toISOString()
            : undefined,
          maxParticipants: data.maxPlayers ? Number(data.maxPlayers) : undefined,
        };
      } else if (data.gameType === 'full-grid') {
        // Validate auction periods for Full Grid
        if (auctionPeriods.length === 0) {
          setError('Please add at least one selection period');
          setIsSubmitting(false);
          return;
        }

        const invalidPeriod = auctionPeriods.find(p => !p.name || !p.startDate || !p.endDate);
        if (invalidPeriod) {
          setError('All selection periods must have a name, start date, and end date');
          setIsSubmitting(false);
          return;
        }

        config = {
          budget: Number(data.fgBudget) || 70,
          maxRiders: Number(data.fgMaxRiders) || 22,
          riderValues: {}, // Will be populated later via admin interface
          selectionStatus: 'open',
          auctionPeriods: auctionPeriods.map(period => {
            const startDate = new Date(period.startDate + ':00Z');
            const endDate = new Date(period.endDate + ':00Z');
            const finalizeDate = period.finalizeDate ? new Date(period.finalizeDate + ':00Z') : undefined;

            return {
              name: period.name,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              finalizeDate: finalizeDate?.toISOString(),
              status: 'pending',
            };
          }),
          auctionStatus: 'pending',
        };
      }
      // Add more game type configs here as needed

      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          name: data.name,
          gameType: data.gameType,
          raceSlug: data.raceSlug || undefined, // Optional for season games
          raceType: data.raceType,
          year: Number(data.year),
          status: 'draft',
          divisionCount: data.divisionCount,
          bidding: data.gameType === 'auctioneer',
          maxPlayers: data.maxPlayers ? Number(data.maxPlayers) : undefined,
          eligibleTeams: [], // TODO: set based on race lineup
          eligibleRiders: [], // TODO: set based on race lineup
          config,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not create game');
      }

      const result = await response.json();

      // Handle multiple division games response
      if (result.gamesCreated && result.gamesCreated > 1) {
        setSuccess(`Successfully created ${result.gamesCreated} division games!`);
      } else {
        setSuccess(`Game "${result.game.name}" successfully created!`);
      }

      reset();
      setSelectedGameType('');
      setAuctionPeriods([]);
      setAllowSharedRiders(false);
    } catch (error: unknown) {
      console.error('Error creating game:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong creating the game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const GAME_TYPE_OPTIONS = [
    { value: 'auctioneer', label: 'Auctioneer - Bid on riders' },
    { value: 'slipstream', label: 'Slipstream - Pick per stage' },
    { value: 'last-man-standing', label: 'Last Man Standing - Elimination' },
    { value: 'poisoned-cup', label: 'Poisoned Cup - Snake Draft' },
    { value: 'nations-cup', label: 'Nations Cup - By country/region' },
    { value: 'rising-stars', label: 'Rising Stars - Growth potential' },
    { value: 'country-roads', label: 'Country Roads - Pool system' },
    { value: 'worldtour-manager', label: 'WorldTour Manager - Full team' },
    { value: 'marginal-gains', label: 'Marginal Gains - Season improvement' },
    { value: 'fan-flandrien', label: 'Fan Flandrien - Predict top 15' },
    { value: 'full-grid', label: 'Full Grid - Budget riders' },
    { value: 'f1-prediction', label: 'F1 Prediction - Voorspel F1 races' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Game</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Game Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Game Type *
            </label>
            <select
              {...register('gameType', {
                required: 'Game type is required'
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a game type</option>
              {GAME_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.gameType && (
              <span className="text-red-500 text-xs mt-1 block">{errors.gameType.message}</span>
            )}
          </div>

          {/* Race Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Race Type *
            </label>
            <select
              {...register('raceType', {
                required: 'Race type is required'
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="grand-tour">Grand Tour</option>
              <option value="classics">Classics</option>
              <option value="single-race">Single Race</option>
              <option value="season">Season</option>
            </select>
            {errors.raceType && (
              <span className="text-red-500 text-xs mt-1 block">{errors.raceType.message}</span>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select &quot;Season&quot; for games that span the entire season without a specific race.
            </p>
          </div>

          {/* Race Selection - Only show if not season type */}
          {watchRaceType !== 'season' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Race *
              </label>
              <select
                {...register('raceSlug', {
                  validate: (value) => {
                    const raceType = watch('raceType');
                    if (raceType !== 'season' && !value) {
                      return 'Race is required';
                    }
                    return true;
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loadingRaces}
              >
                <option value="">
                  {loadingRaces ? 'Loading races...' : 'Select a race'}
                </option>
                {races.map((race) => (
                  <option key={race.id} value={race.id}>
                    {race.name} {race.year}
                  </option>
                ))}
              </select>
              {errors.raceSlug && (
                <span className="text-red-500 text-xs mt-1 block">{errors.raceSlug.message}</span>
              )}
            </div>
          )}

          {/* Game Name */}
          <div>
            <TextInput
              label="Game Name"
              placeholder={`E.g. Auctioneer - Tour de France 2026`}
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
            <p className="text-xs text-gray-500 mt-1">
              Auto-populated based on Game Type and Race. Changing either dropdown will regenerate the name.
            </p>
          </div>

          {/* Year */}
          <div>
            <TextInput
              type="number"
              label={t('global.year')}
              placeholder={`E.g. 2026`}
              {...register('year', {
                required: 'Year is required',
                valueAsNumber: true,
                min: {
                  value: 2020,
                  message: 'Year must be at least 2020'
                },
                max: {
                  value: 2030,
                  message: 'Year cannot exceed 2030'
                }
              })}
            />
            {errors.year && (
              <span className="text-red-500 text-xs mt-1 block">{errors.year.message}</span>
            )}
          </div>

          {/* Division Settings */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-700">Division Settings</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Divisions
              </label>
              <select
                {...register('divisionCount', {
                  valueAsNumber: true,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select division configuration</option>
                <option value="1">Single Division - Players auto-join</option>
                <option value="2">2 Divisions - Separate games created automatically</option>
                <option value="3">3 Divisions - Separate games created automatically</option>
                <option value="4">4 Divisions - Separate games created automatically</option>
                <option value="5">5 Divisions - Separate games created automatically</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Single division: one game created. Multiple divisions: creates separate games automatically (e.g., &quot;Game Name - Division 1&quot;, &quot;Game Name - Division 2&quot;).
              </p>
            </div>
          </div>

          {/* Max Players */}
          <div>
            <TextInput
              type="number"
              label="Maximum Number of Players (optional)"
              placeholder="E.g. 50"
              {...register('maxPlayers', {
                valueAsNumber: true,
                min: {
                  value: 2,
                  message: 'At least 2 players required'
                }
              })}
            />
          </div>

          {/* Auctioneer Specific Fields */}
          {selectedGameType === 'auctioneer' && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Auctioneer Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    type="number"
                    label="Budget per Player"
                    placeholder="E.g. 100"
                    defaultValue="100"
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
                    defaultValue="8"
                    {...register('maxRiders', {
                      min: {
                        value: 1,
                        message: 'At least 1 rider required'
                      }
                    })}
                  />
                </div>
              </div>

              <div>
                <TextInput
                  type="number"
                  label="Maximum Minimum Bid (optional)"
                  placeholder="E.g. 3000"
                  {...register('maxMinimumBid', {
                    min: {
                      value: 1,
                      message: 'Maximum minimum bid must be at least 1'
                    }
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cap the minimum bid amount. Example: If a rider is worth 4921 points but you set this to 3000,
                  the minimum bid will be 3000 instead of 4921. Leave empty for no cap.
                </p>
              </div>

              {/* Shared Riders Configuration */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-md font-semibold text-gray-700">Shared Rider Ownership</h4>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="allowSharedRiders"
                    {...register('allowSharedRiders')}
                    onChange={(e) => setAllowSharedRiders(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <label htmlFor="allowSharedRiders" className="text-sm font-medium text-gray-700">
                    Allow multiple players to buy the same rider
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Enable this for season games where multiple players can own the same rider simultaneously.
                </p>

                {allowSharedRiders && (
                  <div>
                    <TextInput
                      type="number"
                      label="Maximum Owners per Rider (optional)"
                      placeholder="E.g. 5"
                      {...register('maxOwnersPerRider', {
                        min: {
                          value: 2,
                          message: 'Must be at least 2 if specified'
                        }
                      })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Limit how many players can own the same rider. Leave empty for unlimited.
                      Example: Set to 5 to allow up to 5 players to own the same rider.
                    </p>
                  </div>
                )}
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
                          <div className="col-span-2">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* WorldTour Manager Specific Fields */}
          {selectedGameType === 'worldtour-manager' && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">WorldTour Manager Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    type="number"
                    label="Total Budget (points)"
                    placeholder="E.g. 12000"
                    defaultValue="12000"
                    {...register('wtmBudget', {
                      min: {
                        value: 1,
                        message: 'Budget must be at least 1'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Total budget in ranking points (e.g., 12000 points from 2025 ranking)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    type="number"
                    label="Min Riders"
                    placeholder="E.g. 27"
                    defaultValue="27"
                    {...register('wtmMinRiders', {
                      min: {
                        value: 1,
                        message: 'At least 1 rider required'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tot {'{minRiders}'} renners: geen restricties
                  </p>
                </div>
                <div>
                  <TextInput
                    type="number"
                    label="Max Riders"
                    placeholder="E.g. 32"
                    defaultValue="32"
                    {...register('wtmMaxRiders', {
                      min: {
                        value: 1,
                        message: 'At least 1 rider required'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Bij {'{minRiders+1}'}+ renners: minimaal 1 neoprof vereist
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    type="number"
                    label="Max Points per Neo-Pro (optional)"
                    placeholder="E.g. 250"
                    {...register('wtmMaxNeoProPoints', {
                      min: {
                        value: 0,
                        message: 'Cannot be negative'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum points a neo-professional can have earned in current year (e.g., 250)
                  </p>
                </div>
                <div>
                  <TextInput
                    type="number"
                    label="Max Neo-Pro Age"
                    placeholder="E.g. 21"
                    defaultValue="21"
                    {...register('wtmMaxNeoProAge', {
                      min: {
                        value: 18,
                        message: 'Age must be at least 18'
                      },
                      max: {
                        value: 25,
                        message: 'Age cannot exceed 25'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum age for neo-professionals (e.g., 21 years old)
                  </p>
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
                            placeholder="Period name (e.g., Pre-season, Mid-season)"
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
                          <div className="col-span-2">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Marginal Gains Specific Fields */}
          {selectedGameType === 'marginal-gains' && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Marginal Gains Configuration</h3>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Game Concept:</strong> Find the 20 riders who gain the most points compared to the previous season.
                  Riders start with <strong>negative</strong> points equal to their ranking from the start of the current year.
                  During the season, they work towards positive territory. The team with the most improvement wins!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    type="number"
                    label="Team Size"
                    placeholder="E.g. 20"
                    defaultValue="20"
                    {...register('mgTeamSize', {
                      min: {
                        value: 1,
                        message: 'Team size must be at least 1'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of riders each player can select
                  </p>
                </div>

                <div>
                  <TextInput
                    type="number"
                    label="Season Year"
                    placeholder="E.g. 2026"
                    defaultValue={new Date().getFullYear().toString()}
                    {...register('mgCurrentYear', {
                      min: {
                        value: 2024,
                        message: 'Year must be 2024 or later'
                      },
                      max: {
                        value: 2030,
                        message: 'Year cannot exceed 2030'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The current season year (starting points come from rankings_{'{year}'}
                  </p>
                </div>
              </div>

              {/* Auction Periods (Optional) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selection Periods (Optional)
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
                    No selection periods added. Click &quot;+ Add Period&quot; to add one.
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

                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Period Name
                          </label>
                          <input
                            type="text"
                            value={period.name}
                            onChange={(e) => updateAuctionPeriod(index, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                            placeholder="E.g., Initial Selection"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Start Date & Time (UTC)
                          </label>
                          <input
                            type="datetime-local"
                            value={period.startDate}
                            onChange={(e) => updateAuctionPeriod(index, 'startDate', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            End Date & Time (UTC)
                          </label>
                          <input
                            type="datetime-local"
                            value={period.endDate}
                            onChange={(e) => updateAuctionPeriod(index, 'endDate', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Finalize Date & Time (UTC, Optional)
                          </label>
                          <input
                            type="datetime-local"
                            value={period.finalizeDate || ''}
                            onChange={(e) => updateAuctionPeriod(index, 'finalizeDate', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            When to automatically finalize selections
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Slipstream Specific Fields */}
          {selectedGameType === 'slipstream' && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Slipstream Configuration</h3>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Game Concept:</strong> Kies per wedstrijd één renner en neem diens tijdverlies over.
                  Het doel is om over alle wedstrijden het minste tijd te verliezen (Gele trui)
                  of de meeste punten te scoren (Groene trui: top 10 krijgt 10-1 punten).
                  <br /><br />
                  <strong>Regels:</strong> Elke renner mag maar één keer gekozen worden.
                  Deadline is 1 uur voor de start.
                  DNF/DNS/gemiste keuze = straftijd (tijd laatst gefinishte + 1 minuut).
                </p>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                <strong>Na het aanmaken:</strong> Ga naar Admin &rarr; Games Management &rarr; klik op &quot;View&quot; bij de game
                om wedstrijden toe te voegen aan de kalender. Je kunt de standaard 2026 Classics kalender importeren
                of individuele wedstrijden toevoegen.
              </p>
            </div>
          )}

          {/* F1 Prediction Specific Fields */}
          {selectedGameType === 'f1-prediction' && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">F1 Prediction Configuration</h3>

              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Game Concept:</strong> Voorspel de uitslag van elk F1 race weekend.
                  Scoor punten door de juiste posities te voorspellen.
                  <br /><br />
                  <strong>Database:</strong> Deze game wordt aangemaakt in de default database,
                  maar alle voorspellingen en uitslagen worden opgeslagen in de F1 database (oracle-games-f1).
                  Spelers moeten zich eerst aanmelden via een subleague of direct bij de game.
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Registratie Deadline (optioneel)
                </label>
                <input
                  type="datetime-local"
                  {...register('f1RegistrationDeadline')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Na deze datum kunnen nieuwe spelers zich niet meer aanmelden.
                  Laat leeg voor geen deadline.
                </p>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                <strong>Na het aanmaken:</strong> Spelers kunnen zich aanmelden via de F1 pagina.
                Ze moeten geregistreerd zijn voordat ze voorspellingen kunnen invullen.
                Subleagues kunnen gebruikt worden om vrienden uit te nodigen.
              </p>
            </div>
          )}

          {/* Full Grid Specific Fields */}
          {selectedGameType === 'full-grid' && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Full Grid Configuration</h3>

              <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                <p className="text-sm text-green-800">
                  <strong>Spelconcept:</strong> Stel jij het sterkste team samen voor de klassiekers?
                  Selecteer 22 renners binnen een budget van 70 punten.
                  <br /><br />
                  <strong>Regels:</strong> Uit elke ploeg mag je slechts 1 renner kiezen.
                  De admin stelt de waarde van elke renner in via de game management pagina.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <TextInput
                    type="number"
                    label="Budget per Speler"
                    placeholder="E.g. 70"
                    defaultValue="70"
                    {...register('fgBudget', {
                      min: {
                        value: 1,
                        message: 'Budget must be at least 1'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Totaal aantal punten dat spelers mogen besteden
                  </p>
                </div>
                <div>
                  <TextInput
                    type="number"
                    label="Max Renners per Team"
                    placeholder="E.g. 22"
                    defaultValue="22"
                    {...register('fgMaxRiders', {
                      min: {
                        value: 1,
                        message: 'At least 1 rider required'
                      }
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Aantal renners dat geselecteerd moet worden (1 per ploeg)
                  </p>
                </div>
              </div>

              {/* Selection Periods */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selectie Periodes *
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
                    Geen selectie periodes toegevoegd. Klik op &quot;+ Add Period&quot; om er een toe te voegen.
                  </p>
                )}

                <div className="space-y-3">
                  {auctionPeriods.map((period, index) => (
                    <div key={index} className="border border-gray-300 rounded-md p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-700">Periode {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeAuctionPeriod(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Verwijderen
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <input
                            type="text"
                            placeholder="Periode naam (e.g., Selectie Voorjaar)"
                            value={period.name}
                            onChange={(e) => updateAuctionPeriod(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Start Datum & Tijd</label>
                            <input
                              type="datetime-local"
                              value={period.startDate}
                              onChange={(e) => updateAuctionPeriod(index, 'startDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Eind Datum & Tijd</label>
                            <input
                              type="datetime-local"
                              value={period.endDate}
                              onChange={(e) => updateAuctionPeriod(index, 'endDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-600 mb-1">
                              Finalisatie Datum & Tijd (optioneel)
                            </label>
                            <input
                              type="datetime-local"
                              value={period.finalizeDate || ''}
                              onChange={(e) => updateAuctionPeriod(index, 'finalizeDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {period.finalizeDate
                                ? 'Selecties worden automatisch gefinaliseerd op dit moment'
                                : 'Laat leeg voor handmatige finalisatie'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                <strong>Na het aanmaken:</strong> Ga naar Admin &rarr; Games Management &rarr; klik op &quot;View&quot; bij de game
                om renner waarden in te stellen. Je kunt handmatig de waarde per renner invoeren.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          <Button
            className="px-6 py-2 bg-primary hover:bg-primary"
            text={isSubmitting ? "Creating..." : "Create Game"}
            type="submit"
            disabled={isSubmitting || loadingRaces}
          />
        </form>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Create a race via &quot;Add Race&quot; before creating a game</li>
          <li>• Choose a clear name that includes the game type, race, and division</li>
          <li>• For Auctioneer games: add multiple auction periods (e.g., pre-race, mid-race)</li>
          <li>• Each auction period can have different start and end dates</li>
          <li>• After creating the game, you can set the race lineup (which teams/riders participate)</li>
        </ul>
      </div>
    </div>
  );
}
