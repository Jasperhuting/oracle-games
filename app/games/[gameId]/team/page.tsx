'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { PlayerSelector } from "@/components/PlayerSelector";
import { MyTeamSelection } from "@/components/MyTeamSelection";
import { Rider } from "@/lib/types/rider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTranslation } from "react-i18next";
import { useRankings } from "@/contexts/RankingsContext";
import { GameParticipant, Game } from '@/lib/types/games';

export default function TeamSelectionPage({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { riders: rankingsRiders, refetch: refetchRankings } = useRankings();
  const [gameId, setGameId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [participant, setParticipant] = useState<GameParticipant | null>(null);
  const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
  const [selectedRiders, setSelectedRiders] = useState<Rider[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [spentBudget, setSpentBudget] = useState<number>(0);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);
  const { t } = useTranslation();

  console.log('rankingsRiders', rankingsRiders)

  useEffect(() => {
    params.then(p => setGameId(p.gameId));
  }, [params]);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Redirect if not authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    console.log("gameId", gameId)

    if (!gameId) return;

    const loadGameData = async () => {
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

        if (participantData.participants.length === 0) {
          throw new Error('You must join this game before selecting a team');
        }

        const p = participantData.participants[0];
        setParticipant(p);
        setBudget(p.budget || gameData.game.config?.budget || 0);
        setSpentBudget(p.spentBudget || 0);

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
  }, [gameId, user, authLoading, router, rankingsRiders]);

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
            team: r.team?.name || '',
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

      setInfoDialog({
        title: 'Team saved',
        description: 'Team saved successfully!',
      });
      router.push('/games');
    } catch (error) {
      console.error('Error saving team:', error);
      setError(error instanceof Error ? error.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const getRemainingBudget = () => {
  if (!game?.config) return null;
  
  // Type assertion if you're sure about the type
  const config = game.config as { budget?: number };
  if (config.budget !== undefined) {
    return budget - spentBudget;
  }
  
  return null;
};

  const getMaxRiders = () => {
    if (!game?.config) return null;
    const config = game.config as { maxRiders?: number };
    return config.maxRiders || null;
  };

  const getMinRiders = () => {
    if (!game?.config) return null;
    const config = game.config as { minRiders?: number };
    return config.minRiders || null;
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

  // Show loading while auth or game data is loading
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button
            text={t('global.backToGames')}
            onClick={() => router.push('/games')}
            className="px-4 py-2 bg-primary hover:bg-primary"
          />
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Select Your Team</h1>
              <p className="text-sm text-gray-600 mt-1">{game.name}</p>
            </div>
            <Button
              text={t('global.backToGames')}
              onClick={() => router.push('/games')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex gap-6 items-center flex-wrap">
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
      </div>

      {/* Content */}
      <div className="container mx-auto py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Select Riders</h2>
          <p className="text-sm text-gray-600 mb-3">
            Search and click riders to add them to your team. Selected riders are highlighted.
            {maxRiders && ` Maximum ${maxRiders} riders.`}
            {minRiders && ` Minimum ${minRiders} riders.`}
          </p>
          {availableRiders && availableRiders.length > 0 && <PlayerSelector
            selectedPlayers={selectedRiders}
            setSelectedPlayers={handleRiderToggle}
            multiSelect={true}
            multiSelectShowSelected={false}
            items={availableRiders}
          />}
        </div>

        {selectedRiders.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">
              Your Team ({selectedRiders.length} riders)
            </h2>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
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
              <div className="overflow-y-auto">
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
                        className="text-red-600 cursor-pointer hover:text-red-800 text-sm font-medium px-2 py-1"
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

        {/* Save Button */}
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center sticky bottom-0">
          <div className="text-sm text-gray-600">
            {selectedRiders.length === 0 ? 'No riders selected' :
             !canSave() && maxRiders && selectedRiders.length > maxRiders ? `Too many riders (max ${maxRiders})` :
             !canSave() && minRiders && selectedRiders.length < minRiders ? `Not enough riders (min ${minRiders})` :
             'Team ready to save'}
          </div>
          <div className="space-x-3">
            <Button
              text="Cancel"
              onClick={() => router.push('/games')}
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
          game={game}
          myTeamSelection={selectedRiders}
          setMyTeamSelection={setSelectedRiders}
        />
      )}

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
