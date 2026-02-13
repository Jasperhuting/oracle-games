import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth, getServerFirebase } from '@/lib/firebase/server';
import { cookies } from 'next/headers';

// Helper to get current user ID from Authorization header or session cookie
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  try {
    const auth = getServerAuth();

    // Try Authorization header (ID token)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.substring(7);
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
      } catch (tokenError) {
        console.error('ID token verification failed:', tokenError);
      }
    }

    // Fallback to session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// GET team details with rider points for a participant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string; participantId: string }> }
) {
  try {
    const { gameId, participantId } = await params;
    const db = getServerFirebase();

    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get game data (needed for gameType-specific scoring)
    const gameDoc = await db.collection('games').doc(gameId).get();
    const gameData = gameDoc.data();
    const gameType = gameData?.gameType ?? gameData?.config?.gameType;
    const isMarginalGains = gameType === 'marginal-gains';
    const isFullGrid = gameType === 'full-grid';

    // Get participant details
    const participantDoc = await db.collection('gameParticipants').doc(participantId).get();
    
    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantData = participantDoc.data();
    
    if (participantData?.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Participant does not belong to this game' },
        { status: 400 }
      );
    }

    // Authorization: only the owner (or admin) can view team details
    if (participantData?.userId !== currentUserId) {
      const currentUserDoc = await db.collection('users').doc(currentUserId).get();
      const currentUserData = currentUserDoc.data();
      const isAdmin = currentUserData?.userType === 'admin';

      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    // Get user details for player name
    const userDoc = await db.collection('users').doc(participantData.userId).get();
    const userData = userDoc.data();

    let riders = [];

    if (isFullGrid) {
      // For Full Grid, selections are stored as bids (active/won)
      const bidsSnapshot = await db.collection('bids')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantData.userId)
        .get();

      const activeOrWonBids = bidsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(bid => bid.status === 'active' || bid.status === 'won');

      // Try to enrich with points from playerTeams if available
      const teamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantData.userId)
        .get();

      const pointsByRiderId = new Map<string, { pointsScored: number; pointsBreakdown?: any[]; jerseyImage?: string; pricePaid?: number }>();
      for (const doc of teamSnapshot.docs) {
        const data = doc.data();
        pointsByRiderId.set(data.riderNameId, {
          pointsScored: data.pointsScored ?? 0,
          pointsBreakdown: data.pointsBreakdown || [],
          jerseyImage: data.jerseyImage,
          pricePaid: data.pricePaid,
        });
      }

      riders = activeOrWonBids.map(bid => {
        const points = pointsByRiderId.get(bid.riderNameId);
        const riderPoints = points?.pointsScored ?? 0;
        return {
          id: bid.id,
          nameId: bid.riderNameId,
          name: bid.riderName,
          team: bid.riderTeam,
          country: bid.riderCountry,
          rank: 0,
          pointsScored: riderPoints,
          points: riderPoints,
          pointsBreakdown: points?.pointsBreakdown || [],
          jerseyImage: points?.jerseyImage || bid.jerseyImage,
          pricePaid: points?.pricePaid ?? bid.amount ?? null,
          acquisitionType: 'selection',
          draftRound: null,
          draftPick: null,
        };
      });
    } else {
      // Default: use playerTeams as source of truth
      const teamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantData.userId)
        .get();

      for (const doc of teamSnapshot.docs) {
        const data = doc.data();

        // Use pointsScored as the source of truth
        const riderPoints = data.pointsScored ?? 0;

        riders.push({
          id: doc.id,
          nameId: data.riderNameId,
          name: data.riderName,
          team: data.riderTeam,
          country: data.riderCountry,
          rank: data.riderRank || 0,
          pointsScored: riderPoints,
          points: riderPoints,
          pointsBreakdown: data.pointsBreakdown || [],
          jerseyImage: data.jerseyImage,
          pricePaid: data.pricePaid,
          acquisitionType: data.acquisitionType,
          draftRound: data.draftRound,
          draftPick: data.draftPick,
        });
      }
    }

    // Sort riders by pointsScored (highest to lowest)
    riders.sort((a, b) => (b.pointsScored || 0) - (a.pointsScored || 0));

    // Calculate team statistics from pointsScored
    const baseTotalPoints = riders.reduce((sum, rider) => sum + (rider.pointsScored || 0), 0);
    const spentBudget = participantData?.spentBudget || 0;
    const totalPoints = isFullGrid
      ? (participantData?.totalPoints || 0)
      : isMarginalGains
        ? (-spentBudget) + baseTotalPoints
        : baseTotalPoints;

    // Calculate actual ranking by comparing with all participants in the game
    // Mirror teams-overview behavior: rank only active participants, sort by points desc then playername,
    // and give equal points the same rank.
    const allParticipantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('status', '==', 'active')
      .get();

    const participantPoints: { id: string; points: number; playername: string }[] = [];
    for (const pDoc of allParticipantsSnapshot.docs) {
      const pData = pDoc.data();
      const pTeamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', pData.userId)
        .get();

      let pTotal = 0;
      if (isFullGrid) {
        pTotal = pData?.totalPoints || 0;
      } else {
        const pBaseTotal = pTeamSnapshot.docs.reduce((sum, tDoc) => {
          const tData = tDoc.data();
          return sum + (tData.totalPoints ?? tData.pointsScored ?? 0);
        }, 0);

        const pSpentBudget = pData?.spentBudget || 0;
        pTotal = isMarginalGains ? (-pSpentBudget) + pBaseTotal : pBaseTotal;
      }

      participantPoints.push({
        id: pDoc.id,
        points: pTotal,
        playername: pData.playername || '',
      });
    }

    participantPoints.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.playername.localeCompare(b.playername);
    });

    let ranking = 0;
    let currentRank = 1;
    let previousPoints: number | null = null;
    for (let index = 0; index < participantPoints.length; index++) {
      const row = participantPoints[index];
      if (previousPoints === null || row.points !== previousPoints) {
        currentRank = index + 1;
        previousPoints = row.points;
      }
      if (row.id === participantId) {
        ranking = currentRank;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      participant: {
        id: participantId,
        userId: participantData.userId,
        playerName: userData?.playername || userData?.email || 'Unknown',
        totalPoints: totalPoints,
        ranking: ranking,
      },
      team: {
        riders,
        totalPoints,
        riderCount: riders.length,
      },
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
