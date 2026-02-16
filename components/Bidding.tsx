import CurrencyInput from "react-currency-input-field";
import { Button } from "./Button";
import { PlayerCard } from "./PlayerCard";
import { formatDate, qualifiesAsNeoProf } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { CurrencyEuro, GridDots, List, SortAscending, SortDescending } from "tabler-icons-react";
import { AuctionPeriod, Bid } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { PlayerRowBids } from "./PlayerRowBids";
import React from "react";
import { AuctionGameData as GameData, AuctionParticipantData as ParticipantData, RiderWithBid } from "@/lib/types/pages";
import { useTranslation } from "react-i18next";
import { ScrollToTop } from "./ScrollToTop";
import { BiddingCardView } from "./BiddingCardView";
import { BiddingListView } from "./BiddingListView";
import { BiddingListViewWorldTour } from "./BiddingListViewWorldTour";
import Countdown from 'react-countdown';
import { BiddingListViewWorldTourSmall } from "./BiddingListViewWorldTour-small";
import { FullGridTeamSelector } from "@/components/full-grid/FullGridTeamSelector";
import { FullGridRiderList } from "@/components/full-grid/FullGridRiderList";
import { FullGridMyTeam } from "@/components/full-grid/FullGridMyTeam";
import { AuctionStats } from "./AuctionStats";
import Link from "next/link";
import { Tooltip } from "react-tooltip";

interface Standing {
  ranking: number;
  playername: string;
  totalPoints: number;
  participantId: string;
  eligibleForPrizes?: boolean;
}


