'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { ScoreUpdateBanner } from '@/components/ScoreUpdateBanner';
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
  eligibleForPrizes?: boolean;
}

const columnHelper = createColumnHelper<Standing>();

export default function StandingsPage() {
  const params = useParams();
  const { user } = useAuth();
  const gameId = params?.gameId as string;

  const [standings, setStandings] = useState<Standing[]>([]);
  const [gameName, setGameName] = useState<string>('');
  const [gameYear, setGameYear] = useState<number>(new Date().getFullYear());
  const [gameType, setGameType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingPrizeEligibility, setUpdatingPrizeEligibility] = useState<Record<string, boolean>>({});

  const showPrizeEligibility = isAdmin && gameType === 'full-grid';

  const togglePrizeEligibility = useCallback(async (participantId: string, nextValue: boolean) => {
    if (!user) return;

    setUpdatingPrizeEligibility(prev => ({ ...prev, [participantId]: true }));

    try {
      const response = await fetch(`/api/gameParticipants/${participantId}/prize-eligibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          userId: user.uid,
        },
        body: JSON.stringify({ eligibleForPrizes: nextValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update prize eligibility');
      }

      setStandings(prev => prev.map(row => (
        row.participantId === participantId
          ? { ...row, eligibleForPrizes: nextValue }
          : row
      )));
    } catch (err) {
      console.error('Error updating prize eligibility:', err);
    } finally {
      setUpdatingPrizeEligibility(prev => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
    }
  }, [user]);

  const columns = useMemo(
    () => {
      const baseColumns = [
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
      ];

      if (showPrizeEligibility) {
        baseColumns.push(
          columnHelper.accessor('eligibleForPrizes', {
            header: 'Prijzen',
            cell: (info) => {
              const eligible = info.getValue() ?? true;
              const participantId = info.row.original.participantId;
              const isUpdating = updatingPrizeEligibility[participantId];

              return (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={eligible}
                    disabled={isUpdating}
                    onChange={() => togglePrizeEligibility(participantId, !eligible)}
                  />
                  <span className="text-xs text-gray-600">
                    {eligible ? 'Ja' : 'Nee'}
                  </span>
                </label>
              );
            },
            size: 120,
          })
        );
      }

      return baseColumns;
    },
    [gameId, gameType, showPrizeEligibility, togglePrizeEligibility, updatingPrizeEligibility]
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

  useEffect(() => {
    if (!user) return;

    const checkAdmin = async () => {
      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (response.ok) {
          const userData = await response.json();
          setIsAdmin(userData.userType === 'admin');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdmin();
  }, [user]);

  useEffect(() => {
    async function fetchStandings() {
      if (!gameId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch game info for the name
        const gameResponse = await fetch(`/api/games/${gameId}`);

        if (gameResponse.ok) {
          const gameData = await gameResponse.json();
          setGameName(gameData.game?.name || '');
          if (typeof gameData.game?.year === 'number') {
            setGameYear(gameData.game.year);
          }
          setGameType(gameData.game?.gameType ?? gameData.game?.config?.gameType ?? null);
        }

        // Fetch standings
        const response = await fetch(`/api/games/${gameId}/teams-overview`);
        if (!response.ok) {
          throw new Error('Failed to load standings');
        }
        const data = await response.json();
        const teams = data.teams || [];

        const mappedStandings: Standing[] = teams.map((team: any) => ({
          ranking: team.ranking,
          playername: team.playername,
          totalPoints: team.totalPoints ?? 0,
          participantId: team.participantId,
          eligibleForPrizes: team.eligibleForPrizes ?? true,
          totalPercentageDiff: team.totalPercentageDiff,
          totalSpent: team.totalSpent,
          riders: team.riders,
        }));

        setStandings(mappedStandings);
      } catch (err) {
        console.error('Error loading standings:', err);
        setError('Kon tussenstand niet laden');
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
  }, [gameId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link
            href="/games"
            className="text-blue-600 hover:text-blue-700"
          >
            Terug naar games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ScoreUpdateBanner year={gameYear} gameId={gameId} />
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
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Tussenstand
              </h1>
              {gameName && (
                <p className="text-gray-600">{gameName}</p>
              )}
            </div>
            <Link
              href="/games"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Terug
            </Link>
          </div>
        </div>

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
    </div>
  );
}
