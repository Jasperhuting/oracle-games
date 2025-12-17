import { GameData, RiderWithBid } from "@/app/games/[gameId]/auction/page";
import { Bid } from "@/lib/types";
import CurrencyInput from "react-currency-input-field";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { BiddingListViewWorldTour } from "./BiddingListViewWorldTour";

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

  return <>



    <div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 items-center justify-start flex-wrap gap-4 py-4">
      {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
        {game?.gameType === 'worldtour-manager' ? 'No riders selected yet.' : 'No bids placed yet.'}
      </div>}
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



        {myBids.filter((bid) => bid.status !== 'won' && bid.status !== 'lost').map((myBidRider) => {
          const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId || rider.nameID === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
          const canCancel = myBidRider.status === 'active' || myBidRider.status === 'outbid';
          const riderNameId = rider?.nameID || rider?.id || '';

          return rider ?

            
              <div key={myBidRider.id} className="bg-white px-2">
                <div className="flex flex-row w-full py-1">
                  <span className="basis-[90px] flex items-center">{rider.points === 0 ? formatCurrencyWhole(1) : formatCurrencyWhole(rider.effectiveMinBid || rider.points)}</span>
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