import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { F1Prediction, F1ActivityLog, F1_COLLECTIONS, createPredictionDocId, createRaceDocId, createParticipantDocId } from '../../types';
import { Timestamp } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';

const f1Db = getServerFirebaseF1();

type PredictionSnapshot = {
  finishOrder: string[];
  polePosition: string | null;
  fastestLap: string | null;
  dnf1: string | null;
  dnf2: string | null;
};

function toPredictionSnapshot(data: {
  finishOrder: string[];
  polePosition: string | null;
  fastestLap: string | null;
  dnf1: string | null;
  dnf2: string | null;
}): PredictionSnapshot {
  return {
    finishOrder: data.finishOrder,
    polePosition: data.polePosition,
    fastestLap: data.fastestLap,
    dnf1: data.dnf1,
    dnf2: data.dnf2,
  };
}

// Helper to get current user ID from Authorization header or session cookie
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  try {
    const auth = getServerAuth();

    // First try Authorization header (ID token)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.substring(7);
      if (idToken) {
        const decoded = await auth.verifyIdToken(idToken);
        return decoded.uid;
      }
    }

    // Fallback to session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

// GET /api/f1/predictions?season=2026&round=1 (own prediction)
// GET /api/f1/predictions?season=2026&round=1&all=true (all predictions after deadline)
// GET /api/f1/predictions?userId=xxx&round=1 (specific user's prediction, only if race is done)
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());
    const round = searchParams.get('round');
    const all = searchParams.get('all') === 'true';
    const targetUserId = searchParams.get('userId');

    const predictionsRef = f1Db.collection(F1_COLLECTIONS.PREDICTIONS);

    if (round) {
      const roundNum = parseInt(round);
      const raceId = createRaceDocId(season, roundNum);
      
      // If requesting another user's prediction, check if race is done
      if (targetUserId && targetUserId !== currentUserId) {
        const raceDoc = await f1Db.collection(F1_COLLECTIONS.RACES).doc(raceId).get();
        const raceData = raceDoc.data();

        if (!raceData || raceData.status !== 'done') {
          return NextResponse.json(
            { success: false, error: 'Race not finished yet' },
            { status: 403 }
          );
        }

        // Get the specific user's prediction
        const docId = createPredictionDocId(targetUserId, season, roundNum);
        const doc = await predictionsRef.doc(docId).get();

        if (!doc.exists) {
          return NextResponse.json({ success: true, data: null });
        }

        return NextResponse.json({ success: true, data: doc.data() as F1Prediction });
      }
      
      // Get prediction for specific race
      if (all) {
        // Get all predictions for this race (only if race is done)
        const raceDoc = await f1Db.collection(F1_COLLECTIONS.RACES).doc(raceId).get();
        const raceData = raceDoc.data();

        if (!raceData || raceData.status !== 'done') {
          return NextResponse.json(
            { success: false, error: 'Race not finished yet' },
            { status: 403 }
          );
        }

        const snapshot = await predictionsRef.where('raceId', '==', raceId).get();
        const predictions = snapshot.docs.map(doc => doc.data() as F1Prediction);
        return NextResponse.json({ success: true, data: predictions });
      } else {
        // Get own prediction - requires auth
        if (!currentUserId) {
          return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
          );
        }
        
        const docId = createPredictionDocId(currentUserId, season, roundNum);
        const doc = await predictionsRef.doc(docId).get();

        if (!doc.exists) {
          return NextResponse.json({ success: true, data: null });
        }

        return NextResponse.json({ success: true, data: doc.data() as F1Prediction });
      }
    } else {
      // Get all predictions for a season.
      // Own predictions: all races.
      // Other user's predictions: only races that are already done.
      if (!currentUserId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const requestedUserId = targetUserId || currentUserId;
      const snapshot = await predictionsRef
        .where('userId', '==', requestedUserId)
        .get();

      let predictions = snapshot.docs
        .map(doc => doc.data() as F1Prediction)
        .filter((prediction) =>
          prediction.season === season ||
          prediction.raceId?.startsWith(`${season}_`)
        );

      if (requestedUserId !== currentUserId) {
        const racesSnapshot = await f1Db
          .collection(F1_COLLECTIONS.RACES)
          .where('season', '==', season)
          .where('status', '==', 'done')
          .get();

        const doneRaceIds = new Set(racesSnapshot.docs.map((doc) => doc.id));
        predictions = predictions.filter((prediction) => doneRaceIds.has(prediction.raceId));
      }

      return NextResponse.json({ success: true, data: predictions });
    }
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

// POST /api/f1/predictions
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prediction } = body as { prediction: Omit<F1Prediction, 'userId' | 'submittedAt' | 'updatedAt'> };

    if (!prediction || !prediction.season || prediction.round === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required prediction fields' },
        { status: 400 }
      );
    }

    // Check if user is a registered participant for this season
    const participantDocId = createParticipantDocId(userId, prediction.season);
    const participantDoc = await f1Db.collection(F1_COLLECTIONS.PARTICIPANTS).doc(participantDocId).get();

    if (!participantDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Je moet je eerst aanmelden voor F1 ' + prediction.season + ' voordat je kunt voorspellen',
          requiresRegistration: true
        },
        { status: 403 }
      );
    }

    // Check if race is still open for predictions
    const raceId = createRaceDocId(prediction.season, prediction.round);
    const raceDoc = await f1Db.collection(F1_COLLECTIONS.RACES).doc(raceId).get();
    const raceData = raceDoc.data();

    if (!raceData) {
      return NextResponse.json(
        { success: false, error: 'Race not found' },
        { status: 404 }
      );
    }

    if (raceData.status === 'done') {
      return NextResponse.json(
        { success: false, error: 'Race already finished' },
        { status: 403 }
      );
    }

    // Check prediction deadline if set
    if (raceData.predictionDeadline && new Date() > raceData.predictionDeadline.toDate()) {
      return NextResponse.json(
        { success: false, error: 'Prediction deadline passed' },
        { status: 403 }
      );
    }

    // Validate prediction has up to 10 drivers (allow partial predictions)
    if (!prediction.finishOrder || prediction.finishOrder.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Prediction can have maximum 10 drivers' },
        { status: 400 }
      );
    }

    const docId = createPredictionDocId(userId, prediction.season, prediction.round);
    const docRef = f1Db.collection(F1_COLLECTIONS.PREDICTIONS).doc(docId);
    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() as F1Prediction : null;
    const isUpdate = existingDoc.exists;

    const now = new Date();
    const nowTs = Timestamp.fromDate(now);
    const previousSnapshot = existingData
      ? toPredictionSnapshot({
          finishOrder: existingData.finishOrder,
          polePosition: existingData.polePosition,
          fastestLap: existingData.fastestLap,
          dnf1: existingData.dnf1,
          dnf2: existingData.dnf2,
        })
      : null;
    const nextSnapshot = toPredictionSnapshot({
      finishOrder: prediction.finishOrder,
      polePosition: prediction.polePosition,
      fastestLap: prediction.fastestLap,
      dnf1: prediction.dnf1,
      dnf2: prediction.dnf2,
    });

    const predictionData = {
      ...prediction,
      userId,
      raceId,
      isLocked: false,
      updatedAt: now,
      ...(isUpdate ? {} : { submittedAt: now }),
    };

    // Write prediction + immutable history + activity log atomically.
    const batch = f1Db.batch();
    batch.set(docRef, predictionData, { merge: true });

    const revisionRef = docRef.collection('history').doc();
    batch.set(revisionRef, {
      userId,
      season: prediction.season,
      round: prediction.round,
      raceId,
      operation: isUpdate ? 'update' : 'create',
      source: 'api',
      before: previousSnapshot,
      after: nextSnapshot,
      createdAt: nowTs,
      raceStatusAtSave: raceData.status || null,
      predictionDeadlineAtSave: raceData.predictionDeadline || null,
    });

    const activityLog: Omit<F1ActivityLog, 'id'> = {
      userId,
      season: prediction.season,
      activityType: isUpdate ? 'prediction_updated' : 'prediction_saved',
      timestamp: nowTs as unknown as import('firebase/firestore').Timestamp,
      round: prediction.round,
      raceId,
      prediction: nextSnapshot,
      isUpdate,
      ...(isUpdate && previousSnapshot ? { previousPrediction: previousSnapshot } : {}),
    };
    const activityRef = f1Db.collection(F1_COLLECTIONS.ACTIVITY_LOGS).doc();
    batch.set(activityRef, {
      ...activityLog,
      revisionId: revisionRef.id,
    });

    await batch.commit();

    return NextResponse.json({ success: true, data: { id: docId } });
  } catch (error) {
    console.error('Error saving prediction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}
