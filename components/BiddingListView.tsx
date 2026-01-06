import { Bid } from "@/lib/types";
import CurrencyInput from "react-currency-input-field";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { BiddingListViewWorldTour } from "./BiddingListViewWorldTour";
import { SortAscending, SortDescending } from "tabler-icons-react";
import { useState, useMemo } from "react";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { AuctionGameData as GameData, RiderWithBid } from "@/lib/types/pages";

type SortOption = 'price' | 'name' | 'age' | 'team' | 'neoprof' | 'rank';
type SortDirection = 'asc' | 'desc';

export const BiddingListView = ({
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
  }, [myBids, availableRiders, sortBy, sortDirection, game.config]);

  return <>



    <div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 items-center justify-start flex-wrap gap-4 py-4">
      {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
        {game?.gameType === 'worldtour-manager' ? t('messages.noRidersSelectedYet') : t('messages.noBidsPlacedYet')}
      </div>}
      {myBids.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <label className="text-sm font-medium">{t('global.sortingBy')}</label>
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
            <option value="price">{game?.gameType === 'marginal-gains' ? 'Points' : 'Prijs'}</option>
            <option value="rank">t('global.rank')</option>
            <option value="name">t('global.name')</option>
            <option value="age">t('global.age')</option>
            <option value="team">t('global.team')</option>
            {game?.gameType === 'worldtour-manager' && <option value="neoprof">t('global.neoProf')</option>}
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
            title={sortDirection === 'asc' ? t('global.ascending') : t('global.descending')}
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
      <div className="divide-gray-300 divide-y">



        {sortedBids.map((myBidRider) => {
          const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId || rider.nameID === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
          const canCancel = myBidRider.status === 'active' || myBidRider.status === 'outbid';
          const riderNameId = rider?.nameID || rider?.id || '';

          return rider ?

            
              <div key={myBidRider.id} className="bg-white px-2">
                <div className="flex flex-row w-full py-1">
                  <span className="basis-[90px] flex items-center">{rider.points === 0 ? formatCurrencyWhole(1) : formatCurrencyWhole(rider.effectiveMinBid || rider.points || 1)}</span>
                  <span className="basis-[90px] flex items-center">{rider.myBid === 0 ? formatCurrencyWhole(1) : formatCurrencyWhole(rider.myBid || 1)}</span>
                  <span className="flex-1 flex items-center">{rider.name}</span>
                  <span className="basis-[300px] flex items-center">{rider.team?.name || t('global.unknown')}</span>
                  <span className="basis-[200px] flex items-center gap-2">
                    {canCancel && (
                      <>
                        {adjustingBid === rider.myBidId ? (
                          <div className="flex gap-2 items-center w-full">
                            <CurrencyInput
                              id={`adjust-bid-list-${rider.myBidId}`}
                              name="adjust-bid"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
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
                          <>
                            {game?.gameType !== 'worldtour-manager' && (
                              <Button
                                type="button"
                                text={t('global.adjust')}
                                onClick={() => setAdjustingBid(rider.myBidId!)}
                                className="px-2 py-1 text-sm"
                                size="sm"
                                ghost
                                variant="primary"
                              />
                            )}
                            <Button
                              type="button"
                              text={cancellingBid === rider.myBidId ? t('global.loading') : t('global.reset')}
                              onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                              disabled={cancellingBid === rider.myBidId}
                              className="px-2 py-1 text-sm"
                              ghost
                              size="sm"
                              title={t('global.cancelBid')}
                              variant="danger"
                            />
                          </>
                        )}
                      </>
                    )}
                  </span>
                </div>
              </div>
             : null;
        })}
      </div>
    </div>


  </>
}