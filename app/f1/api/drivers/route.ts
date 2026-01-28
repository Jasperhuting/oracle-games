import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1 } from '@/lib/firebase/server';
import { F1Driver, F1_COLLECTIONS, createDriverDocId } from '../../types';

const f1Db = getServerFirebaseF1();

// GET /api/f1/drivers?season=2026
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());

    const driversRef = f1Db.collection(F1_COLLECTIONS.DRIVERS);
    const snapshot = await driversRef
      .where('season', '==', season)
      .where('isActive', '==', true)
      .get();

    const drivers = snapshot.docs.map(doc => doc.data() as F1Driver);

    return NextResponse.json({ success: true, data: drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch drivers' },
      { status: 500 }
    );
  }
}

// POST /api/f1/drivers (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driver } = body as { driver: Omit<F1Driver, 'createdAt'> };

    if (!driver || !driver.shortName || !driver.season) {
      return NextResponse.json(
        { success: false, error: 'Missing required driver fields' },
        { status: 400 }
      );
    }

    const docId = createDriverDocId(driver.shortName, driver.season);
    const docRef = f1Db.collection(F1_COLLECTIONS.DRIVERS).doc(docId);

    await docRef.set({
      ...driver,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: { id: docId } });
  } catch (error) {
    console.error('Error creating driver:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create driver' },
      { status: 500 }
    );
  }
}
