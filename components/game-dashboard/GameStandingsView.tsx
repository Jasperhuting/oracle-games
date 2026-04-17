'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Tooltip } from 'react-tooltip';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { ScoreUpdateBanner } from '@/components/ScoreUpdateBanner';
import { formatStandingsScore } from '@/lib/utils';

export interface GameStandingRow {
  ranking: number;
  playername: string;
  userId: string;
  totalPoints: number;
  participantId: string;
  eligibleForPrizes?: boolean;
  totalPercentageDiff?: number;
  totalSpent?: number;
  riders?: Array<{ pointsScored?: number; pricePaid?: number }>;
}

interface GameStandingsViewProps {
  standings: GameStandingRow[];
  gameId: string;
  gameName?: string;
  gameYear?: number;
  gameType: string | null;
  loading: boolean;
  error: string | null;
  backHref?: string;
  currentUserId?: string;
  embedded?: boolean;
}

const columnHelper = createColumnHelper<GameStandingRow>();

export function GameStandingsView({
  standings,
  gameId,
  gameName,
  gameYear,
  gameType,
  loading,
  error,
  backHref = '/games',
  currentUserId,
  embedded = false,
}: GameStandingsViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showPrizeEligibleOnly, setShowPrizeEligibleOnly] = useState(false);
  const [prizesExpanded, setPrizesExpanded] = useState(false);
  const [showPrizesModal, setShowPrizesModal] = useState(false);

  const prizeEligibleCount = useMemo(
    () => standings.filter((standing) => standing.eligibleForPrizes).length,
    [standings]
  );
  const filteredStandings = useMemo(
    () =>
      showPrizeEligibleOnly
        ? standings
            .filter((standing) => standing.eligibleForPrizes)
            .map((standing, index) => ({
              ...standing,
              ranking: index + 1,
            }))
        : standings,
    [showPrizeEligibleOnly, standings]
  );
  const isFullGrid = (gameType || '').toLowerCase() === 'full-grid';

  const columns = useMemo(() => {
    const allColumns: ColumnDef<GameStandingRow, any>[] = [
      columnHelper.accessor('ranking', {
        header: '#',
        cell: (info) => {
          const ranking = info.getValue();
          return (
            <span
              className={`font-bold ${
                ranking === 1
                  ? 'text-yellow-500'
                  : ranking === 2
                  ? 'text-gray-400'
                  : ranking === 3
                  ? 'text-amber-600'
                  : 'text-gray-500'
              }`}
            >
              {ranking}
            </span>
          );
        },
        size: 60,
      }),
      columnHelper.accessor('playername', {
        header: 'Speler',
        cell: (info) => {
          const showPrize = info.row.original.eligibleForPrizes;
          const userId = info.row.original.userId;
          const isCurrentUser = currentUserId === userId;
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/user/${userId}`}
                className={`${isCurrentUser ? 'font-bold' : 'font-medium'} text-sm text-gray-900 hover:text-primary hover:underline cursor-pointer whitespace-nowrap truncate`}
              >
                {info.getValue()}
              </Link>
              {showPrize ? (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 text-amber-900 shadow-sm ring-1 ring-amber-200"
                  title="Speelt mee voor prijzen"
                  aria-label="Speelt mee voor prijzen"
                  data-tooltip-id="standings-prize-tooltip"
                  data-tooltip-content="Deze speler doet mee voor de prijzen"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor">
                    <path d="M19 4h-3V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a5 5 0 0 0 4 4.9V14a3 3 0 0 0 2 2.83V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.17A3 3 0 0 0 16 14v-2.1A5 5 0 0 0 20 7V5a1 1 0 0 0-1-1zM6 7V6h2v3.83A3 3 0 0 1 6 7zm12 0a3 3 0 0 1-2 2.83V6h2v1zM10 5V4h4v1h-4z" />
                  </svg>
                </span>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor(
        (row) => (row.riders ?? []).reduce((sum, rider) => sum + (rider?.pointsScored || 0), 0),
        {
          id: 'achievedPoints',
          header: 'Punten',
          cell: (info) => (
            <span className="font-semibold text-primary">{formatStandingsScore(info.getValue())}</span>
          ),
          size: 140,
        }
      ),
    ];

    if (!isFullGrid) {
      allColumns.push(
        columnHelper.accessor(
          (row): number | undefined => {
            if (gameType === 'marginal-gains') {
              const pricePaid = row.totalSpent ?? 0;
              if (pricePaid <= 0) return undefined;

              const pointsScored = (row.riders ?? []).reduce(
                (sum, rider) => sum + (rider?.pointsScored || 0),
                0
              );
              const marginalGainsValue = pointsScored - pricePaid;
              return (marginalGainsValue / pricePaid) * 100;
            }

            return row.totalPercentageDiff;
          },
          {
            id: 'percentage',
            header: () => (
              <span
                data-tooltip-id="standings-percentage-tooltip"
                data-tooltip-content={
                  gameType === 'marginal-gains'
                    ? 'Berekening: ((punten - betaald) / betaald) × 100'
                    : 'Berekening: ((betaald - waarde) / waarde) × 100'
                }
              >
                Verschil
              </span>
            ),
            cell: (info) => {
              const percentage = info.getValue();
              const percentageClass =
                percentage === undefined
                  ? 'text-gray-600'
                  : percentage > 0
                    ? gameType === 'marginal-gains'
                      ? 'text-green-600'
                      : 'text-red-600'
                    : percentage < 0
                      ? gameType === 'marginal-gains'
                        ? 'text-red-600'
                        : 'text-green-600'
                      : 'text-gray-600';

              return (
                <span className={`font-medium ${percentageClass}`}>
                  {percentage === undefined
                    ? '-'
                    : gameType === 'marginal-gains'
                      ? `${Math.round(percentage)}%`
                      : `${percentage > 0 ? '+' : ''}${percentage}%`}
                </span>
              );
            },
            size: 120,
            sortingFn: 'basic',
            sortUndefined: 'last',
          }
        ),
        columnHelper.accessor('totalPoints', {
          id: 'totalPoints',
          header: 'Totaal',
          cell: (info) => (
            <span className="font-semibold text-primary">{formatStandingsScore(info.getValue())}</span>
          ),
          size: 100,
        })
      );
    }

    if (gameType === 'auctioneer') {
      return allColumns.filter((column) => column.id !== 'percentage' && column.id !== 'totalPoints');
    }

    if (gameType === 'worldtour-manager') {
      return allColumns.filter((column) => column.id !== 'achievedPoints' && column.id !== 'percentage');
    }

    return allColumns;
  }, [currentUserId, gameType, isFullGrid]);

  const table = useReactTable({
    data: filteredStandings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handlePrizesButtonClick = (e: React.MouseEvent) => {
    if (prizesExpanded) {
      e.preventDefault();
      setShowPrizesModal(true);
    } else {
      e.preventDefault();
      setPrizesExpanded(true);
    }
  };

  if (loading) {
    return (
      <div className={`${embedded ? 'py-12' : 'min-h-screen'} bg-gray-50 flex items-center justify-center`}>
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${embedded ? 'py-12' : 'min-h-screen'} bg-gray-50 flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          {!embedded && (
            <Link href={backHref} className="text-blue-600 hover:text-blue-700">
              Terug naar games
            </Link>
          )}
        </div>
      </div>
    );
  }

  const content = (
    <>
      {showPrizesModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/40" aria-label="Sluit prijzen" onClick={() => setShowPrizesModal(false)} />
          <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Prijzen</h3>
              <button className="text-gray-500 hover:text-gray-700" aria-label="Sluit" onClick={() => setShowPrizesModal(false)}>
                ×
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">1e prijs</div>
                <div>&#39;Bike &amp; Pancakes&#39; arrangement voor 4 personen.</div>
                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img src="https://bercbike.nl/wp-content/uploads/2023/02/gravelbike-huren-montferland-1024x683.jpg" alt="1e prijs - Bike & Pancakes arrangement" className="w-full h-40 object-cover" loading="lazy" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">2e prijs</div>
                <div>Gravel arrangement voor 2 personen.</div>
                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img src="https://bercbike.nl/wp-content/uploads/2021/11/mtb-verhuur-zeddam-montferland.jpg" alt="2e prijs - Gravel arrangement" className="w-full h-40 object-cover" loading="lazy" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">3e prijs</div>
                <div>&#39;Proefritje&#39; te nuttigen in het wielercafe in Zeddam</div>
                <div className="text-xs text-gray-500">(3 speciaalbiertjes geserveerd met lokale kaas &amp; worst)</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img src="https://bercbike.nl/wp-content/uploads/2021/07/achterhoekse-bieren-wielercafe-1024x1024.jpg" alt="3e prijs - Proefritje" className="w-full h-40 object-cover" loading="lazy" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">4e &amp; 5e prijs</div>
                <div>een &#39;Veloholic&#39; shirt</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img src="https://res.cloudinary.com/dtkg71eih/image/upload/v1771949728/wielershirt_z4m8wc.jpg" alt="4e en 5e prijs - Veloholic shirt" className="w-full h-40 object-cover" loading="lazy" />
                </div>
              </div>
              <div className="text-xs text-gray-500">
                * Het buffje mag je houden als aandenken aan een leuke sportieve middag!
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
              <button type="button" onClick={() => setShowPrizesModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900">
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {!embedded && gameYear && <ScoreUpdateBanner year={gameYear} gameId={gameId} />}

      <Tooltip
        id="standings-percentage-tooltip"
        delayShow={0}
        className="!opacity-100"
        render={({ content }) => <div className="text-sm whitespace-pre-line">{String(content || '')}</div>}
      />
      <Tooltip
        id="standings-prize-tooltip"
        delayShow={0}
        className="!opacity-100"
        render={({ content }) => <div className="text-sm whitespace-pre-line">{String(content || '')}</div>}
      />

      {!embedded && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tussenstand</h1>
              {gameName && <p className="text-gray-600">{gameName}</p>}
            </div>
            <Link href={backHref} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
              Terug
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {gameType !== 'worldtour-manager' && gameType !== 'auctioneer' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrizeEligibleOnly((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showPrizeEligibleOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {showPrizeEligibleOnly ? 'Toon alle deelnemers' : 'Alleen voor prijzen'}
            </button>
            <button
              onClick={handlePrizesButtonClick}
              className={`h-12 rounded-full shadow-lg flex items-center cursor-pointer transition-all duration-300 ease-out bg-white hover:bg-emerald-50 overflow-hidden border border-emerald-200 ${prizesExpanded ? 'px-4 gap-2' : 'w-12 justify-center'}`}
            >
              <div className="flex-shrink-0 w-9 h-9 bg-white flex items-center justify-center overflow-hidden">
                <Image src="/berc-bike-logo.jpg" alt="Berc Bike" width={36} height={36} className="w-fit h-fit object-contain" />
              </div>
              <span className={`text-sm text-emerald-700 font-medium whitespace-nowrap transition-all duration-300 ${prizesExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0'}`}>
                Prijzen
              </span>
            </button>
          </div>
          )}
          <span className="text-sm text-gray-600">
            {showPrizeEligibleOnly
              ? `${prizeEligibleCount} deelnemers voor prijzen`
              : `${standings.length} deelnemers totaal`}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredStandings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {showPrizeEligibleOnly ? 'Geen deelnemers die meespelen voor prijzen' : 'Nog geen tussenstand beschikbaar'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 ${
                        ['totalPoints', 'percentage', 'achievedPoints'].includes(header.column.id) ? 'text-right' : ''
                      }`}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={`flex items-center gap-1 whitespace-nowrap ${['totalPoints', 'percentage', 'achievedPoints'].includes(header.column.id) ? 'justify-end' : ''}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() ? <span className="ml-1">{header.column.getIsSorted() === 'asc' ? '↑' : '↓'}</span> : null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${row.original.userId === currentUserId ? 'bg-blue-50/70' : ''}`}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-4 py-3 ${['totalPoints', 'percentage', 'achievedPoints'].includes(cell.column.id) ? 'text-right' : ''}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 mt-9">{content}</div>
    </div>
  );
}
