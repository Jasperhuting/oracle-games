'use client'

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { PlayerSelector } from "./PlayerSelector";
import { MyTeamSelection } from "./MyTeamSelection";
import { Rider } from "@/lib/types/rider";
import { useRankings } from "@/contexts/RankingsContext";
import { useTranslation } from "react-i18next";

interface TeamSelectionModalProps {
  gameId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface GameData {
  id: string;
  name: string;
  gameType: string;
  config: {
    budget?: number;
    maxRiders?: number;
    minRiders?: number;
    teamSize?: number;
  };
  eligibleRiders: string[];
}

interface ParticipantData {
  id: string;
  budget?: number;
  spentBudget?: number;
  rosterSize: number;
  rosterComplete: boolean;
}

export const TeamSelectionModal = ({ gameId, onClose, onSuccess }: TeamSelectionModalProps) => {
  const { user } = useAuth();
  const { riders: rankingsRiders, refetch: refetchRankings } = useRankings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
  const [selectedRiders, setSelectedRiders] = useState<Rider[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [spentBudget, setSpentBudget] = useState<number>(0);

  const { t } = useTranslation(); 

  useEffect(() => {
    const loadGameData = async () => {
      if (!user) return;

      try {
        // Load game details
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (!gameResponse.ok) {
          throw new Error('Failed to load game');
        }
        const gameData = await gameResponse.json();
        setGame(gameData.game);

        // Load participant data
        const participantResponse = await fetch(`/api/gameParticipants?userId=${user.uid}&gameId=${gameId}`);
        if (!participantResponse.ok) {
          throw new Error('Failed to load participant data');
        }
        const participantData = await participantResponse.json();

        if (participantData.participants.length > 0) {
          const p = participantData.participants[0];
          setParticipant(p);
          setBudget(p.budget || gameData.game.config?.budget || 0);
          setSpentBudget(p.spentBudget || 0);
        }

        // Load eligible riders from context
        if (rankingsRiders.length === 0) {
          await refetchRankings();
        }

        // Filter to only eligible riders if specified
        let riders = rankingsRiders;
        if (gameData.game.eligibleRiders && gameData.game.eligibleRiders.length > 0) {
          const eligibleSet = new Set(gameData.game.eligibleRiders);
          riders = riders.filter((r: Rider) => eligibleSet.has(r.nameID || r.id || ''));
        }

        setAvailableRiders(riders);

        // Load current team selection
        const teamResponse = await fetch(`/api/games/${gameId}/team?userId=${user.uid}`);
        if (teamResponse.ok) {
          const teamData = await teamResponse.json();
          if (teamData.riders) {
            setSelectedRiders(teamData.riders);
          }
        }
      } catch (error) {
        console.error('Error loading game data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, user]);

  const handleRiderToggle = (newRiders: Rider[]) => {
    setSelectedRiders(newRiders);
  };

  const handleSave = async () => {
    if (!user || !participant) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          participantId: participant.id,
          riders: selectedRiders.map(r => ({
            nameId: r.nameID || r.id,
            name: r.name,
            team: r.team || '',
            country: r.country,
            rank: r.rank,
            points: r.points,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save team');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving team:', error);
      setError(error instanceof Error ? error.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const getRemainingBudget = () => {
    if (!game?.config?.budget) return null;
    return budget - spentBudget;
  };

  const getMaxRiders = () => {
    return game?.config?.maxRiders || game?.config?.teamSize || null;
  };

  const getMinRiders = () => {
    return game?.config?.minRiders || null;
  };

  const canSave = () => {
    const maxRiders = getMaxRiders();
    const minRiders = getMinRiders();

    // Check roster size constraints
    if (maxRiders && selectedRiders.length > maxRiders) return false;
    if (minRiders && selectedRiders.length < minRiders) return false;

    // Check if team has changed
    return selectedRiders.length > 0;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  const remainingBudget = getRemainingBudget();
  const maxRiders = getMaxRiders();
  const minRiders = getMinRiders();

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Select Your Team</h2>
            <p className="text-sm text-gray-600 mt-1">{game.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Stats Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="flex gap-6 items-center">
            <div>
              <span className="text-sm font-medium text-gray-700">Roster Size:</span>
              <span className={`ml-2 text-lg font-bold ${
                maxRiders && selectedRiders.length > maxRiders ? 'text-red-600' :
                minRiders && selectedRiders.length < minRiders ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {selectedRiders.length}
                {maxRiders && ` / ${maxRiders}`}
              </span>
              {minRiders && (
                <span className="ml-1 text-xs text-gray-500">
                  (min: {minRiders})
                </span>
              )}
            </div>

            {remainingBudget !== null && (
              <div>
                <span className="text-sm font-medium text-gray-700">Budget Remaining:</span>
                <span className={`ml-2 text-lg font-bold ${
                  remainingBudget < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {remainingBudget.toFixed(1)}
                </span>
                <span className="ml-1 text-xs text-gray-500">
                  / {budget}
                </span>
              </div>
            )}

            <div className="ml-auto">
              <span className="text-sm text-gray-600">
                Game Type: <span className="font-medium">{game.gameType}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-3">Select Riders</h3>
            <p className="text-sm text-gray-600 mb-3">
              Search and click riders to add them to your team. Selected riders are highlighted.
              {maxRiders && ` Maximum ${maxRiders} riders.`}
              {minRiders && ` Minimum ${minRiders} riders.`}
            </p>
            <PlayerSelector
              selectedPlayers={selectedRiders}
              setSelectedPlayers={handleRiderToggle}
              multiSelect={true}
              multiSelectShowSelected={false}
              items={availableRiders}
            />
          </div>

          {selectedRiders.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                Your Team ({selectedRiders.length} riders)
              </h3>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 p-3 bg-gray-100 font-semibold text-sm border-b border-gray-200">
                  <div className="col-span-1">{t('global.rank')}</div>
                  <div className="col-span-4">{t('global.name')}</div>
                  <div className="col-span-3">{t('global.team')}</div>
                  <div className="col-span-2">{t('global.points')}</div>
                  <div className="col-span-1">{t('global.country')}</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Riders List */}
                <div className="max-h-[300px] overflow-y-auto">
                  {selectedRiders.map((rider, index) => (
                    <div
                      key={rider.id || index}
                      className="grid grid-cols-12 gap-4 p-3 border-b border-gray-100 hover:bg-gray-50 items-center"
                    >
                      <div className="col-span-1 text-sm">{rider.rank || '-'}</div>
                      <div className="col-span-4 text-sm font-medium truncate" title={rider.name}>
                        {rider.name}
                      </div>
                      <div className="col-span-3 text-sm text-gray-600 truncate" title={rider.team?.name}>
                        {rider.team?.name || '-'}
                      </div>
                      <div className="col-span-2 text-sm">{rider.points || 0}</div>
                      <div className="col-span-1 text-sm">{rider.country}</div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => {
                            setSelectedRiders(selectedRiders.filter(r =>
                              !(r.name === rider.name && r.rank === rider.rank)
                            ));
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedRiders.length === 0 ? 'No riders selected' :
             !canSave() && maxRiders && selectedRiders.length > maxRiders ? `Too many riders (max ${maxRiders})` :
             !canSave() && minRiders && selectedRiders.length < minRiders ? `Not enough riders (min ${minRiders})` :
             'Team ready to save'}
          </div>
          <div className="space-x-3">
            <Button
              text="Cancel"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
            />
            <Button
              text={saving ? "Saving..." : "Save Team"}
              onClick={handleSave}
              disabled={saving || !canSave()}
              className="px-4 py-2 bg-primary hover:bg-primary"
            />
          </div>
        </div>
      </div>

      {/* Floating Team Panel */}
      {selectedRiders.length > 0 && (
        <MyTeamSelection
          myTeamSelection={selectedRiders}
          setMyTeamSelection={setSelectedRiders}
        />
      )}
    </div>
  );
};
