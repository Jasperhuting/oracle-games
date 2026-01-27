'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { ScoreUpdateBanner } from '@/components/ScoreUpdateBanner';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { formatCurrencyWhole } from '@/lib/utils/formatCurrency';

interface Standing {
  ranking: number;
  playername: string;
  totalPoints: number;
  participantId: string;
}

const columnHelper = createColumnHelper<Standing>();

export default function StandingsPage() {
  const params = useParams();
  const { user } = useAuth();
  const gameId = params?.gameId as string;

  const [standings, setStandings] = useState<Standing[]>([]);
  const [gameName, setGameName] = useState<string>('');
  const [gameYear, setGameYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      columnHelper.accessor('totalPoints', {
        header: 'Punten',
        cell: (info) => (
          <span className="font-semibold text-primary">{info.getValue()}</span>
        ),
        size: 100,
      }),
    ],
    []
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
          totalPoints: team.totalPoints.toLocaleString(),
          participantId: team.participantId,
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
                          header.column.id === 'totalPoints' ? 'text-right' : ''
                        }`}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className={`flex items-center gap-1 ${header.column.id === 'totalPoints' ? 'justify-end' : ''}`}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
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
                          cell.column.id === 'totalPoints' ? 'text-right' : ''
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
