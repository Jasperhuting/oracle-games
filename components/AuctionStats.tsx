import { formatCurrencyWhole } from "@/lib/utils/formatCurrency"
import { Bid, GameType, GameConfig, LastManStandingConfig, PoisonedCupConfig, RisingStarsConfig, MarginalGainsConfig, AuctioneerConfig, WorldTourManagerConfig, GiorgioArmadaConfig } from "@/lib/types"
import { useTranslation } from "react-i18next";
import { Collapsible } from "./Collapsible";

// Minimal interface for what AuctionStats needs
interface AuctionStatsGame {
  gameType: GameType | string;
  config: GameConfig | Record<string, any>;
}

export const AuctionStats = ({ game, myBids, auctionClosed, getTotalMyBids, getRemainingBudget }: { game: AuctionStatsGame, myBids: Bid[], auctionClosed: boolean, getTotalMyBids: () => number, getRemainingBudget: () => number }) => {

    const { t } = useTranslation();

    // Helper to check if config has budget property
    const hasBudget = (config: any): config is (AuctioneerConfig | LastManStandingConfig | PoisonedCupConfig | WorldTourManagerConfig | GiorgioArmadaConfig) => {
      return 'budget' in config;
    };

    // Helper to check if config has maxRiders property
    const hasMaxRiders = (config: any): config is (AuctioneerConfig | WorldTourManagerConfig) => {
      return 'maxRiders' in config;
    };

    // Helper to check if config has teamSize property
    const hasTeamSize = (config: any): config is (LastManStandingConfig | PoisonedCupConfig | RisingStarsConfig | MarginalGainsConfig) => {
      return 'teamSize' in config;
    };

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

               {hasTeamSize(game.config) && game.config.teamSize && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.teamSize')}:</span>
                  <span className="ml-2 font-bold text-primary">
                    {game.config.teamSize}
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
              {hasBudget(game.config) && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.totalBudget')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {formatCurrencyWhole(game.config.budget || 0)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Total Spent:' : game.gameType === 'worldtour-manager' ? 'Selected Riders Total:' : 'Active Bids Total:'}
                </span>
                <span className="ml-2 font-bold text-blue-600">
                  {formatCurrencyWhole(getTotalMyBids())}
                </span>
              </div>
              {hasBudget(game.config) && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.remainingBudget')}:</span>
                  <span className={`ml-2 font-bold ${getRemainingBudget() < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                    {formatCurrencyWhole(getRemainingBudget())}
                  </span>
                </div>
              )}
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
              {hasMaxRiders(game.config) && game.config.maxRiders && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.maxRiders')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {game.config.maxRiders}
                  </span>
                </div>
              )}
              {hasTeamSize(game.config) && game.config.teamSize && (
                <div>
                  <span className="text-sm font-medium text-gray-700">{t('games.auctions.teamSize')}:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {game.config.teamSize}
                  </span>
                </div>
              )}
            </div>
    </Collapsible>
}