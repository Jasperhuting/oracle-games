import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

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

    const gameData = gameDoc.data();
    const riderValues = gameData?.config?.riderValues || {};

    // Get all participants for this game
    const participantsSnapshot = await db
      .collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    if (participantsSnapshot.empty) {
      return NextResponse.json({ teams: [] });
    }

    // Sort participants by total points (descending), then by playername
    const sortedDocs = participantsSnapshot.docs.sort((a, b) => {
      const dataA = a.data();
      const dataB = b.data();
      const pointsA = dataA.totalPoints || 0;
      const pointsB = dataB.totalPoints || 0;

      // First sort by points (highest first)
      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }

      // If points are equal, sort by playername alphabetically
      return (dataA.playername || '').localeCompare(dataB.playername || '');
    });

    // Get all player teams for this game
    const playerTeamsSnapshot = await db
      .collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('active', '==', true)
      .get();

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

    // Create a map of userId -> riders
    const teamsMap = new Map<string, any[]>();

    playerTeamsSnapshot.forEach(doc => {
      const team = doc.data();
      const userId = team.userId;

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
      if (teamsMap.size === 0 && teamsMap.get(userId)?.length === 0) {
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

      teamsMap.get(userId)?.push({
        riderId: doc.id,
        riderNameId: team.riderNameId,
        riderName: team.riderName,
        riderTeam,
        riderCountry,
        baseValue,
        pricePaid,
        percentageDiff,
        pointsScored: team.pointsScored || 0,
        acquiredAt: team.acquiredAt,
        acquisitionType: team.acquisitionType || 'auction'
      });
    });

    // Combine participants with their teams and calculate rankings
    const teams = sortedDocs.map((doc) => {
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

      return {
        participantId: doc.id,
        userId,
        playername: participant.playername,
        budget: participant.budget || 0,
        spentBudget: participant.spentBudget || 0,
        remainingBudget: (participant.budget || 0) - (participant.spentBudget || 0),
        rosterSize: participant.rosterSize || 0,
        rosterComplete: participant.rosterComplete || false,
        totalPoints: participant.totalPoints || 0,
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

    // Calculate proper rankings based on totalPoints
    // Teams with the same points get the same ranking
    let currentRank = 1;
    let previousPoints = -1;
    teams.forEach((team, index) => {
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
