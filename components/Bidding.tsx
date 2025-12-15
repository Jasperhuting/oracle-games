import CurrencyInput from "react-currency-input-field";
import { Button } from "./Button";
import { PlayerCard } from "./PlayerCard";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { useState } from "react";
import { GridDots, List } from "tabler-icons-react";
import { Bid } from "@/lib/types";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { PlayerRowBids } from "./PlayerRowBids";
import React from "react";
import { GameData, ParticipantData, RiderWithBid } from "@/app/games/[gameId]/auction/page";
import { useTranslation } from "react-i18next";

export const Bidding = ({ 
    auctionClosed, 
    myBidRef, 
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
    }: {
    auctionClosed: boolean,
    myBidRef: (node?: Element | null | undefined) => void,
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

}) => {


    const [myTeamView, setMyTeamView] = useState('card');
      const [myTeamBidsView, setMyTeamBidsView] = useState('list');

      const { t } = useTranslation();

    return <>


          {/* My Bids Section - Only show when auction is active */}
          {!auctionClosed && (
            <div ref={myBidRef}>
              <div className="mt-4 bg-white p-4 rounded-md rounded-b-none border border-gray-200 flex flex-row gap-4">
                <h1 className="text-2xl font-bold mt-1">
                  {game?.gameType === 'worldtour-manager' ? t('games.auctions.mySelectedRiders') : t('games.auctions.myBids')}
                </h1>
                <span className="flex flex-row gap-2">
                  <Button ghost={myTeamBidsView === 'card'} onClick={() => setMyTeamBidsView('list')}><span className={`flex flex-row gap-2 items-center`}><List />Listview</span></Button>
                  <Button ghost={myTeamBidsView === 'list'} onClick={() => setMyTeamBidsView('card')}><span className={`flex flex-row gap-2 items-center`}><GridDots />Cardview</span></Button>
                </span>
              </div>


              {myTeamBidsView === 'card' ? (<div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4">
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
              </div>) : (<div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 items-center justify-start flex-wrap gap-4 py-4">
                {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
                  {game?.gameType === 'worldtour-manager' ? 'No riders selected yet.' : 'No bids placed yet.'}
                </div>}
                {myBids.length > 0 && (
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

                    console.log(myBidRider);

                    return rider ? (
                      <div key={myBidRider.id} className="bg-white px-2">
                        <div className="flex flex-row w-full py-1">
                          <span className="basis-[90px] flex items-center">{formatCurrencyWhole(rider.effectiveMinBid || rider.points)}</span>
                          <span className="basis-[90px] flex items-center">{formatCurrencyWhole(rider.myBid || 0)}</span>
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
                    ) : null;
                  })}
                </div>
              </div>)}


            </div>
          )}

          {/* Riders List */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-12">
            <div className="flex flex-col gap-4 p-3 bg-white font-semibold text-sm border-b border-gray-200 sticky top-0">
              <div className="col-span-1">{t('global.riders')}</div>
              <span className="flex flex-row gap-2">
                <span className="flex flex-row gap-2">
                  <Button ghost={myTeamView === 'list'} onClick={() => setMyTeamView('card')}><span className={`flex flex-row gap-2 items-center`}><GridDots />Cardview</span></Button>
                  <Button ghost={myTeamView === 'card'} onClick={() => setMyTeamView('list')}><span className={`flex flex-row gap-2 items-center`}><List />Listview</span></Button>
                </span>
              </span>

            </div>


            <div className="overflow-y-auto">
              <div className={`w-full ${myTeamView === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 items-start justify-start flex-wrap gap-4 p-4' : 'flex flex-col items-start bg-white rounded-md divide-y divide-[#CAC4D0] justify-start flex-wrap mb-4 pb-4'}`}>

                {/* it should sort when there is a myBid */}
                {sortedAndFilteredRiders.map((rider, index) => {
                  const riderNameId = rider.nameID || rider.id || '';

                  // Get all bidders for this rider (admin only)
                  const riderBidders = allBids
                    .filter((b: Bid) => (b.riderNameId === rider.nameID || b.riderNameId === rider.id) && b.status === 'active')
                    .sort((a: Bid, b: Bid) => b.amount - a.amount)
                    .sort((a: Bid, b: Bid) => new Date(a.bidAt).getTime() - new Date(b.bidAt).getTime()) // Sort by bidAt descending (newest first)
                    .map((b: Bid) => ({ playername: b.playername, amount: b.amount, bidAt: b.bidAt }))

                  return (
                    <React.Fragment key={rider.id || index}>

                      <div className={`flex w-full ${myTeamView === 'list' && 'flex-col'}`}>

                        {myTeamView === 'card' ?

                          <PlayerCard
                            showBid={true}
                            bid={rider.highestBid}
                            player={rider}
                            onClick={() => { }}
                            selected={false}
                            bidders={isAdmin ? riderBidders : undefined}
                            participant={participant}
                            isNeoProf={qualifiesAsNeoProf(rider, game?.config?.maxNeoProAge || 0)}
                            showNeoProfBadge={game?.gameType === 'worldtour-manager'}
                            buttonContainer={<>
                              <div className="flex flex-row gap-2">


                                <div className="flex-1">
                                  {auctionActive ? (<>
                                    {game?.gameType !== 'worldtour-manager' && (
                                      // For auction games, show bid input
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
                                          {typeof rider.myBid === 'number' ? rider.myBid.toFixed(1) : '0.0'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {rider.myBidStatus === 'won' ? 'Won' : rider.myBidStatus === 'lost' ? 'Lost' : rider.myBidStatus}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">{t('global.noBid')}</span>
                                    )
                                  )}
                                </div>
                                {auctionActive && !rider.isSold && (
                                  <>
                                    {rider.myBid && rider.myBidId && (rider.myBidStatus === 'active' || rider.myBidStatus === 'outbid') && (
                                      <Button
                                        type="button"
                                        text={cancellingBid === rider.myBidId ? t('global.loading') : game?.gameType === 'worldtour-manager' ? t('global.remove') : t('games.auctions.resetBid')}
                                        onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                        disabled={cancellingBid === rider.myBidId}
                                        className="px-2 py-1 text-sm"
                                        title={game?.gameType === 'worldtour-manager' ? t('games.auctions.removeRider') : t('games.auctions.cancelBid')}
                                        variant="danger"
                                      />
                                    )}
                                    <Button
                                      type="button"
                                      text={placingBid === riderNameId ? t('global.loading') : game?.gameType === 'worldtour-manager' ? t('global.select') : t('games.auctions.bid')}
                                      onClick={() => handlePlaceBid(rider)}
                                      disabled={placingBid === riderNameId}
                                      className={`py-1 text-sm ${game?.gameType === 'worldtour-manager' ? 'w-full' : ''}`}
                                      variant="primary"
                                    />
                                  </>
                                )}
                              </div>

                            </>} />
                          :
                          <PlayerRowBids player={rider} showPoints showRank fullWidth selectPlayer={() => handlePlaceBid(rider)} index={index} rightContent={<>
                            <div className={`flex flex-row ${game?.gameType !== 'worldtour-manager' && 'gap-2'}`}>


                              <div className="flex-1">
                                {auctionActive && !rider.isSold ? (<>
                                  {game?.gameType === 'worldtour-manager' ? (
                                    // For worldtour-manager, show the price (no input needed)
                                    <div className="w-full px-2 py-1 text-sm text-center font-semibold text-gray-700">
                                      Price: {formatCurrencyWhole(rider.effectiveMinBid || rider.points)}
                                    </div>
                                  ) : (
                                    // For auction games, show bid input
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
                                        {typeof rider.myBid === 'number' ? rider.myBid.toFixed(1) : '0.0'}
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
                              {auctionActive && !rider.isSold && (
                                <>
                                  {rider.myBid && rider.myBidId && (rider.myBidStatus === 'active' || rider.myBidStatus === 'outbid') && (
                                    <Button
                                      type="button"
                                      text={cancellingBid === rider.myBidId ? t('global.loading') : game?.gameType === 'worldtour-manager' ? t('global.remove') : t('games.auctions.resetBid')}
                                      onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                      disabled={cancellingBid === rider.myBidId}
                                      className="px-2 py-1 text-sm"
                                      title={game?.gameType === 'worldtour-manager' ? t('games.auctions.removeRider') : t('games.auctions.cancelBid')}
                                      variant="danger"
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    text={placingBid === riderNameId ? t('global.loading') : game?.gameType === 'worldtour-manager' ? t('global.select') : t('games.auctions.bid')}
                                    onClick={() => handlePlaceBid(rider)}
                                    disabled={placingBid === riderNameId}
                                    className="px-3 py-1 text-sm"
                                    variant="primary"
                                  />
                                </>
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
    
    </>
}