import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { F1Prediction, F1_COLLECTIONS, createPredictionDocId, createRaceDocId } from '../../types';
import { cookies } from 'next/headers';

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

// GET /api/f1/predictions?season=2026&round=1 (own prediction)
// GET /api/f1/predictions?season=2026&round=1&all=true (all predictions after deadline)
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());
    const round = searchParams.get('round');
    const all = searchParams.get('all') === 'true';

    const predictionsRef = f1Db.collection(F1_COLLECTIONS.PREDICTIONS);

    if (round) {
      // Get prediction for specific race
      if (all) {
        // Get all predictions for this race (only if race is done)
        const raceId = createRaceDocId(season, parseInt(round));
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
        // Get own prediction
        const docId = createPredictionDocId(userId, season, parseInt(round));
        const doc = await predictionsRef.doc(docId).get();

        if (!doc.exists) {
          return NextResponse.json({ success: true, data: null });
        }

        return NextResponse.json({ success: true, data: doc.data() as F1Prediction });
      }
    } else {
      // Get all own predictions for season
      const snapshot = await predictionsRef
        .where('userId', '==', userId)
        .where('season', '==', season)
        .get();

      const predictions = snapshot.docs.map(doc => doc.data() as F1Prediction);
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
    const userId = await getUserFromSession();
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

    // Validate prediction has 22 drivers
    if (!prediction.finishOrder || prediction.finishOrder.length !== 22) {
      return NextResponse.json(
        { success: false, error: 'Prediction must have exactly 22 drivers' },
        { status: 400 }
      );
    }

    const docId = createPredictionDocId(userId, prediction.season, prediction.round);
    const docRef = f1Db.collection(F1_COLLECTIONS.PREDICTIONS).doc(docId);
    const existingDoc = await docRef.get();

    const now = new Date();
    const predictionData = {
      ...prediction,
      userId,
      raceId,
      isLocked: false,
      updatedAt: now,
      ...(existingDoc.exists ? {} : { submittedAt: now }),
    };

    await docRef.set(predictionData, { merge: true });

    return NextResponse.json({ success: true, data: { id: docId } });
  } catch (error) {
    console.error('Error saving prediction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save prediction' },
      { status: 500 }
    );
  }
}
