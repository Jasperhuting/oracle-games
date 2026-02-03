'use client';

import { Trash } from 'tabler-icons-react';

interface MyTeamRider {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  jerseyImage?: string;
  value: number;
}

interface BudgetStats {
  total: number;
  spent: number;
  remaining: number;
  riderCount: number;
  maxRiders: number;
}

interface FullGridMyTeamProps {
  myTeam: MyTeamRider[];
  budgetStats: BudgetStats;
  canEdit: boolean;
  onRemoveRider: (riderNameId: string) => void;
  saving: boolean;
}

export function FullGridMyTeam({
  myTeam,
  budgetStats,
  canEdit,
  onRemoveRider,
  saving,
}: FullGridMyTeamProps) {
  // Group by team
  const sortedTeam = [...myTeam].sort((a, b) => a.riderTeam.localeCompare(b.riderTeam));

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Mijn Team</h2>
        <p className="text-sm text-gray-500">
          {budgetStats.riderCount} van {budgetStats.maxRiders} renners
        </p>
      </div>

      {/* Budget overview */}
      <div className="px-4 py-3 bg-primary/5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Budget</span>
          <span className="text-sm text-gray-500">
            {budgetStats.spent} / {budgetStats.total} pts
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              budgetStats.remaining < 0 ? 'bg-red-500' : 'bg-primary'
            }`}
            style={{ width: `${Math.min((budgetStats.spent / budgetStats.total) * 100, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">Besteed</span>
          <span className={`text-sm font-semibold ${
            budgetStats.remaining < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {budgetStats.remaining} pts over
          </span>
        </div>
      </div>

      {/* Team list */}
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {sortedTeam.map((rider) => (
          <div
            key={rider.riderNameId}
            className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50"
          >
            {/* Jersey */}
            <div className="w-6 h-6 flex-shrink-0">
              {rider.jerseyImage ? (
                <img
                  src={rider.jerseyImage}
                  alt={rider.riderTeam}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 rounded" />
              )}
            </div>

            {/* Rider info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm truncate">
                {rider.riderName}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {rider.riderTeam}
              </div>
            </div>

            {/* Value */}
            <div className="text-sm font-semibold text-primary">
              {rider.value} pts
            </div>

            {/* Remove button */}
            {canEdit && (
              <button
                onClick={() => onRemoveRider(rider.riderNameId)}
                disabled={saving}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Verwijderen"
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {myTeam.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          <p>Je hebt nog geen renners geselecteerd.</p>
          <p className="text-sm mt-1">
            Kies een ploeg aan de linkerkant en selecteer een renner.
          </p>
        </div>
      )}

      {/* Summary */}
      {myTeam.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Totaal</span>
            <span className="font-semibold text-gray-900">
              {budgetStats.spent} punten
            </span>
          </div>

          {budgetStats.riderCount < budgetStats.maxRiders && (
            <p className="text-xs text-orange-600 mt-2">
              Nog {budgetStats.maxRiders - budgetStats.riderCount} renners te selecteren
            </p>
          )}

          {budgetStats.riderCount === budgetStats.maxRiders && (
            <p className="text-xs text-green-600 mt-2">
              Je team is compleet!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
