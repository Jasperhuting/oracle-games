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

  const sortedTeams = [...teams].sort((a, b) => {
    const aIsPro = !!a.isProTeam || a.teamClass === 'PRT';
    const bIsPro = !!b.isProTeam || b.teamClass === 'PRT';
    if (aIsPro !== bIsPro) return aIsPro ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const wtTeams = sortedTeams.filter(team => !(team.isProTeam || team.teamClass === 'PRT'));
  const prtTeams = sortedTeams.filter(team => team.isProTeam || team.teamClass === 'PRT');
  const selectedWtTeams = wtTeams.filter(team => teamsWithSelection.has(team.name));
  const selectedPrtTeams = prtTeams.filter(team => teamsWithSelection.has(team.name));
  const remainingWtTeams = wtTeams.filter(team => !teamsWithSelection.has(team.name));
  const remainingPrtTeams = prtTeams.filter(team => !teamsWithSelection.has(team.name));

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

      <div className="max-h-[600px] overflow-y-auto">
        {totalCount > 0 && (
          <div className="divide-y divide-gray-100">
            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              WT Teams
            </div>
            {[...remainingWtTeams, ...selectedWtTeams].map((team) => {
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
                    </div>
                    {hasSelection && selectedRiderByTeam?.[team.name] && (
                      <div className="text-xs text-green-700 truncate">
                        Gekozen: {selectedRiderByTeam[team.name]}
                      </div>
                    )}
                  </div>
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

            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-t border-gray-200">
              ProTeams
            </div>
            {[...remainingPrtTeams, ...selectedPrtTeams].map((team) => {
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
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${hasSelection ? 'text-green-800' : 'text-gray-900'}`}>
                      {team.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {team.riderCount} renners
                      <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                        PRT
                      </span>
                    </div>
                    {hasSelection && selectedRiderByTeam?.[team.name] && (
                      <div className="text-xs text-green-700 truncate">
                        Gekozen: {selectedRiderByTeam[team.name]}
                      </div>
                    )}
                  </div>
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
        )}
      </div>

      {teams.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          Geen ploegen beschikbaar
        </div>
      )}
    </div>
  );
}
