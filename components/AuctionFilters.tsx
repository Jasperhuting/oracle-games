import { Bid } from "@/lib/types";
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

    return <Collapsible title="Filters" defaultOpen={true} className="bg-white border border-gray-200 rounded-md p-2">
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
                {t('games.auctions.priceRangeLabel')}
            </label>
            <div className="py-2 mt-2">
                <RangeSlider
                    min={minRiderPrice}
                    max={maxRiderPrice}
                    value={priceRange}
                    onInput={(value: number[]) => setPriceRange([value[0], value[1]])}
                />
            </div>
            <div className="flex items-center justify-between mt-1">
                <input
                    type="number"
                    min={minRiderPrice}
                    max={priceRange[1]}
                    value={priceRange[0]}
                    onChange={(e) => {
                        const value = Math.max(minRiderPrice, Math.min(Number(e.target.value), priceRange[1]));
                        setPriceRange([value, priceRange[1]]);
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
                <input
                    type="number"
                    min={priceRange[0]}
                    max={maxRiderPrice}
                    value={priceRange[1]}
                    onChange={(e) => {
                        const value = Math.min(maxRiderPrice, Math.max(Number(e.target.value), priceRange[0]));
                        setPriceRange([priceRange[0], value]);
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
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
                      {showOnlyFillers ? <><Users size="15" />{t('global.showAllRiders')}</> : <><Star size="15" />{t('global.showOnlyFillers')}</>}
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