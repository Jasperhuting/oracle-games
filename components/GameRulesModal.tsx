'use client'

import { useEffect, useState } from 'react';
import { GameRule, GameType } from '@/lib/types/games';
import { X } from 'tabler-icons-react';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: GameType;
  gameName: string;
}

export const GameRulesModal = ({ isOpen, onClose, gameType, gameName }: GameRulesModalProps) => {
  const [rules, setRules] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && gameType) {
      fetchRules();
    }
  }, [isOpen, gameType]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gameRules');
      if (response.ok) {
        const data: { rules: GameRule[] } = await response.json();

        const gameRule = data.rules.find((r: any) => r.gameType === gameType); // eslint-disable-line @typescript-eslint/no-explicit-any
        setRules(gameRule?.rules || '');
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold">{gameName} - Rules</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600">Loading rules...</div>
              </div>
            ) : rules ? (
              <div
                className="prose prose-sm sm:prose-base lg:prose-lg max-w-none
                  prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                  prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1
                  prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800
                  prose-strong:font-bold prose-em:italic
                  prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                  prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                  prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: rules }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                No rules have been added for this game type yet.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
