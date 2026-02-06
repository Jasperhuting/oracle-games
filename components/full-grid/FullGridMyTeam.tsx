'use client';

import { Trash, ChevronLeft, ChevronRight } from 'tabler-icons-react';
import { useMemo, useState } from 'react';

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

type DisplayMode = 'all' | 'scroll' | 'pagination';
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50];
const SCROLL_ITEM_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];
const ITEM_HEIGHT = 56;

export function FullGridMyTeam({
  myTeam,
  budgetStats,
  canEdit,
  onRemoveRider,
  saving,
}: FullGridMyTeamProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('scroll');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [scrollItemCount, setScrollItemCount] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const sortedTeam = [...myTeam].sort((a, b) => {
    const aIsPro = !!a.isProTeam || a.teamClass === 'PRT';
    const bIsPro = !!b.isProTeam || b.teamClass === 'PRT';
    if (aIsPro !== bIsPro) return aIsPro ? 1 : -1;
    return a.riderTeam.localeCompare(b.riderTeam);
  });
  const totalPages = Math.max(1, Math.ceil(sortedTeam.length / itemsPerPage));
  const orderedTeam = sortedTeam;
  const displayTeam = displayMode === 'pagination'
    ? orderedTeam.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : orderedTeam;

  const displayWt = displayTeam.filter(rider => !(rider.isProTeam || rider.teamClass === 'PRT'));
  const displayPrt = displayTeam.filter(rider => rider.isProTeam || rider.teamClass === 'PRT');

  const listMaxHeight = displayMode === 'scroll'
    ? `${scrollItemCount * ITEM_HEIGHT}px`
    : undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Mijn Team</h2>
        <p className="text-sm text-gray-500">
          {budgetStats.riderCount} van {budgetStats.maxRiders} renners
        </p>
      </div>

      {/* Display controls */}
      <div className="px-4 py-2 bg-white border-b border-gray-200 flex flex-wrap items-center gap-3 text-xs">
        <label className="text-gray-600">Weergave</label>
        <select
          value={displayMode}
          onChange={(e) => {
            setDisplayMode(e.target.value as DisplayMode);
            setCurrentPage(1);
          }}
          className="pl-2 pr-6 py-1 text-xs border border-gray-300 rounded-md bg-white"
        >
          <option value="all">Alles</option>
          <option value="scroll">Scroll</option>
          <option value="pagination">Pagina’s</option>
        </select>

        {displayMode === 'pagination' && (
          <>
            <label className="text-gray-600">Per pagina</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="pl-2 pr-6 py-1 text-xs border border-gray-300 rounded-md bg-white"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </>
        )}

        {displayMode === 'scroll' && (
          <>
            <label className="text-gray-600">Items</label>
            <select
              value={scrollItemCount}
              onChange={(e) => setScrollItemCount(Number(e.target.value))}
              className="pl-2 pr-6 py-1 text-xs border border-gray-300 rounded-md bg-white"
            >
              {SCROLL_ITEM_COUNT_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </>
        )}

        {displayMode === 'pagination' && totalPages > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 border border-gray-300 rounded disabled:opacity-50"
              title="Vorige pagina"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-gray-600">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 border border-gray-300 rounded disabled:opacity-50"
              title="Volgende pagina"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
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
        style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
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
              <div className="font-medium text-gray-900 text-sm truncate">
                {rider.riderName}
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                <span>{rider.riderTeam}</span>
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
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {rider.riderName}
                  </div>
                  <div className="text-xs text-gray-500 truncate flex items-center gap-2">
                    <span>{rider.riderTeam}</span>
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
