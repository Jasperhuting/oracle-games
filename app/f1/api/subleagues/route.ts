import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { F1SubLeague, F1_COLLECTIONS } from '../../types';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

const f1Db = getServerFirebaseF1();

// Helper to get user from session
async function getUserFromSession(): Promise<string | null> {
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

// Generate unique code
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/f1/subleagues - Get user's subLeagues
// GET /api/f1/subleagues?code=XXX - Find subLeague by code
// GET /api/f1/subleagues?public=true - Get all public subLeagues
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const isPublic = searchParams.get('public') === 'true';

    const subLeaguesRef = f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES);

    if (code) {
      // Find by code
      const snapshot = await subLeaguesRef.where('code', '==', code.toUpperCase()).limit(1).get();

      if (snapshot.empty) {
        return NextResponse.json(
          { success: false, error: 'SubLeague not found' },
          { status: 404 }
        );
      }

      const doc = snapshot.docs[0];
      const subLeague = { id: doc.id, ...doc.data() } as F1SubLeague;

      return NextResponse.json({ success: true, data: subLeague });
    } else if (isPublic) {
      // Get all public subLeagues
      const snapshot = await subLeaguesRef.where('isPublic', '==', true).get();
      const subLeagues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as F1SubLeague));

      return NextResponse.json({ success: true, data: subLeagues });
    } else {
      // Get user's subLeagues (requires auth)
      const userId = await getUserFromSession();
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const snapshot = await subLeaguesRef.where('memberIds', 'array-contains', userId).get();
      const subLeagues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as F1SubLeague));

      return NextResponse.json({ success: true, data: subLeagues });
    }
  } catch (error) {
    console.error('Error fetching subLeagues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subLeagues' },
      { status: 500 }
    );
  }
}

// POST /api/f1/subleagues - Create new subLeague
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, season, isPublic, description } = body as {
      name: string;
      season?: number;
      isPublic?: boolean;
      description?: string;
    };

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    const subLeaguesRef = f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES);

    while (attempts < 10) {
      const existing = await subLeaguesRef.where('code', '==', code).limit(1).get();
      if (existing.empty) break;
      code = generateCode();
      attempts++;
    }

    const now = new Date();
    const subLeague: Omit<F1SubLeague, 'id'> = {
      name: name.trim(),
      code,
      description: description?.trim(),
      season: season || new Date().getFullYear(),
      createdBy: userId,
      memberIds: [userId],
      pendingMemberIds: [],
      isPublic: Boolean(isPublic),
      maxMembers: 50,
      createdAt: now as unknown as import('firebase/firestore').Timestamp,
      updatedAt: now as unknown as import('firebase/firestore').Timestamp,
    };

    const docRef = await subLeaguesRef.add(subLeague);

    return NextResponse.json({
      success: true,
      data: { id: docRef.id, code },
    });
  } catch (error) {
    console.error('Error creating subLeague:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subLeague' },
      { status: 500 }
    );
  }
}

// PUT /api/f1/subleagues - Join subLeague
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body as { code: string };

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    const subLeaguesRef = f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES);
    const snapshot = await subLeaguesRef.where('code', '==', code.toUpperCase()).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'SubLeague not found' },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const subLeague = doc.data() as F1SubLeague;

    // Check if already member
    if (subLeague.memberIds.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Already a member' },
        { status: 400 }
      );
    }

    // Check max members
    if (subLeague.memberIds.length >= subLeague.maxMembers) {
      return NextResponse.json(
        { success: false, error: 'SubLeague is full' },
        { status: 400 }
      );
    }

    // Add user to members
    await doc.ref.update({
      memberIds: FieldValue.arrayUnion(userId),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: { id: doc.id, name: subLeague.name },
    });
  } catch (error) {
    console.error('Error joining subLeague:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join subLeague' },
      { status: 500 }
    );
  }
}

// DELETE /api/f1/subleagues?id=xxx - Leave subLeague
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subLeagueId = searchParams.get('id');

    if (!subLeagueId) {
      return NextResponse.json(
        { success: false, error: 'SubLeague ID is required' },
        { status: 400 }
      );
    }

    const docRef = f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).doc(subLeagueId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'SubLeague not found' },
        { status: 404 }
      );
    }

    const subLeague = doc.data() as F1SubLeague;

    // Check if member
    if (!subLeague.memberIds.includes(userId)) {
      return NextResponse.json(
        { success: false, error: 'Not a member' },
        { status: 400 }
      );
    }

    // If creator and only member, delete the subLeague
    if (subLeague.createdBy === userId && subLeague.memberIds.length === 1) {
      await docRef.delete();
      return NextResponse.json({ success: true, data: { deleted: true } });
    }

    // Otherwise just leave
    await docRef.update({
      memberIds: FieldValue.arrayRemove(userId),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, data: { left: true } });
  } catch (error) {
    console.error('Error leaving subLeague:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to leave subLeague' },
      { status: 500 }
    );
  }
}
