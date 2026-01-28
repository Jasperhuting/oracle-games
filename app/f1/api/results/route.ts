import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { 
  F1RaceResult, 
  F1Prediction, 
  F1Standing, 
  F1PointsHistory,
  F1_COLLECTIONS, 
  createRaceDocId,
  createStandingDocId,
} from '../../types';
import { calculatePredictionPoints } from '../../lib/points';
import { cookies } from 'next/headers';

const f1Db = getServerFirebaseF1();

// Helper to check if user is admin
async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return false;

    const auth = getServerAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    // Check admin status in database
    const adminDoc = await f1Db.collection('admins').doc(decodedToken.uid).get();
    return adminDoc.exists && adminDoc.data()?.isAdmin === true;
  } catch {
    return false;
  }
}

// GET /api/f1/results?season=2026&round=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());
    const round = searchParams.get('round');

    const resultsRef = f1Db.collection(F1_COLLECTIONS.RACE_RESULTS);

    if (round) {
      // Get specific race result
      const docId = createRaceDocId(season, parseInt(round));
      const doc = await resultsRef.doc(docId).get();

      if (!doc.exists) {
        return NextResponse.json({ success: true, data: null });
      }

      return NextResponse.json({ success: true, data: doc.data() as F1RaceResult });
    } else {
      // Get all results for season
      const snapshot = await resultsRef.where('season', '==', season).get();
      const results = snapshot.docs.map(doc => doc.data() as F1RaceResult);

      return NextResponse.json({ success: true, data: results });
    }
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

// POST /api/f1/results (Admin only) - Submit race result and calculate points
export async function POST(request: NextRequest) {
  try {
    // Check admin
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { result } = body as { result: Omit<F1RaceResult, 'createdAt'> };

    if (!result || !result.season || result.round === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required result fields' },
        { status: 400 }
      );
    }

    if (!result.finishOrder || result.finishOrder.length !== 22) {
      return NextResponse.json(
        { success: false, error: 'Result must have exactly 22 drivers' },
        { status: 400 }
      );
    }

    const raceId = createRaceDocId(result.season, result.round);
    const now = new Date();

    // Save the result
    const resultData: F1RaceResult = {
      ...result,
      raceId,
      publishedAt: now as unknown as import('firebase/firestore').Timestamp,
      createdAt: now as unknown as import('firebase/firestore').Timestamp,
    };

    await f1Db.collection(F1_COLLECTIONS.RACE_RESULTS).doc(raceId).set(resultData);

    // Update race status to done
    await f1Db.collection(F1_COLLECTIONS.RACES).doc(raceId).update({
      status: 'done',
    });

    // Get all predictions for this race
    const predictionsSnapshot = await f1Db
      .collection(F1_COLLECTIONS.PREDICTIONS)
      .where('raceId', '==', raceId)
      .get();

    // Calculate points for each prediction
    const pointsUpdates: { userId: string; points: number; breakdown: F1PointsHistory['breakdown'] }[] = [];

    for (const predDoc of predictionsSnapshot.docs) {
      const prediction = predDoc.data() as F1Prediction;
      const { total, breakdown } = calculatePredictionPoints(prediction, resultData);

      pointsUpdates.push({
        userId: prediction.userId,
        points: total,
        breakdown,
      });

      // Lock the prediction
      await predDoc.ref.update({ isLocked: true });
    }

    // Update standings for each user
    for (const update of pointsUpdates) {
      const standingDocId = createStandingDocId(update.userId, result.season);
      const standingRef = f1Db.collection(F1_COLLECTIONS.STANDINGS).doc(standingDocId);
      const standingDoc = await standingRef.get();

      if (standingDoc.exists) {
        const existing = standingDoc.data() as F1Standing;
        const newRacePoints = { ...existing.racePoints, [raceId]: update.points };
        const newTotalPoints = Object.values(newRacePoints).reduce((a, b) => a + b, 0);

        await standingRef.update({
          totalPoints: newTotalPoints,
          racesParticipated: existing.racesParticipated + 1,
          racePoints: newRacePoints,
          lastRacePoints: update.points,
          lastRaceRound: result.round,
          updatedAt: now,
        });
      } else {
        // Create new standing
        const newStanding: F1Standing = {
          userId: update.userId,
          season: result.season,
          totalPoints: update.points,
          correctPredictions: 0, // TODO: Calculate this
          racesParticipated: 1,
          bestFinish: null,
          racePoints: { [raceId]: update.points },
          lastRacePoints: update.points,
          lastRaceRound: result.round,
          updatedAt: now as unknown as import('firebase/firestore').Timestamp,
        };

        await standingRef.set(newStanding);
      }

      // Save points history
      const historyRef = f1Db
        .collection(F1_COLLECTIONS.STANDINGS)
        .doc(standingDocId)
        .collection(F1_COLLECTIONS.POINTS_HISTORY)
        .doc(String(result.round));

      const historyData: F1PointsHistory = {
        round: result.round,
        raceId,
        points: update.points,
        breakdown: update.breakdown,
        calculatedAt: now as unknown as import('firebase/firestore').Timestamp,
      };

      await historyRef.set(historyData);
    }

    return NextResponse.json({
      success: true,
      data: {
        raceId,
        predictionsProcessed: pointsUpdates.length,
      },
    });
  } catch (error) {
    console.error('Error saving result:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save result' },
      { status: 500 }
    );
  }
}
