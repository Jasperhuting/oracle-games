import { Bid, Game, GameData, RiderWithBid } from "@/lib/types";
import { useTranslation } from "react-i18next";
import RangeSlider from 'react-range-slider-input';
import { Button } from "./Button";
import { Star, Users } from "tabler-icons-react";
import { Toggle } from "./Toggle";
import { Collapsible } from "./Collapsible";
import { useState, useEffect } from "react";

export const AuctionFilters = ({
    searchTerm,
    setSearchTerm,
    priceRange,
    setPriceRange,
    minRiderPrice,
    maxRiderPrice,
    ageRange,
    setAgeRange,
    minRiderAge,
    maxRiderAge,
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
    ageRange?: [number, number],
    setAgeRange?: (ageRange: [number, number]) => void,
    minRiderAge?: number,
    maxRiderAge?: number,
    myBids: Bid[],
    handleResetBidsClick: () => void,
    game: Game,
    showOnlyFillers: boolean,
    setshowOnlyFillers: (showOnlyFillers: boolean) => void,
    hideSoldPlayers: boolean,
    setHideSoldPlayers: (hideSoldPlayers: boolean) => void
    sortedAndFilteredRiders: RiderWithBid[]
}) => {

    const isMarginalGains = game?.gameType === 'marginal-gains';
    const { t } = useTranslation();

    // Lokale state voor price inputs
    const [priceMinInput, setPriceMinInput] = useState(priceRange[0].toString());
    const [priceMaxInput, setPriceMaxInput] = useState(priceRange[1].toString());

    // Lokale state voor age inputs
    const [ageMinInput, setAgeMinInput] = useState(ageRange?.[0].toString() ?? '');
    const [ageMaxInput, setAgeMaxInput] = useState(ageRange?.[1].toString() ?? '');

    // Update lokale state wanneer de externe priceRange verandert (bijv. via slider)
    useEffect(() => {
        setPriceMinInput(priceRange[0].toString());
        setPriceMaxInput(priceRange[1].toString());
    }, [priceRange]);

    // Update lokale state wanneer de externe ageRange verandert (bijv. via slider)
    useEffect(() => {
        if (ageRange) {
            setAgeMinInput(ageRange[0].toString());
            setAgeMaxInput(ageRange[1].toString());
        }
    }, [ageRange]);

    // Debounce voor price min
    useEffect(() => {
        const timer = setTimeout(() => {
            if (priceMinInput === '') return; // Niet valideren bij lege string
            const value = Number(priceMinInput);
            if (!isNaN(value)) {
                const clampedValue = Math.max(minRiderPrice, Math.min(value, priceRange[1]));
                setPriceRange([clampedValue, priceRange[1]]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [priceMinInput]);

    // Debounce voor price max
    useEffect(() => {
        const timer = setTimeout(() => {
            if (priceMaxInput === '') return; // Niet valideren bij lege string
            const value = Number(priceMaxInput);
            if (!isNaN(value)) {
                const clampedValue = Math.min(maxRiderPrice, Math.max(value, priceRange[0]));
                setPriceRange([priceRange[0], clampedValue]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [priceMaxInput]);

    // Debounce voor age min
    useEffect(() => {
        if (ageRange && setAgeRange && minRiderAge !== undefined) {
            const timer = setTimeout(() => {
                if (ageMinInput === '') return; // Niet valideren bij lege string
                const value = Number(ageMinInput);
                if (!isNaN(value)) {
                    const clampedValue = Math.max(minRiderAge, Math.min(value, ageRange[1]));
                    setAgeRange([clampedValue, ageRange[1]]);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [ageMinInput]);

    // Debounce voor age max
    useEffect(() => {
        if (ageRange && setAgeRange && maxRiderAge !== undefined) {
            const timer = setTimeout(() => {
                if (ageMaxInput === '') return; // Niet valideren bij lege string
                const value = Number(ageMaxInput);
                if (!isNaN(value)) {
                    const clampedValue = Math.min(maxRiderAge, Math.max(value, ageRange[0]));
                    setAgeRange([ageRange[0], clampedValue]);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [ageMaxInput]);

    return <Collapsible title="Filters" defaultOpen={true} className="bg-white border border-gray-200 sticky top-0 rounded-md p-2">
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
                {game?.gameType === 'marginal-gains' ? 'Puntenklasse' : t('games.auctions.priceRangeLabel')}
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
                    value={priceMinInput}
                    onChange={(e) => setPriceMinInput(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
                <input
                    type="number"
                    min={priceRange[0]}
                    max={maxRiderPrice}
                    value={priceMaxInput}
                    onChange={(e) => setPriceMaxInput(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
            </div>
        </span>
        {isMarginalGains && ageRange && setAgeRange && minRiderAge !== undefined && maxRiderAge !== undefined && (
            <span className="flex flex-col flex-1 justify-center">
                <label htmlFor="age-range" className="text-sm font-bold text-gray-700">
                    Leeftijd
                </label>
                <div className="py-2 mt-2">
                    <RangeSlider
                        min={minRiderAge}
                        max={maxRiderAge}
                        value={ageRange}
                        onInput={(value: number[]) => setAgeRange([value[0], value[1]])}
                    />
                </div>
                <div className="flex items-center justify-between mt-1">
                    <input
                        type="number"
                        min={minRiderAge}
                        max={ageRange[1]}
                        value={ageMinInput}
                        onChange={(e) => setAgeMinInput(e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <input
                        type="number"
                        min={ageRange[0]}
                        max={maxRiderAge}
                        value={ageMaxInput}
                        onChange={(e) => setAgeMaxInput(e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                </div>
            </span>
        )}
        <div className="flex flex-row flex-1 gap-2 justify-start">
        <span className="flex flex-col flex-1 justify-center">
            <Button className="whitespace-nowrap" text={game.bidding ? t('games.auctions.resetAllBids') : t('games.auctions.resetAllSelects')} disabled={!myBids.some(bid => bid.status === 'active' || bid.status === 'outbid')} onClick={handleResetBidsClick} />
        </span>

        {!game.bidding ? (
            <span>
                  <Button  onClick={() => setshowOnlyFillers(!showOnlyFillers)}>
                    <span className={`flex flex-row gap-2 items-center whitespace-nowrap`}>
                      {showOnlyFillers ? <><Users size="15" />{t('global.showAllRiders')}</> : <><Star size="15" />{t('global.showOnlyFillers')}</>}
                    </span>
                  </Button>
                  </span>
                ) : (sortedAndFilteredRiders.find((rider) => rider.soldTo) || hideSoldPlayers) && <>
                <div><label className="text-sm font-bold text-gray-700" htmlFor="hide-sold-players">{t('global.soldPlayersLabel')}</label>
                <Toggle
                  toggleOn={() => setHideSoldPlayers(false)}
                  toggleOff={() => setHideSoldPlayers(true)}
                  status={!hideSoldPlayers}                  
                  onText={t('global.show')}
                  offText={t('global.hide')}
                />
                </div>
                </>}
                </div>
        </div>
    </Collapsible>
}