import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { F1SubLeague, F1_COLLECTIONS } from '@/app/f1/types';
import { cookies } from 'next/headers';

const f1Db = getServerFirebaseF1();

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    const auth = getServerAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch {
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

// GET /api/f1/subleagues - Get user's sub-leagues
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const snapshot = await f1Db
      .collection(F1_COLLECTIONS.SUB_LEAGUES)
      .where('memberIds', 'array-contains', userId)
      .get();

    const subLeagues = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as F1SubLeague[];

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
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

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
      createdBy: userId,
      memberIds: [userId],
      season: 2026,
      isPublic: false,
      maxMembers: 50,
      createdAt: now as unknown as import('firebase/firestore').Timestamp,
      updatedAt: now as unknown as import('firebase/firestore').Timestamp,
    };

    const docRef = await f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).add(subLeagueData);

    return NextResponse.json({
      success: true,
      data: {
        id: docRef.id,
        ...subLeagueData,
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
    const userId = await getCurrentUserId();
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

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        name: subLeague.name,
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
