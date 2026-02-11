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

// Helper to get user display name
async function getUserDisplayName(userId: string): Promise<string> {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  return userData?.playername || userData?.name || userData?.displayName || 'Anonymous';
}

// GET /api/f1/subleagues/[id] - Get a specific sub-league
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Poule niet gevonden' },
        { status: 404 }
      );
    }

    const subLeague = { id: doc.id, ...doc.data() } as F1SubLeague;

    return NextResponse.json({ success: true, data: subLeague });
  } catch (error) {
    console.error('Error fetching sub-league:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sub-league' },
      { status: 500 }
    );
  }
}

// PATCH /api/f1/subleagues/[id] - Update sub-league settings (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, isPublic, maxMembers } = body;

    const doc = await f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Poule niet gevonden' },
        { status: 404 }
      );
    }

    const subLeague = doc.data() as F1SubLeague;

    // Check if user is admin (creator)
    if (subLeague.createdBy !== userId) {
      return NextResponse.json(
        { success: false, error: 'Je bent niet de beheerder van deze poule' },
        { status: 403 }
      );
    }

    // Build update object
    const updates: Partial<F1SubLeague> = {
      updatedAt: new Date() as unknown as import('firebase/firestore').Timestamp,
    };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);
    if (maxMembers !== undefined) updates.maxMembers = Number(maxMembers);

    await doc.ref.update(updates);

    return NextResponse.json({
      success: true,
      data: { id: doc.id, ...subLeague, ...updates },
    });
  } catch (error) {
    console.error('Error updating sub-league:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sub-league' },
      { status: 500 }
    );
  }
}

