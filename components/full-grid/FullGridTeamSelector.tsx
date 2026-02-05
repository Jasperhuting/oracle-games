'use client';

import { Check } from 'tabler-icons-react';

interface Team {
  name: string;
  slug: string;
  teamImage?: string;
  riderCount: number;
  teamClass?: string;
  isProTeam?: boolean;
}

interface FullGridTeamSelectorProps {
  teams: Team[];
  selectedTeam: string | null;
  teamsWithSelection: Set<string>;
  onSelectTeam: (teamName: string) => void;
  proTeamsSelectedCount?: number;
  proTeamsLimit?: number;
  selectedRiderByTeam?: Record<string, string>;
}

export function FullGridTeamSelector({
  teams,
  selectedTeam,
  teamsWithSelection,
  onSelectTeam,
  proTeamsSelectedCount,
  proTeamsLimit,
  selectedRiderByTeam,
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
        {typeof proTeamsSelectedCount === 'number' && typeof proTeamsLimit === 'number' && (
          <p className="text-xs text-gray-500 mt-1">
            ProTeams: {proTeamsSelectedCount} / {proTeamsLimit}
          </p>
        )}
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
                {team.teamImage ? (
                  <img
                    src={`https://www.procyclingstats.com/${team.teamImage}`}
                    alt={team.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src="/jersey-transparent.png"
                    alt={team.name}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Team name */}
              <div className="flex-1 min-w-0">
                <div className={`font-medium truncate ${hasSelection ? 'text-green-800' : 'text-gray-900'}`}>
                  {team.name}
                </div>
                <div className="text-xs text-gray-500">
                  {team.riderCount} renners
                  {team.teamClass && team.teamClass !== 'PRT' && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                      {team.teamClass}
                    </span>
                  )}
                  {team.isProTeam && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                      PRT
                    </span>
                  )}
                </div>
                {hasSelection && selectedRiderByTeam?.[team.name] && (
                  <div className="text-xs text-green-700 truncate">
                    Gekozen: {selectedRiderByTeam[team.name]}
                  </div>
                )}
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
