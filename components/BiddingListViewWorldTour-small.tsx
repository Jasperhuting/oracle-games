import { AuctionGameData as GameData, RiderWithBid } from "@/lib/types/pages";
import { Bid } from "@/lib/types";
import CurrencyInput from "react-currency-input-field";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Star, SortAscending, SortDescending } from "tabler-icons-react";
import { calculateAge, qualifiesAsNeoProf } from "@/lib/utils";
import { useState, useMemo } from "react";

type SortOption = 'price' | 'name' | 'age' | 'team' | 'neoprof' | 'rank';
type SortDirection = 'asc' | 'desc';

export const BiddingListViewWorldTourSmall = ({
  myBids,
  game,
  availableRiders,
  adjustingBid,
  placingBid,
  bidAmountsRef,
  handlePlaceBid,
  setAdjustingBid,
  cancellingBid,
  handleCancelBidClick,
}:
  {
    myBids: Bid[],
    game: GameData,
    availableRiders: RiderWithBid[],
    adjustingBid: string | null,
    placingBid: string | null,
    bidAmountsRef: React.RefObject<Record<string, string>>,
    handlePlaceBid: (rider: any) => void,
    setAdjustingBid: React.Dispatch<React.SetStateAction<string | null>>,
    cancellingBid: string | null,
    handleCancelBidClick: (bidId: string, riderName: string) => void,
  }) => {

  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<SortOption>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedBids = useMemo(() => {
    const filtered = myBids.filter((bid) => bid.status !== 'won' && bid.status !== 'lost');

    return filtered.sort((a, b) => {
      const riderA = availableRiders.find((rider: any) => rider.id === a.riderNameId || rider.nameID === a.riderNameId);
      const riderB = availableRiders.find((rider: any) => rider.id === b.riderNameId || rider.nameID === b.riderNameId);

      if (!riderA || !riderB) return 0;

      let comparison = 0;

      switch (sortBy) {
        case 'price':
          comparison = (riderB.myBid || 0) - (riderA.myBid || 0);
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
          // Zet lege teams onderaan
          if (!teamA && teamB) return 1;
          if (teamA && !teamB) return -1;
          comparison = teamA.localeCompare(teamB);
          break;
        }
        case 'neoprof': {
          const isNeoProfA = qualifiesAsNeoProf(riderA, game.config) ? 1 : 0;
          const isNeoProfB = qualifiesAsNeoProf(riderB, game.config) ? 1 : 0;
          comparison = isNeoProfB - isNeoProfA;
          break;
        }
        case 'rank':
          comparison = (riderA.rank || 0) - (riderB.rank || 0);
          break;
        default:
          return 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [myBids, availableRiders, sortBy, sortDirection]);

  return <>



    <div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 items-center justify-start flex-wrap gap-4 py-4">
      {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
        {game?.gameType === 'worldtour-manager' ? 'No riders selected yet.' : 'No bids placed yet.'}
      </div>}
      {myBids.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm font-medium">Sorteren op:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="pl-3 pr-5 min-w-[120px] py-1.5 text-sm font-normal border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.25rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.5em 1.5em'
            }}
          >
            <option value="price">{game.gameType === 'marginal-gains' ? 'Points' : 'Prijs'}</option>
            <option value="rank">Rank</option>
            <option value="name">Naam</option>
            <option value="age">Leeftijd</option>
            <option value="team">Ploeg</option>
            <option value="neoprof">Neo-Prof</option>
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
            title={sortDirection === 'asc' ? 'Oplopend' : 'Aflopend'}
          >
            {sortDirection === 'asc' ? <SortAscending size={18} /> : <SortDescending size={18} />}
          </button>
        </div>
      )}
      {myBids.length > 0 && game.gameType !== 'worldtour-manager' && (
        <div className="flex flex-row w-full p-2">
          <span className="font-bold basis-[90px]">{t('global.price')}</span>
          <span className="font-bold basis-[90px]">{t('global.bid')}</span>
          <span className="font-bold flex-1">{t('global.name')}</span>
          <span className="font-bold basis-[300px]">{t('global.team')}</span>
          <span className="font-bold basis-[200px]"></span>
        </div>
      )}
      <div className="flex flex-col">



        {sortedBids.map((myBidRider) => {
          const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId || rider.nameID === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
          const canCancel = myBidRider.status === 'active' || myBidRider.status === 'outbid';
          const riderNameId = rider?.nameID || rider?.id || '';

          return rider ?
            <div key={myBidRider.id} className="bg-white px-2 relative border rounded-lg border-gray-200 flex flex-row gap-2 items-center justify-between">
              <div className="flex items-center">
              <div className="flex items-center">
                {qualifiesAsNeoProf(rider, game.config) && <Star size={15} color="#ff9900" className="flex-shrink-0" />}
                <span className={`truncate font-medium ${qualifiesAsNeoProf(rider, game.config) ? 'ml-1' : ''}`}>
                  {rider.name}
                </span>
              </div>

              <span className="text-gray-600 text-xs truncate ml-2">{rider.team?.name || '-'}</span>

              {rider.age && (
                <span className="text-gray-500 text-xs whitespace-nowrap ml-2">
                  {calculateAge(rider.age)} jr
                </span>
              )}
              </div>

              <div className="flex gap-2 items-center justify-between mt-1">
                <span className="font-medium whitespace-nowrap text-sm">
                  {game.gameType === 'marginal-gains' ? `${rider.myBid} ${rider.myBid === 1 ? 'point' : 'points'}` : rider.myBid === 0 ? formatCurrencyWhole(1) : formatCurrencyWhole(rider.myBid || 1)}
                </span>
                {canCancel && (
                  <>
                    {adjustingBid === rider.myBidId ? (
                      <div className="flex gap-2 items-center flex-1">
                        <CurrencyInput
                          id={`adjust-bid-list-${rider.myBidId}`}
                          name="adjust-bid"
                          className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`${rider.myBid || 0}`}
                          decimalsLimit={0}
                          disabled={placingBid === riderNameId}
                          defaultValue={bidAmountsRef.current[riderNameId] || ''}
                          onValueChange={(value) => {
                            bidAmountsRef.current[riderNameId] = value || '0';
                          }}
                        />
                        <Button
                          type="button"
                          text={placingBid === riderNameId ? t('global.loading') : t('global.save')}
                          onClick={() => {
                            handlePlaceBid(rider);
                            setAdjustingBid(null);
                          }}
                          disabled={placingBid === riderNameId}
                          className="px-2 py-1 text-sm"
                          size="sm"
                          variant="primary"
                        />
                        <Button
                          type="button"
                          text={t('global.cancel')}
                          onClick={() => setAdjustingBid(null)}
                          className="px-2 py-1 text-sm"
                          size="sm"
                          ghost
                        />
                      </div>
                    ) : (
                      <Button
                        type="button"
                        text={cancellingBid === rider.myBidId ? t('global.loading') : t('global.reset')}
                        onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                        disabled={cancellingBid === rider.myBidId}
                        className="px-2 mb-[2px] py-1 text-sm whitespace-nowrap"
                        ghost
                        size="sm"
                        title={t('global.cancelBid')}
                        variant="danger"
                      />
                    )}
                  </>
                )}
              </div>
            </div> : null

        })}
      </div>
    </div>


  </>
}