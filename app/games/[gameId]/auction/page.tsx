'use client'

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";
import { Rider } from "@/lib/types/rider";
import { MyTeamSelection } from "@/components/MyTeamSelection";
import { useRankings } from "@/contexts/RankingsContext";
import { useInView } from "react-intersection-observer";
import 'react-range-slider-input/dist/style.css';
import './range-slider-custom.css';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTranslation } from "react-i18next";
import { MyAuctionTeam } from "@/components/MyAuctionTeam";
import { Bid } from "@/lib/types";
import { MyAuctionBids } from "@/components/MyAuctionBids";
import { MyAuctionBidsBig } from "@/components/MyAuctionBidsBig";
import { Bidding } from "@/components/Bidding";
import { AuctionStats } from "@/components/AuctionStats";
import { AuctionFilters } from "@/components/AuctionFilters";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { Tabs } from "@/components/Tabs";
import { getCachedAuctionData, setCachedAuctionData, invalidateAuctionCache } from "@/lib/utils/auctionCache";
import { AddRiderTab } from "@/components/AddRiderTab";
import { useCacheInvalidation } from "@/hooks/useCacheInvalidation";

// Custom hook to monitor cookie changes
function useCookieValue(cookieName: string) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = () => {
      const cookies = document.cookie.split('; ');
      const cookie = cookies.find(c => c.startsWith(`${cookieName}=`));
      return cookie ? cookie.split('=')[1] : null;
    };

    // Set initial value
    setValue(getCookie());

    // Check for cookie changes periodically
    const interval = setInterval(() => {
      const newValue = getCookie();
      if (newValue !== value) {
        setValue(newValue);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [cookieName]);

  return value;
}

import { AuctionGameData as GameData, AuctionParticipantData as ParticipantData, RiderWithBid } from '@/lib/types/pages';

export default function AuctionPage({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const { user, loading: authLoading, impersonationStatus } = useAuth();
  const { riders: rankingsRiders, loading: rankingsLoading } = useRankings();
  const [gameId, setGameId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [availableRiders, setAvailableRiders] = useState<RiderWithBid[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 45]);
  const bidAmountsRef = useRef<Record<string, string>>({});
  const [placingBid, setPlacingBid] = useState<string | null>(null);
  const [cancellingBid, setCancellingBid] = useState<string | null>(null);
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{ bidId: string; riderName: string } | null>(null);
  const [resetConfirmModal, setResetConfirmModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);
  const [hideSoldPlayers, setHideSoldPlayers] = useState(false);
  const [showOnlyFillers, setshowOnlyFillers] = useState(false);
  const [adjustingBid, setAdjustingBid] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);

  const { t } = useTranslation();


  // useEffect(() => { // TEMPORARY
  //       const checkAdminStatus = async () => {
  //           if (!loading && !user) {
  //               router.push('/login');
  //               return;
  //           }

  //           if (user) {
  //               // Check if user is admin
  //               try {
  //                   const response = await fetch(`/api/getUser?userId=${user.uid}`);
  //                   if (response.ok) {
  //                       const userData = await response.json();
  //                       if (userData.userType === 'admin' || impersonationStatus?.isImpersonating) {
                            
                         
  //                       } else {
  //                           router.push('/maintenance');
  //                       }
  //                   }
  //               } catch (error) {
  //                   console.error('Error checking admin status:', error);
  //                   router.push('/maintenance');
  //               } 
  //           }
  //       };

  //       checkAdminStatus();
  //   }, [user, loading, router]);

  // Player selector state
  const [divisionParticipants, setDivisionParticipants] = useState<ParticipantData[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerBids, setSelectedPlayerBids] = useState<Bid[]>([]);
  const [activeAuctionPeriodTab, setActiveAuctionPeriodTab] = useState(0);

  const [alleBiedingen, setAlleBiedingen] = useState<Bid[]>([]); // Naam aanpassen TODO:

  // Get banner visibility from cookie with change detection
  const hideBannerCookie = useCookieValue('hide-beta-banner');
  const hideBanner = hideBannerCookie === 'true';

  // Monitor cache invalidation from server-side changes
  useCacheInvalidation(gameId);

  useEffect(() => {
    params.then(p => {
      setGameId(p.gameId);
      // Invalidate cache on initial page load to ensure fresh data
      // This prevents showing stale bids after a page refresh
      if (p.gameId) {
        console.log('[AUCTION] Invalidating cache on page load for gameId:', p.gameId);
        invalidateAuctionCache(p.gameId);
      }
    });
  }, [params]);


  useEffect(() => {
    const loadAllBids = async () => {
      if (!gameId) return;

      try {
        const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?limit=1000&offset=0&notActive=true`);
        if (!bidsResponse.ok) {
          throw new Error('Failed to load bids');
        }
        const bidsData = await bidsResponse.json();
        setAlleBiedingen(bidsData.bids || []);
      } catch (error) {
        console.error('Error loading bids:', error);
        setError('Failed to load bids. Please try again later.');
      }
    };

    loadAllBids();
  }, [gameId])


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

      // Wait for rankings to load if they're still loading
      if (rankingsLoading) {
        console.log('[AUCTION] Waiting for RankingsContext to finish loading...');
        // Don't return early - this causes the loading state to get stuck
        // The useEffect will re-trigger when rankingsLoading becomes false
        setLoading(false);
        return;
      }

      // Try to load from cache first (unless forced to refresh)
      // NOTE: Cache is invalidated on page load, so this will only be used during the session
      const cachedData = !forceRefresh ? await getCachedAuctionData(gameId) : null;
      if (cachedData && rankingsRiders.length > 0) {

        // Set state from cache
        setGame(cachedData.gameData);
        const firstParticipant = cachedData.participantData.participants?.[0];
        setParticipant(firstParticipant?.id ? firstParticipant as ParticipantData : null);

        const userBids = cachedData.allBidsData.filter((b: Bid) => b.userId === user.uid);
        const filteredUserBids = userBids.filter((b: Bid) => b.status === 'won' || b.status === 'active' || b.status === 'outbid' || b.status === 'lost');
        setAllBids(cachedData.allBidsData);
        setMyBids(filteredUserBids);

        // Use riders from RankingsContext instead of cache
        let riders = rankingsRiders;
        if (cachedData.gameData.eligibleRiders && cachedData.gameData.eligibleRiders.length > 0) {
          const eligibleSet = new Set(cachedData.gameData.eligibleRiders);
          riders = riders.filter((r: Rider) => eligibleSet.has(r.nameID || r.id || ''));
        }

        // Build soldRidersMap from cached playerTeams
        const soldRidersMap = new Map<string, { ownerName: string; pricePaid: number }>();
        if (cachedData.playerTeamsData.success && cachedData.playerTeamsData.teams) {
          cachedData.playerTeamsData.teams.forEach((teamRider: any) => {
            if (teamRider.riderNameId && teamRider.active) {
              const ownerName = teamRider.playername || teamRider.userName || 'Unknown Player';
              const pricePaid = teamRider.pricePaid || 0;
              soldRidersMap.set(teamRider.riderNameId, { ownerName, pricePaid });
            }
          });
        }

        // Enhance riders with bid information
        const maxMinBid = cachedData.gameData?.config?.maxMinimumBid;
        const ridersWithBids = riders.map((rider: Rider) => {
          const riderNameId = rider.nameID || rider.id || '';
          const myBid = userBids.find((b: Bid) =>
            (b.riderNameId === rider.nameID || b.riderNameId === rider.id)
          );

          const soldData = soldRidersMap.get(riderNameId);
          // Only mark riders as sold for bidding game types, not for selection games
          const isBiddingGame = cachedData.gameData.gameType === 'auctioneer';
          const isSold = isBiddingGame && !!soldData;
          const soldTo = soldData?.ownerName;
          const pricePaid = soldData?.pricePaid;

          const riderPoints = rider.points || 1;
          const effectiveMinBid = maxMinBid && riderPoints > maxMinBid ? maxMinBid : riderPoints;

          let highestBid = 0;
          let highestBidder = '';

          if (myBid && (myBid.status === 'active' || myBid.status === 'outbid' || myBid.status === 'won')) {
            highestBid = myBid.amount;
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

        // Check admin status
        try {
          const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setIsAdmin(userData.userType === 'admin');
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }

        setLoading(false);
        setError(null);

        // Return early - don't fetch fresh data
        return;
      }

      console.log('[AUCTION] No cache found - loading fresh data from API');

      // Check if rankings are available
      if (rankingsRiders.length === 0) {
        console.error('[AUCTION] Rankings not available - this should not happen with autoLoad=true');
        throw new Error('Rankings data not available');
      }

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

      if (gameData.game.gameType !== 'auction' && gameData.game.gameType !== 'marginal-gains' && gameData.game.gameType !== 'auctioneer' && gameData.game.gameType !== 'worldtour-manager') {
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
          userId: user.uid,
          budget: gameData.game.config?.budget || 0,
          spentBudget: 0,
          rosterSize: 0,
          rosterComplete: false,
        });
      } else {
        setParticipant(participantData.participants[0]);
      }

      // Load eligible riders from RankingsContext
      let riders: Rider[] = rankingsRiders;

      // Filter by eligible riders if specified
      if (gameData.game.eligibleRiders && gameData.game.eligibleRiders.length > 0) {
        const eligibleSet = new Set(gameData.game.eligibleRiders);
        riders = riders.filter((r: Rider) => eligibleSet.has(r.nameID || r.id || ''));
      }

      // Load bids - for admins load all, for users load only their bids
      let allBidsData: Bid[] = [];
      let userBids: Bid[] = [];

      // API doesn't support offset-based pagination, so we just load with a high limit
      const bidsLimit = 10000;
      const bidsResponse = await fetch(`/api/games/${gameId}/bids/list?limit=${bidsLimit}`);
      if (bidsResponse.ok) {
        const bidsData = await bidsResponse.json();
        allBidsData = bidsData.bids || [];
      }

      userBids = allBidsData.filter((b: Bid) => b.userId === user.uid);
      allBidsData = userBids.filter((b: Bid) => b.status !== 'active'); // For non-admins, allBids is just their bids

      const filteredUserBidsFromAPI = userBids.filter((b: Bid) => b.status === 'won' || b.status === 'active' || b.status === 'outbid' || b.status === 'lost');

      console.log('[AUCTION] User bids from API - total:', userBids.length, 'filtered:', filteredUserBidsFromAPI.length);
      console.log('[AUCTION] Bid statuses from API:', userBids.map(b => ({ id: b.id, status: b.status, riderNameId: b.riderNameId })));

      setAllBids(allBidsData);
      setMyBids(filteredUserBidsFromAPI);

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
        // Only mark riders as sold for bidding game types, not for selection games
        const isBiddingGame = gameData?.game?.gameType === 'auctioneer';
        const isSold = isBiddingGame && !!soldData;
        const soldTo = soldData?.ownerName;
        const pricePaid = soldData?.pricePaid;

        // Calculate effective minimum bid (apply cap if configured)
        const riderPoints = rider.points || 1;
        const effectiveMinBid = maxMinBid && riderPoints > maxMinBid ? maxMinBid : riderPoints;

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
          if (myBid && (myBid.status === 'active' || myBid.status === 'outbid' || myBid.status === 'won')) {
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

      // Cache the loaded data (riders are already cached by RankingsContext)
      await setCachedAuctionData(
        gameId,
        gameData.game,
        participantData,
        allBidsData,
        playerTeamsData
      );

      setError(null);
    } catch (error) {
      console.error('Error loading auction data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load auction data');
    } finally {
      setLoading(false);
      setForceRefresh(false); // Reset force refresh flag
    }
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!gameId) return;
    // Wait for rankings to load before loading auction data
    if (rankingsLoading) return;

    loadAuctionData();
  }, [gameId, user, authLoading, router, forceRefresh, rankingsLoading]);

  // Load all participants in the same division
  useEffect(() => {
    const loadDivisionParticipants = async () => {
      if (!gameId || !participant) return;

      try {
        const response = await fetch(`/api/games/${gameId}/participants?limit=1000`);
        if (!response.ok) return;

        const data = await response.json();
        if (!data.success) return;

        // Filter participants by division (if divisions exist)
        let filteredParticipants = data.participants;
        if (participant.assignedDivision) {
          filteredParticipants = data.participants.filter(
            (p: ParticipantData) => p.assignedDivision === participant.assignedDivision
          );
        }

        setDivisionParticipants(filteredParticipants);
      } catch (error) {
        console.error('Error loading division participants:', error);
      }
    };

    loadDivisionParticipants();
  }, [gameId, participant]);

  // Load selected player's bids
  useEffect(() => {
    const loadPlayerBids = async () => {
      if (!gameId || !selectedPlayerId) {
        setSelectedPlayerBids([]);
        return;
      }

      try {
        const response = await fetch(`/api/games/${gameId}/bids/list?userId=${selectedPlayerId}&limit=1000`);
        if (!response.ok) return;

        const data = await response.json();
        if (!data.success) return;

        setSelectedPlayerBids(data.bids || []);
      } catch (error) {
        console.error('Error loading player bids:', error);
      }
    };

    loadPlayerBids();
  }, [gameId, selectedPlayerId]);

  // Calculate min/max prices from available riders and set initial price range
  useEffect(() => {
    if (availableRiders.length > 0) {
      const prices = availableRiders.map(r => r.effectiveMinBid || r.points || 1);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      setPriceRange([minPrice, maxPrice]);
    }
  }, [availableRiders]);

  const getEffectiveMinimumBid = (riderPoints: number): number => {
    const maxMinBid = game?.config?.maxMinimumBid;
    const isWorldTourManager = game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains';

    if (maxMinBid && riderPoints > maxMinBid) {
      return maxMinBid;
    }

    // For worldtour-manager, minimum price is always 1 (even for riders with 0 points)
    if (isWorldTourManager && riderPoints === 0) {
      return 1;
    }

    return riderPoints;
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

    // Find the period where we are currently in the time window
    // IMPORTANT: Only check time window, ignore status field to avoid confusion
    let activePeriod = config.auctionPeriods.find((p: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const start = toDate(p.startDate);
      const end = toDate(p.endDate);
      if (!start || !end) return false;

      const inWindow = now >= start && now <= end;
      return inWindow;
    });

    return !!activePeriod?.top200Only;
  })();

  const handlePlaceBid = async (rider: RiderWithBid) => {
    if (!user || !participant) return;

    const riderNameId = rider.nameID || rider.id || '';
    const isWorldTourManager = game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains';

    // For worldtour-manager and marginal-gains, use the rider's effective minimum bid as the price
    // For auction games, use the entered bid amount
    const riderPoints = rider.points || 0;
    const bidAmount = isWorldTourManager
      ? getEffectiveMinimumBid(riderPoints)
      : parseFloat(bidAmountsRef.current[riderNameId] || '0');

    const effectiveMinBid = getEffectiveMinimumBid(riderPoints);

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
    const maxRiders = game?.config?.maxRiders || game?.config?.teamSize;
    // Count UNIQUE riders, not total bids (in case there are duplicate bids)
    const uniqueActiveRiders = new Set(
      myBids
        .filter(b => b.status === 'active' || b.status === 'outbid')
        .map(b => b.riderNameId)
    );
    const activeBidsCount = uniqueActiveRiders.size;
    const isUpdatingExistingBid = rider.myBid !== undefined;

    if (maxRiders && activeBidsCount >= maxRiders && !isUpdatingExistingBid) {
      setError(`Maximum number of riders reached (${activeBidsCount}/${maxRiders}). Cancel a bid to place a new one.`);
      return;
    }

    // Check budget for auction games (not for marginal-gains which has no budget)
    if (game?.gameType !== 'marginal-gains') {
      if (bidAmount > getRemainingBudget(riderNameId)) {
        setError('Bid exceeds your remaining budget');
        return;
      }
    }

    // WorldTour Manager & Marginal Gains: Check neo-prof requirements
    // Rule: If you want 28+ riders, you need at least 1 neo-prof in your team
    if (game && (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains')) {
      // Count UNIQUE riders with active/outbid status
      const totalActiveBids = new Set(
        myBids
          .filter(b => b.status === 'active' || b.status === 'outbid')
          .map(b => b.riderNameId)
      ).size;
      const minRiders = game.config.minRiders || 27;
      const isThisRiderNeoProf = qualifiesAsNeoProf(rider, game?.config);

      // Count current neo-profs in the team (unique riders only)
      const currentNeoProfRiders = new Set(
        myBids
          .filter(b => b.status === 'active' || b.status === 'outbid')
          .filter(b => {
            const bidRider = availableRiders.find(r => (r.nameID || r.id) === b.riderNameId);
            return bidRider && qualifiesAsNeoProf(bidRider, game?.config);
          })
          .map(b => b.riderNameId)
      );
      const currentNeoProfCount = currentNeoProfRiders.size;

      // If we're trying to get to 28+ riders and this is NOT a neo-prof,
      // check if we already have at least one neo-prof
      if (totalActiveBids >= minRiders && !isThisRiderNeoProf && currentNeoProfCount === 0) {
        const maxAge = game.config.maxNeoProAge || 21;
        const maxPoints = game.config.maxNeoProPoints || 250;
        setError(`Om meer dan ${minRiders} renners te hebben, moet je minimaal 1 neoprof in je team hebben (max ${maxAge} jaar oud met max ${maxPoints} punten).`);
        return;
      }

      // If this IS a neo-prof, check if they qualify based on points
      const riderPoints = rider.points || 0;
      if (isThisRiderNeoProf && game.config.maxNeoProPoints && riderPoints > game.config.maxNeoProPoints) {
        setError(`Deze renner heeft te veel punten (${riderPoints}) om als neoprof te kwalificeren. Max toegestaan: ${game.config.maxNeoProPoints} punten.`);
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

      // Invalidate cache when a bid is placed
      invalidateAuctionCache(gameId);

      // Clear bid amount input
      bidAmountsRef.current[riderNameId] = '';

      // Update state directly instead of reloading
      // When updating a bid, remove any existing bid on this rider by this user
      setMyBids(prev => {
        const filtered = prev.filter(b => b.riderNameId !== riderNameId);
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

      // Invalidate cache when all bids are reset
      invalidateAuctionCache(gameId);

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

      // Invalidate cache when a bid is cancelled
      invalidateAuctionCache(gameId);

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
            highestBidder: highestOtherBid?.playername || undefined,
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
      .filter(b => b.status === 'active' || b.status === 'won')
      .reduce((sum, bid) => sum + (Number(bid.amount) || 0), 0);
  };

  const getRemainingBudget = (excludeRiderNameId?: string): number => {
    // Use the game's budget (in case admin updated it) instead of participant's budget
    const budget = Number(game?.config?.budget) || 0;
    const spentBudget = Number(participant?.spentBudget) || 0;

    // After finalization, spentBudget already includes won bids
    // During auction, we need to account for active bids (spentBudget doesn't include them yet)
    const auctionClosed = game?.status === 'active';

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
      // Filter out retired riders
      if (rider.retired) {
        return false;
      }

      const matchesSearch = rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rider.nameID || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rider.team?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const riderPrice = rider.effectiveMinBid || rider.points || 0;
      const matchesPrice = riderPrice >= priceRange[0] && riderPrice <= priceRange[1];

      // Age filter for marginal-gains
      // Convert birth year to actual age
      const currentYear = new Date().getFullYear();
      let riderAge = rider.age ? (typeof rider.age === 'string' ? parseInt(rider.age) : rider.age) : null;
      if (riderAge && riderAge > 1900) {
        riderAge = currentYear - riderAge;
      }
      const matchesAge = game?.gameType !== 'marginal-gains' || !riderAge || (riderAge >= ageRange[0] && riderAge <= ageRange[1]);

      // Apply top-200 restriction at list level: only show riders in top 200 when enabled
      const riderRank = (rider as any).rank; // eslint-disable-line @typescript-eslint/no-explicit-any
      const withinTop200 = !isTop200Restricted || (typeof riderRank === 'number' && riderRank <= 200);

      return matchesSearch && matchesPrice && matchesAge && withinTop200;
    });
  }, [availableRiders, searchTerm, priceRange, ageRange, isTop200Restricted, game?.gameType]);

  const sortedAndFilteredRiders = useMemo(() => {
    return [...filteredRiders]
      // .sort((a, b) => {
      //   if (a.myBid && b.myBid) {
      //     return b.myBid - a.myBid;
      //   } else if (a.myBid) {
      //     return -1;
      //   } else if (b.myBid) {
      //     return 1;
      //   } else {
      //     return a.rank - b.rank;
      //   }
      // })
      // .filter((rider) => {
      //   // Filter out riders that have active bids - they should only appear in "My Bids" section
      //   // Check both nameID and id to ensure we catch all matches
      //   // don't filter the bids if you won them
      //   return !myBids.some(bid =>
      //     bid.riderNameId === rider.nameID ||
      //     bid.riderNameId === rider.id
      //   );
      // })
      .filter((rider) => !hideSoldPlayers || !rider.isSold)
      .filter((rider) => !showOnlyFillers || qualifiesAsNeoProf(rider, game?.config || {}));
  }, [filteredRiders, myBids, hideSoldPlayers, showOnlyFillers, game]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-center text-gray-600">{t('global.loading')}</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">{t('global.error')}</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button
            type="button"
            text={t('global.backToGames')}
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
  const auctionClosed = game.status === 'active' || game.status === 'finished';

  // Calculate min/max prices for the slider
  const allPrices = availableRiders.map(r => r.effectiveMinBid || r.points || 0);
  const minRiderPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxRiderPrice = allPrices.length > 0 ? Math.max(...allPrices) : 10000;

  // Calculate min/max ages for the slider (marginal-gains only)
  // Convert birth years to actual ages
  const currentYear = new Date().getFullYear();
  const allAges = availableRiders
    .map(r => {
      if (!r.age) return null;
      const ageValue = typeof r.age === 'string' ? parseInt(r.age) : r.age;
      // If the value is > 1900, it's likely a birth year, convert to age
      if (ageValue > 1900) {
        return currentYear - ageValue;
      }
      return ageValue;
    })
    .filter((age): age is number => age !== null && !isNaN(age) && age > 0 && age < 100);
  const minRiderAge = allAges.length > 0 ? Math.min(...allAges) : 18;
  const maxRiderAge = allAges.length > 0 ? Math.max(...allAges) : 45;

  const myAuctionBids = myBids.map((bid: Bid) => ({ ...bid, price: sortedAndFilteredRiders.find((b: RiderWithBid) => b.id === bid.riderNameId)?.points })).filter((bid: Bid) => bid.status === 'active')
  const isSelectionBasedGame = game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains';
  return (
    <div className={`min-h-screen bg-gray-50 relative `}>
      <div className="bg-white border-b border-gray-200 z-10 px-8">
        <div className="container mx-auto py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">
                {(game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains') ? 'Team Selection' : 'Auction'} - {game.name}
              </h1>
              <p className="text-gray-600">{game.division}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                text="🔄 Refresh"
                onClick={() => {
                  invalidateAuctionCache(gameId);
                  setForceRefresh(true);
                }}
                ghost
                title="Force refresh data from server"
              />
              {game.bidding && (
                <Button
                  type="button"
                  text="Teams"
                  onClick={() => router.push(`/games/${gameId}/auction/teams`)}
                  ghost
                  title="Bekijk alle teams in één overzicht"
                />
              )}
              <Button
                type="button"
                text={t('global.backToGames')}
                onClick={() => router.push('/games')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="container mx-auto">
          <div className=" w-full flex flex-row gap-4 mb-4 relative">{/* container */}
            <div className="bg-white rounded-md flex-9/12">{/* content */}
                
              <Tabs
                defaultTab="bidding"
                tabs={[
                  {
                    id: 'bidding', label: game.bidding ? 'Bidding' : 'Team Selection', content: <Bidding
                      auctionClosed={auctionClosed}
                      allBids={allBids}
                      auctionActive={auctionActive}
                      cancellingBid={cancellingBid}
                      setHideSoldPlayers={setHideSoldPlayers}
                      hideSoldPlayers={hideSoldPlayers}
                      participant={participant}
                      isAdmin={isAdmin}
                      bidAmountsRef={bidAmountsRef}
                      sortedAndFilteredRiders={sortedAndFilteredRiders}
                      setshowOnlyFillers={setshowOnlyFillers}
                      showOnlyFillers={showOnlyFillers}
                      handlePlaceBid={handlePlaceBid}
                      setAdjustingBid={setAdjustingBid}
                      handleCancelBidClick={handleCancelBidClick}
                      game={game}
                      myBids={myBids}
                      availableRiders={availableRiders}
                      adjustingBid={adjustingBid}
                      placingBid={placingBid}
                      userId={user?.uid}
                    />
                  },
                  ...(!isSelectionBasedGame ? [{
                    id: 'my-bids', label: 'Bidding history', content: <MyAuctionBidsBig
                      selectedPlayerBids={selectedPlayerBids}
                      alleBiedingen={alleBiedingen}
                      myBids={myBids}
                      divisionParticipants={divisionParticipants}
                      selectedPlayerId={selectedPlayerId}
                      setSelectedPlayerId={setSelectedPlayerId}
                      setActiveAuctionPeriodTab={setActiveAuctionPeriodTab}
                      activeAuctionPeriodTab={activeAuctionPeriodTab}
                      user={user}
                      availableRiders={availableRiders}
                      participant={participant}
                      game={game} />
                  }] : [])
                ]} />

            </div>
            
            <div className={`bg-white rounded-md border border-gray-200 p-4 sticky z-20 self-start min-w-[330px]`} style={{ top: hideBanner ? '107px' : '142px' }}>
            

              {!auctionActive && (
                <div className={`mb-4 p-4 rounded-lg ${auctionClosed ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                  <p className={`text-sm font-medium ${auctionClosed ? 'text-red-800' : 'text-yellow-800'
                    }`}>
                    {auctionClosed
                      ? (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains')
                        ? 'Team selection has ended. No more riders can be selected.'
                        : 'The auction has ended. No more bids can be placed.'
                      : (game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains')
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

              <div className="flex relative max-h-[calc(100vh-32px-86px-142px)] overflow-scroll flex-col gap-4">
                <AuctionFilters sortedAndFilteredRiders={sortedAndFilteredRiders} game={game} searchTerm={searchTerm} setSearchTerm={setSearchTerm} priceRange={priceRange} setPriceRange={setPriceRange} minRiderPrice={minRiderPrice} maxRiderPrice={maxRiderPrice} ageRange={ageRange} setAgeRange={setAgeRange} minRiderAge={minRiderAge} maxRiderAge={maxRiderAge} myBids={myBids} handleResetBidsClick={handleResetBidsClick} showOnlyFillers={showOnlyFillers} setshowOnlyFillers={setshowOnlyFillers} hideSoldPlayers={hideSoldPlayers} setHideSoldPlayers={setHideSoldPlayers} />
                <AuctionStats game={game} myBids={myBids} auctionClosed={auctionClosed} getTotalMyBids={getTotalMyBids} getRemainingBudget={getRemainingBudget} />
                {myAuctionBids.length > 0 && game.gameType === 'worldtour-manager' && (
                  <MyAuctionBids game={game} availableRiders={availableRiders} myBids={myAuctionBids} />
                )}
                {game.gameType !== 'worldtour-manager' && game.gameType !== 'marginal-gains' && <MyAuctionTeam availableRiders={availableRiders} auctionPeriods={(game.config.auctionPeriods || []).map(period => ({
                  ...period,
                  startDate: typeof period.startDate === 'string' ? period.startDate : period.startDate.toDate().toISOString(),
                  endDate: typeof period.endDate === 'string' ? period.endDate : period.endDate.toDate().toISOString()
                }))} myBids={myBids.map((bid: Bid) => ({ ...bid, price: filteredRiders.find((b: RiderWithBid) => b.id === bid.riderNameId)?.points, round: bid.bidAt })).filter((bid: Bid) => bid.status === 'won')} starterAmount={game.config.budget || 0} />
                }
              </div>



            </div>
          </div>


          {!auctionClosed && (
            <MyTeamSelection
              myTeamSelection={availableRiders.filter(r => r.myBid).filter((r) => r.myBidStatus === 'active')}
              setMyTeamSelection={() => { }}
              onCancelBid={handleCancelBidClick}
              onAdjustBid={handleAdjustBid}
              hideButton={!auctionActive}
              game={game}
              adjustingBid={adjustingBid}
              isWorldTourManager={game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains'}
            />
          )}

          {auctionClosed && (
            <MyTeamSelection
              myTeamSelection={availableRiders.filter(rider => rider.myBid && myBids.some(bid => bid.id === rider.myBidId && bid.status === 'won'))}
              setMyTeamSelection={() => { }}
              onCancelBid={handleCancelBidClick}
              onAdjustBid={handleAdjustBid}
              hideButton={!auctionActive}
              game={game}
              adjustingBid={adjustingBid}
              isWorldTourManager={game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains'}
            />
          )}



          {filteredRiders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {t('auction.noRidersFound')}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Bid Confirmation Modal */}
      {cancelConfirmModal && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{t('auction.cancelBid')}</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to cancel your bid on {cancelConfirmModal.riderName}?
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                text={t('auction.noKeepBid')}
                onClick={() => setCancelConfirmModal(null)}
                disabled={cancellingBid !== null}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 hover:text-white"
              />
              <Button
                text={cancellingBid === cancelConfirmModal.bidId ? t('global.loading') : t('auction.cancelBidConfirm')}
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
            <h2 className="text-xl font-bold mb-4">{t('auction.resetAllBids')}</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to reset all your bid amounts? This will clear all the amounts you&apos;ve entered in the input fields.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                text={t('auction.noKeepBid')}
                onClick={() => setResetConfirmModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 hover:text-white"
              />
              <Button
                text={t('auction.yesResetAll')}
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
          confirmText={t('global.ok')}
          cancelText={t('global.close')}
        />
      )}
    </div>
  );
}
