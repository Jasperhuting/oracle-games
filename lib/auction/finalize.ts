import { getServerFirebase } from '@/lib/firebase/server';
import { AuctioneerConfig, AuctionPeriod, FullGridConfig, Game, LastManStandingConfig, MarginalGainsConfig, WorldTourManagerConfig } from '../types';
import { Timestamp } from 'firebase-admin/firestore';

export interface FinalizeAuctionOptions {
  gameId: string;
  auctionPeriodName?: string;
  resumeFromUserId?: string; // Resume from this user (exclusive)
}

export interface FinalizeAuctionResult {
  success: boolean;
  message?: string;
  results?: {
    totalRiders: number;
    winnersAssigned: number;
    losersRefunded: number;
    errors: string[];
    lastProcessedUserId?: string; // Last successfully processed user
    totalParticipants: number;
    processedParticipants: number;
  };
  error?: string;
  details?: string;
}

/**
 * Finalize auction bids for a game
 * This is the core finalization logic that can be called from both:
 * - The API endpoint (for manual finalization)
 * - The CRON job (for automatic finalization)
 */
export async function finalizeAuction(
  options: FinalizeAuctionOptions
): Promise<FinalizeAuctionResult> {
  const { gameId, auctionPeriodName, resumeFromUserId } = options;

  try {
    console.log(`[FINALIZE] Request for gameId: ${gameId}, auctionPeriodName: ${auctionPeriodName || 'ALL'}${resumeFromUserId ? `, resuming from user: ${resumeFromUserId}` : ''}`);

    const db = getServerFirebase();

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return {
        success: false,
        error: 'Game not found',
      };
    }

    const gameData = gameDoc.data() as Game;

    // Check if game type supports bidding/selection
    if (
      gameData?.gameType !== 'auctioneer' &&
      gameData?.gameType !== 'worldtour-manager' &&
      gameData?.gameType !== 'marginal-gains' &&
      gameData?.gameType !== 'full-grid'
    ) {
      return {
        success: false,
        error: 'Game does not support bidding',
      };
    }

    // Determine if this is a selection-based game (where multiple users can select the same rider)
    const isSelectionBased = gameData?.gameType === 'worldtour-manager' || gameData?.gameType === 'marginal-gains' || gameData?.gameType === 'full-grid';

    // If game has auction periods and a specific period is specified, validate it
    const auctionPeriods =
      gameData?.gameType === 'auctioneer' ? (gameData.config as AuctioneerConfig)?.auctionPeriods :
        gameData?.gameType === 'worldtour-manager' ? (gameData.config as WorldTourManagerConfig)?.auctionPeriods :
          gameData?.gameType === 'marginal-gains' ? (gameData.config as MarginalGainsConfig)?.auctionPeriods :
            gameData?.gameType === 'full-grid' ? (gameData.config as FullGridConfig)?.auctionPeriods :
            undefined;

    if (auctionPeriods && auctionPeriods.length > 0 && auctionPeriodName) {
      // Validate that the period exists
      const periodExists = auctionPeriods.some((p: AuctionPeriod) => p.name === auctionPeriodName);
      if (!periodExists) {
        return {
          success: false,
          error: `Auction period "${auctionPeriodName}" not found`,
        };
      }

      // Get the period dates to filter bids
      const period = auctionPeriods.find((p: AuctionPeriod) => p.name === auctionPeriodName);
      const periodStartDate = period?.startDate?.toDate?.() || period?.startDate;
      const periodEndDate = period?.endDate?.toDate?.() || period?.endDate;

      console.log(`[FINALIZE] Filtering bids for period "${auctionPeriodName}" from ${periodStartDate} to ${periodEndDate}`);
    }

    // Get all bids for this game (without status filter to avoid index requirement)
    console.log(`[FINALIZE] Querying all bids for gameId: ${gameId}`);
    const allBidsForGameSnapshot = await db.collection('bids')
      .where('gameId', '==', gameId)
      .get();

    console.log(`[FINALIZE] Found ${allBidsForGameSnapshot.size} total bids for game`);

    // Helper to convert Firestore timestamp to ISO string
    const toISOString = (value: Timestamp | Date | string | { _seconds: number } | null | undefined): string | null => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof Date) return value.toISOString();
      if (value instanceof Timestamp) return value.toDate().toISOString();
      if ('_seconds' in value) return new Date(value._seconds * 1000).toISOString();
      return null;
    };

    // Filter for active and outbid bids in memory (outbid status may exist from legacy data)
    // AND filter by auction period if specified
    const activeBidsDocs = allBidsForGameSnapshot.docs.filter(doc => {
      const bidData = doc.data();
      const status = bidData.status;

      // Filter by status
      if (status !== 'active' && status !== 'outbid') {
        return false;
      }

      // Filter by auction period if specified
      if (auctionPeriodName && auctionPeriods && auctionPeriods.length > 0) {
        const period = auctionPeriods.find((p: AuctionPeriod) => p.name === auctionPeriodName);
        // Convert Firestore Timestamps to ISO strings for comparison
        const periodStartDate = toISOString(period?.startDate);
        const periodEndDate = toISOString(period?.endDate);
        const bidAt = toISOString(bidData.bidAt); // Convert Firestore timestamp to ISO string

        if (!periodStartDate || !periodEndDate || !bidAt) {
          return false;
        }

        // Only include bids made during this specific period (string comparison)
        return bidAt >= periodStartDate && bidAt <= periodEndDate;
      }

      return true;
    });
    console.log(`[FINALIZE] Found ${activeBidsDocs.length} active/outbid bids after filtering`);

    // Create a snapshot-like object for compatibility with existing code
    const activeBidsSnapshot = {
      empty: activeBidsDocs.length === 0,
      size: activeBidsDocs.length,
      docs: activeBidsDocs
    };

    // If no active bids, this is still a valid finalization (just with 0 winners)
    if (activeBidsSnapshot.empty) {
      if (allBidsForGameSnapshot.size > 0) {
        const statusCounts: Record<string, number> = {};
        allBidsForGameSnapshot.docs.forEach(doc => {
          const status = doc.data().status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log(`[FINALIZE] Bid status breakdown:`, statusCounts);
        console.log(`[FINALIZE] No active bids found, but ${allBidsForGameSnapshot.size} total bids exist - finalizing with 0 winners`);
      } else {
        console.log(`[FINALIZE] No bids found for ${auctionPeriodName ? `period "${auctionPeriodName}"` : 'this game'} - finalizing with 0 winners`);
      }

      // Still update the period status and game, but with 0 winners
      // This is a valid scenario - the period ended without any bids
      const updateData: Record<string, unknown> = {
        status: 'active',
        finalizedAt: Timestamp.now(),
      };

      // If this is a specific auction period, update that period's status to 'finalized'
      if (auctionPeriodName && auctionPeriods && auctionPeriods.length > 0) {
        // Re-fetch the game document to ensure we have the latest auctionPeriods data
        const latestGameDoc = await db.collection('games').doc(gameId).get();
        const latestGameData = latestGameDoc.data();
        const latestAuctionPeriods = latestGameData?.config?.auctionPeriods || [];

        console.log(`[FINALIZE] Current periods count: ${latestAuctionPeriods.length}`);

        const updatedPeriods = latestAuctionPeriods.map((p: AuctionPeriod) => {
          if (p.name === auctionPeriodName) {
            console.log(`[FINALIZE] Marking period "${auctionPeriodName}" as finalized (0 bids)`);
            return { ...p, status: 'finalized' };
          }
          return p;
        });

        console.log(`[FINALIZE] Updated periods count: ${updatedPeriods.length}`);

        // CRITICAL SAFETY CHECK: Ensure no periods are deleted
        if (updatedPeriods.length < latestAuctionPeriods.length) {
          const errorMsg = `CRITICAL ERROR: Attempted to delete auction periods! Original: ${latestAuctionPeriods.length}, Updated: ${updatedPeriods.length}`;
          console.error(`[FINALIZE] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // CRITICAL SAFETY CHECK: Ensure period names match
        const originalNames = new Set(latestAuctionPeriods.map((p: AuctionPeriod) => p.name));
        const updatedNames = new Set(updatedPeriods.map((p: AuctionPeriod) => p.name));
        const missingPeriods = [...originalNames].filter(name => !updatedNames.has(name));

        if (missingPeriods.length > 0) {
          const errorMsg = `CRITICAL ERROR: Missing periods after update: ${missingPeriods.join(', ')}`;
          console.error(`[FINALIZE] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        updateData['config.auctionPeriods'] = updatedPeriods;

        // Check if all periods are finalized
        const allPeriodsFinalized = updatedPeriods.every((p: AuctionPeriod) => p.status === 'finalized');
        if (allPeriodsFinalized) {
          updateData['config.auctionStatus'] = 'finalized';
          console.log(`[FINALIZE] All auction periods finalized, marking game auction as finalized`);
        }
      } else {
        // For games without periods, mark the whole auction as finalized
        updateData['config.auctionStatus'] = 'finalized';
      }

      await gameDoc.ref.update(updateData);

      // Log the activity
      await db.collection('activityLogs').add({
        action: 'AUCTION_FINALIZED',
        details: {
          gameId,
          gameName: gameData?.name,
          results: {
            totalRiders: 0,
            winnersAssigned: 0,
            losersRefunded: 0,
            errors: [],
          },
        },
        timestamp: Timestamp.now(),
        ipAddress: 'internal',
        userAgent: 'cron-job',
      });

      return {
        success: true,
        message: `Auction period finalized successfully with 0 bids${auctionPeriodName ? ` for period "${auctionPeriodName}"` : ''}`,
        results: {
          totalRiders: 0,
          winnersAssigned: 0,
          losersRefunded: 0,
          errors: [],
          totalParticipants: 0,
          processedParticipants: 0,
        },
      };
    }

    // Group bids by rider
    interface BidWithId {
      id: string;
      riderNameId: string;
      userId: string;
      amount: number;
      bidAt: Timestamp;
      [key: string]: unknown;
    }
    const bidsByRider = new Map<string, BidWithId[]>();

    activeBidsSnapshot.docs.forEach(doc => {
      const bidData = { id: doc.id, ...doc.data() } as BidWithId;
      const riderNameId = bidData.riderNameId;

      if (!bidsByRider.has(riderNameId)) {
        bidsByRider.set(riderNameId, []);
      }
      bidsByRider.get(riderNameId)!.push(bidData);
    });

    // Process each rider's bids
    const results: NonNullable<FinalizeAuctionResult['results']> = {
      totalRiders: bidsByRider.size,
      winnersAssigned: 0,
      losersRefunded: 0,
      errors: [] as string[],
      lastProcessedUserId: undefined,
      totalParticipants: 0, // Will be set later
      processedParticipants: 0,
    };

    // Get game config for limits
    let maxRiders = 0;
    let maxBudget = 0;
    if (gameData.gameType === 'auctioneer') {
      maxRiders = (gameData.config as AuctioneerConfig).maxRiders || 0;
      maxBudget = (gameData.config as AuctioneerConfig).budget || 0;
    } else if (gameData.gameType === 'worldtour-manager') {
      maxRiders = (gameData.config as WorldTourManagerConfig).maxRiders || 0;
      maxBudget = (gameData.config as WorldTourManagerConfig).budget || 0;
    } else if (gameData.gameType === 'marginal-gains') {
      maxRiders = (gameData.config as MarginalGainsConfig).teamSize || 0;
      maxBudget = 0; // No budget for marginal-gains
    } else if (gameData.gameType === 'full-grid') {
      maxRiders = (gameData.config as FullGridConfig).maxRiders || 0;
      maxBudget = (gameData.config as FullGridConfig).budget || 0;
    }

    console.log(`[FINALIZE] Game limits: maxRiders=${maxRiders}, maxBudget=${maxBudget}`);

    // First pass: collect all winning bids per participant
    const winsByParticipant = new Map<string, Array<{ riderNameId: string, bid: BidWithId }>>();

    // For selection-based games, we need to group bids by user FIRST, then validate limits
    if (isSelectionBased) {
      // Group all active bids by user
      const bidsByUser = new Map<string, BidWithId[]>();
      for (const [riderNameId, bids] of bidsByRider.entries()) {
        for (const bid of bids) {
          if (!bidsByUser.has(bid.userId)) {
            bidsByUser.set(bid.userId, []);
          }
          bidsByUser.get(bid.userId)!.push({ ...bid, riderNameId });
        }
      }

      // Process each user's bids with validation
      for (const [userId, userBids] of bidsByUser.entries()) {
        // Sort bids by bidAt (oldest first) - first come, first served
        userBids.sort((a, b) => {
          const timeA = a.bidAt?.toDate ? a.bidAt.toDate() : new Date();
          const timeB = b.bidAt?.toDate ? b.bidAt.toDate() : new Date();
          return timeA.getTime() - timeB.getTime();
        });

        // Get current team state from existing won bids and PlayerTeams
        const existingWonBids = await db.collection('bids')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .where('status', '==', 'won')
          .get();

        let currentSpent = 0;
        const currentRiderIds = new Set<string>();
        existingWonBids.docs.forEach(doc => {
          currentSpent += doc.data().amount || 0;
          currentRiderIds.add(doc.data().riderNameId);
        });

        console.log(`[FINALIZE] User ${userId}: current spent=${currentSpent}, current riders=${currentRiderIds.size}`);

        // Track rejected bids for logging
        const rejectedBids: Array<{ bid: BidWithId; reason: string; details: Record<string, unknown> }> = [];

        // Process bids respecting limits
        for (const bid of userBids) {
          const riderNameId = bid.riderNameId;

          // Skip if rider already in team
          if (currentRiderIds.has(riderNameId)) {
            console.log(`[FINALIZE]   - Skipping ${bid.riderName}: already in team`);
            await db.collection('bids').doc(bid.id).update({ status: 'cancelled_duplicate' });
            rejectedBids.push({
              bid,
              reason: 'DUPLICATE_RIDER',
              details: { message: 'Rider already in team' },
            });
            continue;
          }

          // Check team size limit
          if (maxRiders > 0 && currentRiderIds.size >= maxRiders) {
            console.log(`[FINALIZE]   - Rejecting ${bid.riderName}: team full (${currentRiderIds.size}/${maxRiders})`);
            await db.collection('bids').doc(bid.id).update({ status: 'cancelled_team_full' });
            rejectedBids.push({
              bid,
              reason: 'TEAM_FULL',
              details: { currentSize: currentRiderIds.size, maxRiders },
            });
            results.errors.push(`${bid.riderName} rejected for user ${userId}: team full`);
            continue;
          }

          // Check budget limit (skip for marginal-gains)
          if (maxBudget > 0 && currentSpent + bid.amount > maxBudget) {
            console.log(`[FINALIZE]   - Rejecting ${bid.riderName}: over budget (${currentSpent + bid.amount} > ${maxBudget})`);
            await db.collection('bids').doc(bid.id).update({ status: 'cancelled_over_budget' });
            rejectedBids.push({
              bid,
              reason: 'OVER_BUDGET',
              details: { currentSpent, bidAmount: bid.amount, totalWouldBe: currentSpent + bid.amount, maxBudget },
            });
            results.errors.push(`${bid.riderName} rejected for user ${userId}: over budget`);
            continue;
          }

          // Bid is valid - mark as won
          console.log(`[FINALIZE]   - Accepting ${bid.riderName} for ${bid.amount}`);
          await db.collection('bids').doc(bid.id).update({ status: 'won' });

          // Track the win
          if (!winsByParticipant.has(userId)) {
            winsByParticipant.set(userId, []);
          }
          winsByParticipant.get(userId)!.push({ riderNameId, bid });

          // Update current state
          currentSpent += bid.amount;
          currentRiderIds.add(riderNameId);
        }

        // Log rejected bids if any
        if (rejectedBids.length > 0) {
          await db.collection('activityLogs').add({
            action: 'BIDS_REJECTED_AT_FINALIZE',
            details: {
              gameId,
              gameName: gameData?.name,
              userId,
              auctionPeriodName: auctionPeriodName || 'all',
              rejectedCount: rejectedBids.length,
              rejectedBids: rejectedBids.map(rb => ({
                riderName: rb.bid.riderName,
                riderNameId: rb.bid.riderNameId,
                amount: rb.bid.amount,
                reason: rb.reason,
                ...rb.details,
              })),
              acceptedCount: winsByParticipant.get(userId)?.length || 0,
            },
            timestamp: Timestamp.now(),
            ipAddress: 'internal',
            userAgent: 'finalize-auction',
          });
          console.log(`[FINALIZE] Logged ${rejectedBids.length} rejected bids for user ${userId}`);
        }
      }
    } else {
      // For auction-based games (Auctioneer):
      // Process each rider's bids - only highest bid wins
      for (const [riderNameId, bids] of bidsByRider.entries()) {
        // Sort bids: highest amount first, then earliest time
        bids.sort((a, b) => {
          if (b.amount !== a.amount) {
            return b.amount - a.amount; // Higher bid wins
          }
          // If amounts are equal, earlier bid wins
          const timeA = a.bidAt.toDate();
          const timeB = b.bidAt.toDate();
          return timeA.getTime() - timeB.getTime();
        });

        const winningBid = bids[0];
        const losingBids = bids.slice(1);

        // Collect wins by participant
        if (!winsByParticipant.has(winningBid.userId)) {
          winsByParticipant.set(winningBid.userId, []);
        }
        winsByParticipant.get(winningBid.userId)!.push({ riderNameId, bid: winningBid });

        // Mark winning bid as "won"
        await db.collection('bids').doc(winningBid.id).update({ status: 'won' });

        // Mark losing bids as "lost"
        for (const losingBid of losingBids) {
          await db.collection('bids').doc(losingBid.id).update({ status: 'lost' });
          results.losersRefunded++;
        }
      }
    }

    // Second pass: update each participant once with all their wins
    console.log(`[FINALIZE] Processing ${winsByParticipant.size} participants with wins`);

    // Sort participants for consistent processing order
    const sortedParticipantIds = Array.from(winsByParticipant.entries())
      .map(([userId, wins]) => ({ userId, wins }))
      .sort((a, b) => a.userId.localeCompare(b.userId));

    // Set total participants count
    results.totalParticipants = sortedParticipantIds.length;

    // Find starting point if resuming
    let startIndex = 0;
    if (resumeFromUserId) {
      startIndex = sortedParticipantIds.findIndex(p => p.userId === resumeFromUserId);
      if (startIndex >= 0) {
        startIndex++; // Skip the resume user itself (exclusive)
        console.log(`[FINALIZE] Resuming from index ${startIndex} (after user ${resumeFromUserId})`);
      } else {
        console.log(`[FINALIZE] Resume user ${resumeFromUserId} not found, starting from beginning`);
        startIndex = 0;
      }
    }

    for (let i = startIndex; i < sortedParticipantIds.length; i++) {
      const { userId, wins } = sortedParticipantIds[i];
      results.processedParticipants++;
      results.lastProcessedUserId = userId;
      
      try {
        const participantSnapshot = await db.collection('gameParticipants')
          .where('gameId', '==', gameId)
          .where('userId', '==', userId)
          .limit(1)
          .get();

        if (!participantSnapshot.empty) {
          const participantDoc = participantSnapshot.docs[0];
          const participantData = participantDoc.data();

          // FIX: Rebuild currentTeam from playerTeams collection instead of using corrupted participantData.team
          // This prevents the [object Object] string corruption issue
          const existingPlayerTeams = await db.collection('playerTeams')
            .where('gameId', '==', gameId)
            .where('userId', '==', userId)
            .where('active', '==', true)
            .get();

          const currentTeam = existingPlayerTeams.docs.map(doc => {
            const data = doc.data();
            return {
              riderNameId: data.riderNameId,
              riderName: data.riderName,
              riderTeam: data.riderTeam,
              jerseyImage: data.jerseyImage,
              pricePaid: data.pricePaid,
              acquiredAt: data.acquiredAt,
            };
          });

          const currentSpentBudget = participantData.spentBudget || 0;

          console.log(`[FINALIZE] User ${userId}: current spentBudget=${currentSpentBudget}, wins=${wins.length}, rebuilt team from ${existingPlayerTeams.size} playerTeams`);

          // Calculate total won amount and build new team
          let totalWonAmount = 0;
          const newRiders = wins.map(({ riderNameId, bid }) => {
            totalWonAmount += bid.amount;
            console.log(`[FINALIZE]   - Won rider ${bid.riderName} for ${bid.amount}`);
            return {
              riderNameId: riderNameId,
              riderName: bid.riderName,
              riderTeam: bid.riderTeam,
              jerseyImage: bid.jerseyImage,
              pricePaid: bid.amount, // Use pricePaid instead of amount for consistency
              acquiredAt: Timestamp.now(), // Finalize timestamp as Firestore Timestamp
            };
          });

          const newTeam = [...currentTeam, ...newRiders];

          // IMPORTANT FIX: Calculate spentBudget from ALL won bids instead of accumulating
          // This prevents double-counting when running finalization multiple times for different periods
          const allWonBidsSnapshot = await db.collection('bids')
            .where('gameId', '==', gameId)
            .where('userId', '==', userId)
            .where('status', '==', 'won')
            .get();

          let correctSpentBudget = 0;
          allWonBidsSnapshot.docs.forEach(bidDoc => {
            correctSpentBudget += bidDoc.data().amount || 0;
          });

          console.log(`[FINALIZE] User ${userId}: correct spentBudget=${correctSpentBudget} (calculated from ${allWonBidsSnapshot.size} won bids), teamSize=${newTeam.length}`);

          // Check if roster is complete
          let maxRiders = 0;
          // Handle different game types
          if (gameData.gameType === 'auctioneer') {
            maxRiders = (gameData.config as AuctioneerConfig).maxRiders || 0;
          } else if (gameData.gameType === 'worldtour-manager') {
            maxRiders = (gameData.config as WorldTourManagerConfig).maxRiders || 0;
          } else if (gameData.gameType === 'marginal-gains') {
            maxRiders = (gameData.config as MarginalGainsConfig).teamSize || 0;
          } else if (gameData.gameType === 'full-grid') {
            maxRiders = (gameData.config as FullGridConfig).maxRiders || 0;
          } else if (gameData.gameType === 'last-man-standing') {
            maxRiders = (gameData.config as LastManStandingConfig).teamSize || 0;
          }
          const rosterComplete = newTeam.length >= maxRiders;

          // Update participant with all wins at once
          await participantDoc.ref.update({
            team: newTeam, // Store the clean, properly formatted team array
            spentBudget: correctSpentBudget,
            rosterSize: newTeam.length,
            rosterComplete,
          });

          // IMPORTANT: Also create PlayerTeam documents for each won rider
          // This is required for the points calculation system
          console.log(`[FINALIZE] Creating ${wins.length} PlayerTeam documents for user ${userId}`);
          for (const { riderNameId, bid } of wins) {
            try {
              // Check if a PlayerTeam document already exists for this combination
              const existingPlayerTeam = await db.collection('playerTeams')
                .where('gameId', '==', gameId)
                .where('userId', '==', userId)
                .where('riderNameId', '==', riderNameId)
                .limit(1)
                .get();

              if (!existingPlayerTeam.empty) {
                console.log(`[FINALIZE]   - PlayerTeam already exists for ${bid.riderName}, skipping`);
                continue;
              }

              await db.collection('playerTeams').add({
                gameId: gameId,
                userId: userId,
                riderNameId: riderNameId,

                // Acquisition info
                acquiredAt: Timestamp.now(), // Finalize timestamp as Firestore Timestamp
                acquisitionType: isSelectionBased ? 'selection' : 'auction',
                pricePaid: bid.amount,

                // Rider info (denormalized)
                riderName: bid.riderName,
                riderTeam: bid.riderTeam,
                riderCountry: bid.riderCountry || '',
                jerseyImage: bid.jerseyImage || '',

                // Performance (initialized to 0)
                pointsScored: 0,
                stagesParticipated: 0,
              });
              console.log(`[FINALIZE]   - Created PlayerTeam document for ${bid.riderName}`);
            } catch (error) {
              console.error(`[FINALIZE]   - ERROR creating PlayerTeam for ${bid.riderName}:`, error);
              results.errors.push(`Failed to create PlayerTeam for ${bid.riderName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

          results.winnersAssigned += wins.length;

          console.log(`[FINALIZE] User ${userId}: UPDATED in database (${results.processedParticipants}/${results.totalParticipants})`);
        }
      } catch (error) {
        const errorMsg = `Failed to update participant ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log('[FINALIZE] All participants updated successfully');

    // Update game status and period status
    const updateData: Record<string, unknown> = {
      status: 'active',
      finalizedAt: Timestamp.now(),
    };

    // If this is a specific auction period, update that period's status to 'finalized'
    if (auctionPeriodName && auctionPeriods && auctionPeriods.length > 0) {
      // Re-fetch the game document to ensure we have the latest auctionPeriods data
      const latestGameDoc = await db.collection('games').doc(gameId).get();
      const latestGameData = latestGameDoc.data();
      const latestAuctionPeriods = latestGameData?.config?.auctionPeriods || [];

      console.log(`[FINALIZE] Current periods count: ${latestAuctionPeriods.length}`);

      const updatedPeriods = latestAuctionPeriods.map((p: AuctionPeriod) => {
        if (p.name === auctionPeriodName) {
          console.log(`[FINALIZE] Marking period "${auctionPeriodName}" as finalized`);
          return { ...p, status: 'finalized' };
        }
        return p;
      });

      console.log(`[FINALIZE] Updated periods count: ${updatedPeriods.length}`);

      // CRITICAL SAFETY CHECK: Ensure no periods are deleted
      if (updatedPeriods.length < latestAuctionPeriods.length) {
        const errorMsg = `CRITICAL ERROR: Attempted to delete auction periods! Original: ${latestAuctionPeriods.length}, Updated: ${updatedPeriods.length}`;
        console.error(`[FINALIZE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // CRITICAL SAFETY CHECK: Ensure period names match
      const originalNames = new Set(latestAuctionPeriods.map((p: AuctionPeriod) => p.name));
      const updatedNames = new Set(updatedPeriods.map((p: AuctionPeriod) => p.name));
      const missingPeriods = [...originalNames].filter(name => !updatedNames.has(name));

      if (missingPeriods.length > 0) {
        const errorMsg = `CRITICAL ERROR: Missing periods after update: ${missingPeriods.join(', ')}`;
        console.error(`[FINALIZE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      updateData['config.auctionPeriods'] = updatedPeriods;

      // Check if all periods are finalized
      const allPeriodsFinalized = updatedPeriods.every((p: AuctionPeriod) => p.status === 'finalized');
      if (allPeriodsFinalized) {
        updateData['config.auctionStatus'] = 'finalized';
        console.log(`[FINALIZE] All auction periods finalized, marking game auction as finalized`);
      }
    } else {
      // For games without periods, mark the whole auction as finalized
      updateData['config.auctionStatus'] = 'finalized';
    }

    await gameDoc.ref.update(updateData);

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'AUCTION_FINALIZED',
      details: {
        gameId,
        gameName: gameData?.name,
        results,
      },
      timestamp: Timestamp.now(),
      ipAddress: 'internal',
      userAgent: 'cron-job',
    });

    return {
      success: true,
      message: 'Auction finalized successfully',
      results,
    };

  } catch (error) {
    console.error('Error finalizing auction:', error);
    return {
      success: false,
      error: 'Failed to finalize auction',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
