'use client'

import { useEffect, useState } from 'react';
import { ClientGameRule, ClientGameCategory, GameType } from '@/lib/types/games';

// Helper to convert slug to title case (fallback when no displayName)
const slugToTitle = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function RulesPage() {
  const [rules, setRules] = useState<ClientGameRule[]>([]);
  const [categories, setCategories] = useState<ClientGameCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGameType, setExpandedGameType] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [rulesResponse, categoriesResponse] = await Promise.all([
          fetch('/api/gameRules'),
          fetch('/api/gameCategories'),
        ]);

        if (!rulesResponse.ok) {
          throw new Error('Failed to load game rules');
        }
        const rulesData: { rules: ClientGameRule[] } = await rulesResponse.json();
        setRules(rulesData.rules);

        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.categories || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game rules');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleGameType = (gameType: string) => {
    setExpandedGameType(expandedGameType === gameType ? null : gameType);
  };

  // Group rules by category
  const getRulesByCategory = () => {
    const grouped: Record<string, ClientGameRule[]> = {};
    const uncategorized: ClientGameRule[] = [];

    // Only include rules that have content
    const rulesWithContent = rules.filter(r => r.rules);

    rulesWithContent.forEach((rule) => {
      if (rule.categoryId) {
        if (!grouped[rule.categoryId]) {
          grouped[rule.categoryId] = [];
        }
        grouped[rule.categoryId].push(rule);
      } else {
        uncategorized.push(rule);
      }
    });

    return { grouped, uncategorized };
  };

  const { grouped: rulesByCategory, uncategorized: uncategorizedRules } = getRulesByCategory();

  // Get rules without content (for "Coming Soon" section)
  const rulesWithoutContent = rules.filter(r => !r.rules);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-center text-gray-600">Loading rules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  // Render a single rule item as accordion
  const renderRuleItem = (rule: ClientGameRule) => {
    const isExpanded = expandedGameType === rule.gameType;

    return (
      <div
        key={rule.gameType}
        className="bg-white rounded-lg shadow-sm overflow-hidden"
      >
        <button
          onClick={() => toggleGameType(rule.gameType)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <h3 className="text-xl font-semibold">
            {rule.displayName || slugToTitle(rule.gameType)}
          </h3>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div
              className="prose prose-sm sm:prose-base lg:prose-lg max-w-none mt-4
                prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1
                prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800
                prose-strong:font-bold prose-em:italic
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: rule.rules }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-3 sm:p-6">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">Game Rules</h1>
          <p className="text-gray-600 mt-2">Overview of all game types and their rules</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-3 sm:py-8">
        {/* Rules grouped by category */}
        {categories.map((category) => {
          const categoryRules = rulesByCategory[category.id!] || [];
          if (categoryRules.length === 0) return null;

          return (
            <div key={category.id} className="mb-10">
              <h2 className="text-2xl font-bold mb-4">{category.name}</h2>
              <div className="space-y-4">
                {categoryRules.map(renderRuleItem)}
              </div>
            </div>
          );
        })}

        {/* Uncategorized rules */}
        {uncategorizedRules.length > 0 && (
          <div className="mb-10">
            {categories.length > 0 && (
              <h2 className="text-2xl font-bold mb-4">Other Games</h2>
            )}
            <div className="space-y-4">
              {uncategorizedRules.map(renderRuleItem)}
            </div>
          </div>
        )}

        {/* Game types without rules */}
        {rulesWithoutContent.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-500 mb-4">Coming Soon</h2>
            <div className="space-y-2">
              {rulesWithoutContent.map((rule) => (
                <div
                  key={rule.gameType}
                  className="bg-white rounded-lg shadow-sm px-6 py-4 text-gray-400"
                >
                  {rule.displayName || slugToTitle(rule.gameType)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
