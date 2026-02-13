import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { GameData, Team } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const db = getServerFirebase();

    // Get game data for rider values
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const gameData: DocumentData | undefined = gameDoc.data();
    const riderValues = gameData?.config?.riderValues || {};
    const maxRiders = gameData?.config?.maxRiders || gameData?.config?.teamSize || 32; // Default to 32 if not specified

    // Get all participants for this game
    const participantsSnapshot = await db
      .collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({ teams: [] });
    }

    // Get all player teams for this game
    const playerTeamsSnapshot = await db
      .collection('playerTeams')
      .where('gameId', '==', gameId)
      .get();

    // Get all bids for this game to get bid dates
    const bidsSnapshot = await db
      .collection('bids')
      .where('gameId', '==', gameId)
      .where('status', '==', 'won')
      .get();

    // Create a map of (userId, riderNameId) -> bidAt
    const bidsMap = new Map<string, string>();
    bidsSnapshot.forEach(doc => {
      const bid = doc.data();
      const key = `${bid.userId}_${bid.riderNameId}`;
      if (bid.bidAt) {
        // Convert Firestore Timestamp to ISO string
        let bidDate: string;
        if (typeof bid.bidAt === 'object' && bid.bidAt._seconds) {
          bidDate = new Date(bid.bidAt._seconds * 1000 + (bid.bidAt._nanoseconds || 0) / 1000000).toISOString();
        } else if (bid.bidAt.toDate) {
          bidDate = bid.bidAt.toDate().toISOString();
        } else {
          bidDate = bid.bidAt;
        }
        bidsMap.set(key, bidDate);
      }
    });

    // Get all riders from rankings to enrich the data
    // Use rankings_2026 collection (current year)
    const rankingsSnapshot = await db.collection('rankings_2026').get();
    const ridersMap = new Map<string, any>();

    console.log('[TEAMS-OVERVIEW] Total rankings documents:', rankingsSnapshot.size);

    // Build a map of team references to resolve them in batch
    const teamRefs = new Set<string>();
    const riderTeamRefs = new Map<string, any>();

    rankingsSnapshot.forEach(doc => {
      const rider = doc.data();
      const riderId = rider.nameID || rider.id || doc.id;

      if (riderId) {
        // Store the team reference for this rider
        if (rider.team) {
          riderTeamRefs.set(riderId, rider.team);
          // Extract team document path from reference
          if (rider.team.path) {
            teamRefs.add(rider.team.path);
          }
        }

        // Store country and points (base value)
        ridersMap.set(riderId, {
          team: '',
          country: rider.country || '',
          points: rider.points || 0
        });
      }
    });

    // Fetch all unique team documents
    const teamsData = new Map<string, string>();
    const teamPromises = Array.from(teamRefs).map(async (teamPath) => {
      try {
        const teamDoc = await db.doc(teamPath).get();
        if (teamDoc.exists) {
          const teamData = teamDoc.data();
          teamsData.set(teamPath, teamData?.name || '');
        }
      } catch (error) {
        console.error('[TEAMS-OVERVIEW] Error fetching team:', teamPath, error);
      }
    });

    await Promise.all(teamPromises);

    // Update ridersMap with team names
    riderTeamRefs.forEach((teamRef, riderId) => {
      const riderData = ridersMap.get(riderId);
      if (riderData && teamRef.path) {
        riderData.team = teamsData.get(teamRef.path) || '';
      }
    });

    console.log('[TEAMS-OVERVIEW] Total riders in map:', ridersMap.size);
    console.log('[TEAMS-OVERVIEW] Total teams resolved:', teamsData.size);

    // Create a map of userId -> riders, with deduplication
    const teamsMap = new Map<string, any[]>();
    const userRiderTracker = new Map<string, Set<string>>(); // Track unique riderNameId per user

    playerTeamsSnapshot.forEach(doc => {
      const team: DocumentData = doc.data();
      const userId = team.userId;
      const riderNameId = team.riderNameId;

      // Initialize user's rider tracker if not exists
      if (!userRiderTracker.has(userId)) {
        userRiderTracker.set(userId, new Set());
      }

      // Skip if this rider is already added for this user
      if (userRiderTracker.get(userId)!.has(riderNameId)) {
        console.log(`[TEAMS-OVERVIEW] Skipping duplicate rider ${riderNameId} for user ${userId}`);
        return;
      }

      // Mark this rider as added for this user
      userRiderTracker.get(userId)!.add(riderNameId);

      if (!teamsMap.has(userId)) {
        teamsMap.set(userId, []);
      }

      // Get rider info from rankings if not in playerTeams
      const riderInfo = ridersMap.get(team.riderNameId);
      const riderTeam = team.riderTeam || riderInfo?.team || '';
      const riderCountry = team.riderCountry || riderInfo?.country || '';
      const baseValue = riderInfo?.points || 0;
      const pricePaid = team.pricePaid || 0;

      // Calculate percentage difference (how much more expensive than base value)
      const percentageDiff = baseValue > 0
        ? Math.round(((pricePaid - baseValue) / baseValue) * 100)
        : 0;

      // Debug first rider
      if (!teamsMap.has(userId) || teamsMap.get(userId)?.length === 0) {
        console.log('[TEAMS-OVERVIEW] First rider lookup:', {
          riderNameId: team.riderNameId,
          foundInMap: !!riderInfo,
          riderInfo,
          finalTeam: riderTeam,
          finalCountry: riderCountry,
          baseValue,
          pricePaid,
          percentageDiff
        });
      }

      // Use pointsScored as the source of truth
      let riderPoints = team.pointsScored ?? 0;

      if (gameData?.config?.gameType === 'marginal-gains') {
        riderPoints = (-team.spentBudget) + riderPoints
      }


      teamsMap.get(userId)?.push({
        riderId: doc.id,
        riderNameId: team.riderNameId,
        riderName: team.riderName,
        riderTeam,
        riderCountry,
        baseValue,
        pricePaid,
        percentageDiff,
        pointsScored: riderPoints,
        // Include pointsBreakdown for detailed views
        pointsBreakdown: team.pointsBreakdown || [],
        bidAt: bidsMap.get(`${userId}_${team.riderNameId}`) || (() => {
        // Fallback to acquiredAt if no bid found
        if (!team.acquiredAt) return null;
        if (typeof team.acquiredAt === 'object' && team.acquiredAt._seconds) {
          return new Date(team.acquiredAt._seconds * 1000 + (team.acquiredAt._nanoseconds || 0) / 1000000).toISOString();
        } else if (team.acquiredAt.toDate) {
          return team.acquiredAt.toDate().toISOString();
        } else {
          return team.acquiredAt;
        }
      })(),
        acquisitionType: team.acquisitionType || 'auction'
      });
    });

    // Combine participants with their teams and calculate points
    const teams = participantsSnapshot.docs.map((doc) => {
      const participant = doc.data();
      const userId = participant.userId;
      const riders = teamsMap.get(userId) || [];

      // Sort riders by price paid (highest first)
      riders.sort((a, b) => (b.pricePaid || 0) - (a.pricePaid || 0));

      // Calculate team totals
      const totalBaseValue = riders.reduce((sum, r) => sum + (r.baseValue || 0), 0);
      const totalSpent = riders.reduce((sum, r) => sum + (r.pricePaid || 0), 0);
      const totalDifference = totalSpent - totalBaseValue;
      const totalPercentageDiff = totalBaseValue > 0
        ? Math.round((totalDifference / totalBaseValue) * 100)
        : 0;

      // Calculate totalPoints from riders' pointsScored
      let calculatedTotalPoints = riders.reduce((sum, r) => sum + (r.pointsScored ?? 0), 0);

      if (gameData?.gameType === 'marginal-gains') {
        calculatedTotalPoints = (-participant.spentBudget) + calculatedTotalPoints;
      }

      // For full-grid, use participant totalPoints as source of truth
      if (gameData?.gameType === 'full-grid') {
        calculatedTotalPoints = participant.totalPoints || 0;
      }

      return {
        participantId: doc.id,
        userId,
        playername: participant.playername,
        eligibleForPrizes: gameData?.gameType === 'full-grid'
          ? (participant.eligibleForPrizes ?? true)
          : participant.eligibleForPrizes,
        budget: participant.budget || 0,
        spentBudget: participant.spentBudget || 0,
        remainingBudget: (participant.budget || 0) - (participant.spentBudget || 0),
        rosterSize: participant.rosterSize || 0,
        rosterComplete: participant.rosterComplete || false,
        totalPoints: calculatedTotalPoints,
        ranking: 0, // Will be calculated below
        riders,
        totalRiders: riders.length,
        totalBaseValue,
        totalSpent,
        totalDifference,
        totalPercentageDiff,
        averagePrice: riders.length > 0
          ? Math.round(riders.reduce((sum, r) => sum + (r.pricePaid || 0), 0) / riders.length)
          : 0
      };
    });

    // Sort teams by calculated totalPoints (descending), then by playername
    teams.sort((a: { totalPoints: number; playername: string }, b: { totalPoints: number; playername: string }) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return (a.playername || '').localeCompare(b.playername || '');
    });

    // Calculate proper rankings based on totalPoints
    // Teams with the same points get the same ranking
    let currentRank = 1;
    let previousPoints = -1;
    teams.forEach((team: { totalPoints: number; ranking: number }, index: number) => {
      if (team.totalPoints !== previousPoints) {
        currentRank = index + 1;
        previousPoints = team.totalPoints;
      }
      team.ranking = currentRank;
    });

    return NextResponse.json({ teams });

  } catch (error) {
    console.error('Error fetching teams overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams overview' },
      { status: 500 }
    );
  }
}
