'use client'

import { useState, useEffect, useEffectEvent } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";

interface Participant {
  id: string;
  playername: string;
  userId: string;
  assignedDivision?: string;
  divisionAssigned?: boolean;
  status: string;
  joinedAt: string;
}

interface Game {
  id: string;
  name: string;
  divisionCount?: number;
}

interface DivisionAssignmentModalProps {
  gameId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DivisionAssignmentModal = ({
  gameId,
  onClose,
  onSuccess,
}: DivisionAssignmentModalProps) => {
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedDivisions, setSelectedDivisions] = useState<Record<string, string>>({});

  const loadData = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load game details
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (!gameResponse.ok) {
        throw new Error('Failed to load game');
      }
      const gameData = await gameResponse.json();
      const loadedGame = gameData.game;
      setGame(loadedGame);

      const divisionCount = loadedGame.divisionCount || 1;
      const isMultiDivision = divisionCount > 1;

      let allParticipants: Participant[] = [];

      if (isMultiDivision) {
        // For multi-division games, load pending participants
        const pendingGameId = `${gameId}-pending`;
        const pendingResponse = await fetch(`/api/gameParticipants?gameId=${pendingGameId}`);
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          allParticipants = [...(pendingData.participants || [])];
        }

        // Also load already assigned participants from all related divisions
        // Get the base name to find related division games
        const gameName = loadedGame.name || '';
        const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();

        // Fetch all games with same base name, year, gameType
        const allGamesResponse = await fetch(
          `/api/games/list?year=${loadedGame.year}&gameType=${loadedGame.gameType}`
        );

        if (allGamesResponse.ok) {
          const allGamesData = await allGamesResponse.json();
          const relatedGames = allGamesData.games.filter((g: any) => {
            const gBaseName = (g.name || '').replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
            return gBaseName === baseName && g.id !== gameId;
          });

          // Fetch participants from each related division
          for (const relatedGame of relatedGames) {
            const relatedResponse = await fetch(`/api/gameParticipants?gameId=${relatedGame.id}`);
            if (relatedResponse.ok) {
              const relatedData = await relatedResponse.json();
              allParticipants = [...allParticipants, ...(relatedData.participants || [])];
            }
          }
        }

        // Also load participants from the current game itself
        const currentResponse = await fetch(`/api/gameParticipants?gameId=${gameId}`);
        if (currentResponse.ok) {
          const currentData = await currentResponse.json();
          allParticipants = [...allParticipants, ...(currentData.participants || [])];
        }
      } else {
        // For single-division games, just load normally
        const participantsResponse = await fetch(`/api/gameParticipants?gameId=${gameId}`);
        if (!participantsResponse.ok) {
          throw new Error('Failed to load participants');
        }
        const participantsData = await participantsResponse.json();
        allParticipants = participantsData.participants || [];
      }

      // Remove duplicates (same userId)
      const uniqueParticipants = Array.from(
        new Map(allParticipants.map(p => [p.userId, p])).values()
      );

      setParticipants(uniqueParticipants);

      // Initialize selected divisions with current assignments
      const divisions: Record<string, string> = {};
      uniqueParticipants.forEach((p: Participant) => {
        if (p.assignedDivision) {
          divisions[p.id] = p.assignedDivision;
        }
      });
      setSelectedDivisions(divisions);
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignDivision = async (participantId: string, division: string) => {
    if (!user) return;

    setSaving(participantId);
    setError(null);

    try {
      const response = await fetch(`/api/gameParticipants/${participantId}/assignDivision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          assignedDivision: division,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign division');
      }

      // Update local state
      setParticipants(prev =>
        prev.map(p =>
          p.id === participantId
            ? { ...p, assignedDivision: division, divisionAssigned: true, status: 'active' }
            : p
        )
      );

      setSelectedDivisions(prev => ({
        ...prev,
        [participantId]: division,
      }));
    } catch (error: any) {
      console.error('Error assigning division:', error);
      setError(error.message || 'Failed to assign division');
    } finally {
      setSaving(null);
    }
  };

  const getDivisionOptions = () => {
    const count = game?.divisionCount || 1;
    const options = [];
    for (let i = 1; i <= count; i++) {
      options.push(`Division ${i}`);
    }
    return options;
  };

  const unassignedCount = participants.filter(p => !p.divisionAssigned).length;
  const assignedCount = participants.filter(p => p.divisionAssigned).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Division Assignment
              </h2>
              {game && (
                <p className="text-sm text-gray-600 mt-1">
                  {game.name} - {game.divisionCount} Divisions
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-600">Loading participants...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {!loading && game && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-600 font-medium">Total Players</div>
                  <div className="text-2xl font-bold text-blue-900">{participants.length}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-600 font-medium">Assigned</div>
                  <div className="text-2xl font-bold text-green-900">{assignedCount}</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-sm text-yellow-600 font-medium">Pending</div>
                  <div className="text-2xl font-bold text-yellow-900">{unassignedCount}</div>
                </div>
              </div>

              {/* Participants List */}
              {participants.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  No participants yet
                </div>
              ) : (
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`border rounded-lg p-4 ${
                        participant.divisionAssigned
                          ? 'bg-green-50 border-green-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">
                              {participant.playername}
                            </h3>
                            {participant.divisionAssigned ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-200 text-green-800">
                                Assigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Joined: {new Date(participant.joinedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Assign to Division
                            </label>
                            <select
                              value={selectedDivisions[participant.id] || ''}
                              onChange={(e) => {
                                const division = e.target.value;
                                setSelectedDivisions(prev => ({
                                  ...prev,
                                  [participant.id]: division,
                                }));
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              disabled={saving === participant.id}
                            >
                              <option value="">Select division...</option>
                              {getDivisionOptions().map((div) => (
                                <option key={div} value={div}>
                                  {div}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="pt-5">
                            <Button
                              text={saving === participant.id ? "Saving..." : "Assign"}
                              onClick={() => {
                                const division = selectedDivisions[participant.id];
                                if (division) {
                                  handleAssignDivision(participant.id, division);
                                }
                              }}
                              disabled={
                                !selectedDivisions[participant.id] ||
                                saving === participant.id ||
                                (participant.divisionAssigned &&
                                  selectedDivisions[participant.id] === participant.assignedDivision)
                              }
                              className="px-4 py-2 bg-primary hover:bg-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {participant.assignedDivision && (
                        <div className="mt-2 text-sm text-gray-600">
                          Current Division: <span className="font-medium text-primary">{participant.assignedDivision}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-end">
            <Button
              text="Done"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
