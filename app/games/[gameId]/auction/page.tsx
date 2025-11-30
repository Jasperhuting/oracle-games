'use client'

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { Rider } from "@/lib/scraper/types";
import CurrencyInput from 'react-currency-input-field';
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { MyTeamSelection } from "@/components/MyTeamSelection";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerRow } from "@/components/PlayerRow";
import { ActionPanel } from "@/components/ActionPanel";
import { Toggle } from "@/components/Toggle";
import process from "process";
import { useInView } from "react-intersection-observer";
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';
import { GridDots, List } from "tabler-icons-react";
import './range-slider-custom.css';

const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

interface GameData {
  id: string;
  name: string;
  gameType: string;
  year: number;
  status: string;
  config: {
    budget?: number;
    maxRiders?: number;
    minRiders?: number;
    auctionStatus?: 'pending' | 'active' | 'closed' | 'finalized';
    maxMinimumBid?: number;
  };
  eligibleRiders: string[];
}

interface ParticipantData {
  id: string;
  budget?: number;
  spentBudget?: number;
  rosterSize: number;
  rosterComplete: boolean;
}

interface Bid {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  playername: string;
  riderNameId: string;
  riderName: string;
  amount: number;
  status: 'active' | 'outbid' | 'won' | 'lost';
  placedAt: string;
  bidAt: string;
}

interface RiderWithBid extends Rider {
  highestBid?: number;
  highestBidder?: string;
  myBid?: number;
  myBidStatus?: string;
  myBidId?: string;
  effectiveMinBid?: number; // The actual minimum bid after applying maxMinimumBid cap
}

