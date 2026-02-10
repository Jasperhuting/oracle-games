'use client';

import { Trash } from 'tabler-icons-react';
import { useMemo } from 'react';

interface MyTeamRider {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  jerseyImage?: string;
  value: number;
  teamClass?: string;
  isProTeam?: boolean;
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
  const sortedTeam = [...myTeam].sort((a, b) => {
    const aIsPro = !!a.isProTeam || a.teamClass === 'PRT';
    const bIsPro = !!b.isProTeam || b.teamClass === 'PRT';
    if (aIsPro !== bIsPro) return aIsPro ? 1 : -1;
    return a.riderTeam.localeCompare(b.riderTeam);
  });
  const displayWt = sortedTeam.filter(rider => !(rider.isProTeam || rider.teamClass === 'PRT'));
  const displayPrt = sortedTeam.filter(rider => rider.isProTeam || rider.teamClass === 'PRT');

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Mijn Team</h2>
        <p className="text-sm text-gray-500">
          {budgetStats.riderCount} van {budgetStats.maxRiders} renners
        </p>
      </div>

      {/* Sponsor */}
      <div className="px-4 py-4 bg-white border-b border-gray-200">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-white ring-2 ring-emerald-200 flex items-center justify-center overflow-hidden">
              <img
                src="/berc-bike-logo.jpg"
                alt="Berc Bike"
                className="h-11 w-11 object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Sponsor
                </span>
                <span className="text-[11px] uppercase tracking-wide text-gray-400">Full-Grid</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">Berc Bike</p>
              <p className="text-sm text-gray-600">
                Berc Bike sponsort de prijzen voor hen die 5,- storten.
              </p>
              <span className="text-sm text-gray-400 cursor-not-allowed">
                Prijzen
              </span>
            </div>
          </div>
        </div>
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
            className={`h-full transition-transform duration-300 origin-left ${
              budgetStats.remaining < 0 ? 'bg-red-500' : 'bg-primary'
            }`}
            style={{
              transform: `scaleX(${Math.min(budgetStats.total > 0 ? budgetStats.spent / budgetStats.total : 0, 1)})`,
            }}
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
      <div
        className="divide-y divide-gray-100 overflow-y-auto"
        style={{ maxHeight: '560px' }}
      >
        {displayWt.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50">
              WT Teams
            </div>
            {displayWt.map((rider) => (
              <div
                key={rider.riderNameId}
                className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50"
              >
            {/* Jersey */}
            <div className="w-6 h-6 flex-shrink-0">
              {rider.jerseyImage ? (
                <img
                  src={`https://www.procyclingstats.com/${rider.jerseyImage}`}
                  alt={rider.riderTeam}
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src="/jersey-transparent.png"
                  alt={rider.riderTeam}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Rider info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-900 text-base truncate">
                  {rider.riderName}
                </span>
                <span className="text-sm text-gray-500 truncate">
                  {rider.riderTeam}
                </span>
                {rider.teamClass && rider.teamClass !== 'PRT' && (
                  <span className="uppercase tracking-wide text-[10px] text-gray-400">
                    {rider.teamClass}
                  </span>
                )}
                {rider.isProTeam && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                    PRT
                  </span>
                )}
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
          </>
        )}
        {displayPrt.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-t border-gray-200">
              ProTeams
            </div>
            {displayPrt.map((rider) => (
              <div
                key={rider.riderNameId}
                className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50"
              >
                {/* Jersey */}
                <div className="w-6 h-6 flex-shrink-0">
                  {rider.jerseyImage ? (
                    <img
                      src={`https://www.procyclingstats.com/${rider.jerseyImage}`}
                      alt={rider.riderTeam}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src="/jersey-transparent.png"
                      alt={rider.riderTeam}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Rider info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-gray-900 text-base truncate">
                      {rider.riderName}
                    </span>
                    <span className="text-sm text-gray-500 truncate">
                      {rider.riderTeam}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                      PRT
                    </span>
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
          </>
        )}
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
