'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GAME_TYPES, GameType, GameRule } from "@/lib/types/games";
import { Button } from "./Button";
import { RichTextEditor } from "./RichTextEditor";
import toast from "react-hot-toast";

const GAME_TYPE_LABELS: Record<GameType, string> = {
  'auctioneer': 'Auction Master',
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

export const GameRulesTab = () => {
  const { user } = useAuth();
  const [gameRules, setGameRules] = useState<Record<GameType, string>>({} as Record<GameType, string>);
  const [selectedGameType, setSelectedGameType] = useState<GameType | null>(null);
  const [currentRules, setCurrentRules] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch all game rules on mount
  useEffect(() => {
    fetchGameRules();
  }, []);

  // Update current rules when selection changes
  useEffect(() => {
    if (selectedGameType) {
      setCurrentRules(gameRules[selectedGameType] || '');
    }
  }, [selectedGameType, gameRules]);

  const fetchGameRules = async () => {
    try {
      const response = await fetch('/api/gameRules');
      if (response.ok) {
        const rules: GameRule[] = await response.json();
        const rulesMap: Record<GameType, string> = {} as Record<GameType, string>;

        rules.forEach((rule) => {
          rulesMap[rule.gameType] = rule.rules;
        });

        setGameRules(rulesMap);
      } else {
        toast.error('Failed to fetch game rules');
      }
    } catch (error) {
      console.error('Error fetching game rules:', error);
      toast.error('Error loading game rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedGameType || !user) {
      toast.error('Please select a game type');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/gameRules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameType: selectedGameType,
          rules: currentRules,
          userId: user.uid,
        }),
      });

      if (response.ok) {
        toast.success('Game rules saved successfully');
        // Update local state
        setGameRules(prev => ({
          ...prev,
          [selectedGameType]: currentRules,
        }));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save game rules');
      }
    } catch (error) {
      console.error('Error saving game rules:', error);
      toast.error('Error saving game rules');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (selectedGameType) {
      setCurrentRules(gameRules[selectedGameType] || '');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading game rules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Game Rules Management</h2>
        <p className="text-gray-600 mb-6">
          Select a game type to add or edit its rules. Use the rich text editor to format the content.
        </p>

        {/* Game Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Game Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {GAME_TYPES.map((gameType) => (
              <button
                key={gameType}
                onClick={() => setSelectedGameType(gameType)}
                className={`
                  px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium cursor-pointer
                  ${selectedGameType === gameType
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }
                  ${gameRules[gameType] ? 'ring-2 ring-green-200' : ''}
                `}
              >
                {GAME_TYPE_LABELS[gameType]}
                {gameRules[gameType] && (
                  <span className="block text-xs text-green-600 mt-1">Has rules</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Rules Editor */}
        {selectedGameType && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {GAME_TYPE_LABELS[selectedGameType]} Rules
              </h3>
              <div className="flex gap-2">
                <Button
                  text="Cancel"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={saving}
                />
                <Button
                  text={saving ? 'Saving...' : 'Save Rules'}
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <RichTextEditor
                content={currentRules}
                onChange={setCurrentRules}
              />
            </div>

            {currentRules && (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-2">Preview:</p>
                <div
                  className="p-4 bg-gray-50 rounded-lg border
                    prose prose-sm sm:prose-base max-w-none
                    prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                    prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1
                    prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800
                    prose-strong:font-bold prose-em:italic
                    prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                    prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                    prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: currentRules }}
                />
              </div>
            )}
          </div>
        )}

        {!selectedGameType && (
          <div className="text-center py-12 text-gray-500">
            Select a game type above to manage its rules
          </div>
        )}
      </div>
    </div>
  );
};