export const Bidding = ({
  auctionClosed,
  game,
  auctionActive,
  isAdmin,
  myBids,
  participant,
  allBids,
  availableRiders,
  adjustingBid,
  setAdjustingBid,
  cancellingBid,
  sortedAndFilteredRiders,
  placingBid,
  handlePlaceBid,
  handleCancelBidClick,
  bidAmountsRef,
  userId,
  teamsWithSelection,
  inlineError,
}: {
  auctionClosed: boolean,
  game: GameData,
  myBids: Bid[],
  participant: ParticipantData | null,
  sortedAndFilteredRiders: RiderWithBid[],
  bidAmountsRef: React.RefObject<Record<string, string>>,
  availableRiders: RiderWithBid[],
  showOnlyFillers: boolean,
  setAdjustingBid: React.Dispatch<React.SetStateAction<string | null>>,
  auctionActive: boolean,
  setshowOnlyFillers: React.Dispatch<React.SetStateAction<boolean>>,
  isAdmin: boolean,
  setHideSoldPlayers: React.Dispatch<React.SetStateAction<boolean>>,
  hideSoldPlayers: boolean,
  handleCancelBidClick: (bidId: string, riderName: string) => void,
  cancellingBid: string | null,
  allBids: any,
  handlePlaceBid: (rider: any) => void,
  adjustingBid: string | null,
  placingBid: string | null,
  userId?: string,
  teamsWithSelection?: Set<string>,
  inlineError?: string | null,
}) => {

  const { t } = useTranslation();

  const isSelectionBasedGame = game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains' || game?.gameType === 'full-grid';
  const isFullGrid = game?.gameType === 'full-grid';
  const showInlineError = isFullGrid ? inlineError : null;

  const Completionist = () => <span className="bg-primary text-white px-2 py-1 rounded w-full flex items-center justify-center">{t('bidding.theBiddingHasEnded')}</span>;

  const renderer = ({ days, hours, minutes, seconds, completed }: { days: number, hours: number, minutes: number, seconds: number, completed: boolean }) => {
    if (completed) {
      // Render a completed state
      return <Completionist />;
    } else {
      // Render a countdown - toon dagen als er meer dan 0 dagen zijn
      if (days > 0) {
        return <span className="bg-primary text-white px-2 py-1 rounded w-full flex items-center justify-center">{days} {t('global.days', { count: days })} : {hours} {t('global.hours')} : {minutes} {t('global.minutes')} {t('bidding.untilTheBiddingEnds')}</span>;
      } else {
        return <span className="bg-primary text-white px-2 py-1 rounded w-full flex items-center justify-center">{hours} {t('global.hours')} : {minutes} {t('global.minutes')} : {seconds} {t('global.seconds')} {t('bidding.untilTheBiddingEnds')}</span>;
      }
    }
  };

  const [myTeamView, setMyTeamView] = useState('card');
  const [myTeamBidsView, setMyTeamBidsView] = useState('list');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [showPrizesModal, setShowPrizesModal] = useState(false);

  const isProTourTeamClass = (teamClass?: string) => {
    if (!teamClass) return false;
    const normalized = teamClass.trim().toLowerCase();
    return (
      normalized === 'prt' ||
      normalized === 'proteam' ||
      normalized === 'pro team' ||
      normalized === 'protour' ||
      normalized === 'pro tour' ||
      normalized === 'pro'
    );
  };

  // Sorting state for riders list
  type SortOption = 'price' | 'name' | 'age' | 'team' | 'neoprof' | 'rank';
  type SortDirection = 'asc' | 'desc';
  const [ridersSortBy, setRidersSortBy] = useState<SortOption>('rank');
  const [ridersSortDirection, setRidersSortDirection] = useState<SortDirection>('asc');

  // Sort riders based on selected criteria
  const sortedRiders = useMemo(() => {
    return [...sortedAndFilteredRiders].sort((a, b) => {
      let comparison = 0;

      switch (ridersSortBy) {
        case 'price':
          comparison = (a.effectiveMinBid || a.points || 0) - (b.effectiveMinBid || b.points || 0);
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'age': {
          const ageA = typeof a.age === 'number' ? a.age : parseInt(String(a.age || '0'), 10);
          const ageB = typeof b.age === 'number' ? b.age : parseInt(String(b.age || '0'), 10);
          comparison = ageA - ageB;
          break;
        }
        case 'team': {
          const teamA = a.team?.name || '';
          const teamB = b.team?.name || '';
          // Zet lege teams onderaan
          if (!teamA && teamB) return 1;
          if (teamA && !teamB) return -1;
          comparison = teamA.localeCompare(teamB);
          break;
        }
        case 'neoprof': {
          const isNeoProfA = qualifiesAsNeoProf(a, game?.config) ? 1 : 0;
          const isNeoProfB = qualifiesAsNeoProf(b, game?.config) ? 1 : 0;
          comparison = isNeoProfB - isNeoProfA;
          break;
        }
        case 'rank':
          comparison = (a.rank || 0) - (b.rank || 0);
          break;
        default:
          return 0;
      }

      return ridersSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sortedAndFilteredRiders, ridersSortBy, ridersSortDirection, game?.config]);

  const fullGridRiders = useMemo(() => {
    if (!isFullGrid) return [];

    return availableRiders
      .filter(rider => !rider.retired)
      .filter(rider => (rider.effectiveMinBid || rider.points || 0) > 0)
      .map(rider => {
        return ({
          riderNameId: rider.nameID || rider.id || '',
          riderName: rider.name,
          riderTeam: rider.team?.name || '',
          teamSlug: (rider.team as any)?.slug || (rider.team as any)?.id || (rider.team as any)?.teamNameID || rider.team?.name || '', // eslint-disable-line @typescript-eslint/no-explicit-any
          jerseyImage: rider.team?.jerseyImageTeam || '',
          value: rider.effectiveMinBid || rider.points || 0,
          country: rider.country,
          teamClass: (rider.team as any)?.class || (rider.team as any)?.teamClass, // eslint-disable-line @typescript-eslint/no-explicit-any
          isProTeam: isProTourTeamClass((rider.team as any)?.class || (rider.team as any)?.teamClass), // eslint-disable-line @typescript-eslint/no-explicit-any
        })
      });
  }, [availableRiders, isFullGrid, isProTourTeamClass]);

  const fullGridTeams = useMemo(() => {
    if (!isFullGrid) return [];
    const teamMap = new Map<string, { name: string; slug: string; teamImage?: string; riderCount: number; teamClass?: string; isProTeam?: boolean }>();
    fullGridRiders.forEach(rider => {

      if (!rider.riderTeam) return;
      if (!teamMap.has(rider.riderTeam)) {
        teamMap.set(rider.riderTeam, {
          name: rider.riderTeam,
          slug: rider.teamSlug || rider.riderTeam,
          teamImage: rider.jerseyImage,
          riderCount: 0,
          teamClass: rider.teamClass,
          isProTeam: isProTourTeamClass(rider.teamClass),
        });
      }
      teamMap.get(rider.riderTeam)!.riderCount++;
    });
    return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [fullGridRiders, isFullGrid]);

  useEffect(() => {
    if (!isFullGrid || !game?.id) return;

    const loadStandings = async () => {
      try {
        setStandingsLoading(true);
        setStandingsError(null);

        const response = await fetch(`/api/games/${game.id}/teams-overview`);
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
          eligibleForPrizes: team.eligibleForPrizes,
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
  }, [isFullGrid, game?.id]);

  const sortedStandings = useMemo(() => {
    return [...standings].sort((a, b) => (a.ranking ?? 0) - (b.ranking ?? 0));
  }, [standings]);

  const fullGridTeamRiders = useMemo(() => {
    if (!isFullGrid || !selectedTeam) return [];
    return fullGridRiders
      .filter(rider => rider.riderTeam === selectedTeam)
      .sort((a, b) => b.value - a.value);
  }, [fullGridRiders, selectedTeam, isFullGrid]);

  const fullGridRiderLookup = useMemo(() => {
    const map = new Map<string, RiderWithBid>();
    availableRiders.forEach(rider => {
      const riderNameId = rider.nameID || rider.id || '';
      if (riderNameId) {
        map.set(riderNameId, rider);
      }
    });
    return map;
  }, [availableRiders]);

  const fullGridMyTeam = useMemo(() => {
    if (!isFullGrid) return [];
    const activeBids = myBids.filter(b => b.status === 'active' || b.status === 'won');
    return activeBids.map(bid => {
      const rider = availableRiders.find(r => (r.nameID || r.id) === bid.riderNameId);
      return {
        riderNameId: bid.riderNameId,
        riderName: bid.riderName || rider?.name || '',
        riderTeam: bid.riderTeam || rider?.team?.name || '',
        jerseyImage: rider?.team?.jerseyImageTeam || '',
        value: bid.amount || rider?.effectiveMinBid || rider?.points || 0,
        teamClass: (rider?.team as any)?.class || (rider?.team as any)?.teamClass, // eslint-disable-line @typescript-eslint/no-explicit-any
        isProTeam: isProTourTeamClass((rider?.team as any)?.class || (rider?.team as any)?.teamClass), // eslint-disable-line @typescript-eslint/no-explicit-any
      };
    });
  }, [availableRiders, myBids, isFullGrid]);

  const fullGridBudgetStats = useMemo(() => {
    const budget = Number(game?.config?.budget) || 0;
    const uniqueRiders = new Set(fullGridMyTeam.map(r => r.riderNameId));
    const spent = fullGridMyTeam.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    const maxRiders = Number(game?.config?.maxRiders || game?.config?.teamSize || 0);
    return {
      total: budget,
      spent,
      remaining: budget - spent,
      riderCount: uniqueRiders.size,
      maxRiders: maxRiders || fullGridTeams.length,
    };
  }, [fullGridMyTeam, fullGridTeams.length, game?.config]);

  const proTeamsSelectedCount = useMemo(() => {
    const uniqueTeams = new Set(
      fullGridMyTeam
        .filter(rider => isProTourTeamClass(rider.teamClass))
        .map(rider => rider.riderTeam)
    );
    return uniqueTeams.size;
  }, [fullGridMyTeam]);

  const fullGridSelectedRiderByTeam = useMemo(() => {
    const map: Record<string, string> = {};
    fullGridMyTeam.forEach(rider => {
      if (rider.riderTeam && !map[rider.riderTeam]) {
        map[rider.riderTeam] = rider.riderName;
      }
    });
    return map;
  }, [fullGridMyTeam]);

  const handleFullGridRemove = (riderNameId: string) => {
    const bid = myBids.find(b => (b.status === 'active' || b.status === 'won') && b.riderNameId === riderNameId);
    if (bid) {
      handleCancelBidClick(bid.id || '', bid.riderName || '');
    }
  };

  const fullGridSaving = !!placingBid || !!cancellingBid;

  React.useEffect(() => {
    if (!isFullGrid) return;
    if (!selectedTeam && fullGridTeams.length > 0) {
      const unselectedTeam = fullGridTeams.find(t => !teamsWithSelection?.has(t.name));
      setSelectedTeam(unselectedTeam?.name || fullGridTeams[0].name);
    }
  }, [isFullGrid, selectedTeam, fullGridTeams, teamsWithSelection]);

  const currentPeriod = game?.config?.auctionPeriods?.find((period: AuctionPeriod) => {
    const now = Date.now();
    const startDate = typeof period.startDate === 'string'
      ? new Date(period.startDate).getTime()
      : period.startDate.toDate().getTime();
    const endDate = typeof period.endDate === 'string'
      ? new Date(period.endDate).getTime()
      : period.endDate.toDate().getTime();
    return startDate <= now && endDate > now;
  });

  // Als er geen actieve periode is, zoek dan de eerstvolgende periode (die nog moet beginnen)
  const nextPeriod = !currentPeriod
    ? game?.config?.auctionPeriods
      ?.filter((period: AuctionPeriod) => {
        const now = Date.now();
        const startDate = typeof period.startDate === 'string'
          ? new Date(period.startDate).getTime()
          : period.startDate.toDate().getTime();
        return startDate > now;
      })
      .sort((a: AuctionPeriod, b: AuctionPeriod) => {
        const aStart = typeof a.startDate === 'string'
          ? new Date(a.startDate).getTime()
          : a.startDate.toDate().getTime();
        const bStart = typeof b.startDate === 'string'
          ? new Date(b.startDate).getTime()
          : b.startDate.toDate().getTime();
        return aStart - bStart;
      })[0]
    : null;

  const activePeriod = currentPeriod || nextPeriod;

  const countdownDate = activePeriod?.endDate
    ? typeof activePeriod.endDate === 'string'
      ? new Date(activePeriod.endDate).getTime()
      : activePeriod.endDate instanceof Date
        ? activePeriod.endDate.getTime()
        : activePeriod.endDate.toDate().getTime()
    : Date.now();

  return <>
    {isFullGrid && (
      <Tooltip
        id="standings-prize-tooltip"
        delayShow={0}
        className="!opacity-100"
        render={({ content }) => (
          <div className="text-sm whitespace-pre-line">
            {String(content || '')}
          </div>
        )}
      />
    )}
    {game.bidding && <>
      <Countdown key={countdownDate} date={countdownDate} renderer={renderer} />
      <span className="text-gray-500 text-xs">{t('global.endDate')}: {activePeriod?.endDate ? formatDate(activePeriod.endDate instanceof Date ? activePeriod.endDate.toISOString() : typeof activePeriod.endDate === 'string' ? activePeriod.endDate : activePeriod.endDate.toDate().toISOString()) : t('global.unknownDate')}</span>
    </>}

    {showPrizesModal && isFullGrid && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <button
          className="absolute inset-0 bg-black/40"
          aria-label="Sluit prijzen"
          onClick={() => setShowPrizesModal(false)}
        />
        <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Prijzen</h3>
            <button
              className="text-gray-500 hover:text-gray-700"
              aria-label="Sluit"
              onClick={() => setShowPrizesModal(false)}
            >
              ×
            </button>
          </div>
          <div className="px-5 py-4 text-sm text-gray-700 space-y-3">
            <div>
              <div className="font-semibold text-gray-900">1e prijs</div>
              <div>&#39;Bike &amp; Pancakes&#39; arrangement voor 4 personen.</div>
              <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">2e prijs</div>
              <div>Gravel arrangement voor 2 personen.</div>
              <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">3e prijs</div>
              <div>&#39;Proefritje&#39; te nuttigen in het wielercafe in Zeddam</div>
              <div className="text-xs text-gray-500">(3 speciaalbiertjes geserveerd met lokale kaas &amp; worst)</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">4e &amp; 5e prijs</div>
              <div>een &#39;Veloholic&#39; shirt</div>
            </div>
            <div className="text-xs text-gray-500">
              * Het buffje mag je houden als aandenken aan een leuke sportieve middag!
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
            <Button
              type="button"
              text="Sluiten"
              onClick={() => setShowPrizesModal(false)}
              className="px-4 py-2 text-sm"
              variant="secondary"
            />
          </div>
        </div>
      </div>
    )}


    {/* My Bids Section - Only show when auction is active */}
    {!auctionClosed && (
      <div>
        <div className="bg-white p-4 rounded-md rounded-b-none border border-gray-200 flex flex-row gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold mt-1">
              {isSelectionBasedGame ? t('games.auctions.mySelectedRiders') : t('games.auctions.myBids')}
            </h1>
            {game.teamSelectionDeadline && (
              <p className="text-gray-500 text-xs">
                deadline: {formatDate(game.teamSelectionDeadline)}
              </p>
            )}
          </div>
          {!isFullGrid && (
            <span className="flex flex-row gap-2 justify-center items-center">
              <Button ghost={myTeamBidsView === 'card'} onClick={() => setMyTeamBidsView('list')}><span className={`flex flex-row gap-2 items-center`}><List />{t('global.listView')}</span></Button>
              <Button ghost={myTeamBidsView === 'list'} onClick={() => setMyTeamBidsView('card')}><span className={`flex flex-row gap-2 items-center`}><GridDots />{t('global.cardView')}</span></Button>
            </span>
          )}
        </div>


        {isFullGrid ? (
          <div className="bg-white border border-gray-200 rounded-b-md p-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-white ring-2 ring-emerald-200 flex items-center justify-center overflow-hidden">
                      <img
                        src="/berc-bike-logo.jpg"
                        alt="Berc Bike"
                        className="h-11 w-11 object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Sponsor
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-gray-400">Full-Grid</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900">Berc Bike</p>
                      <p className="text-sm text-gray-600">
                        Berc Bike sponsort de prijzen voor hen die 5,- storten.
                      </p>
                      
                      <button
                        type="button"
                        onClick={() => setShowPrizesModal(true)}
                        className="px-2 py-1 text-xs rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-center"
                      >
                        Prijzen
                      </button>

                      <a
                        href="https://buymeacoffee.com/oraclegames"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 text-xs m-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-100 bg-emerald-700 text-white text-center"
                      >
                        Betaal €5
                      </a>
                    </div>
                  </div>
                </div>
                <FullGridMyTeam
                  myTeam={fullGridMyTeam}
                  budgetStats={fullGridBudgetStats}
                  canEdit={!auctionClosed}
                  onRemoveRider={handleFullGridRemove}
                  saving={fullGridSaving}
                />
              </div>
              <div className="w-full xl:col-span-1 max-w-sm self-start flex flex-col gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    Budget Stats
                  </h3>
                  <div className="flex flex-col divide-y divide-gray-200 text-sm">
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-gray-600">Totale budget</span>
                      <span className="font-semibold text-gray-900">
                        {fullGridBudgetStats.total} pt
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-gray-600">Geselecteerd totaal</span>
                      <span className="font-semibold text-blue-600">
                        {fullGridBudgetStats.spent} pt
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-gray-600">Resterend</span>
                      <span className={`font-semibold ${fullGridBudgetStats.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fullGridBudgetStats.remaining} pt
                      </span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-gray-600">Geselecteerde renners</span>
                      <span className="font-semibold text-primary">
                        {fullGridBudgetStats.riderCount}
                      </span>
                    </div>
                    {fullGridBudgetStats.maxRiders > 0 && (
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-gray-600">Max renners</span>
                        <span className="font-semibold text-gray-900">
                          {fullGridBudgetStats.maxRiders}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Tussenstand</div>
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
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/games/${game.id}/team/${row.participantId}`}
                                      className="font-medium text-gray-900 hover:text-primary hover:underline"
                                    >
                                      {row.playername}
                                    </Link>
                                    {row.eligibleForPrizes ? (
                                      <span
                                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 text-amber-900 shadow-sm ring-1 ring-amber-200"
                                        title="Speelt mee voor prijzen"
                                        aria-label="Speelt mee voor prijzen"
                                        data-tooltip-id="standings-prize-tooltip"
                                        data-tooltip-content="Deze speler doet mee voor de prijzen"
                                      >
                                        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" aria-hidden="true" fill="currentColor">
                                          <path d="M19 4h-3V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a5 5 0 0 0 4 4.9V14a3 3 0 0 0 2 2.83V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-2v-2.17A3 3 0 0 0 16 14v-2.1A5 5 0 0 0 20 7V5a1 1 0 0 0-1-1zM6 7V6h2v3.83A3 3 0 0 1 6 7zm12 0a3 3 0 0 1-2 2.83V6h2v1zM10 5V4h4v1h-4z" />
                                        </svg>
                                      </span>
                                    ) : null}
                                  </div>
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
                </div>
              </div>
            </div>
          </div>
        ) : (
          myTeamBidsView === 'card' ? (
            <BiddingCardView
              myBids={myBids}
              game={game}
              cancellingBid={cancellingBid}
              handleCancelBidClick={handleCancelBidClick}
              availableRiders={availableRiders}
              adjustingBid={adjustingBid}
              placingBid={placingBid}
              bidAmountsRef={bidAmountsRef}
              handlePlaceBid={handlePlaceBid}
              setAdjustingBid={setAdjustingBid}
            />
          ) : (isSelectionBasedGame ?
            <BiddingListViewWorldTourSmall
              myBids={myBids}
              game={game}
              cancellingBid={cancellingBid}
              handleCancelBidClick={handleCancelBidClick}
              availableRiders={availableRiders}
              adjustingBid={adjustingBid}
              placingBid={placingBid}
              bidAmountsRef={bidAmountsRef}
              handlePlaceBid={handlePlaceBid}
              setAdjustingBid={setAdjustingBid}
              userId={userId} /> :
            <BiddingListView myBids={myBids}
              game={game}
              cancellingBid={cancellingBid}
              handleCancelBidClick={handleCancelBidClick}
              availableRiders={availableRiders}
              adjustingBid={adjustingBid}
              placingBid={placingBid}
              bidAmountsRef={bidAmountsRef}
              handlePlaceBid={handlePlaceBid}
              setAdjustingBid={setAdjustingBid} />)
        )}


      </div>
    )}

    {/* Riders List */}
    {isFullGrid ? (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-12 mt-6">
        <div className="grid grid-cols-1 xl:grid-cols-8 gap-6">
          <div className="xl:col-span-3">
            <FullGridTeamSelector
              teams={fullGridTeams}
              selectedTeam={selectedTeam}
              teamsWithSelection={teamsWithSelection || new Set<string>()}
              onSelectTeam={setSelectedTeam}
              proTeamsSelectedCount={proTeamsSelectedCount}
              proTeamsLimit={4}
              selectedRiderByTeam={fullGridSelectedRiderByTeam}
            />
          </div>

          <div className="xl:col-span-5">
            <FullGridRiderList
              riders={fullGridTeamRiders}
              selectedTeam={selectedTeam}
              isRiderSelected={(riderNameId) => fullGridMyTeam.some(r => r.riderNameId === riderNameId)}
              teamHasSelection={selectedTeam ? (teamsWithSelection?.has(selectedTeam) || false) : false}
              canSelect={!auctionClosed}
              budgetRemaining={fullGridBudgetStats.remaining}
              onSelectRider={(rider) => {
                const fullRider = fullGridRiderLookup.get(rider.riderNameId);
                if (fullRider) {
                  handlePlaceBid(fullRider);
                }
              }}
              onDeselectRider={(rider) => handleFullGridRemove(rider.riderNameId)}
              saving={fullGridSaving}
              inlineError={showInlineError}
            />
          </div>
        </div>
      </div>
    ) : (
      <div className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-12">
        <div className="flex flex-col gap-4 p-3 bg-white font-semibold text-sm border-b border-gray-200 sticky top-0">
          <div className="col-span-1">{t('global.riders')}</div>
          <span className="flex flex-row gap-2 justify-between items-center flex-wrap">
            <span className="flex flex-row gap-2">
              <Button ghost={myTeamView === 'list'} onClick={() => setMyTeamView('card')}><span className={`flex flex-row gap-2 items-center`}><GridDots />{t('global.cardView')}</span></Button>
              <Button ghost={myTeamView === 'card'} onClick={() => setMyTeamView('list')}><span className={`flex flex-row gap-2 items-center`}><List />{t('global.listView')}</span></Button>
            </span>
            <span className="flex flex-row gap-2 items-center">
              <label className="text-sm font-medium">{t('global.sortingBy')}</label>
              <select
                value={ridersSortBy}
                onChange={(e) => setRidersSortBy(e.target.value as SortOption)}
                className="pl-3 pr-5 min-w-[120px] py-1.5 text-sm font-normal border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.25rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="price">{game?.gameType === 'marginal-gains' || game?.gameType === 'full-grid' ? 'Points' : 'Prijs'}</option>
                <option value="rank">{t('global.rank')}</option>
                <option value="name">{t('global.name')}</option>
                <option value="age">{t('global.age')}</option>
                <option value="team">{t('global.team')}</option>
                {game?.gameType === 'worldtour-manager' && <option value="neoprof">{t('global.neoProf')}</option>}
              </select>
              <button
                onClick={() => setRidersSortDirection(ridersSortDirection === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
                title={ridersSortDirection === 'asc' ? t('global.ascending') : t('global.descending')}
              >
                {ridersSortDirection === 'asc' ? <SortAscending size={18} /> : <SortDescending size={18} />}
              </button>
            </span>
          </span>

        </div>


        <div className="overflow-y-auto">
          <div className={`w-full ${myTeamView === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 items-start justify-start flex-wrap gap-4 p-4' : 'flex flex-col items-start bg-white rounded-md divide-y divide-[#CAC4D0] justify-start flex-wrap mb-4 pb-4'}`}>

            {/* it should sort when there is a myBid */}
            {sortedRiders.map((rider, index) => {
              const riderNameId = rider.nameID || rider.id || '';

              // Get all bidders for this rider (admin only)
              const riderBidders = allBids
                .filter((b: Bid) => (b.riderNameId === rider.nameID || b.riderNameId === rider.id) && b.status === 'active')
                .sort((a: Bid, b: Bid) => b.amount - a.amount)
                .sort((a: Bid, b: Bid) => new Date(a.bidAt).getTime() - new Date(b.bidAt).getTime()) // Sort by bidAt descending (newest first)
                .map((b: Bid) => ({ playername: b.playername, amount: b.amount, bidAt: b.bidAt }))

              // Full Grid: check if this rider's team already has a selection
              const teamAlreadySelected = !!(teamsWithSelection && rider.team?.name && teamsWithSelection.has(rider.team.name) && !rider.myBid);

              return (
                <React.Fragment key={rider.id || index}>

                  <div className={`flex w-full ${myTeamView === 'list' && 'flex-col'}`}>

                    {myTeamView === 'card' ?

                      rider && <PlayerCard
                        showBid={true}
                        bid={rider.highestBid}
                        player={rider}
                        onClick={() => { }}
                        selected={false}
                        bidders={isAdmin ? riderBidders : undefined}
                        isNeoProf={qualifiesAsNeoProf(rider, game?.config)}
                        showNeoProfBadge={game?.gameType === 'worldtour-manager'}
                        showPointsInsteadOfPrice={game?.gameType === 'marginal-gains' || game?.gameType === 'full-grid'}
                        buttonContainer={<>
                          {/* it should check if the game.gameType is not worldtour-manager or marginal-gains */}
                          <div className={`flex flex-row gap-2`}>

                            {auctionActive ? (<>
                              {(game?.gameType === 'auctioneer') ? (
                                <CurrencyInput
                                  id="input-example"
                                  name="input-name"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                  placeholder={`Min: ${rider.effectiveMinBid || rider.points}`}
                                  decimalsLimit={0}
                                  disabled={placingBid === riderNameId || rider.isSold}
                                  defaultValue={bidAmountsRef.current[riderNameId] || ''}
                                  onValueChange={(value, name, values) => {
                                    bidAmountsRef.current[riderNameId] = value || '0';
                                  }}
                                />
                              ) : (
                                <></>
                              )}
                            </>
                            ) : (
                              // After auction closes, show win/loss status
                              rider.myBid ? (
                                <div>
                                  <div className={`font-bold text-sm ${rider.myBidStatus === 'won' ? 'text-green-600' :
                                    rider.myBidStatus === 'lost' ? 'text-red-600' :
                                      'text-gray-700'
                                    }`}>
                                    {typeof rider.myBid === 'number' ? rider.myBid.toFixed(1) : '0'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {rider.myBidStatus === 'won' ? 'Won' : rider.myBidStatus === 'lost' ? 'Lost' : rider.myBidStatus}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">{t('global.noBid')}</span>
                              )
                            )}
                            {auctionActive && !rider.isSold && !teamAlreadySelected && (
                              <>
                                {rider.myBid && rider.myBidId && (rider.myBidStatus === 'active' || rider.myBidStatus === 'outbid') ? (
                                  <Button
                                    type="button"
                                    text={cancellingBid === rider.myBidId ? t('global.loading') : isSelectionBasedGame ? t('global.remove') : t('games.auctions.resetBid')}
                                    onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                    disabled={cancellingBid === rider.myBidId}
                                    className="px-2 py-1 text-sm w-full"
                                    title={isSelectionBasedGame ? t('games.auctions.removeRider') : t('games.auctions.cancelBid')}
                                    variant="danger"
                                  />
                                ) : (
                                  <Button
                                    type="button"
                                    text={placingBid === riderNameId ? t('global.loading') : isSelectionBasedGame ? t('global.select') : t('games.auctions.bid')}
                                    onClick={() => handlePlaceBid(rider)}
                                    disabled={placingBid === riderNameId}
                                    className={`py-1 text-sm w-full`}
                                    variant="primary"
                                  />
                                )}
                              </>
                            )}
                            {teamAlreadySelected && (
                              <span className="text-[10px] text-gray-400 italic">Reeds gekozen</span>
                            )}
                          </div>

                        </>} />
                      :
                      <PlayerRowBids game={game} player={rider} showPoints showRank showAge fullWidth selectPlayer={() => handlePlaceBid(rider)} index={index} rightContent={<>
                        <div className={`flex flex-row ${!isSelectionBasedGame ? 'gap-2' : ''}`}>


                          <div className="flex-1">
                            {auctionActive && !rider.isSold ? (<>
                              {!isSelectionBasedGame ? (
                                <CurrencyInput
                                  id="input-example"
                                  name="input-name"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                  placeholder={`Min: ${rider.effectiveMinBid || rider.points}`}
                                  decimalsLimit={0}
                                  disabled={placingBid === riderNameId || rider.isSold}
                                  defaultValue={bidAmountsRef.current[riderNameId] || ''}
                                  onValueChange={(value) => {
                                    bidAmountsRef.current[riderNameId] = value || '0';
                                  }}
                                />

                              ) : (<></>)}
                            </>
                            ) : (
                              // After auction closes, show win/loss status
                              rider.myBid ? (
                                <div>
                                  <div className={`font-bold text-sm ${rider.myBidStatus === 'won' ? 'text-green-600' :
                                    rider.myBidStatus === 'lost' ? 'text-red-600' :
                                      'text-gray-700'
                                    }`}>
                                    {typeof rider.myBid === 'number' ? rider.myBid.toFixed(1) : '0'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {rider.myBidStatus === 'won' ? t('games.auctions.won') : rider.myBidStatus === 'lost' ? t('games.auctions.lost') : rider.myBidStatus}
                                  </div>
                                </div>
                              ) : (
                                rider.isSold && rider?.pricePaid ? (
                                  <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">{t('games.auctions.soldFor')} {formatCurrency(rider?.pricePaid)}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">{t('games.auctions.noBid')}</span>
                                )
                              )
                            )}
                          </div>
                          {auctionActive && !rider.isSold && !teamAlreadySelected && (
                            <div className="min-w-[80px] flex justify-end">
                              {rider.myBid && rider.myBidId && (rider.myBidStatus === 'active' || rider.myBidStatus === 'outbid') ? (
                                <Button
                                  type="button"
                                  text={cancellingBid === rider.myBidId ? t('global.loading') : isSelectionBasedGame ? t('global.remove') : t('games.auctions.resetBid')}
                                  onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                  disabled={cancellingBid === rider.myBidId}
                                  className="px-2 py-1 text-sm"
                                  title={isSelectionBasedGame ? t('games.auctions.removeRider') : t('games.auctions.cancelBid')}
                                  variant="danger"
                                />
                              ) : (<Button
                                type="button"
                                text={placingBid === riderNameId ? t('global.loading') : isSelectionBasedGame ? t('global.select') : t('games.auctions.bid')}
                                onClick={() => handlePlaceBid(rider)}
                                disabled={placingBid === riderNameId}
                                className="px-3 py-1 text-sm"
                                variant="primary"
                              />)}

                            </div>
                          )}
                          {teamAlreadySelected && (
                            <span className="text-[10px] text-gray-400 italic whitespace-nowrap">Reeds gekozen</span>
                          )}
                        </div>

                      </>} />}
                  </div>


                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    )}

    <ScrollToTop />

  </>
}
