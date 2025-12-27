import { formatCurrencyWhole } from "@/lib/utils/formatCurrency"
import { Bid } from "@/lib/types"
import { useTranslation } from "react-i18next";
import { GameData } from "@/app/games/[gameId]/auction/page";
import { Collapsible } from "./Collapsible";

export const AuctionStats = ({ game, myBids, auctionClosed, getTotalMyBids, getRemainingBudget }: { game: GameData, myBids: Bid[], auctionClosed: boolean, getTotalMyBids: () => number, getRemainingBudget: () => number }) => {

    const { t } = useTranslation();
    const isMarginalGains = game?.gameType === 'marginal-gains';

    // For marginal-gains, only show rider count stats (no budget)
    if (isMarginalGains) {
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
              {game.config.maxRiders && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.maxRiders')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {game.config.maxRiders}
                  </span>
                </div>
              )}
            </div>
        </Collapsible>
    }

    return <Collapsible title="Budget Stats" defaultOpen={true} className="border border-gray-200 rounded-md p-2">
            <div className="flex items-between justify-between flex-col divide-y divide-gray-200 w-full">
              <div>
                <span className="text-sm font-medium text-gray-700">{t('games.auctions.totalBudget')}:</span>
                <span className="ml-2 font-bold text-gray-900">
                  {formatCurrencyWhole(game?.config?.budget || 0)}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Total Spent:' : game.gameType === 'worldtour-manager' ? 'Selected Riders Total:' : 'Active Bids Total:'}
                </span>
                <span className="ml-2 font-bold text-blue-600">
                  {formatCurrencyWhole(getTotalMyBids())}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">{t('games.auctions.remainingBudget')}:</span>
                <span className={`ml-2 font-bold ${getRemainingBudget() < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                  {formatCurrencyWhole(getRemainingBudget())}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Riders Won:' : game.gameType === 'worldtour-manager' ? 'Selected Riders:' : 'My Active Bids:'}
                </span>
                <span className="ml-2 font-bold text-primary">
                  {auctionClosed
                    ? new Set(myBids.filter(b => b.status === 'won').map(b => b.riderNameId)).size
                    : new Set(myBids.filter(b => b.status === 'won' || b.status === 'active').map(b => b.riderNameId)).size
                  }
                </span>
              </div>
              {game.config.maxRiders && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.maxRiders')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {game.config.maxRiders}
                  </span>
                </div>
              )}
            </div>
    </Collapsible>
}