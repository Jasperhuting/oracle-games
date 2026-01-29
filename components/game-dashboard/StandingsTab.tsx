'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Tooltip } from 'react-tooltip';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';

interface Standing {
  ranking: number;
  playername: string;
  totalPoints: number;
  participantId: string;
  totalPercentageDiff?: number;
  totalSpent?: number;
  riders?: Array<{ pointsScored?: number; pricePaid?: number }>;
}

interface StandingsTabProps {
  gameId: string;
  standings: Standing[];
  gameType: string | null;
  loading: boolean;
  error: string | null;
}

const columnHelper = createColumnHelper<Standing>();

export function StandingsTab({ gameId, standings, gameType, loading, error }: StandingsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
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
        cell: (info) => (
          <Link
            href={`/games/${gameId}/team/${info.row.original.participantId}`}
            className="font-medium text-gray-900 hover:text-primary hover:underline cursor-pointer"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor(
        (row) => (row.riders ?? []).reduce((sum, rider) => sum + (rider?.pointsScored || 0), 0),
        {
          id: 'achievedPoints',
          header: 'Behaalde punten',
          cell: (info) => (
            <span className="font-semibold text-primary">{info.getValue().toLocaleString()}</span>
          ),
          size: 140,
        }
      ),
      columnHelper.accessor(
        (row) => {
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
        header: 'Punten',
        cell: (info) => (
          <span className="font-semibold text-primary">{info.getValue().toLocaleString()}</span>
        ),
        size: 100,
      }),
    ],
    [gameId, gameType]
  );

  const table = useReactTable({
    data: standings,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <Tooltip
        id="standings-percentage-tooltip"
        delayShow={0}
        className="!opacity-100"
        render={({ content }) => (
          <div className="text-sm whitespace-pre-line">
            {String(content || '')}
          </div>
        )}
      />

      {/* Standings Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {standings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nog geen tussenstand beschikbaar
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
                        header.column.id === 'totalPoints' || header.column.id === 'percentage' || header.column.id === 'achievedPoints' ? 'text-right' : ''
                      }`}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={`flex items-center gap-1 whitespace-nowrap ${header.column.id === 'totalPoints' || header.column.id === 'percentage' || header.column.id === 'achievedPoints' ? 'justify-end' : ''}`}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() ? (
                          <span className="ml-1">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-4 py-3 ${
                        cell.column.id === 'totalPoints' || cell.column.id === 'percentage' || cell.column.id === 'achievedPoints' ? 'text-right' : ''
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
