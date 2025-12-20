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
      const startDate = typeof period.startDate === 'object' && 'toDate' in period.startDate
        ? period.startDate.toDate()
        : new Date(period.startDate as any);
      const endDate = typeof period.endDate === 'object' && 'toDate' in period.endDate
        ? period.endDate.toDate()
        : new Date(period.endDate as any);

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
                      {game.config.auctionPeriods.map((period, index) => {
                        const now = new Date()
                        const startDate = typeof period.startDate === 'object' && 'toDate' in period.startDate
                          ? period.startDate.toDate()
                          : new Date(period.startDate as any)
                        const endDate = typeof period.endDate === 'object' && 'toDate' in period.endDate
                          ? period.endDate.toDate()
                          : new Date(period.endDate as any)
                        const isPeriodActive = now >= startDate && now <= endDate

                        const formatDate = (date: Date) => {
                          return date.toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        }

                        return (
                          <button
                            key={index}
                            onClick={() => !isPeriodActive && setActiveAuctionPeriodTab(index)}
                            disabled={isPeriodActive}
                            className={`
                            whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm
                            ${isPeriodActive
                              ? 'border-transparent text-gray-400 cursor-not-allowed opacity-50'
                              : activeAuctionPeriodTab === index
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                          `}
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-semibold">{period.name}</span>
                              <span className="text-xs mt-1">
                                {formatDate(startDate)} - {formatDate(endDate)}
                              </span>
                              {isPeriodActive && (
                                <span className="text-xs font-bold text-orange-500 mt-1">
                                  ● Actief - Niet zichtbaar
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
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
              
                              const startDate = typeof auctionPeriod.startDate === 'object' && 'toDate' in auctionPeriod.startDate
                                ? auctionPeriod.startDate.toDate()
                                : new Date(auctionPeriod.startDate as any);
                              const endDate = typeof auctionPeriod.endDate === 'object' && 'toDate' in auctionPeriod.endDate
                                ? auctionPeriod.endDate.toDate()
                                : new Date(auctionPeriod.endDate as any);
                              const now = new Date()

                              // SECURITY: Check if this auction period is currently active
                              // During an active auction period, users should NOT see active bids from other players
                              const isAuctionPeriodActive = now >= startDate && now <= endDate

                              // Use selectedPlayerBids if a player is selected, otherwise use myBids
                              const bidsToShow = selectedPlayerId ? selectedPlayerBids : myBids;


                              // Filter bids to only show bids within this auction period
                              const bidsInPeriod = bidsToShow.filter((bid) => {
                                const bidDate = new Date(bid.bidAt);
                                if (bid.riderNameId === 'mattia-agostinacchio') {
                                  console.log('bid', bid)
                                  console.log('bidAt', bid.bidAt)
                                  console.log('bidDate', bidDate)
                                  console.log('startDate', startDate)
                                  console.log('endDate', endDate)
                                  console.log('bidDate >= startDate && bidDate <= endDate', bidDate >= startDate && bidDate <= endDate)
                                }
                                return bidDate >= startDate && bidDate <= endDate;
                              });

                              console.log('bidsInPeriod', bidsInPeriod);
                              console.log('availableRiders', availableRiders);

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

                                    // SECURITY: Only show other players' active bids if the auction period is over
                                    // If auction period is still active, filter out all 'active' status bids from other players
                                    // This prevents users from seeing what others are currently bidding during an active auction
                                    const riderBidders = alleBiedingen
                                      .filter((b: Bid) => (b.riderNameId === rider?.nameID || b.riderNameId === rider?.id))
                                      .filter((b: Bid) => {
                                        // If the auction period is still active, hide all 'active' bids
                                        if (isAuctionPeriodActive && b.status === 'active') {
                                          return false;
                                        }
                                        return true;
                                      })
                                      .sort((a: Bid, b: Bid) => b.amount - a.amount)
                                      .map((b: Bid) => ({ playername: b.playername, amount: b.amount, bidAt: b.bidAt }))            
              
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
                                        isNeoProf={qualifiesAsNeoProf(rider, game?.config || {})}
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