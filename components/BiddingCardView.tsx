import { GameData, RiderWithBid } from "@/app/games/[gameId]/auction/page";
import { Bid } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";
import { qualifiesAsNeoProf } from "@/lib/utils";
import CurrencyInput from "react-currency-input-field";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

export const BiddingCardView = ({
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

    return <div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4">
              {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
                {game?.gameType === 'worldtour-manager' ? t('games.auctions.noRidersSelected') : t('games.auctions.noBidsPlaced')}
              </div>}
              {myBids.filter((bid) => bid.status !== 'won' && bid.status !== 'lost').map((myBidRider) => {
                const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId || rider.nameID === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
                const canCancel = myBidRider.status === 'active' || myBidRider.status === 'outbid';
                const riderNameId = rider?.nameID || rider?.id || '';
    
                return rider ? (
                  <div key={myBidRider.id}>
                    <PlayerCard
                      showBid={true}
                      className="border-2 rounded-md border-gray-200"
                      hideInfo={true}
                      bid={rider?.myBid || myBidRider.amount || 0}
                      player={rider}
                      onClick={() => { }}
                      selected={false}
                      isNeoProf={qualifiesAsNeoProf(rider, game?.config?.maxNeoProAge || 0)}
                      showNeoProfBadge={game?.gameType === 'worldtour-manager'}
                      buttonContainer={
                        <>
                          {rider && canCancel && (
                            <div className="flex flex-col gap-2 w-full">
                              {adjustingBid === rider.myBidId ? (
                                <>
                                  <CurrencyInput
                                    id={`adjust-bid-${rider.myBidId}`}
                                    name="adjust-bid"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder={`${t('global.current')}: ${rider.myBid || 0}`}
                                    prefix="€"
                                    min={1}
                                    decimalsLimit={0}
                                    disabled={placingBid === riderNameId}
                                    defaultValue={bidAmountsRef.current[riderNameId] || ''}
                                    onValueChange={(value) => {
                                      bidAmountsRef.current[riderNameId] = value || '0';
                                    }}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      text={placingBid === riderNameId ? t('global.loading') : t('global.save')}
                                      onClick={() => {
                                        handlePlaceBid(rider);
                                        setAdjustingBid(null);
                                      }}
                                      disabled={placingBid === riderNameId}
                                      className="px-2 py-1 text-sm flex-1"
                                      variant="primary"
                                    />
                                    <Button
                                      type="button"
                                      text={t('global.cancel')}
                                      onClick={() => setAdjustingBid(null)}
                                      className="px-2 py-1 text-sm flex-1"
                                      ghost
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  {game?.gameType !== 'worldtour-manager' && (
                                    <Button
                                      type="button"
                                      text={t('games.auctions.adjustBid')}
                                      onClick={() => setAdjustingBid(rider.myBidId!)}
                                      className="px-2 py-1 text-sm w-full"
                                      ghost
                                      variant="primary"
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    text={cancellingBid === rider.myBidId ? t('global.loading') : t('games.auctions.resetBid')}
                                    onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                    disabled={cancellingBid === rider.myBidId}
                                    className="px-2 py-1 text-sm w-full"
                                    ghost
                                    title={t('games.auctions.cancelBid')}
                                    variant="danger"
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </>
                      }
                    />
                  </div>
                ) : null;
              })}
            </div>
}