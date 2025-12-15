import { Bid } from "@/lib/types";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { useTranslation } from "react-i18next";
import RangeSlider from 'react-range-slider-input';
import { Button } from "./Button";
import { GameData, RiderWithBid } from "@/app/games/[gameId]/auction/page";
import { Star, Users } from "tabler-icons-react";
import { Toggle } from "./Toggle";
import { Collapsible } from "./Collapsible";

export const AuctionFilters = ({
    searchTerm,
    setSearchTerm,
    priceRange,
    setPriceRange,
    minRiderPrice,
    maxRiderPrice,
    myBids,
    handleResetBidsClick,
    game,
    showOnlyFillers,
    setshowOnlyFillers,
    hideSoldPlayers,
    setHideSoldPlayers,
    sortedAndFilteredRiders,

}: {
    searchTerm: string,
    setSearchTerm: (searchTerm: string) => void,
    priceRange: [number, number],
    setPriceRange: (priceRange: [number, number]) => void,
    minRiderPrice: number,
    maxRiderPrice: number,
    myBids: Bid[],
    handleResetBidsClick: () => void,
    game: GameData,
    showOnlyFillers: boolean,
    setshowOnlyFillers: (showOnlyFillers: boolean) => void,
    hideSoldPlayers: boolean,
    setHideSoldPlayers: (hideSoldPlayers: boolean) => void
    sortedAndFilteredRiders: RiderWithBid[] 
}) => {


    const { t } = useTranslation();

    return <Collapsible title="Filters" defaultOpen={true} className="mb-4 bg-white border border-gray-200 rounded-md p-2">
        <div className="flex flex-col gap-4">

        <span className="flex flex-col flex-1">
            <label htmlFor="search" className="text-sm font-bold text-gray-700">{t('global.search')}</label>
            <input
                type="text"
                placeholder={t('games.auctions.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
        </span>
        <span className="flex flex-col flex-1 justify-center">
            <label htmlFor="price-range" className="text-sm font-bold text-gray-700">
                {t('games.auctions.priceRangeLabel')}: {formatCurrencyWhole(priceRange[0])} - {formatCurrencyWhole(priceRange[1])}
            </label>
            <div className="py-2 mt-2">
                <RangeSlider
                    min={minRiderPrice}
                    max={maxRiderPrice}
                    value={priceRange}
                    onInput={(value: number[]) => setPriceRange([value[0], value[1]])}
                />
            </div>
        </span>
        <span className="flex flex-col flex-1 justify-center">
            <label htmlFor="price-range" className="text-sm font-bold text-gray-700">
                {t('games.auctions.resetAllBids')}
            </label>
            <Button text={t('games.auctions.resetAllBids')} disabled={!myBids.some(bid => bid.status === 'active' || bid.status === 'outbid')} onClick={handleResetBidsClick} />
        </span>

        {game.gameType === 'worldtour-manager' ? (
                  <Button onClick={() => setshowOnlyFillers(!showOnlyFillers)}>
                    <span className={`flex flex-row gap-2 items-center`}>
                      {showOnlyFillers ? <><Users />{t('global.showAllRiders')}</> : <><Star />{t('global.showOnlyFillers')}</>}
                    </span>
                  </Button>
                ) : (sortedAndFilteredRiders.find((rider) => rider.soldTo) || hideSoldPlayers) && <Toggle
                  toggleOn={() => setHideSoldPlayers(false)}
                  toggleOff={() => setHideSoldPlayers(true)}
                  status={!hideSoldPlayers}
                  onText={t('global.showSoldPlayers')}
                  offText={t('global.hideSoldPlayers')}
                />}
        </div>
    </Collapsible>
}