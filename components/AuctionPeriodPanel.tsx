'use client'

import { useState, useMemo } from "react";
import { Bid } from "@/lib/types";
import { AuctionGameData, AuctionParticipantData, RiderWithBid } from "@/lib/types/pages";
import { PlayerCard } from "./PlayerCard";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { useTranslation } from "react-i18next";
import { SortAscending, SortDescending } from "tabler-icons-react";

interface AuctionPeriodPanelProps {
  auctionPeriod: {
    name: string;
    startDate: Date | string | { toDate: () => Date };
    endDate: Date | string | { toDate: () => Date };
  };
  periodIndex: number;
  bidsToShow: Bid[];
  availableRiders: RiderWithBid[];
  alleBiedingen: Bid[];
  game: AuctionGameData;
  selectedPlayerId: string | null;
  calculateRemainingBudget: (bids: Bid[], index: number) => number;
  isVisible: boolean;
}

type SortOption = 'price' | 'name' | 'age' | 'team' | 'neoprof' | 'rank' | 'status';
type SortDirection = 'asc' | 'desc';

// Helper for date conversion
const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(String(value));
};

export const AuctionPeriodPanel = ({
  auctionPeriod,
  periodIndex,
  bidsToShow,
  availableRiders,
  alleBiedingen,
  game,
  selectedPlayerId,
  calculateRemainingBudget,
  isVisible
}: AuctionPeriodPanelProps) => {
  // State is now PER TAB - behouden bij tab switches
  const [sortBy, setSortBy] = useState<SortOption>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { t } = useTranslation();

  // Early return if not visible (maar state blijft behouden!)
  if (!isVisible) return null;

  const startDate = toDate(auctionPeriod.startDate);
  const endDate = toDate(auctionPeriod.endDate);
  const now = new Date();
  const isAuctionPeriodActive = now >= startDate && now <= endDate;

  // Filter bids for this period - memoized
  const bidsInPeriod = useMemo(() => {
    return bidsToShow.filter((bid) => {
      const bidDate = new Date(bid.bidAt);
      if (bid.status === 'won') {
        return bidDate <= endDate && bidDate >= new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      }
      if (bid.status === 'lost') {
        return bidDate >= startDate && bidDate <= endDate;
      }
      if (bid.status === 'active' && !isAuctionPeriodActive) {
        return bidDate >= startDate && bidDate <= endDate;
      }
      return false;
    });
  }, [bidsToShow, startDate, endDate, isAuctionPeriodActive]);

  if (bidsInPeriod.length === 0) return null;

  // Calculate remaining budget - memoized
  const remainingBudget = useMemo(() => {
    return calculateRemainingBudget(bidsToShow, periodIndex);
  }, [bidsToShow, periodIndex, calculateRemainingBudget]);

  // Sort the bids - memoized
  const sortedBidsInPeriod = useMemo(() => {
    return [...bidsInPeriod].sort((a, b) => {
      const riderA = availableRiders.find((r: RiderWithBid) => r.id === a.riderNameId || r.nameID === a.riderNameId);
      const riderB = availableRiders.find((r: RiderWithBid) => r.id === b.riderNameId || r.nameID === b.riderNameId);

      if (!riderA || !riderB) return 0;

      let comparison = 0;

      switch (sortBy) {
        case 'price':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case 'name':
          comparison = (riderA.name || '').localeCompare(riderB.name || '');
          break;
        case 'age': {
          const ageA = typeof riderA.age === 'number' ? riderA.age : parseInt(String(riderA.age || '0'), 10);
          const ageB = typeof riderB.age === 'number' ? riderB.age : parseInt(String(riderB.age || '0'), 10);
          comparison = ageA - ageB;
          break;
        }
        case 'team': {
          const teamA = riderA.team?.name || '';
          const teamB = riderB.team?.name || '';
          if (!teamA && teamB) return 1;
          if (teamA && !teamB) return -1;
          comparison = teamA.localeCompare(teamB);
          break;
        }
        case 'neoprof': {
          const isNeoProfA = qualifiesAsNeoProf(riderA, game?.config) ? 1 : 0;
          const isNeoProfB = qualifiesAsNeoProf(riderB, game?.config) ? 1 : 0;
          comparison = isNeoProfB - isNeoProfA;
          break;
        }
        case 'rank':
          comparison = (riderA.rank || 0) - (riderB.rank || 0);
          break;
        case 'status': {
          const statusOrder = { won: 0, active: 1, outbid: 2, lost: 3, cancelled: 4 };
          comparison = (statusOrder[a.status as keyof typeof statusOrder] || 99) - 
                       (statusOrder[b.status as keyof typeof statusOrder] || 99);
          break;
        }
        default:
          return 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [bidsInPeriod, availableRiders, sortBy, sortDirection, game?.config]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{t('global.sortingBy')}</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="pl-3 pr-5 min-w-[120px] py-1.5 text-sm font-normal border border-gray-300 rounded-md 
                       focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.25rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em'
            }}
          >
            <option value="price">{t('global.price')}</option>
            <option value="rank">{t('global.rank')}</option>
            <option value="name">{t('global.name')}</option>
            <option value="age">{t('global.age')}</option>
            <option value="team">{t('global.team')}</option>
            <option value="status">Status</option>
            {game?.gameType === 'worldtour-manager' && <option value="neoprof">{t('global.neoProf')}</option>}
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none 
                       focus:ring-2 focus:ring-primary bg-white cursor-pointer"
            title={sortDirection === 'asc' ? t('global.ascending') : t('global.descending')}
          >
            {sortDirection === 'asc' ? <SortAscending size={18} /> : <SortDescending size={18} />}
          </button>
        </div>
        <div className="text-sm">
          <span className="font-medium">Remaining Budget: </span>
          <span className="text-lg font-bold text-green-600">{formatCurrencyWhole(remainingBudget)}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedBidsInPeriod.map((myBidRider) => (
          <BidCard
            key={myBidRider.id}
            myBidRider={myBidRider}
            availableRiders={availableRiders}
            alleBiedingen={alleBiedingen}
            isAuctionPeriodActive={isAuctionPeriodActive}
            game={game}
          />
        ))}
      </div>
    </div>
  );
};

// Separate component for each bid card to properly use hooks
interface BidCardProps {
  myBidRider: Bid;
  availableRiders: RiderWithBid[];
  alleBiedingen: Bid[];
  isAuctionPeriodActive: boolean;
  game: AuctionGameData;
}

const BidCard = ({ myBidRider, availableRiders, alleBiedingen, isAuctionPeriodActive, game }: BidCardProps) => {
  const rider = availableRiders.find(
    (r: RiderWithBid) => r.id === myBidRider.riderNameId || r.nameID === myBidRider.riderNameId
  );

  // Filter bidders - memoized per rider
  const riderBidders = useMemo(() => {
    if (!rider) return [];
    return alleBiedingen
      .filter((b: Bid) => (b.riderNameId === rider?.nameID || b.riderNameId === rider?.id))
      .filter((b: Bid) => {
        if (isAuctionPeriodActive && b.status === 'active') return false;
        return true;
      })
      .sort((a: Bid, b: Bid) => b.amount - a.amount)
      .map((b: Bid) => ({ playername: b.playername, amount: b.amount, bidAt: b.bidAt }));
  }, [alleBiedingen, rider, isAuctionPeriodActive]);

  if (!rider) return null;

  return (
    <PlayerCard
      showBid={true}
      className={`border-2 rounded-md ${
        myBidRider.status === 'won' 
          ? 'border-green-500 bg-green-50' 
          : myBidRider.status === 'lost' 
            ? 'border-red-400 bg-red-50 opacity-70' 
            : ''
      }`}
      hideInfo={true}
      showRank={true}
      bidders={riderBidders}
      bid={myBidRider.amount || 0}
      player={rider}
      myTeam={true}
      onClick={() => { }}
      selected={false}
      isNeoProf={qualifiesAsNeoProf(rider, game?.config || {})}
      showNeoProfBadge={game?.gameType === 'worldtour-manager'}
      showPointsInsteadOfPrice={game?.gameType === 'marginal-gains'}
      buttonContainer={<></>}
    />
  );
};
