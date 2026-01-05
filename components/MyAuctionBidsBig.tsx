import { AuctionGameData as GameData, AuctionParticipantData as ParticipantData, RiderWithBid } from "@/lib/types/pages"
import { Bid } from "@/lib/types";
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { User } from "firebase/auth"
import { PlayerCard } from "./PlayerCard";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { useState, useMemo } from "react";
import { SortAscending, SortDescending } from "tabler-icons-react";

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

  // Sorting state
  type SortOption = 'price' | 'name' | 'age' | 'team' | 'neoprof' | 'rank' | 'status';
  type SortDirection = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortOption>('price');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');


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

                              // Sort the bids based on the selected criteria
                              const sortedBidsInPeriod = [...bidsInPeriod].sort((a, b) => {
                                const riderA = availableRiders.find((r: any) => r.id === a.riderNameId || r.nameID === a.riderNameId);
                                const riderB = availableRiders.find((r: any) => r.id === b.riderNameId || r.nameID === b.riderNameId);

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
                                    comparison = (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99);
                                    break;
                                  }
                                  default:
                                    return 0;
                                }

                                return sortDirection === 'asc' ? comparison : -comparison;
                              });

                              // Card View - Show all bids (won and lost) for this auction period
                              return <div key={periodIndex} className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                  <div className="flex items-center gap-2">
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
                                      <option value="price">Prijs</option>
                                      <option value="rank">Rank</option>
                                      <option value="name">Naam</option>
                                      <option value="age">Leeftijd</option>
                                      <option value="team">Ploeg</option>
                                      <option value="status">Status</option>
                                      {game?.gameType === 'worldtour-manager' && <option value="neoprof">Neo-Prof</option>}
                                    </select>
                                    <button
                                      onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                                      className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
                                      title={sortDirection === 'asc' ? 'Oplopend' : 'Aflopend'}
                                    >
                                      {sortDirection === 'asc' ? <SortAscending size={18} /> : <SortDescending size={18} />}
                                    </button>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-medium">Remaining Budget: </span>
                                    <span className="text-lg font-bold text-green-600">{formatCurrencyWhole(remainingBudget)}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {sortedBidsInPeriod
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
                                    ) : null;
                                  })
                                }</div>
                              </div>
                            })}
    
    </>
}