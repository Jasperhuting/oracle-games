import { GameData, ParticipantData, RiderWithBid } from "@/app/games/[gameId]/auction/page"
import { Bid } from "@/lib/types";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { User } from "firebase/auth"
import { PlayerCard } from "./PlayerCard";
import { qualifiesAsNeoProf } from "@/lib/utils";

export const MyAuctionBidsBig = ({
    divisionParticipants, 
    availableRiders,
    alleBiedingen,
    selectedPlayerId, 
    setSelectedPlayerId, 
    selectedPlayerBids,
    user, 
    game,
    participant,
    myBids,
    activeAuctionPeriodTab,
    setActiveAuctionPeriodTab
}: {
    divisionParticipants: ParticipantData[], 
    alleBiedingen: Bid[],
    availableRiders: RiderWithBid[],
    participant: ParticipantData | null,
    selectedPlayerId: string | null, 
    selectedPlayerBids: Bid[],
    setSelectedPlayerId: (id: string | null) => void, 
    user: User | null, 
    game: GameData, 
    myBids: Bid[],
    activeAuctionPeriodTab: number, 
    setActiveAuctionPeriodTab: (index: number) => void}) => {


  // Calculate remaining budget for a player based on their won bids up to a specific auction period
  const calculateRemainingBudget = (playerBids: Bid[], upToAuctionPeriodIndex: number): number => {
    if (!game?.config?.budget) return 0;

    const startingBudget = game.config.budget;
    const auctionPeriods = game.config.auctionPeriods || [];

    // Calculate total spent on won bids up to and including the specified auction period
    let totalSpent = 0;

    for (let i = 0; i <= upToAuctionPeriodIndex; i++) {
      if (i >= auctionPeriods.length) break;

      const period = auctionPeriods[i];
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);

      // Find all won bids in this period
      const wonBidsInPeriod = playerBids.filter((bid) => {
        if (bid.status !== 'won') return false;
        const bidDate = new Date(bid.bidAt);
        return bidDate >= startDate && bidDate <= endDate;
      });

      totalSpent += wonBidsInPeriod.reduce((sum, bid) => sum + bid.amount, 0);
    }

    return startingBudget - totalSpent;
  };

    


    return <>
        {/* Player selector dropdown */}
              {divisionParticipants.length > 0 && (
                <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                  <label htmlFor="player-selector" className="block text-sm font-medium text-gray-700 mb-2">
                    View another player's bids:
                  </label>
                  <select
                    id="player-selector"
                    value={selectedPlayerId || ''}
                    onChange={(e) => setSelectedPlayerId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Select a player --</option>
                    {divisionParticipants
                      .filter(p => p.userId !== user?.uid) // Exclude current user
                      .map((p) => (
                        <option key={p.id} value={p.userId}>
                          {p.playername || 'Unknown Player'}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <h2 className="text-2xl font-bold mb-4">
                {selectedPlayerId ? 'Selected Player\'s Bids per Auction Round' : 'My Bids per Auction Round'}
              </h2>

                {/* Auction Period Tabs */}
              {game.config.auctionPeriods && game.config.auctionPeriods.length > 0 && (
                <div className="mb-4">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                      {game.config.auctionPeriods.map((period, index) => (
                        <button
                          key={index}
                          onClick={() => setActiveAuctionPeriodTab(index)}
                          className={`
                          whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm
                          ${activeAuctionPeriodTab === index
                              ? 'border-primary text-primary'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                        `}
                        >
                          {period.name}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              )}


              {game.config.auctionPeriods?.map((auctionPeriod, periodIndex) => {
                              // Only render the active tab
                              if (periodIndex !== activeAuctionPeriodTab) return null;
              
                              // bidAt looks like: bidAt: "2025-12-14T19:26:01.513Z"
                              // auctionPeriod looks like: startDate: '2025-12-15T22:00:00.000Z', endDate: '2025-12-17T22:00:00.000Z',
                              // help me filter them
                              // the bids are empty
              
                              const startDate = new Date(auctionPeriod.startDate)
                              const endDate = new Date(auctionPeriod.endDate)
              
                              console.log({ startDate });
                              console.log({ endDate });
              
                              const bids = alleBiedingen
                                .filter((bid) => {
                                  return new Date(bid.bidAt) >= startDate && new Date(bid.bidAt) <= endDate ? bid : null
                                })
              
                              // Use selectedPlayerBids if a player is selected, otherwise use myBids
                              const bidsToShow = selectedPlayerId ? selectedPlayerBids : myBids;
              
                              // Filter bids to only show bids within this auction period
                              const bidsInPeriod = bidsToShow.filter((bid) => {
                                const bidDate = new Date(bid.bidAt);
                                return bidDate >= startDate && bidDate <= endDate;
                              });
              
                              // Don't render this section if there are no bids in this period
                              if (bidsInPeriod.length === 0) return null;
              
                              // Calculate remaining budget for the selected player up to this period
                              const remainingBudget = selectedPlayerId
                                ? calculateRemainingBudget(selectedPlayerBids, periodIndex)
                                : calculateRemainingBudget(myBids, periodIndex);
              
                              // Card View - Show all bids (won and lost) for this auction period
                              return <div key={periodIndex} className="mb-8">
                                <div className="flex justify-end items-center mb-4">
                                  <div className="text-sm">
                                    <span className="font-medium">Remaining Budget: </span>
                                    <span className="text-lg font-bold text-green-600">{formatCurrencyWhole(remainingBudget)}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {bidsInPeriod
                                  .map((myBidRider) => {
                                    const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId || rider.nameID === myBidRider.riderNameId);
              
                                    const riderBidders = alleBiedingen
                                      .filter((b: Bid) => (b.riderNameId === rider?.nameID || b.riderNameId === rider?.id))
                                      .sort((a: Bid, b: Bid) => b.amount - a.amount)
                                      .map((b: Bid) => ({ playername: b.playername, amount: b.amount, bidAt: b.bidAt }))
              
                                    console.log('riderBidders', riderBidders)
              
                                    return rider ? (
                                      <PlayerCard
                                        key={myBidRider.id}
                                        showBid={true}
                                        className={`border-2 rounded-md ${myBidRider.status === 'won' ? 'border-green-500 bg-green-50' : ''}`}
                                        hideInfo={true}
                                        bidders={riderBidders}
                                        bid={myBidRider.amount || 0}
                                        player={rider}
                                        participant={participant}
                                        myTeam={true}
                                        onClick={() => { }}
                                        selected={false}
                                        isNeoProf={qualifiesAsNeoProf(rider, game?.config?.maxNeoProAge || 0)}
                                        showNeoProfBadge={game?.gameType === 'worldtour-manager'}
                                        buttonContainer={<></>}
                                      />
                                    ) : null;
                                  })
                                }</div>
                              </div>
                            })}
    
    </>
}