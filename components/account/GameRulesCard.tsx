'use client';

import { useState, useEffect } from 'react';
import { GameRulesModal } from '@/components/GameRulesModal';
import { GameType, GameRule } from '@/lib/types/games';
import { Book } from 'tabler-icons-react';
import { Button } from '../Button';

interface RuleItem {
  gameType: GameType;
  name: string;
}

export function GameRulesCard() {
  const [availableRules, setAvailableRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<RuleItem | null>(null);

  useEffect(() => {
    async function fetchAvailableRules() {
      try {
        const response = await fetch('/api/gameRules');
        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        const rules: GameRule[] = data.rules || [];

        // Map game types to friendly names
        const ruleItems: RuleItem[] = rules
          .filter((r) => r.rules && r.rules.trim() !== '')
          .map((r) => ({
            gameType: r.gameType,
            name: getGameTypeName(r.gameType),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAvailableRules(ruleItems);
      } catch (error) {
        console.error('Error fetching rules:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAvailableRules();
  }, []);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
          Spelregels
        </h2>

        {loading ? (
          <p className="text-sm text-gray-400">Laden...</p>
        ) : availableRules.length === 0 ? (
          <p className="text-sm text-gray-400">Geen spelregels beschikbaar</p>
        ) : (
          <ul className="space-y-2">
            {availableRules.map((rule) => (
              <li key={rule.gameType} className="flex items-center gap-2 flex-row">
                <Button
                  variant="text"
                  onClick={() => setSelectedRule(rule)}
                  startIcon={<Book className="w-4 h-4 flex-shrink-0" />}
                  className="flex items-center gap-2 text-sm"
                >
                  {rule.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedRule && (
        <GameRulesModal
          isOpen={true}
          onClose={() => setSelectedRule(null)}
          gameType={selectedRule.gameType}
          gameName={selectedRule.name}
        />
      )}
    </>
  );
}

function getGameTypeName(gameType: GameType): string {
  const names: Record<string, string> = {
    'auctioneer': 'Auction Master',
    'slipstream': 'Slipstream',
    'last-man-standing': 'Last Man Standing',
    'poisoned-cup': 'Poisoned Cup',
    'nations-cup': 'Nations Cup',
    'rising-stars': 'Rising Stars',
    'country-roads': 'Country Roads',
    'worldtour-manager': 'WorldTour Manager',
    'fan-flandrien': 'Fan Flandrien',
    'full-grid': 'Full Grid',
    'marginal-gains': 'Marginal Gains',
    'formula-1': 'F1 Predictions',
    'wk-2026': 'WK 2026',
  };

  return names[gameType] || gameType;
}
