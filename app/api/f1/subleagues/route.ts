import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { F1SubLeague, F1Participant, F1_COLLECTIONS, createParticipantDocId } from '@/app/f1/types';
import { cookies } from 'next/headers';

const db = getServerFirebase();
const f1Db = getServerFirebaseF1();

// Helper to get current user ID from session cookie or Authorization header
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  try {
    const auth = getServerAuth();
    
    // First try Authorization header (ID token)
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

// Generate a random code for the sub-league
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/f1/subleagues - Get sub-leagues
// ?my=true - Get user's sub-leagues (default)
// ?public=true - Get all public sub-leagues
// ?all=true - Get all sub-leagues user has access to (member + public)
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const showPublic = searchParams.get('public') === 'true';
    const showAll = searchParams.get('all') === 'true';

    let subLeagues: F1SubLeague[] = [];

    if (showPublic) {
      // Get all public sub-leagues
      const publicSnapshot = await f1Db
        .collection(F1_COLLECTIONS.SUB_LEAGUES)
        .where('isPublic', '==', true)
        .where('season', '==', 2026)
        .get();

      subLeagues = publicSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as F1SubLeague[];
    } else if (showAll) {
      // Get user's sub-leagues AND public sub-leagues
      const [memberSnapshot, publicSnapshot] = await Promise.all([
        f1Db
          .collection(F1_COLLECTIONS.SUB_LEAGUES)
          .where('memberIds', 'array-contains', userId)
          .get(),
        f1Db
          .collection(F1_COLLECTIONS.SUB_LEAGUES)
          .where('isPublic', '==', true)
          .where('season', '==', 2026)
          .get(),
      ]);

      const memberLeagues = memberSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as F1SubLeague[];

      const publicLeagues = publicSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as F1SubLeague[];

      // Merge and dedupe
      const leagueMap = new Map<string, F1SubLeague>();
      [...memberLeagues, ...publicLeagues].forEach(league => {
        if (league.id) leagueMap.set(league.id, league);
      });
      subLeagues = Array.from(leagueMap.values());
    } else {
      // Default: Get only user's sub-leagues
      const snapshot = await f1Db
        .collection(F1_COLLECTIONS.SUB_LEAGUES)
        .where('memberIds', 'array-contains', userId)
        .get();

      subLeagues = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as F1SubLeague[];
    }

    return NextResponse.json({ success: true, data: subLeagues });
  } catch (error) {
    console.error('Error fetching sub-leagues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sub-leagues' },
      { status: 500 }
    );
  }
}

// POST /api/f1/subleagues - Create a new sub-league
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, isPublic = false, description } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await f1Db
        .collection(F1_COLLECTIONS.SUB_LEAGUES)
        .where('code', '==', code)
        .get();
      if (existing.empty) break;
      code = generateCode();
      attempts++;
    }

    const now = new Date();
    const subLeagueData: Omit<F1SubLeague, 'id'> = {
      name: name.trim(),
      code,
      description: description?.trim() || '',
      createdBy: userId,
      memberIds: [userId],
      pendingMemberIds: [],
      season: 2026,
      isPublic: Boolean(isPublic),
      maxMembers: 50,
      createdAt: now as unknown as import('firebase/firestore').Timestamp,
      updatedAt: now as unknown as import('firebase/firestore').Timestamp,
    };

    const docRef = await f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).add(subLeagueData);

    // Automatically register creator as participant if not already
    const participantDocId = createParticipantDocId(userId, 2026);
    const participantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

    let becameParticipant = false;
    if (!participantDoc.exists) {
      // Get user info from default database
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const userDisplayName = userData?.name || userData?.displayName || 'Anonymous';

      // Create participant
      const participantData: Omit<F1Participant, 'id'> = {
        userId,
        gameId: `f1-prediction-2026`,
        season: 2026,
        displayName: userDisplayName,
        joinedAt: now as unknown as import('firebase/firestore').Timestamp,
        status: 'active',
      };

      await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).set(participantData);
      becameParticipant = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: docRef.id,
        ...subLeagueData,
        becameParticipant,
      },
    });
  } catch (error) {
    console.error('Error creating sub-league:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create sub-league' },
      { status: 500 }
    );
  }
}

// PUT /api/f1/subleagues - Join a sub-league by code
export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || code.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    // Find sub-league by code
    const snapshot = await f1Db
      .collection(F1_COLLECTIONS.SUB_LEAGUES)
      .where('code', '==', code.trim().toUpperCase())
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Poule niet gevonden met deze code' },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const subLeague = doc.data() as F1SubLeague;

    // Check if already a member
    if (subLeague.memberIds.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Je bent al lid van deze poule' },
        { status: 400 }
      );
    }

    // Add user to members
    await doc.ref.update({
      memberIds: [...subLeague.memberIds, userId],
      updatedAt: new Date(),
    });

    // Automatically register user as participant if not already
    const participantDocId = createParticipantDocId(userId, subLeague.season);
    const participantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

    let becameParticipant = false;
    if (!participantDoc.exists) {
      // Get user info from default database
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const userDisplayName = userData?.name || userData?.displayName || 'Anonymous';

      // Create participant
      const now = new Date();
      const participantData: Omit<F1Participant, 'id'> = {
        userId,
        gameId: subLeague.gameId || `f1-prediction-${subLeague.season}`,
        season: subLeague.season,
        displayName: userDisplayName,
        joinedAt: now as unknown as import('firebase/firestore').Timestamp,
        status: 'active',
      };

      await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).set(participantData);
      becameParticipant = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        name: subLeague.name,
        becameParticipant,
      },
    });
  } catch (error) {
    console.error('Error joining sub-league:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join sub-league' },
      { status: 500 }
    );
  }
}
