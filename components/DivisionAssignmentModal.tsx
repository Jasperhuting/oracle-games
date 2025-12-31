'use client'

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "./ConfirmDialog";
import { Participant, DivisionAssignmentModalProps } from "@/lib/types/game-ui";
import { Game } from "@/lib/types/games";

// Local interface for division game data with division field
interface DivisionGame {
  id: string;
  name: string;
  division: string;
}

export const DivisionAssignmentModal = ({
  gameId,
  onClose,
  onSuccess,
}: DivisionAssignmentModalProps) => {
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [availableDivisions, setAvailableDivisions] = useState<DivisionGame[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedDivisions, setSelectedDivisions] = useState<Record<string, string>>({});
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{id: string; name: string} | null>(null);

  const cleanupOrphanedParticipants = async () => {
    if (!user) return;

    try {
      console.log('[DivisionAssignment] Cleaning up orphaned participants...');
      const response = await fetch('/api/games/cleanup-orphaned-participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[DivisionAssignment] Cleanup complete: ${data.deletedCount} participant(s) removed`);
      }
    } catch (error) {
      console.error('Error cleaning up orphaned participants:', error);
    }
  };

  const loadData = (async () => {
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
        // Get the base name to find related division games
        const gameName = loadedGame.name || '';
        const baseName = gameName.replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();

        // Find the base game (without division suffix) to get pending participants
        // Use a broader search - just get all games and filter client-side
        const allGamesResponse = await fetch(
          `/api/games/list?limit=1000`
        );

        let baseGameId = gameId; // fallback to current gameId
        let allGamesData: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

        if (allGamesResponse.ok) {
          allGamesData = await allGamesResponse.json(); // Read once and store

          // Find the base game (the one with divisionCount > 1 but no specific division field)
          const baseGame = allGamesData.games.find((g: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const gBaseName = (g.name || '').replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
            return gBaseName === baseName && g.divisionCount > 1 && !g.division;
          });

          if (baseGame) {
            baseGameId = baseGame.id;
          }

          // Find all actual division games that exist
          console.log('[DivisionAssignment] Base name:', baseName);
          console.log('[DivisionAssignment] All games retrieved:', allGamesData.games.map((g: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            name: g.name,
            division: g.division,
            divisionCount: g.divisionCount,
          })));

          const divisionGames = allGamesData.games.filter((g: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const gBaseName = (g.name || '').replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
            const gName = g.name || '';

            // Check if this game has a division field OR has "Division X" in the name
            const hasDivisionField = g.division && g.division.trim() !== '';
            const hasDivisionInName = /Division\s+\d+/i.test(gName);
            const matchesBaseName = gBaseName === baseName;

            console.log('[DivisionAssignment] Checking game:', g.name, 'baseName:', gBaseName, 'division:', g.division, 'hasDivisionField:', hasDivisionField, 'hasDivisionInName:', hasDivisionInName, 'match:', matchesBaseName && (hasDivisionField || hasDivisionInName));

            // Include games that match the base name AND (have a division field OR have Division X in name)
            return matchesBaseName && (hasDivisionField || hasDivisionInName);
          }).map((g: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            // Extract division from the division field, or from the name if field is empty
            let division = g.division && g.division.trim() !== '' ? g.division : '';
            if (!division) {
              const match = (g.name || '').match(/Division\s+(\d+)/i);
              if (match) {
                division = `Division ${match[1]}`;
              }
            }

            return {
              id: g.id,
              name: g.name,
              division: division,
            };
          }).filter((g: DivisionGame) => g.division); // Filter out any that still don't have a division

          console.log('[DivisionAssignment] All games for this type/year:', allGamesData.games.length);
          console.log('[DivisionAssignment] Available divisions:', divisionGames);
          setAvailableDivisions(divisionGames);
        }

        // For multi-division games, load pending participants from base game
        const pendingGameId = `${baseGameId}-pending`;
        console.log('[DivisionAssignment] Loading pending from:', pendingGameId);
        const pendingResponse = await fetch(`/api/gameParticipants?gameId=${pendingGameId}`);
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          console.log('[DivisionAssignment] Pending participants:', pendingData.participants?.length || 0);
          allParticipants = [...(pendingData.participants || [])];
        } else {
          console.log('[DivisionAssignment] Failed to load pending participants');
        }

        // Also load already assigned participants from all related divisions
        // Use the already parsed allGamesData
        if (allGamesData) {
          const relatedGames = allGamesData.games.filter((g: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const gBaseName = (g.name || '').replace(/\s*-\s*Division\s+\d+\s*$/i, '').trim();
            return gBaseName === baseName && g.id !== gameId && g.id !== baseGameId;
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

        // Still set availableDivisions to empty array for single-division games
        setAvailableDivisions([]);
      }

      // Remove duplicates (same userId)
      console.log('[DivisionAssignment] Total participants before dedup:', allParticipants.length);
      const uniqueParticipants = Array.from(
        new Map(allParticipants.map(p => [p.userId, p])).values()
      );
      console.log('[DivisionAssignment] Unique participants:', uniqueParticipants.length);
      console.log('[DivisionAssignment] Participants:', uniqueParticipants.map(p => `${p.playername} (${p.divisionAssigned ? 'assigned' : 'pending'})`));

      // For participants without email, fetch from users collection
      const participantsWithEmails = await Promise.all(
        uniqueParticipants.map(async (participant) => {
          if (!participant.userEmail && participant.userId) {
            try {
              const userResponse = await fetch(`/api/getUser?userId=${participant.userId}`);
              if (userResponse.ok) {
                const userData = await userResponse.json();
                return { ...participant, userEmail: userData.email };
              }
            } catch (error) {
              console.error('Error fetching user email:', error);
            }
          }
          return participant;
        })
      );

      setParticipants(participantsWithEmails);

      // Initialize selected divisions with current assignments
      const divisions: Record<string, string> = {};
      participantsWithEmails.forEach((p: Participant) => {
        if (p.assignedDivision) {
          divisions[p.id] = p.assignedDivision;
        }
      });
      setSelectedDivisions(divisions);
    } catch (error: unknown) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    const initialize = async () => {
      // First cleanup any orphaned participants
      await cleanupOrphanedParticipants();
      // Then load the data
      await loadData();
    };
    initialize();
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

      // Reload data to get fresh participant list
      // This ensures pending participants are shown correctly
      await loadData();
      
    } catch (error: unknown) {
      console.error('Error assigning division:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign division');
    } finally {
      setSaving(null);
    }
  };

  const confirmRemoveParticipant = (participantId: string, participantName: string) => {
    setPendingRemove({ id: participantId, name: participantName });
    setRemoveConfirmOpen(true);
  };

  const handleRemoveParticipant = async () => {
    if (!user || !pendingRemove) return;

    setRemoving(pendingRemove.id);
    setError(null);

    try {
      const response = await fetch(`/api/gameParticipants/${pendingRemove.id}/assignDivision?adminUserId=${user.uid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove participant');
      }

      // Remove from local state
      setParticipants(prev => prev.filter(p => p.id !== pendingRemove.id));
    } catch (error: unknown) {
      console.error('Error removing participant:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove participant');
    } finally {
      setRemoving(null);
    }
  };

  const getDivisionOptions = () => {
    const options = ['Unassigned']; // Add unassigned option first
    // Use actual available divisions instead of divisionCount
    availableDivisions.forEach(div => {
      options.push(div.division);
    });
    return options;
  };

  const unassignedCount = participants.filter(p => !p.divisionAssigned).length;
  const assignedCount = participants.filter(p => p.divisionAssigned).length;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                  {game.name} - {availableDivisions.length > 0 ? availableDivisions.length : game.divisionCount} Division{(availableDivisions.length > 0 ? availableDivisions.length : game.divisionCount) !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl cursor-pointer leading-none"
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
                          {participant.userEmail && (
                            <p className="text-sm text-gray-600 mt-1">
                              {participant.userEmail}
                            </p>
                          )}
                          <p className="text-sm text-gray-500 mt-0.5">
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
                              disabled={saving === participant.id || removing === participant.id}
                            >
                              <option value="">Select division...</option>
                              {getDivisionOptions().map((div) => (
                                <option key={div} value={div}>
                                  {div}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="pt-5 flex gap-2">
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
                                removing === participant.id ||
                                (participant.divisionAssigned &&
                                  selectedDivisions[participant.id] === participant.assignedDivision)
                              }
                              className="px-4 py-2 bg-primary hover:bg-primary"
                            />
                            <Button
                              text={removing === participant.id ? "Removing..." : "Remove"}
                              onClick={() => confirmRemoveParticipant(participant.id, participant.playername)}
                              disabled={saving === participant.id || removing === participant.id}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700"
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

      {/* Remove Participant Confirmation Dialog */}
      <ConfirmDialog
        open={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={handleRemoveParticipant}
        title="Remove Participant"
        description={
          pendingRemove ? (
            <p>Are you sure you want to remove <strong>{pendingRemove.name}</strong> from this game?</p>
          ) : ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
