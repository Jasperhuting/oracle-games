'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  oddsUserId: string;
}

interface GameWithStandings {
  gameId: string;
  gameName: string;
  standings: Standing[];
}

const columnHelper = createColumnHelper<Standing>();

export function MyGamesStandings() {
  const { user } = useAuth();
  const [games, setGames] = useState<GameWithStandings[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('ranking', {
        header: '#',
        cell: (info) => {
          const ranking = info.getValue();
          const isCurrentUser = info.row.original.oddsUserId === user?.uid;
          return (
            <span
              className={`${isCurrentUser ? 'font-bold' : 'font-medium'} ${
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
          const isCurrentUser = info.row.original.oddsUserId === user?.uid;
          return (
            <span className={`${isCurrentUser ? 'font-bold text-primary' : 'font-medium text-gray-900'}`}>
              {info.getValue()}
              {isCurrentUser && ' (jij)'}
            </span>
          );
        },
      }),
      columnHelper.accessor('totalPoints', {
        header: 'Punten',
        cell: (info) => {
          const isCurrentUser = info.row.original.oddsUserId === user?.uid;
          return (
            <span className={`${isCurrentUser ? 'font-bold' : 'font-semibold'} text-primary`}>
              {info.getValue()}
            </span>
          );
        },
        size: 100,
      }),
    ],
    [user?.uid]
  );

  const activeGame = games.find(g => g.gameId === activeTab);

  const table = useReactTable({
    data: activeGame?.standings || [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  useEffect(() => {
    async function fetchMyGamesAndStandings() {
      if (!user) return;

      setLoading(true);

      try {
        // Fetch user's participations
        const participantsResponse = await fetch(`/api/gameParticipants?userId=${user.uid}`);
        if (!participantsResponse.ok) {
          throw new Error('Failed to load participations');
        }

        const participantsData = await participantsResponse.json();
        const participants = participantsData.participants || [];

        // Get unique game IDs (remove -pending suffix)
        const gameIds = [...new Set(
          participants
            .map((p: any) => p.gameId.replace(/-pending$/, ''))
            .filter((id: string) => id)
        )] as string[];

        // Fetch standings for each game
        const gamesWithStandings: GameWithStandings[] = [];

        for (const gameId of gameIds) {
          try {
            // Fetch game info
            const gameResponse = await fetch(`/api/games/${gameId}`);
            const gameData = gameResponse.ok ? await gameResponse.json() : null;
            const gameName = gameData?.game?.name || gameId;
            const gameStatus = gameData?.game?.status;

            // Only show games that are bidding, active, or finished
            if (!['bidding', 'active', 'finished'].includes(gameStatus)) {
              continue;
            }

            // Fetch standings
            const standingsResponse = await fetch(`/api/games/${gameId}/teams-overview`);
            if (!standingsResponse.ok) continue;

            const standingsData = await standingsResponse.json();
            const teams = standingsData.teams || [];

            const standings: Standing[] = teams.map((team: any) => ({
              ranking: team.ranking,
              playername: team.playername,
              totalPoints: team.totalPoints,
              participantId: team.participantId,
              oddsUserId: team.userId,
            }));

            gamesWithStandings.push({
              gameId,
              gameName,
              standings,
            });
          } catch (err) {
            console.error(`Error fetching standings for game ${gameId}:`, err);
          }
        }

        setGames(gamesWithStandings);
        if (gamesWithStandings.length > 0 && !activeTab) {
          setActiveTab(gamesWithStandings[0].gameId);
        }
      } catch (err) {
        console.error('Error fetching games:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMyGamesAndStandings();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Tussenstand</h2>
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Tussenstand</h2>
        <div className="text-gray-500">Je speelt nog niet mee in actieve games.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Tussenstand</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {games.map((game) => (
            <button
              key={game.gameId}
              onClick={() => setActiveTab(game.gameId)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === game.gameId
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {game.gameName}
            </button>
          ))}
        </div>
      </div>

      {/* Standings Table */}
      <div className="p-4">
        {activeGame && activeGame.standings.length > 0 ? (
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    const isFirst = index === 0;
                    const isLast = index === headerGroup.headers.length - 1;
                    return (
                      <th
                        key={header.id}
                        className={`pb-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 ${isFirst ? 'pl-4' : ''} ${isLast ? 'pr-4' : ''} ${
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
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => {
                const isCurrentUser = row.original.oddsUserId === user?.uid;
                return (
                  <tr
                    key={row.id}
                    className={`${isCurrentUser ? 'bg-primary/10 rounded-lg' : 'hover:bg-gray-50'}`}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirst = index === 0;
                      const isLast = index === row.getVisibleCells().length - 1;
                      return (
                        <td
                          key={cell.id}
                          className={`py-3 ${isFirst ? 'pl-4' : ''} ${isLast ? 'pr-4' : ''} ${
                            cell.column.id === 'totalPoints' ? 'text-right' : ''
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nog geen tussenstand beschikbaar
          </div>
        )}
      </div>
    </div>
  );
}