// POST /api/f1/subleagues/[id] - Actions: request, approve, reject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, targetUserId } = body;

    const doc = await f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Poule niet gevonden' },
        { status: 404 }
      );
    }

    const subLeague = doc.data() as F1SubLeague;
    const now = new Date();

    switch (action) {
      case 'request': {
        // User requests to join a public sub-league
        if (!subLeague.isPublic) {
          return NextResponse.json(
            { success: false, error: 'Deze poule is niet publiek. Gebruik een code om deel te nemen.' },
            { status: 400 }
          );
        }

        if (subLeague.memberIds.includes(userId)) {
          return NextResponse.json(
            { success: false, error: 'Je bent al lid van deze poule' },
            { status: 400 }
          );
        }

        if (subLeague.pendingMemberIds?.includes(userId)) {
          return NextResponse.json(
            { success: false, error: 'Je hebt al een aanvraag ingediend voor deze poule' },
            { status: 400 }
          );
        }

        if (subLeague.memberIds.length >= subLeague.maxMembers) {
          return NextResponse.json(
            { success: false, error: 'Deze poule zit vol' },
            { status: 400 }
          );
        }

        // Add to pending members
        await doc.ref.update({
          pendingMemberIds: [...(subLeague.pendingMemberIds || []), userId],
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          message: 'Aanvraag verstuurd! De beheerder zal je verzoek beoordelen.',
        });
      }

      case 'cancel': {
        // User cancels their own join request
        if (!subLeague.pendingMemberIds?.includes(userId)) {
          return NextResponse.json(
            { success: false, error: 'Je hebt geen openstaande aanvraag voor deze poule' },
            { status: 400 }
          );
        }

        await doc.ref.update({
          pendingMemberIds: subLeague.pendingMemberIds.filter(id => id !== userId),
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          message: 'Aanvraag geannuleerd',
        });
      }

      case 'approve': {
        // Admin approves a join request
        if (subLeague.createdBy !== userId) {
          return NextResponse.json(
            { success: false, error: 'Je bent niet de beheerder van deze poule' },
            { status: 403 }
          );
        }

        if (!targetUserId) {
          return NextResponse.json(
            { success: false, error: 'targetUserId is required' },
            { status: 400 }
          );
        }

        if (!subLeague.pendingMemberIds?.includes(targetUserId)) {
          return NextResponse.json(
            { success: false, error: 'Deze gebruiker heeft geen openstaande aanvraag' },
            { status: 400 }
          );
        }

        if (subLeague.memberIds.includes(targetUserId)) {
          return NextResponse.json(
            { success: false, error: 'Deze gebruiker is al lid' },
            { status: 400 }
          );
        }

        // Move from pending to members
        await doc.ref.update({
          memberIds: [...subLeague.memberIds, targetUserId],
          pendingMemberIds: subLeague.pendingMemberIds.filter(id => id !== targetUserId),
          updatedAt: now,
        });

        // Automatically register user as F1 participant if not already
        const participantDocId = createParticipantDocId(targetUserId, subLeague.season);
        const participantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

        if (!participantDoc.exists) {
          const displayName = await getUserDisplayName(targetUserId);
          const participantData: Omit<F1Participant, 'id'> = {
            userId: targetUserId,
            gameId: subLeague.gameId || `f1-prediction-${subLeague.season}`,
            season: subLeague.season,
            displayName,
            joinedAt: now as unknown as import('firebase/firestore').Timestamp,
            status: 'active',
          };
          await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).set(participantData);
        }

        return NextResponse.json({
          success: true,
          message: 'Gebruiker is toegevoegd aan de poule',
        });
      }

      case 'reject': {
        // Admin rejects a join request
        if (subLeague.createdBy !== userId) {
          return NextResponse.json(
            { success: false, error: 'Je bent niet de beheerder van deze poule' },
            { status: 403 }
          );
        }

        if (!targetUserId) {
          return NextResponse.json(
            { success: false, error: 'targetUserId is required' },
            { status: 400 }
          );
        }

        if (!subLeague.pendingMemberIds?.includes(targetUserId)) {
          return NextResponse.json(
            { success: false, error: 'Deze gebruiker heeft geen openstaande aanvraag' },
            { status: 400 }
          );
        }

        // Remove from pending
        await doc.ref.update({
          pendingMemberIds: subLeague.pendingMemberIds.filter(id => id !== targetUserId),
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          message: 'Aanvraag afgewezen',
        });
      }

      case 'remove': {
        // Admin removes a member
        if (subLeague.createdBy !== userId) {
          return NextResponse.json(
            { success: false, error: 'Je bent niet de beheerder van deze poule' },
            { status: 403 }
          );
        }

        if (!targetUserId) {
          return NextResponse.json(
            { success: false, error: 'targetUserId is required' },
            { status: 400 }
          );
        }

        if (targetUserId === subLeague.createdBy) {
          return NextResponse.json(
            { success: false, error: 'Je kunt jezelf niet verwijderen als beheerder' },
            { status: 400 }
          );
        }

        if (!subLeague.memberIds.includes(targetUserId)) {
          return NextResponse.json(
            { success: false, error: 'Deze gebruiker is geen lid' },
            { status: 400 }
          );
        }

        await doc.ref.update({
          memberIds: subLeague.memberIds.filter(id => id !== targetUserId),
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          message: 'Gebruiker is verwijderd uit de poule',
        });
      }

      case 'leave': {
        // User leaves the sub-league
        if (!subLeague.memberIds.includes(userId)) {
          return NextResponse.json(
            { success: false, error: 'Je bent geen lid van deze poule' },
            { status: 400 }
          );
        }

        if (userId === subLeague.createdBy) {
          return NextResponse.json(
            { success: false, error: 'De beheerder kan de poule niet verlaten. Draag eerst het beheer over of verwijder de poule.' },
            { status: 400 }
          );
        }

        await doc.ref.update({
          memberIds: subLeague.memberIds.filter(id => id !== userId),
          updatedAt: now,
        });

        return NextResponse.json({
          success: true,
          message: 'Je hebt de poule verlaten',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error with sub-league action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}

// DELETE /api/f1/subleagues/[id] - Delete sub-league (creator only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const docRef = f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Poule niet gevonden' },
        { status: 404 }
      );
    }

    const subLeague = doc.data() as F1SubLeague;

    if (subLeague.createdBy !== userId) {
      return NextResponse.json(
        { success: false, error: 'Je bent niet de beheerder van deze poule' },
        { status: 403 }
      );
    }

    await docRef.delete();

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting sub-league:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete sub-league' },
      { status: 500 }
    );
  }
}
