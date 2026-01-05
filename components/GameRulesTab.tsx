'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GameRule, ClientGameCategory } from "@/lib/types/games";
import { Button } from "./Button";
import { RichTextEditor } from "./RichTextEditor";
import toast from "react-hot-toast";

// Helper to convert slug to title case (fallback when no displayName)
const slugToTitle = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface GameRuleData {
  rules: string;
  categoryId: string | null;
  displayName: string | null;
}

export const GameRulesTab = () => {
  const { user } = useAuth();
  const [gameTypes, setGameTypes] = useState<string[]>([]);
  const [gameRules, setGameRules] = useState<Record<string, GameRuleData>>({});
  const [categories, setCategories] = useState<ClientGameCategory[]>([]);
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);
  const [currentRules, setCurrentRules] = useState<string>('');
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New game form state
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  const [newGameName, setNewGameName] = useState('');

  // Fetch all game rules and categories on mount
  useEffect(() => {
    fetchGameRules();
    fetchCategories();
  }, []);

  // Update current rules and category when selection changes
  useEffect(() => {
    if (selectedGameType) {
      setCurrentRules(gameRules[selectedGameType]?.rules || '');
      setCurrentCategoryId(gameRules[selectedGameType]?.categoryId || null);
    }
  }, [selectedGameType, gameRules]);

  const fetchGameRules = async () => {
    try {
      const response = await fetch('/api/gameRules');
      if (response.ok) {
        const data: { rules: GameRule[] } = await response.json();
        const rulesMap: Record<string, GameRuleData> = {};
        const types: string[] = [];

        data.rules.forEach((rule) => {
          types.push(rule.gameType);
          rulesMap[rule.gameType] = {
            rules: rule.rules,
            categoryId: rule.categoryId || null,
            displayName: rule.displayName || null,
          };
        });

        setGameTypes(types.sort());
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

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/gameCategories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
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
          categoryId: currentCategoryId,
          rules: currentRules,
          userId: user.uid,
        }),
      });

      if (response.ok) {
        toast.success('Game rules saved successfully');
        // Update local state
        setGameRules(prev => ({
          ...prev,
          [selectedGameType]: {
            rules: currentRules,
            categoryId: currentCategoryId,
            displayName: prev[selectedGameType]?.displayName || null,
          },
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
      setCurrentRules(gameRules[selectedGameType]?.rules || '');
      setCurrentCategoryId(gameRules[selectedGameType]?.categoryId || null);
    }
  };

  const handleCreateNewGame = async () => {
    if (!newGameName.trim() || !user) {
      toast.error('Please enter a game name');
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
          displayName: newGameName.trim(),
          isNew: true,
          rules: '',
          userId: user.uid,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('New game type created successfully');
        
        // Add to local state
        const newSlug = data.gameType;
        setGameTypes(prev => [...prev, newSlug].sort());
        setGameRules(prev => ({
          ...prev,
          [newSlug]: {
            rules: '',
            categoryId: null,
            displayName: newGameName.trim(),
          },
        }));
        
        // Select the new game and reset form
        setSelectedGameType(newSlug);
        setNewGameName('');
        setShowNewGameForm(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create game type');
      }
    } catch (error) {
      console.error('Error creating game type:', error);
      toast.error('Error creating game type');
    } finally {
      setSaving(false);
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Game Type
            </label>
            <Button
              text={showNewGameForm ? 'Cancel' : '+ Add New Game'}
              variant={showNewGameForm ? 'secondary' : 'primary'}
              onClick={() => {
                setShowNewGameForm(!showNewGameForm);
                setNewGameName('');
              }}
            />
          </div>

          {/* New Game Form */}
          {showNewGameForm && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Game Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="e.g. Fantasy League"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNewGame()}
                />
                <Button
                  text={saving ? 'Creating...' : 'Create Game'}
                  variant="primary"
                  onClick={handleCreateNewGame}
                  disabled={saving || !newGameName.trim()}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                A URL-friendly slug will be generated automatically (e.g. &quot;Fantasy League&quot; → &quot;fantasy-league&quot;)
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {gameTypes.map((gameType: string) => (
              <button
                key={gameType}
                onClick={() => setSelectedGameType(gameType)}
                className={`
                  px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium cursor-pointer
                  ${selectedGameType === gameType
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }
                  ${gameRules[gameType]?.rules ? 'ring-2 ring-green-200' : ''}
                `}
              >
                {gameRules[gameType]?.displayName || slugToTitle(gameType)}
                {gameRules[gameType]?.rules && (
                  <span className="block text-xs text-green-600 mt-1">Has rules</span>
                )}
                {gameRules[gameType]?.categoryId && (
                  <span className="block text-xs text-blue-600">
                    {categories.find(c => c.id === gameRules[gameType]?.categoryId)?.name || 'Unknown category'}
                  </span>
                )}
              </button>
            ))}
          </div>
          {gameTypes.length === 0 && !showNewGameForm && (
            <p className="text-sm text-gray-500 mt-2">
              No game types yet. Click &quot;+ Add New Game&quot; to create one.
            </p>
          )}
        </div>

        {/* Rules Editor */}
        {selectedGameType && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {gameRules[selectedGameType]?.displayName || slugToTitle(selectedGameType)} Rules
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

            {/* Category Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={currentCategoryId || ''}
                onChange={(e) => setCurrentCategoryId(e.target.value || null)}
                className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No categories available. Create categories in the &quot;Game Categories&quot; tab first.
                </p>
              )}
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
