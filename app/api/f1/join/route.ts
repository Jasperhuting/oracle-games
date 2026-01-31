import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { F1Participant, F1_COLLECTIONS, createParticipantDocId } from '@/app/f1/types';
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

// GET /api/f1/join?season=2026 - Check if user is registered for F1 season
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', isParticipant: false },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || '2026');

    // Check if user is already a participant
    const participantDocId = createParticipantDocId(userId, season);
    const participantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

    if (participantDoc.exists) {
      const participant = participantDoc.data() as F1Participant;
      return NextResponse.json({
        success: true,
        isParticipant: true,
        participant: {
          ...participant,
          id: participantDoc.id,
          joinedAt: participant.joinedAt?.toDate?.()?.toISOString() || participant.joinedAt,
        },
      });
    }

    // Check if there's an F1 game for this season and if registration is open
    const gamesSnapshot = await db.collection('games')
      .where('gameType', '==', 'f1-prediction')
      .where('year', '==', season)
      .limit(1)
      .get();

    let registrationOpen = true;
    let gameId: string | null = null;

    if (!gamesSnapshot.empty) {
      const gameDoc = gamesSnapshot.docs[0];
      const game = gameDoc.data();
      gameId = gameDoc.id;

      // Check registration status
      if (game.status === 'finished') {
        registrationOpen = false;
      }

      // Check registration deadline if set
      if (game.config?.registrationDeadline) {
        const deadline = new Date(game.config.registrationDeadline);
        if (new Date() > deadline) {
          registrationOpen = false;
        }
      }

      // Check max participants
      if (game.config?.maxParticipants) {
        const participantsCount = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS)
          .where('season', '==', season)
          .where('status', '==', 'active')
          .count()
          .get();

        if (participantsCount.data().count >= game.config.maxParticipants) {
          registrationOpen = false;
        }
      }
    }

    return NextResponse.json({
      success: true,
      isParticipant: false,
      registrationOpen,
      gameId,
    });
  } catch (error) {
    console.error('Error checking F1 participation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check participation status' },
      { status: 500 }
    );
  }
}

// POST /api/f1/join - Register user for F1 season
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
    const { season = 2026, displayName } = body;

    // Check if user is already a participant
    const participantDocId = createParticipantDocId(userId, season);
    const existingParticipant = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

    if (existingParticipant.exists) {
      return NextResponse.json(
        { success: false, error: 'Je bent al geregistreerd voor F1 ' + season },
        { status: 400 }
      );
    }

    // Get user info from default database
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userDisplayName = displayName || userData?.name || userData?.displayName || 'Anonymous';

    // Find or verify F1 game exists
    const gamesSnapshot = await db.collection('games')
      .where('gameType', '==', 'f1-prediction')
      .where('year', '==', season)
      .limit(1)
      .get();

    let gameId = `f1-prediction-${season}`;

    if (!gamesSnapshot.empty) {
      const gameDoc = gamesSnapshot.docs[0];
      const game = gameDoc.data();
      gameId = gameDoc.id;

      // Check registration status
      if (game.status === 'finished') {
        return NextResponse.json(
          { success: false, error: 'Registratie is gesloten voor dit seizoen' },
          { status: 400 }
        );
      }

      // Check registration deadline
      if (game.config?.registrationDeadline) {
        const deadline = new Date(game.config.registrationDeadline);
        if (new Date() > deadline) {
          return NextResponse.json(
            { success: false, error: 'Registratie deadline is verstreken' },
            { status: 400 }
          );
        }
      }

      // Check max participants
      if (game.config?.maxParticipants) {
        const participantsCount = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS)
          .where('season', '==', season)
          .where('status', '==', 'active')
          .count()
          .get();

        if (participantsCount.data().count >= game.config.maxParticipants) {
          return NextResponse.json(
            { success: false, error: 'Maximum aantal deelnemers bereikt' },
            { status: 400 }
          );
        }
      }
    }

    // Create participant in F1 database
    const now = new Date();
    const participantData: Omit<F1Participant, 'id'> = {
      userId,
      gameId,
      season,
      displayName: userDisplayName,
      joinedAt: now as unknown as import('firebase/firestore').Timestamp,
      status: 'active',
    };

    await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).set(participantData);

    return NextResponse.json({
      success: true,
      data: {
        id: participantDocId,
        ...participantData,
        joinedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error joining F1:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join F1' },
      { status: 500 }
    );
  }
}
