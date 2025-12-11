'use client'

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Eye, EyeOff, GridDots, List, Star, Users } from "tabler-icons-react";
import './range-slider-custom.css';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PlayerRowBids } from "@/components/PlayerRowBids";

const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

// Helper functions for sessionStorage cache
const getCachedRankings = (year: number): Rider[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`rankings_${year}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Error reading from cache:', error);
  }
  return null;
};

const setCachedRankings = (year: number, riders: Rider[]): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`rankings_${year}`, JSON.stringify(riders));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
};

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
    // WorldTour Manager specific
    minNeoPros?: number;
    maxNeoProPoints?: number;
    maxNeoProAge?: number;
    auctionPeriods?: Array<{
      name: string;
      startDate: string;
      endDate: string;
      status: string;
      neoProfsRequired?: number;
      neoProfsMaxPoints?: number;
      neoProfsMaxBudget?: number;
    }>;
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
  age?: string;
  myBid?: number;
  myBidStatus?: string;
  myBidId?: string;
  effectiveMinBid?: number; // The actual minimum bid after applying maxMinimumBid cap
  soldTo?: string; // Player name who owns this rider (from previous auction rounds)
  isSold?: boolean; // Whether this rider is already sold
  pricePaid?: number; // Price paid for this rider in the auction
}

export default function AuctionPage({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading, impersonationStatus } = useAuth();
  const [gameId, setGameId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [availableRiders, setAvailableRiders] = useState<RiderWithBid[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const bidAmountsRef = useRef<Record<string, string>>({});
  const [placingBid, setPlacingBid] = useState<string | null>(null);
  const [cancellingBid, setCancellingBid] = useState<string | null>(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{ bidId: string; riderName: string } | null>(null);
  const [resetConfirmModal, setResetConfirmModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPlayerCard, setShowPlayerCard] = useState(true);
  const [myTeamView, setMyTeamView] = useState('card');
  const [myTeamBidsView, setMyTeamBidsView] = useState('list');
  const [isSticky, setIsSticky] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);
  const [hideSoldPlayers, setHideSoldPlayers] = useState(false);
  const [showOnlyFillers, setshowOnlyFillers] = useState(false);
  const [adjustingBid, setAdjustingBid] = useState<string | null>(null);

  useEffect(() => {
    const checkBannerCookie = () => {
      // Clear any localStorage value (legacy)
      if (typeof window !== 'undefined' && localStorage.getItem('hide-beta-banner') !== null) {
        localStorage.removeItem('hide-beta-banner');
      }

      const cookies = document.cookie.split('; ');
      const hideBannerCookie = cookies.find(cookie => cookie.startsWith('hide-beta-banner='));

      if (hideBannerCookie) {
        // Extract the value after 'hide-beta-banner='
        const value = hideBannerCookie.split('=')[1];
        setShowBanner(value !== 'true');
      } else {
        setShowBanner(true);
      }
    };

    // Check initially
    checkBannerCookie();

    // Poll for cookie changes (since cookies don't trigger events)
    const interval = setInterval(checkBannerCookie, 100);

    return () => clearInterval(interval);
  }, []);

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

      if (gameData.game.gameType !== 'auction' && gameData.game.gameType !== 'auctioneer' && gameData.game.gameType !== 'worldtour-manager') {
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

      // Load eligible riders - use cache if available
      const year = gameData.game.year || YEAR;
      const cached = getCachedRankings(year);
      let riders: Rider[] = [];

      // Use cache if available, otherwise fetch
      if (cached) {
        console.log('Using cached rankings data from sessionStorage');
        riders = cached;
      } else {
        console.log('Fetching fresh rankings data');
        // Fetch all riders in batches
        let offset = 0;
        const limit = 500;
        let hasMore = true;

        while (hasMore) {
          const ridersResponse = await fetch(`/api/getRankings?year=${year}&limit=${limit}&offset=${offset}`);
          if (!ridersResponse.ok) throw new Error('Failed to load riders');
          const ridersData = await ridersResponse.json();

          riders = riders.concat(ridersData.riders);

          // Check if there are more riders to fetch
          hasMore = ridersData.riders.length === limit;
          offset += limit;
        }

        // Store in sessionStorage (persists across page refreshes)
        setCachedRankings(year, riders);
      }

      // Filter by eligible riders if specified
      if (gameData.game.eligibleRiders && gameData.game.eligibleRiders.length > 0) {
        const eligibleSet = new Set(gameData.game.eligibleRiders);
        riders = riders.filter((r: Rider) => eligibleSet.has(r.nameID || r.id || ''));
      }

      // Load bids - for admins load all, for users load only their bids
      let allBidsData: Bid[] = [];
      let userBids: Bid[] = [];

      if (userIsAdmin) {
        // Admin: Load all bids with pagination
        let bidsOffset = 0;
        const bidsLimit = 1000;
        let hasMoreBids = true;

        while (hasMoreBids) {
          const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?limit=${bidsLimit}&offset=${bidsOffset}`);
          if (bidsResponse.ok) {
            const bidsData = await bidsResponse.json();
            const fetchedBids = bidsData.bids || [];
            allBidsData = allBidsData.concat(fetchedBids);

            // Check if there are more bids to fetch
            hasMoreBids = fetchedBids.length === bidsLimit;
            bidsOffset += bidsLimit;
          } else {
            hasMoreBids = false;
          }
        }
        userBids = allBidsData.filter((b: Bid) => b.userId === user.uid);
      } else {
        // Regular user: Load only their own bids with pagination
        let bidsOffset = 0;
        const bidsLimit = 1000;
        let hasMoreBids = true;

        while (hasMoreBids) {
          const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?userId=${user.uid}&limit=${bidsLimit}&offset=${bidsOffset}`);
          if (bidsResponse.ok) {
            const bidsData = await bidsResponse.json();
            const fetchedBids = bidsData.bids || [];
            userBids = userBids.concat(fetchedBids);

            // Check if there are more bids to fetch
            hasMoreBids = fetchedBids.length === bidsLimit;
            bidsOffset += bidsLimit;
          } else {
            hasMoreBids = false;
          }
        }
        allBidsData = userBids; // For non-admins, allBids is just their bids
      }

      setAllBids(allBidsData);
      setMyBids(userBids);

      // Load all sold riders from playerTeams collection (properly filtered by gameId)
      const playerTeamsResponse = await fetch(`/api/games/${gameId}/team/list-all`);
      const playerTeamsData = await playerTeamsResponse.json();

      // Build a map of sold riders: riderNameId -> { ownerName, pricePaid }
      const soldRidersMap = new Map<string, { ownerName: string; pricePaid: number }>();
      if (playerTeamsData.success && playerTeamsData.teams) {
        playerTeamsData.teams.forEach((teamRider: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (teamRider.riderNameId && teamRider.active) {
            const ownerName = teamRider.playername || teamRider.userName || 'Unknown Player';
            const pricePaid = teamRider.pricePaid || 0;
            soldRidersMap.set(teamRider.riderNameId, { ownerName, pricePaid });
          }
        });
      }

      // Enhance riders with bid information and sold status
      const maxMinBid = gameData?.game?.config?.maxMinimumBid;
      const ridersWithBids = riders.map((rider: Rider) => {
        const riderNameId = rider.nameID || rider.id || '';
        const myBid = userBids.find((b: Bid) =>
          (b.riderNameId === rider.nameID || b.riderNameId === rider.id)
        );

        // Check if rider is already sold
        const soldData = soldRidersMap.get(riderNameId);
        const isSold = !!soldData;
        const soldTo = soldData?.ownerName;
        const pricePaid = soldData?.pricePaid;

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
          soldTo,
          isSold,
          pricePaid,
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

  // Helper to calculate rider's age
  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  // Helper to check if a rider is a neo-professional
  const isNeoProf = (rider: RiderWithBid): boolean => {

    if (!game?.config?.maxNeoProAge) return false;
    if (!rider.age) return false;

    const age = calculateAge(rider.age);
    return age <= game.config.maxNeoProAge;
  };

  // Helper to check if a rider qualifies as a neo-prof based on points
  const qualifiesAsNeoProf = (rider: RiderWithBid): boolean => {
    if (!isNeoProf(rider)) return false;

    const maxPoints = game?.config?.maxNeoProPoints;
    if (maxPoints === undefined) return true; // No points limit

    return rider.points <= maxPoints;
  };

  // Determine if the current auction period is restricted to top 200 riders
  const isTop200Restricted = (() => {
    if (!game || (game.gameType !== 'auctioneer')) return false;

    const config: any = game.config; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!config || !Array.isArray(config.auctionPeriods)) return false;

    const toDate = (value: any): Date | null => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value === 'string') return new Date(value);
      if (typeof value.toDate === 'function') return value.toDate();
      return null;
    };

    const now = new Date();

    // Try to find an active period based on time window and status
    let activePeriod = config.auctionPeriods.find((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const start = toDate(p.startDate);
      const end = toDate(p.endDate);
      if (!start || !end) return false;

      const inWindow = now >= start && now <= end;
      // Use game.status as authoritative check, period status as additional filter
      const statusActive = p.status === 'active' && game.status === 'bidding';
      return inWindow && statusActive;
    });

    // Fallback: if nothing matches, use the first period as the "current" one
    if (!activePeriod && config.auctionPeriods.length > 0) {
      activePeriod = config.auctionPeriods[0];
    }

    return !!activePeriod?.top200Only;
  })();

  const handlePlaceBid = async (rider: RiderWithBid) => {
    if (!user || !participant) return;

    const riderNameId = rider.nameID || rider.id || '';
    const isWorldTourManager = game?.gameType === 'worldtour-manager';

    // For worldtour-manager, use the rider's effective minimum bid as the price
    // For auction games, use the entered bid amount
    const bidAmount = isWorldTourManager
      ? getEffectiveMinimumBid(rider.points)
      : parseFloat(bidAmountsRef.current[riderNameId] || '0');

    const effectiveMinBid = getEffectiveMinimumBid(rider.points);

    // Prevent bidding on sold riders
    if (rider.isSold) {
      setError(`This rider is already sold to ${rider.soldTo}`);
      return;
    }

    // When top-200 restriction is active, block bids on riders outside top 200
    if (isTop200Restricted) {
      const riderRank = (rider as any).rank; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (typeof riderRank !== 'number' || riderRank > 200) {
        setError('Tijdens deze biedronde kun je alleen bieden op renners uit de top 200.');
        return;
      }
    }

    // Skip bid validation for worldtour-manager (it's a direct selection)
    if (!isWorldTourManager) {
      if (Number(bidAmount) < effectiveMinBid) {
        setError(`Bid must be at least ${effectiveMinBid}`);
        return;
      }

      if (!bidAmount || bidAmount <= 0) {
        setError('Please enter a valid bid amount');
        return;
      }
    }

    // Check maxRiders limit before placing a new bid (not when updating existing)
    const maxRiders = game?.config?.maxRiders;
    const activeBidsCount = myBids.filter(b => b.status === 'active' || b.status === 'outbid').length;
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

    // WorldTour Manager: Check neo-prof requirements
    // Rule: If you want 28+ riders, you need at least 1 neo-prof in your team
    if (game && game.gameType === 'worldtour-manager') {
      const totalActiveBids = myBids.filter(b => b.status === 'active' || b.status === 'outbid').length;
      const minRiders = game.config.minRiders || 27;
      const isThisRiderNeoProf = qualifiesAsNeoProf(rider);

      // Count current neo-profs in the team
      const currentNeoProfBids = myBids.filter(b => {
        if (b.status !== 'active' && b.status !== 'outbid') return false;
        const bidRider = availableRiders.find(r => (r.nameID || r.id) === b.riderNameId);
        return bidRider && qualifiesAsNeoProf(bidRider);
      });
      const currentNeoProfCount = currentNeoProfBids.length;

      // If we're trying to get to 28+ riders and this is NOT a neo-prof,
      // check if we already have at least one neo-prof
      if (totalActiveBids >= minRiders && !isThisRiderNeoProf && currentNeoProfCount === 0) {
        const maxAge = game.config.maxNeoProAge || 21;
        const maxPoints = game.config.maxNeoProPoints || 250;
        setError(`Om meer dan ${minRiders} renners te hebben, moet je minimaal 1 neoprof in je team hebben (max ${maxAge} jaar oud met max ${maxPoints} punten).`);
        return;
      }

      // If this IS a neo-prof, check if they qualify based on points
      if (isThisRiderNeoProf && game.config.maxNeoProPoints && rider.points > game.config.maxNeoProPoints) {
        setError(`Deze renner heeft te veel punten (${rider.points}) om als neoprof te kwalificeren. Max toegestaan: ${game.config.maxNeoProPoints} punten.`);
        return;
      }
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
      bidAmountsRef.current[riderNameId] = '';

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
      setInfoDialog({
        title: 'Error placing bid',
        description: errorMsg,
      });
    } finally {
      setPlacingBid(null);
    }
  };

  const handleCancelBidClick = (bidId: string, riderName: string) => {
    setCancelConfirmModal({ bidId, riderName });
  };

  const handleResetBidsClick = () => {
    setResetConfirmModal(true);
  };

  const handleResetBidsConfirm = async () => {
    if (!user) return;

    setResetConfirmModal(false);
    setError(null);

    try {
      // Cancel all active bids only (users shouldn't know they're outbid)
      const cancelPromises = myBids
        .filter(bid => bid.status === 'active')
        .map(bid =>
          fetch(`/api/games/${gameId}/bids/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              bidId: bid.id,
            }),
          })
        );

      await Promise.all(cancelPromises);

      // Clear all state
      bidAmountsRef.current = {};
      setMyBids([]);

      // Update available riders to remove bid info
      setAvailableRiders(prev => prev.map(r => ({
        ...r,
        myBid: undefined,
        myBidStatus: undefined,
        myBidId: undefined,
      })));

      // Reload bids to get fresh data
      const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?limit=1000&offset=0`);
      if (bidsResponse.ok) {
        const bidsData = await bidsResponse.json();
        setAllBids(bidsData.bids || []);
      }

    } catch (error) {
      console.error('Error resetting bids:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to reset bids';
      setError(errorMsg);
      setInfoDialog({
        title: 'Error resetting bids',
        description: errorMsg,
      });
    }
  };

  const handleAdjustBid = (bidId: string) => {
    setAdjustingBid(bidId);
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
      setInfoDialog({
        title: 'Error cancelling bid',
        description: errorMsg,
      });
    } finally {
      setCancellingBid(null);
    }
  };

  const getTotalMyBids = (): number => {
    return myBids
      .filter(b => b.status === 'active' || b.status === 'outbid' || b.status === 'won')
      .reduce((sum, bid) => sum + (Number(bid.amount) || 0), 0);
  };

  const getRemainingBudget = (excludeRiderNameId?: string): number => {
    // Use the game's budget (in case admin updated it) instead of participant's budget
    const budget = Number(game?.config?.budget) || 0;
    const spentBudget = Number(participant?.spentBudget) || 0;

    // After finalization, spentBudget already includes won bids
    // During auction, we need to account for active bids (spentBudget doesn't include them yet)
    const auctionClosed = game?.status === 'finished';

    if (auctionClosed) {
      // After finalization, only use spentBudget (which already includes won riders)
      return budget - spentBudget;
    } else {
      // During auction, calculate total active bids (including outbid for legacy data)
      const activeBidsTotal = myBids
        .filter(b => b.status === 'active' || b.status === 'outbid')
        .filter(b => !excludeRiderNameId || b.riderNameId !== excludeRiderNameId)
        .reduce((sum, bid) => sum + (Number(bid.amount) || 0), 0);

      return budget - spentBudget - activeBidsTotal;
    }
  };

  const filteredRiders = useMemo(() => {
    return availableRiders.filter(rider => {
      const matchesSearch = rider.name.toLowerCase().includes(searchTerm.toLowerCase()) || rider.nameID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rider.team?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const riderPrice = rider.effectiveMinBid || rider.points;
      const matchesPrice = riderPrice >= priceRange[0] && riderPrice <= priceRange[1];

      // Apply top-200 restriction at list level: only show riders in top 200 when enabled
      const riderRank = (rider as any).rank; // eslint-disable-line @typescript-eslint/no-explicit-any
      const withinTop200 = !isTop200Restricted || (typeof riderRank === 'number' && riderRank <= 200);

      return matchesSearch && matchesPrice && withinTop200;
    });
  }, [availableRiders, searchTerm, priceRange, isTop200Restricted]);

  const sortedAndFilteredRiders = useMemo(() => {
    return [...filteredRiders]
      .sort((a, b) => {
        if (a.myBid && b.myBid) {
          return b.myBid - a.myBid;
        } else if (a.myBid) {
          return -1;
        } else if (b.myBid) {
          return 1;
        } else {
          return a.rank - b.rank;
        }
      })
      .filter((rider) => {
        // Filter out riders that have active bids - they should only appear in "My Bids" section
        // Check both nameID and id to ensure we catch all matches
        return !myBids.some(bid =>
          bid.riderNameId === rider.nameID ||
          bid.riderNameId === rider.id
        );
      })
      .filter((rider) => !hideSoldPlayers || !rider.isSold)
      .filter((rider) => !showOnlyFillers || qualifiesAsNeoProf(rider));
  }, [filteredRiders, myBids, hideSoldPlayers, showOnlyFillers]);

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

  // Use game.status as the single source of truth for auction state
  // config.auctionStatus is kept in sync but game.status is authoritative
  const auctionActive = game.status === 'bidding';
  const auctionClosed = game.status === 'finished';

  // Calculate min/max prices for the slider
  const allPrices = availableRiders.map(r => r.effectiveMinBid || r.points);
  const minRiderPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxRiderPrice = allPrices.length > 0 ? Math.max(...allPrices) : 10000;

  return (
    <div className={`min-h-screen bg-gray-50 relative ${showBanner ? 'mt-[36px]' : 'mt-0'} `}>
      <div className="bg-white border-b border-gray-200 z-10 px-8">
        <div className="container mx-auto py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">
                {game.gameType === 'worldtour-manager' ? 'Team Selection' : 'Auction'} - {game.name}
              </h1>
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

      <div
        className={`sticky z-20 transition-all duration-200 ${isSticky ? 'drop-shadow-md' : ''}`}
        style={{
          top: `${(showBanner ? 36 : 0) +
            (impersonationStatus.isImpersonating ? 48 : 0) +
            86
            }px`
        }}
      >
        {/* Stats Bar */}
        <div className="bg-white border-b border-gray-200 z-10 px-8">
          <div className="container mx-auto py-3">
            <div className="flex gap-6 items-center flex-wrap">
              <div>
                <span className="text-sm font-medium text-gray-700">Total Budget:</span>
                <span className="ml-2 text-lg font-bold text-gray-900">
                  {formatCurrencyWhole(game?.config?.budget || 0)}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {auctionClosed ? 'Total Spent:' : game.gameType === 'worldtour-manager' ? 'Selected Riders Total:' : 'Active Bids Total:'}
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
                  {auctionClosed ? 'Riders Won:' : game.gameType === 'worldtour-manager' ? 'Selected Riders:' : 'My Active Bids:'}
                </span>
                <span className="ml-2 text-lg font-bold text-primary">
                  {auctionClosed
                    ? myBids.filter(b => b.status === 'won').length
                    : myBids.length
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
        <div className="bg-white w-full px-8">
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
              <span className="flex flex-col flex-1 justify-center">
                <label htmlFor="price-range" className="text-sm font-bold text-gray-700">
                  Reset all bids
                </label>
                <Button text="Reset all bids" disabled={!myBids.some(bid => bid.status === 'active' || bid.status === 'outbid')} onClick={handleResetBidsClick} />
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
                  ? game.gameType === 'worldtour-manager'
                    ? 'Team selection has ended. No more riders can be selected.'
                    : 'The auction has ended. No more bids can be placed.'
                  : game.gameType === 'worldtour-manager'
                    ? 'Team selection has not started yet. Selection will open soon.'
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
                    const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
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
                          isNeoProf={qualifiesAsNeoProf(rider)}
                          showNeoProfBadge={game?.gameType === 'worldtour-manager'}
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
                <h1 className="text-2xl font-bold mt-1">
                  {game?.gameType === 'worldtour-manager' ? 'My Selected Riders' : 'My Bids'}
                </h1>
                <span className="flex flex-row gap-2">
                  <Button ghost={myTeamBidsView === 'card'} onClick={() => setMyTeamBidsView('list')}><span className={`flex flex-row gap-2 items-center`}><List />Listview</span></Button>
                  <Button ghost={myTeamBidsView === 'list'} onClick={() => setMyTeamBidsView('card')}><span className={`flex flex-row gap-2 items-center`}><GridDots />Cardview</span></Button>
                </span>
              </div>


              {myTeamBidsView === 'card' ? (<div className="bg-gray-100 border border-gray-200 p-4 rounded-t-none -mt-[1px] rounded-md mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 py-4">
                {myBids.length === 0 && <div className="col-span-full text-center text-gray-500">
                  {game?.gameType === 'worldtour-manager' ? 'No riders selected yet.' : 'No bids placed yet.'}
                </div>}
                {myBids.map((myBidRider) => {
                  const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
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
                        isNeoProf={qualifiesAsNeoProf(rider)}
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
                                      placeholder={`Current: ${rider.myBid || 0}`}
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
                                        text={placingBid === riderNameId ? "..." : "Save"}
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
                                        text="Cancel"
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
                                        text="Adjust bid"
                                        onClick={() => setAdjustingBid(rider.myBidId!)}
                                        className="px-2 py-1 text-sm w-full"
                                        ghost
                                        variant="primary"
                                      />
                                    )}
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
                    <span className="font-bold basis-[90px]">Price</span>
                    <span className="font-bold basis-[90px]">Bid</span>
                    <span className="font-bold flex-1">Name</span>
                    <span className="font-bold basis-[300px]">Team</span>
                    <span className="font-bold basis-[200px]"></span>
                  </div>
                )}
                <div className="divide-gray-300 divide-y">
                  {myBids.map((myBidRider) => {
                    const rider = availableRiders.find((rider: any) => rider.id === myBidRider.riderNameId); // eslint-disable-line @typescript-eslint/no-explicit-any
                    const canCancel = myBidRider.status === 'active' || myBidRider.status === 'outbid';
                    const riderNameId = rider?.nameID || rider?.id || '';

                    console.log(myBidRider);

                    return rider ? (
                      <div key={myBidRider.id} className="bg-white px-2">
                        <div className="flex flex-row w-full py-1">
                          <span className="basis-[90px] flex items-center">{formatCurrencyWhole(rider.effectiveMinBid || rider.points)}</span>
                          <span className="basis-[90px] flex items-center">{formatCurrencyWhole(rider.myBid || 0)}</span>
                          <span className="flex-1 flex items-center">{rider.name}</span>
                          <span className="basis-[300px] flex items-center">{rider.team?.name || 'Unknown'}</span>
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
                                      prefix="€"
                                      decimalsLimit={0}
                                      disabled={placingBid === riderNameId}
                                      defaultValue={bidAmountsRef.current[riderNameId] || ''}
                                      onValueChange={(value) => {
                                        bidAmountsRef.current[riderNameId] = value || '0';
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      text={placingBid === riderNameId ? "..." : "Save"}
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
                                      text="Cancel"
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
                                        text="Adjust"
                                        onClick={() => setAdjustingBid(rider.myBidId!)}
                                        className="px-2 py-1 text-sm"
                                        size="sm"
                                        ghost
                                        variant="primary"
                                      />
                                    )}
                                    <Button
                                      type="button"
                                      text={cancellingBid === rider.myBidId ? "..." : "Reset"}
                                      onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                      disabled={cancellingBid === rider.myBidId}
                                      className="px-2 py-1 text-sm"
                                      ghost
                                      size="sm"
                                      title="Cancel bid"
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
              <div className="col-span-1">Riders</div>
              <span className="flex flex-row gap-2">
                <span className="flex flex-row gap-2">
                  <Button ghost={myTeamView === 'list'} onClick={() => setMyTeamView('card')}><span className={`flex flex-row gap-2 items-center`}><GridDots />Cardview</span></Button>
                  <Button ghost={myTeamView === 'card'} onClick={() => setMyTeamView('list')}><span className={`flex flex-row gap-2 items-center`}><List />Listview</span></Button>
                </span>


                {game.gameType === 'worldtour-manager' ? (
                  <Button onClick={() => setshowOnlyFillers(!showOnlyFillers)}>
                    <span className={`flex flex-row gap-2 items-center`}>
                      {showOnlyFillers ? <><Users />Show all riders</> : <><Star />Show only fillers</>}
                    </span>
                  </Button>
                ) : <Button onClick={() => setHideSoldPlayers(!hideSoldPlayers)}>
                  <span className={`flex flex-row gap-2 items-center`}>
                    {hideSoldPlayers ? <><Eye />Show sold players</> : <><EyeOff />Hide sold players</>}
                  </span>
                </Button>}
              </span>

            </div>


            <div className="overflow-y-auto">




              <div className={`w-full ${myTeamView === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-center justify-start flex-wrap gap-4 p-4' : 'flex flex-col items-start bg-white rounded-md divide-y divide-[#CAC4D0] justify-start flex-wrap my-4 pb-4'}`}>

                {/* it should sort when there is a myBid */}
                {sortedAndFilteredRiders.map((rider, index) => {
                  const riderNameId = rider.nameID || rider.id || '';

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

                      <div className={`flex w-full ${myTeamView === 'list' && 'flex-col'}`}>

                        {myTeamView === 'card' ?

                          <PlayerCard
                            showBid={true}
                            bid={rider.highestBid}
                            player={rider}
                            onClick={() => { }}
                            selected={false}
                            bidders={riderBidders}
                            isNeoProf={qualifiesAsNeoProf(rider)}
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
                                        prefix="€"
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
                                      <span className="text-xs text-gray-400">No bid</span>
                                    )
                                  )}
                                </div>
                                {auctionActive && !rider.isSold && (
                                  <>
                                    {rider.myBid && rider.myBidId && (rider.myBidStatus === 'active' || rider.myBidStatus === 'outbid') && (
                                      <Button
                                        type="button"
                                        text={cancellingBid === rider.myBidId ? "..." : game?.gameType === 'worldtour-manager' ? "Remove" : "Reset bid"}
                                        onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                        disabled={cancellingBid === rider.myBidId}
                                        className="px-2 py-1 text-sm"
                                        title={game?.gameType === 'worldtour-manager' ? "Remove rider" : "Cancel bid"}
                                        variant="danger"
                                      />
                                    )}
                                    <Button
                                      type="button"
                                      text={placingBid === riderNameId ? "..." : game?.gameType === 'worldtour-manager' ? "Select" : "Bid"}
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
                                      prefix="€"
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
                                        {rider.myBidStatus === 'won' ? 'Won' : rider.myBidStatus === 'lost' ? 'Lost' : rider.myBidStatus}
                                      </div>
                                    </div>
                                  ) : (
                                    rider.isSold && rider?.pricePaid ? (
                                      <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">Sold for {formatCurrency(rider?.pricePaid)}</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">No bid</span>
                                    )
                                  )
                                )}
                              </div>
                              {auctionActive && !rider.isSold && (
                                <>
                                  {rider.myBid && rider.myBidId && (rider.myBidStatus === 'active' || rider.myBidStatus === 'outbid') && (
                                    <Button
                                      type="button"
                                      text={cancellingBid === rider.myBidId ? "..." : game?.gameType === 'worldtour-manager' ? "Remove" : "Reset bid"}
                                      onClick={() => handleCancelBidClick(rider.myBidId!, rider.name)}
                                      disabled={cancellingBid === rider.myBidId}
                                      className="px-2 py-1 text-sm"
                                      title={game?.gameType === 'worldtour-manager' ? "Remove rider" : "Cancel bid"}
                                      variant="danger"
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    text={placingBid === riderNameId ? "..." : game?.gameType === 'worldtour-manager' ? "Select" : "Bid"}
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


          {!auctionClosed && (
            <MyTeamSelection
              myTeamSelection={availableRiders.filter(r => r.myBid)}
              setMyTeamSelection={() => { }}
              onCancelBid={handleCancelBidClick}
              onAdjustBid={handleAdjustBid}
              hideButton={!auctionActive}
              adjustingBid={adjustingBid}
              isWorldTourManager={game?.gameType === 'worldtour-manager'}
            />
          )}

          {auctionClosed && (
            <MyTeamSelection
              myTeamSelection={availableRiders.filter(rider => rider.myBid && myBids.some(bid => bid.id === rider.myBidId && bid.status === 'won'))}
              setMyTeamSelection={() => { }}
              onCancelBid={handleCancelBidClick}
              onAdjustBid={handleAdjustBid}
              hideButton={!auctionActive}
              adjustingBid={adjustingBid}
              isWorldTourManager={game?.gameType === 'worldtour-manager'}
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
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
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

      {/* Reset All Bids Confirmation Modal */}
      {resetConfirmModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Reset All Bids</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to reset all your bid amounts? This will clear all the amounts you&apos;ve entered in the input fields.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                text="No, Keep Them"
                onClick={() => setResetConfirmModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 hover:text-white"
              />
              <Button
                text="Yes, Reset All"
                onClick={handleResetBidsConfirm}
                className="px-4 py-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Info Dialog for messages previously shown with alert() */}
      {infoDialog && (
        <ConfirmDialog
          open={true}
          onClose={() => setInfoDialog(null)}
          onConfirm={() => setInfoDialog(null)}
          title={infoDialog.title}
          description={infoDialog.description}
          confirmText="OK"
          cancelText="Close"
        />
      )}
    </div>
  );
}
