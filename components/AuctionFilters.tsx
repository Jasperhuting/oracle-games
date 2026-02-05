import { Bid, RiderWithBid } from "@/lib/types";
import { GameType } from "@/lib/types/games";
import { useTranslation } from "react-i18next";
import RangeSlider from 'react-range-slider-input';
import { Button } from "./Button";
import { Star, Users } from "tabler-icons-react";
import { Toggle } from "./Toggle";
import { Collapsible } from "./Collapsible";
import { useState, useEffect, useMemo } from "react";
import { Divider } from "./Divider";
import { TeamSelector } from "./TeamSelector";
import { Team } from "@/lib/scraper/types";

export const AuctionFilters = ({
    searchTerm,
    setSearchTerm,
    priceRange,
    setPriceRange,
    minRiderPrice,
    maxRiderPrice,
    birthYearRange,
    setBirthYearRange,
    minBirthYear,
    maxBirthYear,
    myBids,
    handleResetBidsClick,
    game,
    showOnlyFillers,
    setshowOnlyFillers,
    hideSoldPlayers,
    setHideSoldPlayers,
    sortedAndFilteredRiders,
    availableTeams,
    selectedTeamFilter,
    setSelectedTeamFilter,
    teamsWithSelection,

}: {
    searchTerm: string,
    setSearchTerm: (searchTerm: string) => void,
    priceRange: [number, number],
    setPriceRange: (priceRange: [number, number]) => void,
    minRiderPrice: number,
    maxRiderPrice: number,
    birthYearRange?: [number, number],
    setBirthYearRange?: (birthYearRange: [number, number]) => void,
    minBirthYear?: number,
    maxBirthYear?: number,
    myBids: Bid[],
    handleResetBidsClick: () => void,
    game: { gameType: GameType; bidding: boolean },
    showOnlyFillers: boolean,
    setshowOnlyFillers: (showOnlyFillers: boolean) => void,
    hideSoldPlayers: boolean,
    setHideSoldPlayers: (hideSoldPlayers: boolean) => void
    sortedAndFilteredRiders: RiderWithBid[]
    availableTeams?: { name: string; count: number; teamImage?: string }[],
    selectedTeamFilter?: string[],
    setSelectedTeamFilter?: (teams: string[]) => void,
    teamsWithSelection?: Set<string>,
}) => {

    const isMarginalGains = game?.gameType === 'marginal-gains';
    const { t } = useTranslation();
    const toTeamSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const teamSelectorTeams = useMemo<Team[]>(() => {
        if (!availableTeams) return [];
        return availableTeams.map((team) => ({
            id: toTeamSlug(team.name),
            slug: toTeamSlug(team.name),
            name: team.name,
            country: '',
            teamImage: team.teamImage
        }));
    }, [availableTeams]);

    const teamRiderCounts = useMemo(() => {
        const teamCounts = new Map<string, { count: number }>();
        availableTeams?.forEach((team) => {
            teamCounts.set(toTeamSlug(team.name), { count: team.count });
        });
        return teamCounts;
    }, [availableTeams]);

    const selectedTeam = useMemo<Team[]>(() => {
        if (!selectedTeamFilter || selectedTeamFilter.length === 0) return [];
        return teamSelectorTeams.filter((team) => selectedTeamFilter.includes(team.name || ''));
    }, [selectedTeamFilter, teamSelectorTeams]);

    // Lokale state voor price inputs
    const [priceMinInput, setPriceMinInput] = useState(priceRange[0].toString());
    const [priceMaxInput, setPriceMaxInput] = useState(priceRange[1].toString());

    // Lokale state voor birth year inputs
    const [birthYearMinInput, setBirthYearMinInput] = useState(birthYearRange?.[0].toString() ?? '');
    const [birthYearMaxInput, setBirthYearMaxInput] = useState(birthYearRange?.[1].toString() ?? '');

    // Helper to calculate age from birth year for display
    const currentYear = new Date().getFullYear();
    const getAgeFromYear = (year: number) => currentYear - year;

    // Update lokale state wanneer de externe priceRange verandert (bijv. via slider)
    useEffect(() => {
        setPriceMinInput(priceRange[0].toString());
        setPriceMaxInput(priceRange[1].toString());
    }, [priceRange]);

    // Update lokale state wanneer de externe birthYearRange verandert (bijv. via slider)
    useEffect(() => {
        if (birthYearRange) {
            setBirthYearMinInput(birthYearRange[0].toString());
            setBirthYearMaxInput(birthYearRange[1].toString());
        }
    }, [birthYearRange]);

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

    // Debounce voor birth year min
    useEffect(() => {
        if (birthYearRange && setBirthYearRange && minBirthYear !== undefined) {
            const timer = setTimeout(() => {
                if (birthYearMinInput === '') return; // Niet valideren bij lege string
                const value = Number(birthYearMinInput);
                if (!isNaN(value)) {
                    const clampedValue = Math.max(minBirthYear, Math.min(value, birthYearRange[1]));
                    setBirthYearRange([clampedValue, birthYearRange[1]]);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [birthYearMinInput]);

    // Debounce voor birth year max
    useEffect(() => {
        if (birthYearRange && setBirthYearRange && maxBirthYear !== undefined) {
            const timer = setTimeout(() => {
                if (birthYearMaxInput === '') return; // Niet valideren bij lege string
                const value = Number(birthYearMaxInput);
                if (!isNaN(value)) {
                    const clampedValue = Math.min(maxBirthYear, Math.max(value, birthYearRange[0]));
                    setBirthYearRange([birthYearRange[0], clampedValue]);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [birthYearMaxInput]);

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
            {availableTeams && availableTeams.length > 0 && setSelectedTeamFilter && (
                <span className="flex flex-col flex-1">
                    <label htmlFor="team-filter" className="text-sm font-bold text-gray-700">Team</label>
                    <TeamSelector
                        selectedTeams={selectedTeam}
                        setSelectedTeams={(teams: Team[]) => {
                            const allowedTeams = teams.filter((team) => !teamsWithSelection?.has(team.name || ''));
                            setSelectedTeamFilter(allowedTeams.map((team) => team.name).filter(Boolean) as string[]);
                        }}
                        availableTeams={teamSelectorTeams}
                        multiSelect={true}
                        multiSelectShowSelected={false}
                        showSelected={true}
                        showRiderCounts={true}
                        teamRiderCounts={teamRiderCounts}
                        placeholder={`Alle teams (${availableTeams.reduce((sum, t) => sum + t.count, 0)})`}
                    />
                </span>
            )}
            {game?.gameType !== 'full-grid' && (
                <span className="flex flex-col flex-1 justify-center">
                    <label htmlFor="price-range" className="text-sm font-bold text-gray-700">
                        {game?.gameType === 'marginal-gains' ? t('global.points') : t('games.auctions.priceRangeLabel')}
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
            )}
            {isMarginalGains && birthYearRange && setBirthYearRange && minBirthYear !== undefined && maxBirthYear !== undefined && (
                <span className="flex flex-col flex-1 justify-center">
                    <label htmlFor="birth-year-range" className="text-sm font-bold text-gray-700">
                        Geboortejaar
                    </label>
                    <div className="py-2 mt-2">
                        <RangeSlider
                            min={minBirthYear}
                            max={maxBirthYear}
                            value={birthYearRange}
                            onInput={(value: number[]) => setBirthYearRange([value[0], value[1]])}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex flex-col items-start">
                            <input
                                type="number"
                                min={minBirthYear}
                                max={birthYearRange[1]}
                                value={birthYearMinInput}
                                onChange={(e) => setBirthYearMinInput(e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            />
                            <span className="text-xs text-gray-500 mt-0.5">({getAgeFromYear(birthYearRange[0])} jr)</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <input
                                type="number"
                                min={birthYearRange[0]}
                                max={maxBirthYear}
                                value={birthYearMaxInput}
                                onChange={(e) => setBirthYearMaxInput(e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            />
                            <span className="text-xs text-gray-500 mt-0.5">({getAgeFromYear(birthYearRange[1])} jr)</span>
                        </div>
                    </div>
                </span>
            )}
             {game.gameType !== 'marginal-gains' ? 
             !game.bidding && game.gameType !== 'full-grid' ? (
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
                </> : <></>}
            <Divider />
            <div className="flex flex-row flex-1 gap-2 justify-start">
                <span className="flex flex-col flex-1 justify-center">
                    <Button className="whitespace-nowrap" text={game.bidding ? t('games.auctions.resetAllBids') : t('games.auctions.resetAllSelects')} disabled={!myBids.some(bid => bid.status === 'active' || bid.status === 'outbid')} onClick={handleResetBidsClick} />
                </span>

            </div>
        </div>
    </Collapsible>
}
