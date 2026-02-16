import { formatCurrencyWhole } from "@/lib/utils/formatCurrency"
import { Bid, GameType, GameConfig } from "@/lib/types"
import { useTranslation } from "react-i18next";
import { Collapsible } from "./Collapsible";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Standing {
  ranking: number;
  playername: string;
  totalPoints: number;
  participantId: string;
}

// Minimal interface for what AuctionStats needs
interface AuctionStatsGame {
  gameType: GameType | string;
  config: GameConfig | Record<string, any>;
}

export const AuctionStats = ({ gameId, game, myBids, auctionClosed, getTotalMyBids, getRemainingBudget }: { gameId: string, game: AuctionStatsGame, myBids: Bid[], auctionClosed: boolean, getTotalMyBids: () => number, getRemainingBudget: () => number }) => {

    const { t } = useTranslation();
    const isFullGrid = game.gameType === 'full-grid';
    const isSelectionBasedGame = game.gameType === 'worldtour-manager' || game.gameType === 'full-grid';

    const [standings, setStandings] = useState<Standing[]>([]);
    const [standingsLoading, setStandingsLoading] = useState(false);
    const [standingsError, setStandingsError] = useState<string | null>(null);

    // Format value as points (plain number) for full-grid, or as currency for other games
    const formatValue = (amount: number) => {
      if (isFullGrid) return `${amount} pt`;
      return formatCurrencyWhole(amount);
    };

    // Config accessors using any cast to avoid union type issues
    const cfg = game.config as any;
    const hasBudget = cfg && 'budget' in cfg;
    const hasMaxRiders = cfg && 'maxRiders' in cfg;
    const hasTeamSize = cfg && 'teamSize' in cfg;

    useEffect(() => {
      if (!gameId) return;

      const loadStandings = async () => {
        try {
          setStandingsLoading(true);
          setStandingsError(null);

          const response = await fetch(`/api/games/${gameId}/teams-overview`);
          if (!response.ok) {
            throw new Error('Kon tussenstand niet laden');
          }
          const data = await response.json();
          const teams = data.teams || [];

          const mappedStandings: Standing[] = teams.map((team: any) => ({
            ranking: team.ranking,
            playername: team.playername,
            totalPoints: team.totalPoints ?? 0,
            participantId: team.participantId,
          }));

          setStandings(mappedStandings);
        } catch (err) {
          console.error('Error loading standings:', err);
          setStandingsError(err instanceof Error ? err.message : 'Kon tussenstand niet laden');
        } finally {
          setStandingsLoading(false);
        }
      };

      loadStandings();
    }, [gameId]);

    const sortedStandings = useMemo(() => {
      return [...standings].sort((a, b) => (a.ranking ?? 0) - (b.ranking ?? 0));
    }, [standings]);

    // For marginal-gains, only show rider count stats (no budget)
    if (game.gameType === 'marginal-gains') {
        return <Collapsible title="Team Stats" defaultOpen={true} className="border border-gray-200 rounded-md p-2">
            <div className="flex items-between justify-between flex-col divide-y divide-gray-200 w-full">
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Riders Won:' : 'Selected Riders:'}
                </span>
                <span className="ml-2 font-bold text-primary">
                  {auctionClosed
                    ? new Set(myBids.filter(b => b.status === 'won').map(b => b.riderNameId)).size
                    : new Set(myBids.filter(b => b.status === 'won' || b.status === 'active').map(b => b.riderNameId)).size
                  }
                </span>
              </div>

               {hasTeamSize && cfg.teamSize && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.teamSize')}:</span>
                  <span className="ml-2 font-bold text-primary">
                    {cfg.teamSize}
                  </span>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-700">Total Points to gain:</span>
                <span className="ml-2 font-bold text-primary">
                  {myBids.reduce((acc, bid) => acc + bid.amount, 0)}
                </span>
              </div>
            </div>
        </Collapsible>
    }

    return <Collapsible title="Budget Stats" defaultOpen={true} className="border border-gray-200 rounded-md p-2">
            <div className="flex items-between justify-between flex-col divide-y divide-gray-200 w-full">
              {hasBudget && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.totalBudget')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {formatValue(Number(cfg.budget) || 0)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Total Spent:' : isSelectionBasedGame ? 'Selected Riders Total:' : 'Active Bids Total:'}
                </span>
                <span className="ml-2 font-bold text-blue-600">
                  {formatValue(getTotalMyBids())}
                </span>
              </div>
              {hasBudget && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.remainingBudget')}:</span>
                  <span className={`ml-2 font-bold ${getRemainingBudget() < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                    {formatValue(getRemainingBudget())}
                  </span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Riders Won:' : isSelectionBasedGame ? 'Selected Riders:' : 'My Active Bids:'}
                </span>
                <span className="ml-2 font-bold text-primary">
                  {auctionClosed
                    ? new Set(myBids.filter(b => b.status === 'won').map(b => b.riderNameId)).size
                    : new Set(myBids.filter(b => b.status === 'won' || b.status === 'active').map(b => b.riderNameId)).size
                  }
                </span>
              </div>
              {hasMaxRiders && cfg.maxRiders && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.maxRiders')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {cfg.maxRiders}
                  </span>
                </div>
              )}
              {hasTeamSize && cfg.teamSize && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.teamSize')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {cfg.teamSize}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm font-semibold text-gray-700 mb-2">Tussenstand</div>
              {standingsLoading ? (
                <div className="text-xs text-gray-500">Laden...</div>
              ) : standingsError ? (
                <div className="text-xs text-red-600">{standingsError}</div>
              ) : sortedStandings.length === 0 ? (
                <div className="text-xs text-gray-500">Nog geen tussenstand beschikbaar</div>
              ) : (
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {sortedStandings.map((row) => (
                        <tr key={row.participantId} className="hover:bg-gray-50">
                          <td className="py-2 pr-2 text-gray-500 w-10">#{row.ranking}</td>
                          <td className="py-2 pr-2">
                            <Link
                              href={`/games/${gameId}/team/${row.participantId}`}
                              className="font-medium text-gray-900 hover:text-primary hover:underline"
                            >
                              {row.playername}
                            </Link>
                          </td>
                          <td className="py-2 text-right font-semibold text-primary">
                            {row.totalPoints.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
    </Collapsible>
}
