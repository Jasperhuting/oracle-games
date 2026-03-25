import { userHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase, getServerFirebaseF1 } from '@/lib/firebase/server';
import { F1Participant, F1_COLLECTIONS, createParticipantDocId } from '@/app/f1/types';

const db = getServerFirebase();
const f1Db = getServerFirebaseF1();

// GET /api/f1/join?season=2026 - Check if user is registered for F1 season
export const GET = userHandler('f1-join-check', async ({ uid, request }) => {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '2026');

  // Check if user is already a participant
  const participantDocId = createParticipantDocId(uid, season);
  const participantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

  if (participantDoc.exists) {
    const participant = participantDoc.data() as F1Participant;
    return {
      success: true,
      isParticipant: true,
      participant: {
        ...participant,
        id: participantDoc.id,
        joinedAt: participant.joinedAt?.toDate?.()?.toISOString() || participant.joinedAt,
      },
    };
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

  return {
    success: true,
    isParticipant: false,
    registrationOpen,
    gameId,
  };
});

// POST /api/f1/join - Register user for F1 season
export const POST = userHandler('f1-join', async ({ uid, request }) => {
  const body = await request.json();
  const { season = 2026, displayName } = body;

  // Check if user is already a participant
  const participantDocId = createParticipantDocId(uid, season);
  const existingParticipant = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

  if (existingParticipant.exists) {
    throw new ApiError('Je bent al geregistreerd voor F1 ' + season, 400);
  }

  // Get user info from default database
  const userDoc = await db.collection('users').doc(uid).get();
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
      throw new ApiError('Registratie is gesloten voor dit seizoen', 400);
    }

    // Check registration deadline
    if (game.config?.registrationDeadline) {
      const deadline = new Date(game.config.registrationDeadline);
      if (new Date() > deadline) {
        throw new ApiError('Registratie deadline is verstreken', 400);
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
        throw new ApiError('Maximum aantal deelnemers bereikt', 400);
      }
    }
  }

  // Create participant in F1 database
  const now = new Date();
  const participantData: Omit<F1Participant, 'id'> = {
    userId: uid,
    gameId,
    season,
    displayName: userDisplayName,
    joinedAt: now as unknown as import('firebase/firestore').Timestamp,
    status: 'active',
  };

  await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).set(participantData);

  return {
    success: true,
    data: {
      id: participantDocId,
      ...participantData,
      joinedAt: now.toISOString(),
    },
  };
});
