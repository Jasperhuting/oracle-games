import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1 } from '@/lib/firebase/server';
import { F1Race, F1_COLLECTIONS, createRaceDocId } from '../../types';

const f1Db = getServerFirebaseF1();

// GET /api/f1/races?season=2026
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());

    const racesRef = f1Db.collection(F1_COLLECTIONS.RACES);
    const snapshot = await racesRef
      .where('season', '==', season)
      .orderBy('round', 'asc')
      .get();

    const races = snapshot.docs.map(doc => doc.data() as F1Race);

    return NextResponse.json({ success: true, data: races });
  } catch (error) {
    console.error('Error fetching races:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch races' },
      { status: 500 }
    );
  }
}

// POST /api/f1/races (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { race } = body as { race: Omit<F1Race, 'createdAt'> };

    if (!race || race.round === undefined || !race.season) {
      return NextResponse.json(
        { success: false, error: 'Missing required race fields' },
        { status: 400 }
      );
    }

    const docId = createRaceDocId(race.season, race.round);
    const docRef = f1Db.collection(F1_COLLECTIONS.RACES).doc(docId);

    await docRef.set({
      ...race,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: { id: docId } });
  } catch (error) {
    console.error('Error creating race:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create race' },
      { status: 500 }
    );
  }
}
