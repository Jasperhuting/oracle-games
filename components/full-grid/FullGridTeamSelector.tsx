'use client';

import { Check } from 'tabler-icons-react';

interface Team {
  name: string;
  slug: string;
  jerseyImage?: string;
  riderCount: number;
}

interface FullGridTeamSelectorProps {
  teams: Team[];
  selectedTeam: string | null;
  teamsWithSelection: Set<string>;
  onSelectTeam: (teamName: string) => void;
}

export function FullGridTeamSelector({
  teams,
  selectedTeam,
  teamsWithSelection,
  onSelectTeam,
}: FullGridTeamSelectorProps) {
  const completedCount = teamsWithSelection.size;
  const totalCount = teams.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Kies een Ploeg</h2>
        <p className="text-sm text-gray-500">
          {completedCount} van {totalCount} ploegen geselecteerd
        </p>
      </div>

      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {teams.map((team) => {
          const isSelected = selectedTeam === team.name;
          const hasSelection = teamsWithSelection.has(team.name);

          return (
            <button
              key={team.slug}
              onClick={() => onSelectTeam(team.name)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                isSelected
                  ? 'bg-primary/10 border-l-4 border-primary'
                  : hasSelection
                  ? 'bg-green-50 hover:bg-green-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Team jersey */}
              <div className="w-8 h-8 flex-shrink-0">
                {team.jerseyImage ? (
                  <img
                    src={team.jerseyImage}
                    alt={team.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 rounded" />
                )}
              </div>

              {/* Team name */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${hasSelection ? 'text-green-800' : 'text-gray-900'}`}>
                  {team.name}
                </div>
                <div className="text-xs text-gray-500">
                  {team.riderCount} renners
                </div>
              </div>

              {/* Selection indicator */}
              {hasSelection && (
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {teams.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          Geen ploegen beschikbaar
        </div>
      )}
    </div>
  );
}
