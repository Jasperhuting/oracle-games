import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1 } from '@/lib/firebase/server';

const f1Db = getServerFirebaseF1();

// GET /api/f1/participants?season=2026
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || '2026');

    const participantsSnapshot = await f1Db
      .collection('participants')
      .where('season', '==', season)
      .where('status', '==', 'active')
      .get();

    const participants = participantsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      participants,
      season,
    });
  } catch (error) {
    console.error('Error fetching F1 participants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}