export default function AuctionPage({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gameId, setGameId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [availableRiders, setAvailableRiders] = useState<RiderWithBid[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [placingBid, setPlacingBid] = useState<string | null>(null);
  const [cancellingBid, setCancellingBid] = useState<string | null>(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{ bidId: string; riderName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPlayerCard, setShowPlayerCard] = useState(true);
  const [myTeamView, setMyTeamView] = useState('list');
  const [isSticky, setIsSticky] = useState(false);

  const { ref, inView } = useInView({
    /* Optional options */
    threshold: 0,
    rootMargin: "-243px 0px 0px 0px",
  });

  const { ref: myBidRef, inView: myBidInView } = useInView({
    /* Optional options */
    threshold: 0,
    rootMargin: "-243px 0px 0px 0px",
  });

  // Detect when sticky header is active
  useEffect(() => {
    const handleScroll = () => {
      // Check if we've scrolled past the initial header position (100px from top)
      setIsSticky(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    params.then(p => setGameId(p.gameId));
  }, [params]);

  useEffect(() => {
    if (!user) return;

    // Check if user is admin
    const checkAdmin = async () => {
      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);

        if (response.ok) {
          const userData = await response.json();
          setIsAdmin(userData.userType === 'admin');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };

    checkAdmin();
  }, [user]);

  const loadAuctionData = (async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Check admin status first
      let userIsAdmin = false;
      try {
        const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userIsAdmin = userData.userType === 'admin';
          setIsAdmin(userIsAdmin);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }

      // Load game details
      const gameResponse = await fetch(`/api/games/${gameId}`);
      if (!gameResponse.ok) throw new Error('Failed to load game');
      const gameData = await gameResponse.json();

      if (gameData.game.gameType !== 'auction' && gameData.game.gameType !== 'auctioneer') {
        throw new Error('This game is not an auction game');
      }

      setGame(gameData.game);

      // Load participant data (optional for admins)
      const participantResponse = await fetch(`/api/gameParticipants?userId=${user.uid}&gameId=${gameId}`);
      if (!participantResponse.ok) throw new Error('Failed to load participant data');
      const participantData = await participantResponse.json();

      if (participantData.participants.length === 0) {
        // Allow admins to view without being a participant
        if (!userIsAdmin) {
          throw new Error('You must join this game before participating in the auction');
        }
        // For admins, set a placeholder participant with view-only access
        setParticipant({
          id: 'admin-view',
          budget: gameData.game.config?.budget || 0,
          spentBudget: 0,
          rosterSize: 0,
          rosterComplete: false,
        });
      } else {
        setParticipant(participantData.participants[0]);
      }

      // Load eligible riders
      const year = gameData.game.year || YEAR;
      const ridersResponse = await fetch(`/api/getRankings?year=${year}&limit=500`);
      if (!ridersResponse.ok) throw new Error('Failed to load riders');
      const ridersData = await ridersResponse.json();

      let riders = ridersData.riders;
      if (gameData.game.eligibleRiders && gameData.game.eligibleRiders.length > 0) {
        const eligibleSet = new Set(gameData.game.eligibleRiders);
        riders = riders.filter((r: Rider) => eligibleSet.has(r.nameID || r.id || ''));
      }

      // Load bids - for admins load all, for users load only their bids
      let allBidsData: Bid[] = [];
      let userBids: Bid[] = [];

      if (userIsAdmin) {
        // Admin: Load all bids
        const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?limit=1000`);
        if (bidsResponse.ok) {
          const bidsData = await bidsResponse.json();
          allBidsData = bidsData.bids || [];
          userBids = allBidsData.filter((b: Bid) => b.userId === user.uid);
        }
      } else {
        // Regular user: Load only their own bids
        const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?userId=${user.uid}&limit=1000`);
        if (bidsResponse.ok) {
          const bidsData = await bidsResponse.json();
          userBids = bidsData.bids || [];
          allBidsData = userBids; // For non-admins, allBids is just their bids
        }
      }

      setAllBids(allBidsData);
      setMyBids(userBids);

      // Enhance riders with bid information
      const maxMinBid = gameData?.game?.config?.maxMinimumBid;
      const ridersWithBids = riders.map((rider: Rider) => {
        const myBid = userBids.find((b: Bid) =>
          (b.riderNameId === rider.nameID || b.riderNameId === rider.id)
        );

        // Calculate effective minimum bid (apply cap if configured)
        const effectiveMinBid = maxMinBid && rider.points > maxMinBid ? maxMinBid : rider.points;

        // Calculate highest bid for this rider
        let highestBid = 0;
        let highestBidder = '';

        if (userIsAdmin) {
          // For admins, find the highest active bid from ALL bids
          const riderBids = allBidsData.filter((b: Bid) =>
            (b.riderNameId === rider.nameID || b.riderNameId === rider.id) &&
            b.status === 'active'
          );

          if (riderBids.length > 0) {
            const highest = riderBids.reduce((max: Bid, bid: Bid) =>
              bid.amount > max.amount ? bid : max
            );

            highestBid = highest.amount;
            highestBidder = highest.playername || '';
          }
        } else {
          // For regular users, only show their own bid if it's active
          if (myBid && myBid.status === 'active') {
            highestBid = myBid.amount;
            // Don't set highestBidder for non-admins
          }
        }

        return {
          ...rider,
          highestBid: highestBid || undefined,
          highestBidder: highestBidder || undefined,
          myBid: myBid?.amount || undefined,
          myBidStatus: myBid?.status || undefined,
          myBidId: myBid?.id || undefined,
          effectiveMinBid,
        };
      });

      setAvailableRiders(ridersWithBids);

      setError(null);
    } catch (error) {
      console.error('Error loading auction data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load auction data');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!gameId) return;

    loadAuctionData();
  }, [gameId, user, authLoading, router]);

  // Calculate min/max prices from available riders and set initial price range
  useEffect(() => {
    if (availableRiders.length > 0) {
      const prices = availableRiders.map(r => r.effectiveMinBid || r.points);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      setPriceRange([minPrice, maxPrice]);
    }
  }, [availableRiders]);

  const getEffectiveMinimumBid = (riderPoints: number): number => {
    const maxMinBid = game?.config?.maxMinimumBid;
    if (maxMinBid && riderPoints > maxMinBid) {
      return maxMinBid;
    }
    return riderPoints;
  };

  const handlePlaceBid = async (rider: RiderWithBid) => {
    if (!user || !participant) return;

    const riderNameId = rider.nameID || rider.id || '';
    const bidAmount = parseFloat(bidAmounts[riderNameId] || '0');
    const effectiveMinBid = getEffectiveMinimumBid(rider.points);

    if (Number(bidAmount) < effectiveMinBid) {
      setError(`Bid must be at least ${effectiveMinBid}`);
      return;
    }

    if (!bidAmount || bidAmount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    // Check maxRiders limit before placing a new bid (not when updating existing)
    const maxRiders = game?.config?.maxRiders;
    const activeBidsCount = myBids.filter(b => b.status === 'active').length;
    const isUpdatingExistingBid = rider.myBid !== undefined;

    if (maxRiders && activeBidsCount >= maxRiders && !isUpdatingExistingBid) {
      setError(`Maximum number of riders reached (${maxRiders}/${maxRiders}). Cancel a bid to place a new one.`);
      return;
    }

    // Check budget, excluding any existing bid on this rider (in case we're updating)
    if (bidAmount > getRemainingBudget(riderNameId)) {
      setError('Bid exceeds your remaining budget');
      return;
    }

    if (rider.highestBid !== undefined && rider.highestBid !== null && bidAmount <= rider.highestBid) {
      const highestBid = typeof rider.highestBid === 'number' ? rider.highestBid.toFixed(1) : rider.highestBid;
      setError(`Bid must be higher than current highest bid (${highestBid})`);
      return;
    }

    setPlacingBid(riderNameId);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/bids/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          participantId: participant.id,
          riderNameId,
          riderName: rider.name,
          amount: bidAmount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to place bid');
      }

      const result = await response.json();
      const newBid = result.bid;

      // Clear bid amount input
      setBidAmounts(prev => ({ ...prev, [riderNameId]: '' }));

      // Update state directly instead of reloading
      // When updating a bid, remove any existing bid on this rider by this user
      setMyBids(prev => {
        const filtered = prev.filter(b => b.riderNameId !== riderNameId);
        return [...filtered, newBid];
      });
      setAllBids(prev => {
        const filtered = prev.filter(b =>
          !(b.userId === user.uid && b.riderNameId === riderNameId)
        );
        return [...filtered, newBid];
      });

      // Update the rider's bid info
      setAvailableRiders(prev => prev.map(r => {
        const riderId = r.nameID || r.id || '';
        if (riderId === riderNameId) {
          return {
            ...r,
            highestBid: newBid.amount,
            highestBidder: newBid.playername,
            myBid: newBid.amount,
            myBidStatus: newBid.status,
            myBidId: newBid.id,
          };
        }
        return r;
      }));
    } catch (error) {
      console.error('Error placing bid:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to place bid';
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setPlacingBid(null);
    }
  };

  const handleCancelBidClick = (bidId: string, riderName: string) => {
    setCancelConfirmModal({ bidId, riderName });
  };

  const handleCancelBidConfirm = async () => {
    if (!user || !cancelConfirmModal) return;

    const { bidId } = cancelConfirmModal;
    setCancellingBid(bidId);
    setCancelConfirmModal(null);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/bids/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          bidId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel bid');
      }

      // Update state directly instead of reloading
      // Remove the cancelled bid from myBids and allBids
      setMyBids(prev => prev.filter(b => b.id !== bidId));
      setAllBids(prev => prev.filter(b => b.id !== bidId));

      // Update the rider's bid info - remove the bid
      setAvailableRiders(prev => prev.map(r => {
        if (r.myBidId === bidId) {
          // Check if there are other active bids for this rider
          const otherBids = allBids.filter(b =>
            b.id !== bidId &&
            (b.riderNameId === r.nameID || b.riderNameId === r.id) &&
            b.status === 'active'
          );

          const highestOtherBid = otherBids.length > 0
            ? otherBids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
            : null;

          return {
            ...r,
            myBid: undefined,
            myBidStatus: undefined,
            myBidId: undefined,
            highestBid: highestOtherBid?.amount || undefined,
            highestBidder: highestOtherBid?.userName || undefined,
          };
        }
        return r;
      }));
    } catch (error) {
      console.error('Error cancelling bid:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to cancel bid';
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setCancellingBid(null);
    }
  };

  const getTotalMyBids = (): number => {
    return myBids
      .filter(b => b.status === 'active' || b.status === 'won')
      .reduce((sum, bid) => sum + (Number(bid.amount) || 0), 0);
  };

  const getRemainingBudget = (excludeRiderNameId?: string): number => {
    // Use the game's budget (in case admin updated it) instead of participant's budget
    const budget = Number(game?.config?.budget) || 0;
    const spentBudget = Number(participant?.spentBudget) || 0;

    // After finalization, spentBudget already includes won bids
    // During auction, we need to account for active bids (spentBudget doesn't include them yet)
    const auctionClosed = game?.status === 'finished' || game?.config?.auctionStatus === 'closed' || game?.config?.auctionStatus === 'finalized';

    if (auctionClosed) {
      // After finalization, only use spentBudget (which already includes won riders)
      return budget - spentBudget;
    } else {
      // During auction, calculate total active bids
      const activeBidsTotal = myBids
        .filter(b => b.status === 'active')
        .filter(b => !excludeRiderNameId || b.riderNameId !== excludeRiderNameId)
        .reduce((sum, bid) => sum + (Number(bid.amount) || 0), 0);

      return budget - spentBudget - activeBidsTotal;
    }
  };

  const filteredRiders = availableRiders.filter(rider => {
    const matchesSearch = rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.team?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const riderPrice = rider.effectiveMinBid || rider.points;
    const matchesPrice = riderPrice >= priceRange[0] && riderPrice <= priceRange[1];

    return matchesSearch && matchesPrice;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-center text-gray-600">Loading auction...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button
            type="button"
            text="Back to Games"
            onClick={() => router.push('/games')}
          />
        </div>
      </div>
    );
  }

  if (!game) return null;

  // Check both game.status and game.config.auctionStatus for auction state
  const auctionActive = game.status === 'bidding' || game.config.auctionStatus === 'active';
  const auctionClosed = game.status === 'finished' || game.config.auctionStatus === 'closed' || game.config.auctionStatus === 'finalized';

  // Calculate min/max prices for the slider
  const allPrices = availableRiders.map(r => r.effectiveMinBid || r.points);
  const minRiderPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxRiderPrice = allPrices.length > 0 ? Math.max(...allPrices) : 10000;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="bg-white border-b border-gray-200 z-10 p-8">
        <div className="container mx-auto py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Auction - {game.name}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Status: <span className={`font-medium ${auctionActive ? 'text-green-600' :
                  auctionClosed ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                  {game.status === 'bidding' ? 'active' : (game.config.auctionStatus || game.status || 'pending')}
                </span>
              </p>
            </div>
            <Button
              type="button"
              text="← Back to Games"
              onClick={() => router.push('/games')}
            />
          </div>
        </div>
      </div>
      <div className={`sticky top-[100px] z-20 transition-shadow duration-200 ${isSticky ? 'drop-shadow-md' : ''}`}>
        {/* Stats Bar */}
        <div className="bg-white border-b border-gray-200 z-10 p-8">
          <div className="container mx-auto py-3">
            <div className="flex gap-6 items-center flex-wrap">
              <div>
                <span className="text-sm font-medium text-gray-700">Total Budget:</span>
                <span className="ml-2 text-lg font-bold text-gray-900">
                  {Number(game?.config?.budget || 0).toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Total Spent:' : 'Active Bids Total:'}
                </span>
                <span className="ml-2 text-lg font-bold text-blue-600">
                  {formatCurrencyWhole(getTotalMyBids())}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Remaining Budget:</span>
                <span className={`ml-2 text-lg font-bold ${getRemainingBudget() < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                  {formatCurrencyWhole(getRemainingBudget())}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Riders Won:' : 'My Active Bids:'}
                </span>
                <span className="ml-2 text-lg font-bold text-primary">
                  {auctionClosed
                    ? myBids.filter(b => b.status === 'won').length
                    : myBids.filter(b => b.status === 'active').length
                  }
                </span>
              </div>
              {game.config.maxRiders && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Max Riders:</span>
                  <span className="ml-2 text-lg font-bold text-gray-900">
                    {game.config.maxRiders}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search and Price Filter */}
        <div className="bg-white w-full p-8">
          <div className="container mx-auto">
            <div className="mb-4 bg-white py-4 flex flex-row gap-4">

              <span className="flex flex-col flex-1">
                <label htmlFor="search" className="text-sm font-bold text-gray-700">Search</label>
                <input
                  type="text"
                  placeholder="Search riders by name or team..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </span>
              <span className="flex flex-col flex-1 justify-center">
                <label htmlFor="price-range" className="text-sm font-bold text-gray-700">
                  Price Range: {formatCurrencyWhole(priceRange[0])} - {formatCurrencyWhole(priceRange[1])}
                </label>
                <div className="py-2 mt-2">
                  <RangeSlider
                    min={minRiderPrice}
                    max={maxRiderPrice}
                    value={priceRange}
                    onInput={(value: number[]) => setPriceRange([value[0], value[1]])}
                  />
                </div>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Content */}
      <div className="p-8">
        <div className="container mx-auto">
          {!auctionActive && (
            <div className={`mb-4 p-4 rounded-lg ${auctionClosed ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
              <p className={`text-sm font-medium ${auctionClosed ? 'text-red-800' : 'text-yellow-800'
                }`}>
                {auctionClosed
                  ? 'The auction has ended. No more bids can be placed.'
                  : 'The auction has not started yet. Bidding will open soon.'}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* My Team Section - Only show when auction is closed */}
          {auctionClosed && (
            <div ref={ref}>
              <div className="mt-4 bg-white p-4 rounded-md rounded-b-none border border-gray-200">
                <h1 className="text-2xl font-bold">My Team</h1>
              </div>

              <div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4">
                {myBids
                  .filter(bid => bid.status === 'won')
                  .map((myBidRider) => {
                    const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId);
                    return rider ? (
                      <div key={myBidRider.id}>
                        <PlayerCard
                          showBid={true}
                          className="border-2 rounded-md border-green-500 bg-green-50"
                          hideInfo={true}
                          bid={myBidRider.amount || 0}
                          player={rider}
                          onClick={() => { }}
                          selected={false}
                          buttonContainer={
                            <div className="w-full text-center py-2 text-green-700 font-semibold">
                              ✓ Won!
                            </div>
                          }
                        />
                      </div>
                    ) : null;
                  })}
              </div>
            </div>
          )}
          {/* My Bids Section - Only show when auction is active */}
          {!auctionClosed && (
            <div ref={myBidRef}>
              <div className="mt-4 bg-white p-4 rounded-md rounded-b-none border border-gray-200 flex flex-row gap-4">
                <h1 className="text-2xl font-bold mt-1">My Bids</h1>
                <span className="flex flex-row gap-2">
                  <Button ghost onClick={() => setMyTeamView('list')}><span className="flex flex-row gap-2 items-center"><List />Listview</span></Button>
                  <Button ghost onClick={() => setMyTeamView('card')}><span className="flex flex-row gap-2 items-center"><GridDots />Cardview</span></Button>
                </span>
              </div>


              {myTeamView === 'card' ? (<div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4">
                {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">No bids placed yet.</div>}
                {myBids.map((myBidRider) => {
                  const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId);
                  const isLost = myBidRider.status === 'lost' || myBidRider.status === 'outbid';

                  return rider ? (
                    <div key={myBidRider.id}>
                      <PlayerCard
                        showBid={true}
                        className={`border-2 rounded-md ${isLost ? 'border-red-300 bg-red-50 opacity-60' : 'border-gray-200'
                          }`}
                        hideInfo={true}
                        bid={rider?.myBid || myBidRider.amount || 0}
                        player={rider}
                        onClick={() => { }}
                        selected={false}
                        buttonContainer={
                          <>
                            {isLost && (
                              <div className="w-full text-center py-2 text-red-600 font-medium text-sm">
                                Lost
                              </div>
                            )}
                            {!isLost && rider && (
                              <Button
                                type="button"
                                text={cancellingBid === rider.myBidId ? "..." : "Reset bid"}
                                onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                disabled={cancellingBid === rider.myBidId}
                                className="px-2 py-1 text-sm w-full"
                                ghost
                                title="Cancel bid"
                                variant="danger"
                              />
                            )}
                          </>
                        }
                      />
                    </div>
                  ) : null;
                })}
              </div>) : (<div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 items-center justify-start flex-wrap gap-4 py-4">
                {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">No bids placed yet.</div>}
                {myBids.length > 0 && (
                  <div className="flex flex-row w-full p-2">
                    <span className="font-bold basis-[90px]">Price</span>
                    <span className="font-bold basis-[90px]">Bid</span>
                    <span className="font-bold flex-1">Name</span>
                    <span className="font-bold basis-[300px]">Team</span>
                    <span className="font-bold basis-[100px]"></span>
                  </div>
                )}
                <div className="divide-gray-300 divide-y">
                  {myBids.map((myBidRider) => {
                    const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId);

                    return rider ? (
                      <div key={myBidRider.id} className="bg-white px-2">
                        <div className="flex flex-row w-full py-1">
                          <span className="basis-[90px] flex items-center">{formatCurrencyWhole(rider.effectiveMinBid || rider.points)}</span>
                          <span className="basis-[90px] flex items-center">{formatCurrencyWhole(rider.myBid || 0)}</span>
                          <span className="flex-1 flex items-center">{rider.name}</span>
                          <span className="basis-[300px] flex items-center">{rider.team?.name || 'Unknown'}</span>
                          <span className="basis-[100px] flex items-center">
                            <Button
                              type="button"
                              text={cancellingBid === rider.myBidId ? "..." : "Reset bid"}
                              onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                              disabled={cancellingBid === rider.myBidId}
                              className="px-2 py-1 text-sm w-full"
                              ghost
                              size="sm"
                              title="Cancel bid"
                              variant="danger"
                            />
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
            <div className="grid grid-cols-12 gap-4 p-3 bg-white font-semibold text-sm border-b border-gray-200 sticky top-0">
              <div className="col-span-1">Riders</div>
            </div>


            <div className="overflow-y-auto">




              <div className={`w-full ${showPlayerCard ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 p-4' : 'flex flex-col items-start bg-white rounded-md divide-y divide-[#CAC4D0] justify-start flex-wrap my-4 pb-4'}`}>

                {/* it should sort when there is a myBid */}
                {filteredRiders.sort((a, b) => {
                  if (a.myBid && b.myBid) {
                    return b.myBid - a.myBid;
                  } else if (a.myBid) {
                    return -1;
                  } else if (b.myBid) {
                    return 1;
                  } else {
                    return a.rank - b.rank;
                  }
                }).filter((rider) => !myBids.some(bid => bid.riderName === rider.name)).map((rider, index) => {
                  const riderNameId = rider.nameID || rider.id || '';
                  const isOutbid = rider.myBidStatus === 'outbid';
                  const isWinning = rider.myBid && rider.myBid === rider.highestBid;

                  // Get all bidders for this rider (admin only)
                  const riderBidders = isAdmin
                    ? allBids
                      .filter((b: Bid) => (b.riderNameId === rider.nameID || b.riderNameId === rider.id) && b.status === 'active')
                      .sort((a: Bid, b: Bid) => b.amount - a.amount)
                      .sort((a: Bid, b: Bid) => new Date(a.bidAt).getTime() - new Date(b.bidAt).getTime()) // Sort by bidAt descending (newest first)
                      .map((b: Bid) => ({ playername: b.playername, amount: b.amount, bidAt: b.bidAt }))
                    : undefined;

                  return (
                    <React.Fragment key={rider.id || index}>

                      <div className="flex w-full">

                        {showPlayerCard ?

                          <PlayerCard showBid={true} bid={rider.highestBid} player={rider} onClick={() => { }} selected={false} bidders={riderBidders} buttonContainer={<>
                            <div className="flex flex-row gap-2">


                              <div className="flex-1">
                                {auctionActive ? (<>
                                  <CurrencyInput
                                    id="input-example"
                                    name="input-name"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder={`Min: ${rider.effectiveMinBid || rider.points}`}
                                    defaultValue={rider.effectiveMinBid || rider.points}
                                    prefix="€"
                                    decimalsLimit={0}
                                    disabled={placingBid === riderNameId}
                                    value={bidAmounts[riderNameId] || ''}
                                    onValueChange={(value, name, values) => {
                                      const newValue = value || '0';
                                      setBidAmounts(prev => ({
                                        ...prev,
                                        [riderNameId]: newValue
                                      }));
                                    }}
                                  />
                                </>
                                ) : (

                                  rider.myBid ? (
                                    <div>
                                      <div className={`font-bold text-sm ${isOutbid ? 'text-red-600' : 'text-green-600'}`}>
                                        {typeof rider.myBid === 'number' ? rider.myBid.toFixed(1) : '0.0'}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {isOutbid ? 'Outbid' : isWinning ? 'Winning' : rider.myBidStatus}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">No bid</span>
                                  )
                                )}
                              </div>
                              {auctionActive && (
                                <>
                                  {rider.myBid && rider.myBidId && (
                                    <Button
                                      type="button"
                                      text={cancellingBid === rider.myBidId ? "..." : "Reset bid"}
                                      onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                      disabled={cancellingBid === rider.myBidId}
                                      className="px-2 py-1 text-sm"
                                      title="Cancel bid"
                                      variant="danger"
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    text={placingBid === riderNameId ? "..." : "Bid"}
                                    onClick={() => handlePlaceBid(rider)}
                                    disabled={placingBid === riderNameId || !bidAmounts[riderNameId]}
                                    className="px-3 py-1 text-sm"
                                    variant="primary"
                                  />
                                </>
                              )}
                            </div>

                          </>} />
                          :
                          <PlayerRow player={rider} selectPlayer={() => { }} index={index} />}
                      </div>


                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>


          {!auctionClosed && (
            <MyTeamSelection
              myTeamSelection={availableRiders.filter(r => r.myBid)}
              setMyTeamSelection={() => { }}
              onCancelBid={handleCancelBidClick}
              hideButton={!auctionActive}
            />
          )}

          {auctionClosed && (
            <MyTeamSelection
              myTeamSelection={availableRiders.filter(rider => rider.myBid && myBids.some(bid => bid.id === rider.myBidId && bid.status === 'won'))}
              setMyTeamSelection={() => { }}
              onCancelBid={handleCancelBidClick}
              hideButton={!auctionActive}
            />
          )}



          {filteredRiders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No riders found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Cancel Bid Confirmation Modal */}
      {cancelConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Cancel Bid</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to cancel your bid on {cancelConfirmModal.riderName}?
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                text="No, Keep Bid"
                onClick={() => setCancelConfirmModal(null)}
                disabled={cancellingBid !== null}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 hover:text-white"
              />
              <Button
                text={cancellingBid === cancelConfirmModal.bidId ? "Cancelling..." : "Yes, Cancel Bid"}
                onClick={handleCancelBidConfirm}
                disabled={cancellingBid !== null}
                className="px-4 py-2"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
